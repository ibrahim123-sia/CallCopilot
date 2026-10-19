import "server-only";
import { getSettings } from "../db/repo";
import {
  AiRateLimitError,
  AiUnavailableError,
  JsonRequest,
  ProviderId,
  TextStreamRequest,
} from "./common";
import { geminiGenerateJson, geminiModelFor, geminiTextStream, hasGeminiKey } from "./gemini";
import { groqFits, groqGenerateJson, groqModelFor, groqTextStream, hasGroqKey } from "./groq";

/**
 * Provider router: tries the primary provider (Groq by default) and falls back to the other
 * on rate limits, errors, invalid output, or requests too large for Groq's free token budget.
 */

export interface LlmResult<T> {
  data: T;
  provider: ProviderId;
  model: string;
}

export function hasLlmKey(): boolean {
  return hasGroqKey() || hasGeminiKey();
}

function isConfigured(p: ProviderId): boolean {
  return p === "groq" ? hasGroqKey() : hasGeminiKey();
}

export async function providerOrder(): Promise<ProviderId[]> {
  let primary: ProviderId = "groq";
  try {
    primary = (await getSettings()).llmPrimary ?? "groq";
  } catch {
    // settings unavailable (e.g. during tests) → default order
  }
  return primary === "groq" ? ["groq", "gemini"] : ["gemini", "groq"];
}

function combineFailures(rateLimits: AiRateLimitError[], errors: unknown[], skippedForSize: boolean): Error {
  if (errors.length === 0 && rateLimits.length > 0) {
    const soonest = rateLimits.reduce((a, b) => (a.retryAfterMs <= b.retryAfterMs ? a : b));
    return new AiRateLimitError(soonest.retryAfterMs, soonest.model, "All providers");
  }
  if (errors.length > 0) return errors[errors.length - 1] instanceof Error ? (errors[errors.length - 1] as Error) : new Error(String(errors[errors.length - 1]));
  if (skippedForSize) return new Error("This request is too large for Groq's free tier. Add GEMINI_API_KEY so long meetings can be processed.");
  return new AiUnavailableError();
}

export async function generateJsonWithMeta<T>(req: JsonRequest<T>): Promise<LlmResult<T>> {
  const rateLimits: AiRateLimitError[] = [];
  const errors: unknown[] = [];
  let skippedForSize = false;
  let anyConfigured = false;

  for (const provider of await providerOrder()) {
    if (!isConfigured(provider)) continue;
    anyConfigured = true;
    if (provider === "groq" && !groqFits(req.task, req.system + req.prompt)) {
      skippedForSize = true;
      continue;
    }
    try {
      if (provider === "groq") return { data: await groqGenerateJson(req), provider, model: groqModelFor(req.task) };
      return { data: await geminiGenerateJson(req), provider, model: geminiModelFor(req.task) };
    } catch (err) {
      if (err instanceof AiRateLimitError) rateLimits.push(err);
      else errors.push(err);
      console.warn(`[llm] ${provider} failed for ${req.task}:`, err instanceof Error ? err.message : err);
    }
  }

  if (!anyConfigured) throw new AiUnavailableError();
  throw combineFailures(rateLimits, errors, skippedForSize);
}

export async function generateJson<T>(req: JsonRequest<T>): Promise<T> {
  return (await generateJsonWithMeta(req)).data;
}

/**
 * Streams text from the first provider that starts successfully. Falling back is only possible
 * before the first token arrives; a failure mid-answer is surfaced to the caller.
 */
export async function* generateTextStream(req: TextStreamRequest): AsyncGenerator<string> {
  const rateLimits: AiRateLimitError[] = [];
  const errors: unknown[] = [];
  let skippedForSize = false;
  let anyConfigured = false;
  const promptText = req.system + req.messages.map((m) => m.content).join("\n");

  for (const provider of await providerOrder()) {
    if (!isConfigured(provider)) continue;
    anyConfigured = true;
    if (provider === "groq" && !groqFits(req.task, promptText)) {
      skippedForSize = true;
      continue;
    }
    const stream = provider === "groq" ? groqTextStream(req) : geminiTextStream(req);
    let first: IteratorResult<string>;
    try {
      first = await stream.next();
    } catch (err) {
      if (err instanceof AiRateLimitError) rateLimits.push(err);
      else errors.push(err);
      console.warn(`[llm] ${provider} stream failed for ${req.task}:`, err instanceof Error ? err.message : err);
      continue;
    }
    if (!first.done) yield first.value;
    yield* stream;
    return;
  }

  if (!anyConfigured) throw new AiUnavailableError();
  throw combineFailures(rateLimits, errors, skippedForSize);
}
