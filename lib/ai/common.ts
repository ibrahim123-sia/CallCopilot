import type { ZodType, ZodTypeDef } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { cleanJsonString, safeParseJson } from "../analysis/jsonRepair";

/**
 * Task kinds. Each task maps to its own model per provider so their free-tier quotas
 * (counted per model) don't starve each other.
 */
export type AiTask = "live" | "translate" | "summary" | "chat";

export type ProviderId = "groq" | "gemini";

export interface JsonRequest<T> {
  task: AiTask;
  system: string;
  prompt: string;
  schema: ZodType<T, ZodTypeDef, unknown>;
  temperature?: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface TextStreamRequest {
  task: AiTask;
  system: string;
  messages: ChatTurn[];
}

export class AiUnavailableError extends Error {
  constructor(message = "No AI provider is configured. Add GROQ_API_KEY and/or GEMINI_API_KEY to .env (both have free tiers).") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export class AiRateLimitError extends Error {
  constructor(public retryAfterMs: number, public model: string, provider = "AI") {
    super(`${provider} free-tier limit reached for ${model}. Retrying in ${Math.ceil(retryAfterMs / 1000)}s.`);
    this.name = "AiRateLimitError";
  }
}

/** Per-model cooldown after a 429, shared by all providers. */
const cooldownUntil = new Map<string, number>();

export function cooldownRemaining(key: string): number {
  return Math.max(0, (cooldownUntil.get(key) ?? 0) - Date.now());
}

export function startCooldown(key: string, ms: number): void {
  cooldownUntil.set(key, Date.now() + ms);
}

/** Test hook. */
export function resetCooldowns(): void {
  cooldownUntil.clear();
}

/** Rough token estimate (≈4 chars per token) used to keep requests inside per-minute token limits. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * JSON Schema for the model: annotation keywords providers don't need (defaults, $schema)
 * are stripped; Zod still applies defaults when validating the response.
 */
export function toModelJsonSchema(schema: ZodType<unknown, ZodTypeDef, unknown>): unknown {
  const raw = zodToJsonSchema(schema, { target: "jsonSchema7", $refStrategy: "none" });
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        if (k === "default" || k === "$schema") continue;
        out[k] = strip(v);
      }
      return out;
    }
    return node;
  };
  return strip(raw);
}

/** Parses (and lightly repairs) model text, then validates it with Zod. */
export function parseModelJson<T>(raw: string, schema: ZodType<T, ZodTypeDef, unknown>, task: AiTask): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJsonString(raw));
  } catch {
    parsed = safeParseJson<unknown>(raw, null);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Model returned invalid JSON for ${task}: ${result.error.message.slice(0, 300)}`);
  }
  return result.data;
}

/** Maps AI errors to an HTTP response shape the UI understands. */
export function aiErrorResponse(err: unknown): { status: number; body: Record<string, unknown>; headers?: Record<string, string> } {
  if (err instanceof AiRateLimitError) {
    return {
      status: 429,
      body: { error: err.message, retryAfterMs: err.retryAfterMs, code: "rate_limited" },
      headers: { "Retry-After": String(Math.ceil(err.retryAfterMs / 1000)) },
    };
  }
  if (err instanceof AiUnavailableError) {
    return { status: 503, body: { error: err.message, code: "no_key" } };
  }
  return {
    status: 502,
    body: { error: "AI request failed", details: err instanceof Error ? err.message : String(err) },
  };
}
