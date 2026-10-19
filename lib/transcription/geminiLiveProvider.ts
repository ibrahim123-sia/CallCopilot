import { Speaker, TranscriptEntry } from "../types";
import {
  ProviderConnectOptions,
  StatusCallback,
  TranscriptCallback,
  TranscriptionProvider,
  TranscriptionStatus,
} from "./types";
import { buildLiveSessionConfig, cleanVocabulary, LiveLanguage } from "./geminiLiveConfig";

export { languageCodesFor } from "./geminiLiveConfig";

/**
 * Free real-time speech-to-text via the Gemini Live API (gemini-3.5-transcribe-live).
 *
 * The model has no speaker diarization, so we keep the existing dual-channel design and run
 * one session per channel: channel 0 = our microphone ("team"), channel 1 = the meeting tab
 * ("client"). Each Live session is capped at ~10 minutes, so sessions are rotated before that
 * with a short overlap, and reconnected with a fresh single-use token after any drop.
 */

const WS_BASE =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";
const SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 1600; // 100 ms at 16 kHz
const ROTATE_AFTER_MS = 8.5 * 60 * 1000;
const OLD_SESSION_DRAIN_MS = 4000;
const MAX_PENDING_SAMPLES = SAMPLE_RATE * 5; // buffer at most 5 s while a session is opening
const MAX_RECONNECTS = 8;

export function int16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

/** Splits interleaved stereo PCM into one mono buffer per channel. */
export function deinterleave(stereo: Int16Array): [Int16Array, Int16Array] {
  const frames = stereo.length >> 1;
  const left = new Int16Array(frames);
  const right = new Int16Array(frames);
  for (let i = 0; i < frames; i++) {
    left[i] = stereo[i * 2];
    right[i] = stereo[i * 2 + 1];
  }
  return [left, right];
}

/**
 * Interim updates are the full hypothesis for the current segment so far (measured), and the
 * model sometimes revises earlier words — so the newest update replaces the old one.
 */
export function mergeInterim(current: string, incoming: string): string {
  return incoming.trim() || current;
}

type SessionEvents = {
  onReady: (s: ChannelSession) => void;
  onInterim: (s: ChannelSession, text: string) => void;
  onFinal: (s: ChannelSession, text: string) => void;
  onGoAway: (s: ChannelSession) => void;
  onClosed: (s: ChannelSession, reason: string, unexpected: boolean) => void;
};

class ChannelSession {
  ws: WebSocket | null = null;
  ready = false;
  closing = false;
  openedAt = 0;
  private pending: Int16Array[] = [];
  private pendingSamples = 0;

  constructor(
    private readonly setup: Record<string, unknown>,
    private readonly events: SessionEvents
  ) {}

  async open(token: string): Promise<void> {
    this.ws = new WebSocket(`${WS_BASE}?access_token=${encodeURIComponent(token)}`);
    this.ws.onopen = () => {
      this.openedAt = Date.now();
      this.ws?.send(JSON.stringify({ setup: this.setup }));
    };
    this.ws.onmessage = async (event) => {
      const raw = typeof event.data === "string" ? event.data : await (event.data as Blob).text();
      this.handleMessage(raw);
    };
    this.ws.onclose = (event) => {
      const wasClosing = this.closing;
      this.ready = false;
      this.ws = null;
      this.events.onClosed(this, event.reason || `code ${event.code}`, !wasClosing);
    };
    this.ws.onerror = () => {
      // onclose follows with details
    };
  }

  private handleMessage(raw: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if ("setupComplete" in msg) {
      this.ready = true;
      this.flushPending();
      this.events.onReady(this);
      return;
    }
    if (msg.goAway) {
      this.events.onGoAway(this);
      return;
    }
    const sc = msg.serverContent as
      | { interimInputTranscription?: { text?: string }; inputTranscription?: { text?: string } }
      | undefined;
    if (!sc) return;
    if (sc.interimInputTranscription?.text) this.events.onInterim(this, sc.interimInputTranscription.text);
    if (sc.inputTranscription?.text) this.events.onFinal(this, sc.inputTranscription.text);
  }

  send(samples: Int16Array): void {
    if (this.closing) return;
    if (!this.ready || this.ws?.readyState !== WebSocket.OPEN) {
      this.pending.push(samples);
      this.pendingSamples += samples.length;
      while (this.pendingSamples > MAX_PENDING_SAMPLES && this.pending.length) {
        this.pendingSamples -= this.pending.shift()!.length;
      }
      return;
    }
    this.ws.send(
      JSON.stringify({
        realtimeInput: { audio: { data: int16ToBase64(samples), mimeType: `audio/pcm;rate=${SAMPLE_RATE}` } },
      })
    );
  }

  private flushPending(): void {
    const queued = this.pending;
    this.pending = [];
    this.pendingSamples = 0;
    for (const chunk of queued) this.send(chunk);
  }

  /** Asks the server to finalize what it has heard so far (keeps the session open). */
  flush(): void {
    try {
      if (this.ready && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
      }
    } catch {}
  }

  /** Ends the audio stream so the server flushes the last final transcript, then closes. */
  drainAndClose(delayMs = OLD_SESSION_DRAIN_MS): void {
    if (this.closing) return;
    this.closing = true;
    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
      }
    } catch {}
    setTimeout(() => this.ws?.close(), delayMs);
  }

  closeNow(): void {
    this.closing = true;
    this.ws?.close();
  }
}

/** One logical speaker channel; owns the active session and its replacement during rotation. */
class ChannelController {
  active: ChannelSession | null = null;
  private next: ChannelSession | null = null;
  private rotateTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnects = 0;
  private buffer: Int16Array[] = [];
  private buffered = 0;
  private utterance: { id: string; start: number; interim: string } | null = null;
  stopped = false;

  constructor(
    private readonly speaker: Speaker,
    private readonly channel: 0 | 1,
    private readonly setup: Record<string, unknown>,
    private readonly fetchToken: () => Promise<string>,
    private readonly emit: (entry: TranscriptEntry) => void,
    private readonly report: (status: TranscriptionStatus, detail?: string) => void
  ) {}

  async start(): Promise<void> {
    this.stopped = false;
    await this.createSession("active");
  }

  /**
   * Creates a session and assigns it to its role *before* connecting, so a fast setupComplete
   * is never missed and audio sent meanwhile is buffered by the session instead of dropped.
   */
  private async createSession(role: "active" | "next"): Promise<void> {
    const session = new ChannelSession(this.setup, {
      onReady: (s) => this.handleReady(s),
      onInterim: (s, text) => this.handleInterim(text),
      onFinal: (s, text) => this.handleFinal(text),
      onGoAway: (s) => {
        if (s === this.active) this.rotate();
      },
      onClosed: (s, reason, unexpected) => this.handleClosed(s, reason, unexpected),
    });
    if (role === "active") this.active = session;
    else this.next = session;
    const stillWanted = () => !this.stopped && (role === "active" ? this.active : this.next) === session;
    try {
      const token = await this.fetchToken();
      if (!stillWanted()) return;
      await session.open(token);
    } catch (err) {
      if (role === "active" && this.active === session) this.active = null;
      if (role === "next" && this.next === session) this.next = null;
      throw err;
    }
  }

  private handleReady(session: ChannelSession): void {
    this.reconnects = 0;
    if (session === this.next) {
      // Rotation complete: switch traffic to the new session, let the old one drain
      const old = this.active;
      this.active = session;
      this.next = null;
      old?.drainAndClose();
    }
    if (session === this.active) {
      this.scheduleRotation();
      this.report("listening");
    }
  }

  private scheduleRotation(): void {
    if (this.rotateTimer) clearTimeout(this.rotateTimer);
    this.rotateTimer = setTimeout(() => this.rotate(), ROTATE_AFTER_MS);
  }

  private async rotate(): Promise<void> {
    if (this.stopped || this.next) return;
    try {
      await this.createSession("next");
    } catch (err) {
      console.warn("Session rotation failed, will retry:", err);
      this.rotateTimer = setTimeout(() => this.rotate(), 15000);
    }
  }

  private handleClosed(session: ChannelSession, reason: string, unexpected: boolean): void {
    if (session === this.next) this.next = null;
    if (session !== this.active || this.stopped || !unexpected) return;

    this.active = null;
    this.scheduleReconnect(reason);
  }

  private scheduleReconnect(reason: string): void {
    if (this.stopped) return;
    if (this.reconnects >= MAX_RECONNECTS) {
      this.report("error", `Transcription connection lost: ${reason}`);
      return;
    }
    this.reconnects++;
    const quota = /quota|resource_exhausted|rate.?limit/i.test(reason);
    // Back off much longer when the free-tier quota is the cause
    const delay = quota ? 30000 : Math.min(1000 * 2 ** (this.reconnects - 1), 15000);
    this.report(
      "connecting",
      quota ? `Gemini free-tier limit hit, retrying in ${delay / 1000}s...` : `Reconnecting (${reason})...`
    );
    this.reconnectTimer = setTimeout(async () => {
      if (this.stopped) return;
      try {
        await this.createSession("active");
      } catch (err) {
        this.scheduleReconnect(err instanceof Error ? err.message : "token error");
      }
    }, delay);
  }

  private handleInterim(text: string): void {
    if (!this.utterance) this.utterance = { id: this.newId(), start: Date.now(), interim: "" };
    this.utterance.interim = mergeInterim(this.utterance.interim, text);
    this.emit({
      id: this.utterance.id,
      speaker: this.speaker,
      text: this.utterance.interim,
      timestamp: this.utterance.start,
      isFinal: false,
      channel: this.channel,
    });
  }

  private handleFinal(text: string): void {
    const clean = text.trim();
    const u = this.utterance ?? { id: this.newId(), start: Date.now(), interim: "" };
    this.utterance = null;
    if (!clean) return;
    this.emit({
      id: u.id,
      speaker: this.speaker,
      text: clean,
      timestamp: u.start,
      durationMs: Math.max(0, Date.now() - u.start),
      isFinal: true,
      channel: this.channel,
    });
  }

  private newId(): string {
    return `gl-${Date.now()}-ch${this.channel}-${Math.random().toString(36).slice(2, 6)}`;
  }

  push(samples: Int16Array): void {
    this.buffer.push(samples);
    this.buffered += samples.length;
    if (this.buffered < CHUNK_SAMPLES) return;
    const merged = new Int16Array(this.buffered);
    let offset = 0;
    for (const b of this.buffer) {
      merged.set(b, offset);
      offset += b.length;
    }
    this.buffer = [];
    this.buffered = 0;
    this.active?.send(merged);
  }

  /** Finalize the in-progress utterance, e.g. when the user pauses. */
  flush(): void {
    this.active?.flush();
  }

  /** Reopen a channel whose session was lost while paused. */
  async restart(): Promise<void> {
    this.stopAll(true);
    await this.start();
  }

  stopAll(drain: boolean): void {
    this.stopped = true;
    if (this.rotateTimer) clearTimeout(this.rotateTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.rotateTimer = this.reconnectTimer = null;
    for (const s of [this.active, this.next]) {
      if (!s) continue;
      if (drain) s.drainAndClose(3000);
      else s.closeNow();
    }
    this.active = this.next = null;
    this.buffer = [];
    this.buffered = 0;
  }
}

export class GeminiLiveTranscriptionProvider implements TranscriptionProvider {
  private status: TranscriptionStatus = "idle";
  private transcriptCallbacks: TranscriptCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];
  private channels: ChannelController[] = [];
  private isPaused = false;
  private options: ProviderConnectOptions = {};

  constructor(private readonly tokenUrl = "/api/stt-token?provider=gemini") {}

  private async fetchToken(): Promise<string> {
    // The token locks the session config, so it must be created with our language + vocabulary
    const res = await fetch(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: this.options.language ?? "en",
        vocabulary: cleanVocabulary(this.options.keyterms),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) {
      const message = data.error || `Could not get a transcription token (${res.status})`;
      this.setStatus("error", message);
      throw new Error(message);
    }
    this.model = data.model || this.model;
    return data.token;
  }

  private model = "gemini-3.5-transcribe-live";

  public async connect(options: ProviderConnectOptions): Promise<void> {
    this.options = options;
    this.isPaused = false;
    this.setStatus("connecting");

    // Resolve the model name from the token endpoint before building setup messages
    const firstToken = await this.fetchToken();

    // Same config as locked into the token (the server ignores anything that differs)
    const { responseModalities, ...sessionConfig } = buildLiveSessionConfig({
      language: options.language as LiveLanguage | undefined,
      vocabulary: options.keyterms,
    });
    const setup = {
      model: `models/${this.model}`,
      generationConfig: { responseModalities },
      ...sessionConfig,
    };

    const speakers: Array<{ speaker: Speaker; channel: 0 | 1 }> = options.multichannel === false
      ? [{ speaker: "team", channel: 0 }]
      : [
          { speaker: "team", channel: 0 },
          { speaker: "client", channel: 1 },
        ];

    let tokenForFirst: string | null = firstToken;
    this.channels = speakers.map(
      ({ speaker, channel }) =>
        new ChannelController(
          speaker,
          channel,
          setup,
          async () => {
            // Reuse the token we already fetched for the very first session
            if (tokenForFirst) {
              const t = tokenForFirst;
              tokenForFirst = null;
              return t;
            }
            return this.fetchToken();
          },
          (entry) => this.transcriptCallbacks.forEach((cb) => cb(entry)),
          (status, detail) => {
            if (this.isPaused && status === "listening") return;
            this.setStatus(status, detail);
          }
        )
    );

    await Promise.all(this.channels.map((c) => c.start()));
  }

  public sendAudio(pcm: Int16Array): void {
    if (this.isPaused || this.channels.length === 0) return;
    const [left, right] = deinterleave(pcm);
    this.channels[0]?.push(left);
    this.channels[1]?.push(right);
  }

  public disconnect(): void {
    for (const c of this.channels) c.stopAll(true);
    this.channels = [];
    this.setStatus("disconnected");
  }

  public pause(): void {
    this.isPaused = true;
    // Docs: when audio pauses for more than a second, send audioStreamEnd to flush cached audio
    for (const c of this.channels) c.flush();
    this.setStatus("paused");
  }

  public resume(): void {
    this.isPaused = false;
    // Sessions can time out while idle; reopen any channel that has no live session.
    for (const c of this.channels) {
      if (!c.active) c.restart().catch(() => {});
    }
    this.setStatus("listening");
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

  private setStatus(status: TranscriptionStatus, detail?: string): void {
    this.status = status;
    this.statusCallbacks.forEach((cb) => cb(status, detail));
  }
}
