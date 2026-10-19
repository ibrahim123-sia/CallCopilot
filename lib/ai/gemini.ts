import "server-only";
import { GoogleGenAI, ThinkingLevel, ApiError } from "@google/genai";
import { getServerEnv } from "../env";
import {
  AiRateLimitError,
  AiTask,
  AiUnavailableError,
  cooldownRemaining,
  JsonRequest,
  parseModelJson,
  startCooldown,
  TextStreamRequest,
  toModelJsonSchema,
} from "./common";

export function geminiModelFor(task: AiTask): string {
  const env = getServerEnv();
  switch (task) {
    case "live":
      return env.GEMINI_LIVE_MODEL;
    case "translate":
      return env.GEMINI_TRANSLATE_MODEL;
    default:
      return env.GEMINI_MODEL;
  }
}

let client: GoogleGenAI | null = null;

export function hasGeminiKey(): boolean {
  return Boolean(getServerEnv().GEMINI_API_KEY);
}

export function getGemini(): GoogleGenAI {
  const key = getServerEnv().GEMINI_API_KEY;
  if (!key) throw new AiUnavailableError("GEMINI_API_KEY is not configured. Add it to .env (free key from aistudio.google.com).");
  if (!client) client = new GoogleGenAI({ apiKey: key });
  return client;
}

const cooldownKey = (model: string) => `gemini:${model}`;

function parseRetryDelayMs(err: unknown): number {
  const text = err instanceof Error ? err.message : String(err);
  // Gemini 429 bodies carry RetryInfo like "retryDelay": "17s"
  const match = text.match(/retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s/);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000);
  return 30_000;
}

function isRateLimit(err: unknown): boolean {
  if (err instanceof ApiError && err.status === 429) return true;
  const text = err instanceof Error ? err.message : String(err);
  return /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(text);
}

function isThinkingUnsupported(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err);
  return /thinking/i.test(text) && (err instanceof ApiError ? err.status === 400 : /400|INVALID_ARGUMENT/.test(text));
}

async function withQuota<T>(model: string, fn: () => Promise<T>): Promise<T> {
  const remaining = cooldownRemaining(cooldownKey(model));
  if (remaining > 0) throw new AiRateLimitError(remaining, model, "Gemini");
  try {
    return await fn();
  } catch (err) {
    if (isRateLimit(err)) {
      const delay = parseRetryDelayMs(err);
      startCooldown(cooldownKey(model), delay);
      throw new AiRateLimitError(delay, model, "Gemini");
    }
    throw err;
  }
}

const FAST_TASKS: AiTask[] = ["live", "translate"];

function thinkingFor(task: AiTask) {
  return FAST_TASKS.includes(task) ? { thinkingLevel: ThinkingLevel.MINIMAL } : undefined;
}

export function geminiIsCoolingDown(task: AiTask): number {
  return cooldownRemaining(cooldownKey(geminiModelFor(task)));
}

/** Structured JSON generation validated with Zod. */
export async function geminiGenerateJson<T>(req: JsonRequest<T>): Promise<T> {
  const ai = getGemini();
  const model = geminiModelFor(req.task);
  const jsonSchema = toModelJsonSchema(req.schema);

  const call = (withThinking: boolean) =>
    ai.models.generateContent({
      model,
      contents: req.prompt,
      config: {
        systemInstruction: req.system,
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
        temperature: req.temperature,
        ...(withThinking && thinkingFor(req.task) ? { thinkingConfig: thinkingFor(req.task) } : {}),
      },
    });

  const response = await withQuota(model, async () => {
    try {
      return await call(true);
    } catch (err) {
      // Some models don't accept a thinking level; retry once without it.
      if (isThinkingUnsupported(err)) return await call(false);
      throw err;
    }
  });

  return parseModelJson(response.text ?? "", req.schema, req.task);
}

/** Streams plain text (used by the client chat). */
export async function* geminiTextStream(req: TextStreamRequest): AsyncGenerator<string> {
  const ai = getGemini();
  const model = geminiModelFor(req.task);
  const stream = await withQuota(model, () =>
    ai.models.generateContentStream({
      model,
      contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      config: { systemInstruction: req.system },
    })
  );
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}
