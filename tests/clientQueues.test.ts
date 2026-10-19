import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SegmentSaver } from "../lib/client/segmentSaver";
import { TranslationQueue } from "../lib/client/translationQueue";
import { TranscriptEntry } from "../lib/types";

const entry = (id: string, text = "hello"): TranscriptEntry => ({
  id,
  speaker: "client",
  text,
  timestamp: 1,
  isFinal: true,
  channel: 1,
});

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe("SegmentSaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("batches lines and retries a failed save without losing them", async () => {
    const calls: unknown[] = [];
    let fail = true;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)));
      if (fail) {
        fail = false;
        return jsonResponse(500, {});
      }
      return jsonResponse(200, { ok: true });
    }) as unknown as typeof fetch;

    const saver = new SegmentSaver("m1", { fetchImpl, flushMs: 1000 });
    saver.add(entry("a"));
    saver.add(entry("b"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(saver.pendingCount).toBe(2); // first attempt failed, lines kept

    await vi.advanceTimersByTimeAsync(2000);
    expect(saver.pendingCount).toBe(0);
    expect(calls).toHaveLength(2);
    expect((calls[1] as { segments: Array<{ id: string }> }).segments.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("TranslationQueue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends at most one request per batch window and passes recent context", async () => {
    const bodies: Array<{ lines: Array<{ id: string }>; context: Array<{ id: string }> }> = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      return jsonResponse(200, { items: body.lines.map((l: { id: string }) => ({ id: l.id, romanUrdu: `ru-${l.id}` })) });
    }) as unknown as typeof fetch;
    const translated: string[] = [];

    const q = new TranslationQueue({
      batchMs: 6000,
      fetchImpl,
      onTranslated: (items) => translated.push(...items.map((i) => i.romanUrdu)),
    });

    q.add(entry("1"));
    await vi.advanceTimersByTimeAsync(0);
    q.add(entry("2"));
    q.add(entry("3"));
    await vi.advanceTimersByTimeAsync(3000);
    expect(bodies).toHaveLength(1); // still inside the 6s window

    await vi.advanceTimersByTimeAsync(3000);
    expect(bodies).toHaveLength(2);
    expect(bodies[1].lines.map((l) => l.id)).toEqual(["2", "3"]);
    expect(bodies[1].context.map((l) => l.id)).toEqual(["1"]);
    expect(translated).toEqual(["ru-1", "ru-2", "ru-3"]);
  });

  it("backs off on 429 and retries the same lines", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      if (calls === 1) return jsonResponse(429, { retryAfterMs: 10000 });
      return jsonResponse(200, { items: body.lines.map((l: { id: string }) => ({ id: l.id, romanUrdu: "ok" })) });
    }) as unknown as typeof fetch;
    const statuses: string[] = [];
    const done: string[] = [];

    const q = new TranslationQueue({
      batchMs: 1000,
      fetchImpl,
      onTranslated: (items) => done.push(...items.map((i) => i.id)),
      onStatus: (s) => statuses.push(s.state),
    });
    q.add(entry("x"));
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses).toContain("cooldown");

    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toBe(2);
    expect(done).toEqual(["x"]);
  });

  it("disables itself when no API key is configured", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(503, { error: "no key" })) as unknown as typeof fetch;
    const statuses: string[] = [];
    const q = new TranslationQueue({ batchMs: 100, fetchImpl, onTranslated: () => {}, onStatus: (s) => statuses.push(s.state) });
    q.add(entry("a"));
    await vi.advanceTimersByTimeAsync(0);
    q.add(entry("b"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual(["disabled"]);
  });
});
