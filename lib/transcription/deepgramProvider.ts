import { TranscriptEntry } from "../types";
import {
  ProviderConnectOptions,
  StatusCallback,
  TranscriptCallback,
  TranscriptionProvider,
  TranscriptionStatus,
} from "./types";

const KEEPALIVE_INTERVAL_MS = 5000;
const MAX_KEYTERMS = 50;

export function buildDeepgramListenUrl(options: ProviderConnectOptions): string {
  const sampleRate = options.sampleRate || 16000;
  // Nova-3: "multi" = code-switching (en/es/fr/de/hi/ru/pt/ja/it/nl). Urdu is monolingual only.
  const lang =
    options.language === "ur" ? "ur" : options.language === "auto" ? "multi" : "en";

  const params = new URLSearchParams({
    model: "nova-3",
    multichannel: "true",
    channels: "2",
    encoding: "linear16",
    sample_rate: sampleRate.toString(),
    interim_results: "true",
    punctuate: "true",
    smart_format: "true",
    endpointing: "300",
    language: lang,
  });

  const keyterms = (options.keyterms || [])
    .map((k) => k.trim())
    .filter((k) => k.length > 1)
    .slice(0, MAX_KEYTERMS);
  for (const term of new Set(keyterms)) {
    params.append("keyterm", term);
  }

  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}

export class DeepgramTranscriptionProvider implements TranscriptionProvider {
  private socket: WebSocket | null = null;
  private status: TranscriptionStatus = "idle";
  private transcriptCallbacks: TranscriptCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];
  private options: ProviderConnectOptions = {};
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 8;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private isIntentionallyClosed: boolean = false;
  private isPaused: boolean = false;
  private streamStartedAt: number = 0; // wall clock when the current socket opened
  private currentUtteranceMap = new Map<number, { id: string; startTime: number }>();

  public async connect(options: ProviderConnectOptions): Promise<void> {
    this.options = options;
    this.isIntentionallyClosed = false;
    this.isPaused = false;
    this.reconnectAttempts = 0;

    await this.initSocket();
  }

  private async fetchToken(): Promise<{ token: string; scheme: string } | null> {
    if (this.options.token) return { token: this.options.token, scheme: "token" };
    try {
      const res = await fetch("/api/stt-token?provider=deepgram");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        throw new Error(data.error || `Failed to obtain STT token (${res.status})`);
      }
      return { token: data.token, scheme: data.scheme || "bearer" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to obtain token";
      this.setStatus("error", msg);
      return null;
    }
  }

  private async initSocket(): Promise<void> {
    this.setStatus("connecting");

    // Always mint a fresh short-lived token: a cached one would be expired on reconnect.
    const auth = await this.fetchToken();
    if (!auth || this.isIntentionallyClosed) return;

    try {
      this.socket = new WebSocket(buildDeepgramListenUrl(this.options), [auth.scheme, auth.token]);
      this.socket.binaryType = "arraybuffer";

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.streamStartedAt = Date.now();
        this.currentUtteranceMap.clear();
        this.startKeepAlive();
        this.setStatus(this.isPaused ? "paused" : "listening");
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.socket.onerror = (event) => {
        console.error("Deepgram WebSocket error:", event);
      };

      this.socket.onclose = (event) => {
        this.stopKeepAlive();
        if (!this.isIntentionallyClosed) {
          this.handleUnexpectedClose(event.reason || `Connection dropped (code ${event.code})`);
        } else {
          this.setStatus("disconnected");
        }
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Socket initialization error";
      this.setStatus("error", msg);
    }
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    // Deepgram closes idle streams after ~10s without audio; while paused we send no audio.
    this.keepAliveInterval = setInterval(() => {
      if (this.isPaused && this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "KeepAlive" }));
      }
    }, KEEPALIVE_INTERVAL_MS);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  private handleMessage(data: string | ArrayBuffer): void {
    if (typeof data !== "string") return;

    try {
      const parsed = JSON.parse(data);
      if (parsed.type && parsed.type !== "Results") return;

      const alt = parsed.channel?.alternatives?.[0];
      const transcript = alt?.transcript?.trim();
      if (!transcript) return;

      // channel_index is [channel, total_channels]
      const channelIndex = Array.isArray(parsed.channel_index) ? parsed.channel_index[0] : 0;
      const isFinal = Boolean(parsed.is_final);
      const speaker = channelIndex === 1 ? "client" : "team";

      let utteranceInfo = this.currentUtteranceMap.get(channelIndex);
      if (!utteranceInfo) {
        const startSec = typeof parsed.start === "number" ? parsed.start : null;
        const startTime =
          startSec !== null && this.streamStartedAt
            ? this.streamStartedAt + Math.round(startSec * 1000)
            : Date.now();
        utteranceInfo = {
          id: `dg-${startTime}-ch${channelIndex}-${Math.random().toString(36).slice(2, 6)}`,
          startTime,
        };
        this.currentUtteranceMap.set(channelIndex, utteranceInfo);
      }

      const entry: TranscriptEntry = {
        id: utteranceInfo.id,
        speaker,
        text: transcript,
        timestamp: utteranceInfo.startTime,
        durationMs:
          typeof parsed.duration === "number" ? Math.round(parsed.duration * 1000) : undefined,
        isFinal,
        channel: channelIndex === 1 ? 1 : 0,
      };

      if (isFinal) {
        // Next segment on this channel gets a fresh id
        this.currentUtteranceMap.delete(channelIndex);
      }

      for (const cb of this.transcriptCallbacks) {
        cb(entry);
      }
    } catch (err) {
      console.warn("Failed to parse Deepgram message:", err);
    }
  }

  private handleUnexpectedClose(reason: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
      this.setStatus(
        "connecting",
        `Reconnecting in ${Math.round(backoffMs / 1000)}s (attempt ${this.reconnectAttempts})...`
      );

      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        this.initSocket();
      }, backoffMs);
    } else {
      this.setStatus("error", `Connection closed: ${reason}. Max reconnect attempts reached.`);
    }
  }

  public sendAudio(pcmChunk: Int16Array): void {
    if (this.isPaused) return; // paused means nothing leaves the browser
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(pcmChunk.buffer);
    }
  }

  public disconnect(): void {
    this.isIntentionallyClosed = true;
    this.stopKeepAlive();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        // Ask Deepgram to flush pending finals before closing
        try {
          this.socket.send(JSON.stringify({ type: "CloseStream" }));
        } catch {}
      }
      this.socket.close();
      this.socket = null;
    }
    this.setStatus("disconnected");
  }

  public pause(): void {
    this.isPaused = true;
    if (this.socket?.readyState === WebSocket.OPEN) {
      // Flush whatever was being said so it doesn't hang as interim
      try {
        this.socket.send(JSON.stringify({ type: "Finalize" }));
      } catch {}
    }
    this.setStatus("paused");
  }

  public resume(): void {
    this.isPaused = false;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.setStatus("listening");
    } else if (!this.reconnectTimeout) {
      this.reconnectAttempts = 0;
      this.initSocket();
    }
  }

  public onTranscript(callback: TranscriptCallback): void {
    this.transcriptCallbacks.push(callback);
  }

  public onStatusChange(callback: StatusCallback): void {
    this.statusCallbacks.push(callback);
  }

  public getStatus(): TranscriptionStatus {
    return this.status;
  }

  private setStatus(status: TranscriptionStatus, errorDetail?: string): void {
    this.status = status;
    for (const cb of this.statusCallbacks) {
      cb(status, errorDetail);
    }
  }
}
