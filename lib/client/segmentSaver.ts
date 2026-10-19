import { TranscriptEntry } from "../types";

type FetchFn = typeof fetch;

/**
 * Persists final transcript lines to the local database during a live call, in small
 * batches with retry, so a browser crash or refresh never loses the conversation.
 */
export class SegmentSaver {
  private queue: TranscriptEntry[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private failures = 0;

  constructor(
    private readonly meetingId: string,
    private readonly opts: { flushMs?: number; fetchImpl?: FetchFn; onError?: (msg: string | null) => void } = {}
  ) {}

  add(entry: TranscriptEntry): void {
    this.queue.push(entry);
    if (this.queue.length >= 10) void this.flush();
    else this.schedule(this.opts.flushMs ?? 1500);
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  private schedule(ms: number): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, ms);
  }

  async flush(): Promise<void> {
    if (this.inFlight) await this.inFlight;
    if (this.queue.length === 0) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const batch = this.queue.splice(0, 100);
    const doFetch = this.opts.fetchImpl ?? fetch;
    this.inFlight = (async () => {
      try {
        const res = await doFetch(`/api/meetings/${this.meetingId}/segments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            segments: batch.map((e) => ({
              id: e.id,
              speaker: e.speaker,
              text: e.text,
              timestamp: e.timestamp,
              durationMs: e.durationMs ?? null,
            })),
          }),
        });
        if (!res.ok) throw new Error(`save failed (${res.status})`);
        this.failures = 0;
        this.opts.onError?.(null);
      } catch (err) {
        // Put the batch back in front and retry with backoff
        this.queue.unshift(...batch);
        this.failures++;
        this.opts.onError?.(
          `Transcript not saved yet (${err instanceof Error ? err.message : "network error"}) — retrying`
        );
        this.schedule(Math.min(1000 * 2 ** this.failures, 20000));
      } finally {
        this.inFlight = null;
      }
    })();
    await this.inFlight;
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
