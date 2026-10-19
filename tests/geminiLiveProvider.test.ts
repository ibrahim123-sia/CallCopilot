import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  deinterleave,
  GeminiLiveTranscriptionProvider,
  int16ToBase64,
  languageCodesFor,
  mergeInterim,
} from "../lib/transcription/geminiLiveProvider";
import { buildLiveSessionConfig, LIVE_VAD } from "../lib/transcription/geminiLiveConfig";
import { TranscriptEntry } from "../lib/types";

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  server(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  send(d: string) {
    this.sent.push(d);
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: "" });
  }
  drop(reason = "network") {
    this.readyState = 3;
    this.onclose?.({ code: 1006, reason });
  }
  get audioMessages() {
    return this.sent.map((s) => JSON.parse(s)).filter((m) => m.realtimeInput?.audio);
  }
  get setup() {
    return JSON.parse(this.sent[0]).setup;
  }
}

const stereo = (frames: number) => new Int16Array(frames * 2).fill(1);

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe("helpers", () => {
  it("deinterleaves stereo PCM into team/client channels", () => {
    const [l, r] = deinterleave(new Int16Array([1, 2, 3, 4, 5, 6]));
    expect(Array.from(l)).toEqual([1, 3, 5]);
    expect(Array.from(r)).toEqual([2, 4, 6]);
  });

  it("base64-encodes little-endian PCM", () => {
    expect(int16ToBase64(new Int16Array([1, 256]))).toBe(btoa(String.fromCharCode(1, 0, 0, 1)));
  });

  it("maps languages to Gemini language codes", () => {
    expect(languageCodesFor("en")).toEqual(["en-US"]);
    expect(languageCodesFor("auto")).toEqual([]);
    expect(languageCodesFor("ur")).toEqual(["ur-PK"]);
  });

  it("replaces the interim hypothesis (updates are cumulative and may revise earlier words)", () => {
    expect(mergeInterim("", "We need")).toBe("We need");
    expect(mergeInterim("We need", "We need a CRM")).toBe("We need a CRM");
    // a revision must not duplicate text
    expect(mergeInterim("are people after the launch?", "people after the launch?")).toBe("people after the launch?");
    expect(mergeInterim("kept", "  ")).toBe("kept");
  });

  it("builds the session config with tuned VAD and cleaned vocabulary", () => {
    const cfg = buildLiveSessionConfig({ language: "auto", vocabulary: ["Acme", "Acme", " ", "x"] });
    expect(cfg.inputAudioTranscription.languageCodes).toEqual([]);
    expect(cfg.inputAudioTranscription.customVocabulary).toEqual(["Acme"]);
    expect(cfg.realtimeInputConfig.automaticActivityDetection).toEqual(LIVE_VAD);
  });
});

describe("GeminiLiveTranscriptionProvider", () => {
  let tokens = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    tokens = 0;
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ token: `tok-${++tokens}`, model: "gemini-3.5-transcribe-live" }) }))
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function connected(opts: { multichannel?: boolean } = {}) {
    const p = new GeminiLiveTranscriptionProvider();
    const entries: TranscriptEntry[] = [];
    p.onTranscript((e) => entries.push(e));
    await p.connect({ language: "en", multichannel: opts.multichannel ?? true, keyterms: ["Acme", "Acme", "Okta"] });
    await flush();
    return { p, entries };
  }

  it("opens one session per speaker with a single-use token each and sends setup", async () => {
    await connected();
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances.map((w) => new URL(w.url).searchParams.get("access_token"))).toEqual(["tok-1", "tok-2"]);
    const ws = MockWebSocket.instances[0];
    ws.open();
    expect(ws.setup.model).toBe("models/gemini-3.5-transcribe-live");
    expect(ws.setup.inputAudioTranscription.languageCodes).toEqual(["en-US"]);
    expect(ws.setup.inputAudioTranscription.customVocabulary).toEqual(["Acme", "Okta"]);
    expect(ws.setup.realtimeInputConfig.automaticActivityDetection).toEqual(LIVE_VAD);
  });

  it("requests tokens with the session config, because tokens lock it", async () => {
    await connected();
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/stt-token?provider=gemini");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ language: "en", vocabulary: ["Acme", "Okta"] });
  });

  it("mic-only mode opens a single team session", async () => {
    await connected({ multichannel: false });
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("buffers audio until setupComplete, then streams 100ms chunks per channel", async () => {
    const { p } = await connected();
    const [team, client] = MockWebSocket.instances;
    team.open();
    client.open();

    p.sendAudio(stereo(1600)); // 100 ms
    expect(team.audioMessages).toHaveLength(0);

    team.server({ setupComplete: {} });
    client.server({ setupComplete: {} });
    expect(team.audioMessages).toHaveLength(1);
    expect(client.audioMessages).toHaveLength(1);
    expect(team.audioMessages[0].realtimeInput.audio.mimeType).toBe("audio/pcm;rate=16000");
  });

  it("emits interim then final entries with the speaker of the channel", async () => {
    const { entries } = await connected();
    const client = MockWebSocket.instances[1];
    client.open();
    client.server({ setupComplete: {} });
    client.server({ serverContent: { interimInputTranscription: { text: "Our budget" } } });
    client.server({ serverContent: { inputTranscription: { text: "Our budget is 25k." } } });

    expect(entries.map((e) => [e.speaker, e.isFinal, e.text])).toEqual([
      ["client", false, "Our budget"],
      ["client", true, "Our budget is 25k."],
    ]);
    expect(entries[0].id).toBe(entries[1].id);
    expect(entries[1].channel).toBe(1);
  });

  it("sends nothing while paused", async () => {
    const { p } = await connected();
    const team = MockWebSocket.instances[0];
    team.open();
    team.server({ setupComplete: {} });
    p.pause();
    // pausing flushes the current sentence so it becomes final right away
    expect(team.sent.some((s) => JSON.parse(s).realtimeInput?.audioStreamEnd)).toBe(true);
    p.sendAudio(stereo(3200));
    expect(team.audioMessages).toHaveLength(0);
    p.resume();
    p.sendAudio(stereo(1600));
    expect(team.audioMessages).toHaveLength(1);
  });

  it("reconnects with a fresh token after an unexpected drop", async () => {
    await connected();
    const team = MockWebSocket.instances[0];
    team.open();
    team.server({ setupComplete: {} });
    team.drop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(MockWebSocket.instances).toHaveLength(3);
    expect(new URL(MockWebSocket.instances[2].url).searchParams.get("access_token")).toBe("tok-3");
  });

  it("rotates to a new session on goAway and drains the old one", async () => {
    const { p } = await connected();
    const oldTeam = MockWebSocket.instances[0];
    oldTeam.open();
    oldTeam.server({ setupComplete: {} });

    oldTeam.server({ goAway: { timeLeft: "10s" } });
    await flush();
    const newTeam = MockWebSocket.instances[2];
    expect(newTeam).toBeDefined();
    newTeam.open();
    newTeam.server({ setupComplete: {} });

    // Old session gets audioStreamEnd; new audio goes to the new session
    expect(oldTeam.sent.some((s) => JSON.parse(s).realtimeInput?.audioStreamEnd)).toBe(true);
    p.sendAudio(stereo(1600));
    expect(newTeam.audioMessages).toHaveLength(1);
  });
});
