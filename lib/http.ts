import "server-only";
import { NextResponse } from "next/server";
import { ApiError } from "@google/genai";
import { ZodError, ZodType, ZodTypeDef } from "zod";
import { aiErrorResponse, AiRateLimitError, AiUnavailableError } from "./ai/common";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function readJson<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, `Invalid request: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  return parsed.data;
}

export function notFound(what = "Not found"): never {
  throw new HttpError(404, what);
}

/** Wraps a route handler so thrown errors become consistent JSON responses. */
export function handle<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof AiRateLimitError || err instanceof AiUnavailableError) {
    const r = aiErrorResponse(err);
    return NextResponse.json(r.body, { status: r.status, headers: r.headers });
  }
  console.error(err);
  if (err instanceof ApiError) {
    const r = aiErrorResponse(err);
    return NextResponse.json(r.body, { status: r.status });
  }
  return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
}
