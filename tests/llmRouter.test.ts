import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

const geminiGenerateJson = vi.fn();
const geminiTextStream = vi.fn();

vi.mock("../lib/ai/gemini", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/ai/gemini")>();
  return {
    ...actual,
    geminiGenerateJson: (...a: unknown[]) => geminiGenerateJson(...a),
    geminiTextStream: (...a: unknown[]) => geminiTextStream(...a),
  };
});

const { generateJsonWithMeta, generateTextStream } = await import("../lib/ai/llm");
const { AiRateLimitError, resetCooldowns } = await import("../lib/ai/common");
const { createDb, setDbForTests } = await import("../lib/db");
const repo = await import("../lib/db/repo");

const Schema = z.object({ answer: z.string() });
const req = (over: Partial<{ task: "live" | "translate" | "summary" | "chat"; prompt: string }> = {}) => ({
  task: over.task ?? ("live" as const),
  system: "sys",
  prompt: over.prompt ?? "hello",
  schema: Schema,
});

const groqOk = (content: string) =>
  ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ choices: [{ message: { content } }] }) }) as unknown as Response;
const groq429 = (retry = "12") =>
  ({ ok: false, status: 429, headers: new Headers({ "retry-after": retry }), text: async () => "rate limited" }) as unknown as Response;

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(c) {
      for (const t of chunks) c.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`));
      c.enqueue(encoder.encode("data: [DONE]\n\n"));
      c.close();
    },
  });
  return { ok: true, status: 200, headers: new Headers(), body } as unknown as Response;
}

async function collect(gen: AsyncGenerator<string>) {
  let out = "";
  for await (const t of gen) out += t;
  return out;
}

describe("LLM provider router", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.GROQ_API_KEY = "gsk_test";
    process.env.GEMINI_API_KEY = "gem_test";
    setDbForTests(createDb(":memory:"));
    resetCooldowns();
    geminiGenerateJson.mockReset();
    geminiTextStream.mockReset();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (process.env as Record<string, string | undefined>).GROQ_API_KEY;
    delete (process.env as Record<string, string | undefined>).GEMINI_API_KEY;
  });

  it("uses Groq first with a JSON schema and low reasoning effort", async () => {
    fetchMock.mockResolvedValueOnce(groqOk('{"answer":"from groq"}'));
    const r = await generateJsonWithMeta(req());
    expect(r).toMatchObject({ provider: "groq", data: { answer: "from groq" }, model: "openai/gpt-oss-20b" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.reasoning_effort).toBe("low");
    expect(body.include_reasoning).toBe(false);
    expect(geminiGenerateJson).not.toHaveBeenCalled();
  });

  it("translation uses the Qwen model with a JSON schema and no gpt-oss reasoning params", async () => {
    fetchMock.mockResolvedValueOnce(groqOk('{"answer":"ok"}'));
    await generateJsonWithMeta(req({ task: "translate" }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("qwen/qwen3.8-27b");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.reasoning_effort).toBeUndefined();
  });

  it("uses JSON mode with the schema in the prompt for models without json_schema support", async () => {
    process.env.GROQ_TRANSLATE_MODEL = "llama-3.1-8b-instant";
    try {
      fetchMock.mockResolvedValueOnce(groqOk('{"answer":"ok"}'));
      await generateJsonWithMeta(req({ task: "translate" }));
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.response_format).toEqual({ type: "json_object" });
      expect(body.messages[0].content).toContain("JSON Schema");
    } finally {
      delete (process.env as Record<string, string | undefined>).GROQ_TRANSLATE_MODEL;
    }
  });

  it("falls back to Gemini on a Groq 429 and skips Groq while it cools down", async () => {
    fetchMock.mockResolvedValueOnce(groq429("20"));
    geminiGenerateJson.mockResolvedValue({ answer: "from gemini" });

    const first = await generateJsonWithMeta(req());
    expect(first.provider).toBe("gemini");

    const second = await generateJsonWithMeta(req());
    expect(second.provider).toBe("gemini");
    expect(fetchMock).toHaveBeenCalledTimes(1); // no second Groq call during cooldown
  });

  it("falls back when Groq returns output that fails validation", async () => {
    fetchMock.mockResolvedValueOnce(groqOk('{"wrong":1}'));
    geminiGenerateJson.mockResolvedValue({ answer: "fixed" });
    expect((await generateJsonWithMeta(req())).provider).toBe("gemini");
  });

  it("sends oversized requests straight to Gemini", async () => {
    geminiGenerateJson.mockResolvedValue({ answer: "big" });
    const r = await generateJsonWithMeta(req({ task: "summary", prompt: "x".repeat(40_000) }));
    expect(r.provider).toBe("gemini");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a rate limit when every provider is limited", async () => {
    delete (process.env as Record<string, string | undefined>).GEMINI_API_KEY;
    fetchMock.mockResolvedValueOnce(groq429("9"));
    await expect(generateJsonWithMeta(req())).rejects.toBeInstanceOf(AiRateLimitError);
  });

  it("respects the Gemini-first setting", async () => {
    await repo.saveSettings({ llmPrimary: "gemini" });
    geminiGenerateJson.mockResolvedValue({ answer: "g" });
    expect((await generateJsonWithMeta(req())).provider).toBe("gemini");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("streams Groq SSE deltas", async () => {
    fetchMock.mockResolvedValueOnce(sseResponse(["Budget ", "was ", "25k [M1]."]));
    const text = await collect(generateTextStream({ task: "chat", system: "s", messages: [{ role: "user", content: "q" }] }));
    expect(text).toBe("Budget was 25k [M1].");
  });

  it("falls back to Gemini when the Groq stream fails before the first token", async () => {
    fetchMock.mockResolvedValueOnce(groq429());
    geminiTextStream.mockImplementation(async function* () {
      yield "from ";
      yield "gemini";
    });
    const text = await collect(generateTextStream({ task: "chat", system: "s", messages: [{ role: "user", content: "q" }] }));
    expect(text).toBe("from gemini");
  });
});
