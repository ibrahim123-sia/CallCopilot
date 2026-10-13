import { TranscriptEntry } from "../types";
import {
  ProviderConnectOptions,
  StatusCallback,
  TranscriptCallback,
  TranscriptionProvider,
  TranscriptionStatus,
} from "./types";

export class DeepgramTranscriptionProvider implements TranscriptionProvider {
  private socket: WebSocket | null = null;
  private status: TranscriptionStatus = "idle";
  private transcriptCallbacks: TranscriptCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];
  private token: string | null = null;
  private options: ProviderConnectOptions = {};
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isIntentionallyClosed: boolean = false;
  private currentUtteranceMap = new Map<number, { id: string; startTime: number }>();

  public async connect(options: ProviderConnectOptions): Promise<void> {
    this.options = options;
    this.token = options.token || null;
    this.isIntentionallyClosed = false;
    this.reconnectAttempts = 0;

    await this.initSocket();
  }

  private async initSocket(): Promise<void> {
    if (!this.token) {
      // Fetch token from server endpoint
      try {
        this.setStatus("connecting");
        const res = await fetch("/api/stt-token");
        if (!res.ok) {
          throw new Error(`Failed to obtain STT token: ${res.statusText}`);
        }
        const data = await res.json();
        this.token = data.key || data.token;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to obtain token";
        this.setStatus("error", msg);
        return;
      }
    }

    this.setStatus("connecting");

    const sampleRate = this.options.sampleRate || 16000;
    const lang = this.options.language === "ur" ? "ur" : this.options.language === "auto" ? "en" : "en-US";

    const queryParams = new URLSearchParams({
      model: "nova-2",
      multichannel: "true",
      channels: "2",
      encoding: "linear16",
      sample_rate: sampleRate.toString(),
      interim_results: "true",
      punctuate: "true",
      endpointing: "300",
      language: lang,
    });

    const url = `wss://api.deepgram.com/v1/listen?${queryParams.toString()}`;

    try {
      // In browser, Deepgram supports passing auth token via subprotocol
      this.socket = new WebSocket(url, ["token", this.token!]);

      this.socket.binaryType = "arraybuffer";

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus("listening");
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.socket.onerror = (event) => {
        console.error("Deepgram WebSocket error:", event);
        this.setStatus("error", "Transcription connection error");
      };

      this.socket.onclose = (event) => {
        if (!this.isIntentionallyClosed) {
          this.handleUnexpectedClose(event.reason || "Connection dropped");
        } else {
          this.setStatus("disconnected");
        }
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Socket initialization error";
      this.setStatus("error", msg);
    }
  }

  private handleMessage(data: string | ArrayBuffer): void {
    if (typeof data !== "string") return;

    try {
      const parsed = JSON.parse(data);
      const alt = parsed.channel?.alternatives?.[0];
      const transcript = alt?.transcript?.trim();

      if (!transcript) return;

      // Extract channel: channel_index is typically [channel, total_channels]
      const channelIndex = Array.isArray(parsed.channel_index)
        ? parsed.channel_index[0]
        : 0;

      const isFinal = Boolean(parsed.is_final || parsed.speech_final);
      const speaker = channelIndex === 1 ? "client" : "team";

      let utteranceInfo = this.currentUtteranceMap.get(channelIndex);
      if (!utteranceInfo) {
        utteranceInfo = {
          id: `dg-${Date.now()}-ch${channelIndex}`,
          startTime: Date.now(),
        };
        this.currentUtteranceMap.set(channelIndex, utteranceInfo);
      }

      const entry: TranscriptEntry = {
        id: utteranceInfo.id,
        speaker,
        text: transcript,
        timestamp: utteranceInfo.startTime,
        isFinal,
        channel: channelIndex === 1 ? 1 : 0,
      };

      if (isFinal) {
        // Reset utterance id for next turn on this channel
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
      const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      this.setStatus(
        "connecting",
        `Reconnecting in ${Math.round(backoffMs / 1000)}s (attempt ${this.reconnectAttempts})...`
      );

      this.reconnectTimeout = setTimeout(() => {
        this.initSocket();
      }, backoffMs);
    } else {
      this.setStatus(
        "error",
        `Connection closed: ${reason}. Max reconnect attempts reached.`
      );
    }
  }

  public sendAudio(pcmChunk: Int16Array): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(pcmChunk.buffer);
    }
  }

  public disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus("disconnected");
  }

  public pause(): void {
    this.setStatus("paused");
  }

  public resume(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.setStatus("listening");
    } else {
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
