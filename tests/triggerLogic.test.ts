import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AnalysisTriggerController } from "@/lib/analysis/triggerLogic";
import { TranscriptEntry } from "@/lib/types";

describe("Analysis Trigger & Concurrency Controller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not trigger when speaker is team or speech is not final", () => {
    const controller = new AnalysisTriggerController({ debounceMs: 1000, minIntervalMs: 2000 });
    const triggerFn = vi.fn().mockResolvedValue(undefined);

    const teamEntry: TranscriptEntry = {
      id: "1",
      speaker: "team",
      text: "Our team can handle that.",
      timestamp: Date.now(),
      isFinal: true,
      channel: 0,
    };

    const clientInterim: TranscriptEntry = {
      id: "2",
      speaker: "client",
      text: "We need an MCP server...",
      timestamp: Date.now(),
      isFinal: false,
      channel: 1,
    };

    expect(controller.handleUtterance(teamEntry, triggerFn)).toBe(false);
    expect(controller.handleUtterance(clientInterim, triggerFn)).toBe(false);

    vi.advanceTimersByTime(2000);
    expect(triggerFn).not.toHaveBeenCalled();
  });

  it("debounces client utterance after silence threshold", async () => {
    const controller = new AnalysisTriggerController({ debounceMs: 2000, minIntervalMs: 3000 });
    const triggerFn = vi.fn().mockResolvedValue(undefined);

    const clientFinal1: TranscriptEntry = {
      id: "c1",
      speaker: "client",
      text: "Can we use Anthropic MCP?",
      timestamp: Date.now(),
      isFinal: true,
      channel: 1,
    };

    controller.handleUtterance(clientFinal1, triggerFn);

    // After 1000ms (before debounce expires), client adds another utterance
    vi.advanceTimersByTime(1000);
    expect(triggerFn).not.toHaveBeenCalled();

    const clientFinal2: TranscriptEntry = {
      id: "c2",
      speaker: "client",
      text: "And also vector search for 100k notes?",
      timestamp: Date.now(),
      isFinal: true,
      channel: 1,
    };

    controller.handleUtterance(clientFinal2, triggerFn);

    // Another 1000ms: still within new debounce
    vi.advanceTimersByTime(1000);
    expect(triggerFn).not.toHaveBeenCalled();

    // Advance remaining 1000ms to hit 2000ms debounce
    vi.advanceTimersByTime(1000);
    expect(triggerFn).toHaveBeenCalledTimes(1);
  });

  it("aborts active in-flight request when newer utterance executes", async () => {
    const controller = new AnalysisTriggerController({ debounceMs: 500, minIntervalMs: 1000 });

    let receivedSignal1: AbortSignal | null = null;
    const triggerFn1 = vi.fn().mockImplementation((signal: AbortSignal) => {
      receivedSignal1 = signal;
      return new Promise((resolve) => setTimeout(resolve, 5000));
    });

    const client1: TranscriptEntry = {
      id: "1",
      speaker: "client",
      text: "First question",
      timestamp: Date.now(),
      isFinal: true,
      channel: 1,
    };

    controller.handleUtterance(client1, triggerFn1);
    vi.advanceTimersByTime(500);

    expect(triggerFn1).toHaveBeenCalledTimes(1);
    expect(receivedSignal1!.aborted).toBe(false);

    // Later client utterance arrives after minInterval
    vi.advanceTimersByTime(1100);

    const triggerFn2 = vi.fn().mockResolvedValue(undefined);
    const client2: TranscriptEntry = {
      id: "2",
      speaker: "client",
      text: "Second question superseding first",
      timestamp: Date.now(),
      isFinal: true,
      channel: 1,
    };

    controller.handleUtterance(client2, triggerFn2);
    vi.advanceTimersByTime(500);

    // Previous signal should be aborted!
    expect(receivedSignal1!.aborted).toBe(true);
    expect(triggerFn2).toHaveBeenCalledTimes(1);
  });

  it("cancelPending halts active timers", () => {
    const controller = new AnalysisTriggerController({ debounceMs: 1000 });
    const triggerFn = vi.fn().mockResolvedValue(undefined);

    const clientEntry: TranscriptEntry = {
      id: "c",
      speaker: "client",
      text: "Hello",
      timestamp: Date.now(),
      isFinal: true,
      channel: 1,
    };

    controller.handleUtterance(clientEntry, triggerFn);
    controller.cancelPending();

    vi.advanceTimersByTime(2000);
    expect(triggerFn).not.toHaveBeenCalled();
  });
});
