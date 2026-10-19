import "server-only";
import { getServerEnv } from "../env";
import {
  AiRateLimitError,
  AiTask,
  AiUnavailableError,
  cooldownRemaining,
  estimateTokens,
  JsonRequest,
  parseModelJson,
  startCooldown,
  TextStreamRequest,
  toModelJsonSchema,
} from "./common";

/**
 * Groq (OpenAI-compatible chat completions). Very fast inference with a free tier whose
 * tokens-per-minute limit is small, so oversized requests are routed to Gemini instead.
 */

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/** Max completion tokens per task (also counted against the per-request token budget). */
const MAX_OUTPUT: Record<AiTask, number> = { live: 1800, translate: 1500, summary: 4000, chat: 1500 };

export function groqModelFor(task: AiTask): string {
  const env = getServerEnv();
  switch (task) {
    case "live":
      return env.GROQ_LIVE_MODEL;
    case "translate":
      return env.GROQ_TRANSLATE_MODEL;
    default:
      return env.GROQ_MODEL;
  }
}

export function hasGroqKey(): boolean {
  return Boolean(getServerEnv().GROQ_API_KEY);
}

const cooldownKey = (model: string) => `groq:${model}`;

export function groqIsCoolingDown(task: AiTask): number {
  return cooldownRemaining(cooldownKey(groqModelFor(task)));
}

/** Whether a request of this size fits Groq's per-minute token budget (else skip to the next provider). */
export function groqFits(task: AiTask, promptText: string): boolean {
  return estimateTokens(promptText) + MAX_OUTPUT[task] <= getServerEnv().GROQ_MAX_TOKENS_PER_REQUEST;
}

const isGptOss = (model: string) => model.startsWith("openai/gpt-oss");
const supportsJsonSchema = (model: string) => /^(openai\/gpt-oss|qwen\/|meta-models\/)/.test(model) && !model.includes("safeguard");

function parseRetryAfter(res: Response): number {
  const header = res.headers.get("retry-after");
  const seconds = header ? parseFloat(header) : NaN;
  return Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : 30_000;
}

async function post(model: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const key = getServerEnv().GROQ_API_KEY;
  if (!key) throw new AiUnavailableError("GROQ_API_KEY is not configured.");

  const remaining = cooldownRemaining(cooldownKey(model));
  if (remaining > 0) throw new AiRateLimitError(remaining, model, "Groq");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, ...body }),
    signal,
  });

  if (res.status === 429) {
    const delay = parseRetryAfter(res);
    startCooldown(cooldownKey(model), delay);
    throw new AiRateLimitError(delay, model, "Groq");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${text.slice(0, 400)}`);
  }
  return res;
}

function reasoningParams(model: string, task: AiTask): Record<string, unknown> {
  if (!isGptOss(model)) return {};
  return { reasoning_effort: task === "summary" || task === "chat" ? "medium" : "low", include_reasoning: false };
}

export async function groqGenerateJson<T>(req: JsonRequest<T>): Promise<T> {
  const model = groqModelFor(req.task);
  const schema = toModelJsonSchema(req.schema);

  // gpt-oss/qwen accept a JSON schema (best-effort); other models get JSON mode plus the schema in the prompt.
  const responseFormat = supportsJsonSchema(model)
    ? { type: "json_schema", json_schema: { name: `${req.task}_result`, strict: false, schema } }
    : { type: "json_object" };
  const system = supportsJsonSchema(model)
    ? req.system
    : `${req.system}\n\nRespond ONLY with a JSON object that matches this JSON Schema:\n${JSON.stringify(schema)}`;

  const res = await post(model, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: req.prompt },
    ],
    temperature: req.temperature ?? 0.3,
    max_completion_tokens: MAX_OUTPUT[req.task],
    response_format: responseFormat,
    ...reasoningParams(model, req.task),
  });
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  return parseModelJson(content, req.schema, req.task);
}

/** Streams plain text via server-sent events. */
export async function* groqTextStream(req: TextStreamRequest): AsyncGenerator<string> {
  const model = groqModelFor(req.task);
  const res = await post(model, {
    messages: [{ role: "system", content: req.system }, ...req.messages],
    temperature: 0.4,
    max_completion_tokens: MAX_OUTPUT[req.task],
    stream: true,
    ...reasoningParams(model, req.task),
  });
  if (!res.body) throw new Error("Groq returned no stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch {
        // ignore keep-alive / partial lines
      }
    }
  }
}
