import { describe, it, expect } from "vitest";
import {
  formatTranscriptForPrompt,
  partitionTranscriptWindow,
  truncateTranscriptBuffer,
} from "@/lib/analysis/contextBuilder";
import { TranscriptEntry } from "@/lib/types";

describe("Context Builder & Transcript Formatting", () => {
  it("formats transcript entries with timestamps and speaker labels", () => {
    const entries: TranscriptEntry[] = [
      {
        id: "1",
        speaker: "team",
        text: "Welcome Alex.",
        timestamp: 1700000000000,
        isFinal: true,
        channel: 0,
      },
      {
        id: "2",
        speaker: "client",
        text: "Thanks, excited to discuss MCP.",
        timestamp: 1700000010000,
        isFinal: true,
        channel: 1,
      },
    ];

    const formatted = formatTranscriptForPrompt(entries);
    expect(formatted).toContain("Our Team: Welcome Alex.");
    expect(formatted).toContain("Client: Thanks, excited to discuss MCP.");
  });

  it("handles empty transcript gracefully", () => {
    expect(formatTranscriptForPrompt([])).toBe("(No speech recorded yet)");
  });

  it("partitions transcript window correctly", () => {
    const baseTime = 1000000;
    const entries: TranscriptEntry[] = [];

    // Create 10 entries spanning 10 minutes (600,000ms)
    for (let i = 0; i < 10; i++) {
      entries.push({
        id: `entry-${i}`,
        speaker: i % 2 === 0 ? "team" : "client",
        text: `Turn ${i}`,
        timestamp: baseTime + i * 60000,
        isFinal: true,
        channel: i % 2 === 0 ? 0 : 1,
      });
    }

    // 4-minute window (240,000ms) from latest timestamp (baseTime + 540,000)
    const { recent, older } = partitionTranscriptWindow(entries, 240000);

    expect(recent.length).toBeGreaterThan(0);
    expect(older.length).toBeGreaterThan(0);
    expect(recent.length + older.length).toBe(10);
    // Recent entries should be the latest ones
    expect(recent[recent.length - 1].id).toBe("entry-9");
  });

  it("truncates long transcript buffers to maxChars limit", () => {
    const shortText = "Short transcript";
    expect(truncateTranscriptBuffer(shortText, 100)).toBe(shortText);

    const longText = "a".repeat(500);
    const truncated = truncateTranscriptBuffer(longText, 200);
    expect(truncated.length).toBeLessThanOrEqual(200 + 60);
    expect(truncated).toContain("[... earlier transcript truncated for length ...]");
  });
});
