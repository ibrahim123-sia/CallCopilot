import { describe, it, expect } from "vitest";
import { formatClockTime, formatDuration, formatLocalDate } from "../lib/time";

describe("time helpers", () => {
  it("formats clock time in the local timezone", () => {
    const d = new Date(2026, 9, 18, 9, 5, 7); // local time
    expect(formatClockTime(d.getTime())).toBe("09:05:07");
    expect(formatLocalDate(d.getTime())).toBe("2026-10-18");
  });

  it("formats durations, switching to hours past 60 minutes", () => {
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(3725)).toBe("1:02:05");
  });
});
