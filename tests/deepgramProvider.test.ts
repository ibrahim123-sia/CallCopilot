import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildDeepgramListenUrl,
  DeepgramTranscriptionProvider,
} from "../lib/transcription/deepgramProvider";
import { TranscriptEntry } from "../lib/types";

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];
  readyState = 0;
  binaryType = "";
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;

  constructor(public url: string, public protocols: string[]) {
    MockWebSocket.instances.push(this);
  }
  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
  send(data: unknown) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({ code: 1006, reason: "network" });
  }
}

describe("buildDeepgramListenUrl", () => {
  it("uses nova-3 with smart formatting and English by default", () => {
    const url = new URL(buildDeepgramListenUrl({ language: "en" }));
    expect(url.searchParams.get("model")).toBe("nova-3");
    expect(url.searchParams.get("language")).toBe("en");
    expect(url.searchParams.get("smart_format")).toBe("true");
  });

  it("maps auto to Nova-3 multilingual and keeps Urdu monolingual", () => {
    expect(new URL(buildDeepgramListenUrl({ language: "auto" })).searchParams.get("language")).toBe("multi");
    expect(new URL(buildDeepgramListenUrl({ language: "ur" })).searchParams.get("language")).toBe("ur");
  });

  it("adds deduplicated, non-empty keyterms", () => {
    const url = new URL(
      buildDeepgramListenUrl({ language: "en", keyterms: ["Acme Corp", "Acme Corp", " ", "Kubernetes"] })
    );
    expect(url.searchParams.getAll("keyterm")).toEqual(["Acme Corp", "Kubernetes"]);
  });
});

describe("DeepgramTranscriptionProvider", () => {
  let tokenCounter = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    tokenCounter = 0;
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ token: `jwt-${++tokenCounter}`, scheme: "bearer" }),
      }))
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("authenticates with a bearer JWT", async () => {
    const provider = new DeepgramTranscriptionProvider();
    await provider.connect({ language: "en" });
    expect(MockWebSocket.instances[0].protocols).toEqual(["bearer", "jwt-1"]);
  });

  it("does not send audio while paused, and keeps the socket alive instead", async () => {
    const provider = new DeepgramTranscriptionProvider();
    await provider.connect({ language: "en" });
    const ws = MockWebSocket.instances[0];
    ws.open();

    provider.sendAudio(new Int16Array(4));
    expect(ws.sent.filter((d) => d instanceof ArrayBuffer)).toHaveLength(1);

    provider.pause();
    provider.sendAudio(new Int16Array(4));
    expect(ws.sent.filter((d) => d instanceof ArrayBuffer)).toHaveLength(1);

    vi.advanceTimersByTime(5000);
    expect(ws.sent).toContain(JSON.stringify({ type: "KeepAlive" }));

    provider.resume();
    provider.sendAudio(new Int16Array(4));
    expect(ws.sent.filter((d) => d instanceof ArrayBuffer)).toHaveLength(2);
  });

  it("fetches a fresh token when reconnecting after a drop", async () => {
    const provider = new DeepgramTranscriptionProvider();
    await provider.connect({ language: "en" });
    MockWebSocket.instances[0].open();
    MockWebSocket.instances[0].drop();

    await vi.advanceTimersByTimeAsync(1000);
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[1].protocols).toEqual(["bearer", "jwt-2"]);
  });

  it("emits final entries with channel-based speaker and segment duration", async () => {
    const provider = new DeepgramTranscriptionProvider();
    const received: TranscriptEntry[] = [];
    provider.onTranscript((e) => received.push(e));
    await provider.connect({ language: "en" });
    const ws = MockWebSocket.instances[0];
    ws.open();

    ws.onmessage?.({
      data: JSON.stringify({
        type: "Results",
        channel_index: [1, 2],
        start: 2.5,
        duration: 1.75,
        is_final: true,
        channel: { alternatives: [{ transcript: "Our budget is $25,000." }] },
      }),
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      speaker: "client",
      channel: 1,
      isFinal: true,
      durationMs: 1750,
      text: "Our budget is $25,000.",
    });
  });
});
