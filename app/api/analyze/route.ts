import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rateLimit";
import { getServerEnv } from "@/lib/env";
import { handle, HttpError, readJson } from "@/lib/http";
import { hasLlmKey } from "@/lib/ai/llm";
import * as repo from "@/lib/db/repo";
import { runLiveAnalysis } from "@/lib/services/analysis";
import { CANNED_DEMO_ANALYSIS } from "@/lib/analysis/cannedData";

export const runtime = "nodejs";

const AnalyzeBody = z.object({
  clientId: z.string().optional(),
  meetingId: z.string().optional(),
  recentTranscript: z.string().max(30_000),
  earlierTranscript: z.string().max(12_000).default(""),
  recentClientText: z.string().max(5_000).default(""),
  callContext: z.object({
    clientName: z.string().default("Client"),
    projectName: z.string().default(""),
    meetingGoal: z.string().default(""),
    language: z.enum(["en", "ur", "auto"]).default("en"),
  }),
  isDemo: z.boolean().default(false),
});

export const POST = handle(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  if (!checkRateLimit(ip, getServerEnv().RATE_LIMIT_PER_MINUTE).allowed) {
    throw new HttpError(429, "Too many analysis requests. Please wait a few seconds.");
  }

  const body = await readJson(req, AnalyzeBody);

  if (!hasLlmKey()) {
    if (body.isDemo) return NextResponse.json(CANNED_DEMO_ANALYSIS);
    throw new HttpError(503, "No AI key configured. Add a free GROQ_API_KEY (console.groq.com) and/or GEMINI_API_KEY (aistudio.google.com) to .env.");
  }

  const result = await runLiveAnalysis({
    ...body,
    teamProfile: (await repo.getSettings()).teamProfile,
  });
  return NextResponse.json(result);
});
