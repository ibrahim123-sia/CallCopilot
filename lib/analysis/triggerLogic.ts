import { TranscriptEntry } from "../types";

export interface TriggerOptions {
  debounceMs?: number; // silence debounce after client finishes
  minIntervalMs?: number; // minimum time between analysis invocations
}

export class AnalysisTriggerController {
  private debounceMs: number;
  private minIntervalMs: number;
  private lastTriggerTime: number = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private currentAbortController: AbortController | null = null;
  private isAnalyzing: boolean = false;
  private pendingRequest: (() => Promise<void>) | null = null;

  constructor(options: TriggerOptions = {}) {
    this.debounceMs = options.debounceMs ?? 2000;
    this.minIntervalMs = options.minIntervalMs ?? 5000;
  }

  /**
   * Called whenever a transcript entry arrives.
   * Only triggers when the entry is from the client, isFinal, and contains substantive text.
   */
  public handleUtterance(
    entry: TranscriptEntry,
    triggerAction: (abortSignal: AbortSignal) => Promise<void>
  ): boolean {
    if (entry.speaker !== "client" || !entry.isFinal || !entry.text.trim()) {
      return false;
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      this.scheduleOrExecute(triggerAction);
    }, this.debounceMs);

    return true;
  }

  private async scheduleOrExecute(
    triggerAction: (abortSignal: AbortSignal) => Promise<void>
  ): Promise<void> {
    const now = Date.now();
    const timeSinceLast = now - this.lastTriggerTime;

    if (timeSinceLast < this.minIntervalMs) {
      // Delay until minimum interval elapses
      const waitRemaining = this.minIntervalMs - timeSinceLast;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.scheduleOrExecute(triggerAction);
      }, waitRemaining);
      return;
    }

    // Cancel in-flight older analysis if active
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }

    const abortController = new AbortController();
    this.currentAbortController = abortController;
    this.lastTriggerTime = Date.now();
    this.isAnalyzing = true;

    try {
      await triggerAction(abortController.signal);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // Expected cancellation
        return;
      }
      throw err;
    } finally {
      if (this.currentAbortController === abortController) {
        this.currentAbortController = null;
        this.isAnalyzing = false;
      }
    }
  }

  public cancelPending(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    this.isAnalyzing = false;
    this.pendingRequest = null;
  }

  public getIsAnalyzing(): boolean {
    return this.isAnalyzing;
  }

  public reset(): void {
    this.cancelPending();
    this.lastTriggerTime = 0;
  }
}
