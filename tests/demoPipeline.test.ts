import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DemoTranscriptionProvider } from "@/lib/transcription/demoProvider";
import { DEMO_CALL_SCRIPT } from "@/lib/transcription/demoScript";
import { TranscriptEntry } from "@/lib/types";

describe("Demo Mode Interactive Streaming Pipeline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("plays scripted demo steps through the provider with speaker separation", async () => {
    const miniScript = DEMO_CALL_SCRIPT.slice(0, 2);
    const provider = new DemoTranscriptionProvider(miniScript);

    const receivedEntries: TranscriptEntry[] = [];
    provider.onTranscript((entry) => {
      receivedEntries.push(entry);
    });

    const connectPromise = provider.connect({ speedMultiplier: 10 });
    // Advance connection setup
    vi.advanceTimersByTime(500);
    await connectPromise;

    expect(provider.getStatus()).toBe("listening");

    // Advance time to allow interim words and first utterance to finish
    vi.advanceTimersByTime(2000);

    expect(receivedEntries.length).toBeGreaterThan(0);

    // Verify first step was team speaker
    const finalFirst = receivedEntries.find(
      (e) => e.isFinal && e.speaker === "team"
    );
    expect(finalFirst).toBeDefined();
    expect(finalFirst?.channel).toBe(0);

    // Advance to play second step (client speaker)
    vi.advanceTimersByTime(3000);

    const finalSecond = receivedEntries.find(
      (e) => e.isFinal && e.speaker === "client"
    );
    expect(finalSecond).toBeDefined();
    expect(finalSecond?.channel).toBe(1);
    expect(finalSecond?.text).toContain("Salesforce");

    provider.disconnect();
    expect(provider.getStatus()).toBe("disconnected");
  });

  it("supports pause and resume during playback", async () => {
    const miniScript = DEMO_CALL_SCRIPT.slice(0, 1);
    const provider = new DemoTranscriptionProvider(miniScript);

    const received: TranscriptEntry[] = [];
    provider.onTranscript((e) => received.push(e));

    const connectPromise = provider.connect({ speedMultiplier: 10 });
    vi.advanceTimersByTime(500);
    await connectPromise;

    provider.pause();
    expect(provider.getStatus()).toBe("paused");

    const countAtPause = received.length;
    vi.advanceTimersByTime(2000);
    expect(received.length).toBe(countAtPause);

    provider.resume();
    expect(provider.getStatus()).toBe("listening");

    provider.disconnect();
  });
});
