import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError, readJson } from "@/lib/http";
import { hasLlmKey } from "@/lib/ai/llm";
import { translateLines } from "@/lib/services/translate";

export const runtime = "nodejs";

const Line = z.object({
  id: z.string().min(1).max(200),
  speaker: z.enum(["client", "team"]),
  text: z.string().min(1).max(5000),
});

const TranslateBody = z.object({
  meetingId: z.string().optional(),
  lines: z.array(Line).min(1).max(30),
  context: z.array(Line).max(10).default([]),
});

export const POST = handle(async (req: Request) => {
  const body = await readJson(req, TranslateBody);
  if (!hasLlmKey()) {
    throw new HttpError(503, "Roman Urdu captions need a free GROQ_API_KEY or GEMINI_API_KEY in .env.");
  }
  const items = await translateLines(body.lines, body.context, body.meetingId);
  return NextResponse.json({ items });
});
