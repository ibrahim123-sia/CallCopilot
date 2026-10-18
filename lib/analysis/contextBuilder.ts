import { TranscriptEntry } from "../types";
import { formatClockTime } from "../time";

export function formatTranscriptForPrompt(entries: TranscriptEntry[]): string {
  if (entries.length === 0) return "(No speech recorded yet)";

  return entries
    .map((e) => {
      const timeStr = formatClockTime(e.timestamp);
      const speakerLabel = e.speaker === "client" ? "Client" : "Our Team";
      return `[${timeStr}] ${speakerLabel}: ${e.text}`;
    })
    .join("\n");
}

/**
 * Extracts the most recent window of transcript (e.g., last 4 minutes)
 * and leaves older entries for rolling summarization.
 */
export function partitionTranscriptWindow(
  entries: TranscriptEntry[],
  windowDurationMs: number = 240000 // 4 minutes
): { recent: TranscriptEntry[]; older: TranscriptEntry[] } {
  if (entries.length === 0) {
    return { recent: [], older: [] };
  }

  const latestTs = entries[entries.length - 1].timestamp;
  const cutoff = latestTs - windowDurationMs;

  const older: TranscriptEntry[] = [];
  const recent: TranscriptEntry[] = [];

  for (const entry of entries) {
    if (entry.timestamp < cutoff) {
      older.push(entry);
    } else {
      recent.push(entry);
    }
  }

  // Ensure at least the last 5 entries are in recent if available
  if (recent.length < 5 && entries.length > recent.length) {
    const minSlice = entries.slice(-Math.min(entries.length, 5));
    return {
      recent: minSlice,
      older: entries.slice(0, entries.length - minSlice.length),
    };
  }

  return { recent, older };
}

/**
 * Truncate transcript text if it exceeds max character limit, keeping the latest content.
 */
export function truncateTranscriptBuffer(text: string, maxChars: number = 40000): string {
  if (text.length <= maxChars) return text;
  return "[... earlier transcript truncated for length ...]\n" + text.slice(-maxChars);
}
