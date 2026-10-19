import { Speaker } from "../types";

type FetchFn = typeof fetch;

export interface CaptionLine {
  id: string;
  speaker: Speaker;
  text: string;
}

export interface TranslationQueueOptions {
  meetingId?: string;
  /** Minimum gap between translation requests; keeps us inside free-tier RPM. */
  batchMs: number;
  maxLinesPerRequest?: number;
  onTranslated: (items: Array<{ id: string; romanUrdu: string }>) => void;
  onStatus?: (status: { state: "ok" | "cooldown" | "disabled"; message?: string }) => void;
  fetchImpl?: FetchFn;
  now?: () => number;
}

/**
 * Batches final caption lines and translates them to Roman Urdu with a few lines of prior
 * context. One request per `batchMs` at most; backs off on 429 and stops if no key is set.
 */
export class TranslationQueue {
  private pending: CaptionLine[] = [];
  private context: CaptionLine[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;
  private lastRequestAt = 0;
  private cooldownUntil = 0;
  private disabled = false;
  private stopped = false;

  constructor(private readonly opts: TranslationQueueOptions) {}

  private now(): number {
    return this.opts.now ? this.opts.now() : Date.now();
  }

  add(line: CaptionLine): void {
    if (this.disabled || this.stopped || !line.text.trim()) return;
    this.pending.push(line);
    this.schedule();
  }

  private schedule(): void {
    if (this.timer || this.busy || this.pending.length === 0 || this.stopped) return;
    const earliest = Math.max(this.lastRequestAt + this.opts.batchMs, this.cooldownUntil);
    const wait = Math.max(0, earliest - this.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, wait);
  }

  async flush(): Promise<void> {
    if (this.busy || this.pending.length === 0 || this.disabled || this.stopped) return;
    this.busy = true;
    const batch = this.pending.splice(0, this.opts.maxLinesPerRequest ?? 12);
    this.lastRequestAt = this.now();
    const doFetch = this.opts.fetchImpl ?? fetch;

    try {
      const res = await doFetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: this.opts.meetingId, lines: batch, context: this.context.slice(-4) }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        this.pending.unshift(...batch);
        const retry = Number(data.retryAfterMs) || 30000;
        this.cooldownUntil = this.now() + retry;
        this.opts.onStatus?.({ state: "cooldown", message: `Free-tier limit — Roman Urdu resumes in ${Math.ceil(retry / 1000)}s` });
      } else if (res.status === 503) {
        this.disabled = true;
        this.pending = [];
        this.opts.onStatus?.({ state: "disabled", message: data.error || "Translation unavailable" });
      } else if (!res.ok) {
        // Skip this batch rather than retrying forever on a bad response
        this.opts.onStatus?.({ state: "ok", message: data.error || `Translation failed (${res.status})` });
      } else {
        this.opts.onTranslated(data.items || []);
        this.context.push(...batch);
        this.context = this.context.slice(-4);
        this.opts.onStatus?.({ state: "ok" });
      }
    } catch {
      this.pending.unshift(...batch);
      this.cooldownUntil = this.now() + 5000;
    } finally {
      this.busy = false;
      this.schedule();
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
