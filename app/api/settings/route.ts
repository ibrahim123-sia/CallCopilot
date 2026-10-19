import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { handle, readJson } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { AppSettings } from "@/lib/types";

export const runtime = "nodejs";

function status() {
  const env = getServerEnv();
  return {
    geminiConfigured: Boolean(env.GEMINI_API_KEY),
    groqConfigured: Boolean(env.GROQ_API_KEY),
    deepgramConfigured: Boolean(env.DEEPGRAM_API_KEY),
    models: {
      live: env.GEMINI_LIVE_MODEL,
      translate: env.GEMINI_TRANSLATE_MODEL,
      summary: env.GEMINI_MODEL,
      stt: env.GEMINI_STT_MODEL,
    },
    groqModels: { live: env.GROQ_LIVE_MODEL, translate: env.GROQ_TRANSLATE_MODEL, summary: env.GROQ_MODEL },
  };
}

export const GET = handle(async () => NextResponse.json({ settings: await repo.getSettings(), status: status() }));

const StringList = z.array(z.string().trim().min(1).max(100)).max(200);

const SettingsPatch = z.object({
  teamProfile: z
    .object({
      companyName: z.string().max(120),
      coreSkills: StringList,
      industries: StringList,
      excludedAreas: StringList,
      knownTopics: StringList,
    })
    .partial()
    .optional(),
  exportOptions: z
    .object({
      audience: z.enum(["client", "internal"]),
      includeOutcome: z.boolean(),
      includeSummary: z.boolean(),
      includeRequirements: z.boolean(),
      includeDecisions: z.boolean(),
      includeTasks: z.boolean(),
      includeNotes: z.boolean(),
      includeInternalSections: z.boolean(),
      includeFullTranscript: z.boolean(),
      includeTranslation: z.boolean(),
      companyName: z.string().max(120),
    })
    .partial()
    .optional(),
  pacing: z
    .object({
      analysisMinIntervalSec: z.number().min(5).max(120),
      translationEnabled: z.boolean(),
      translationBatchSec: z.number().min(2).max(60),
    })
    .partial()
    .optional(),
  sttProvider: z.enum(["gemini", "deepgram"]).optional(),
  llmPrimary: z.enum(["groq", "gemini"]).optional(),
  captionLayout: z.enum(["side-by-side", "stacked"]).optional(),
});

export const PUT = handle(async (req: Request) => {
  const patch = await readJson(req, SettingsPatch);
  const settings = await repo.saveSettings(patch as Partial<AppSettings>);
  return NextResponse.json({ settings, status: status() });
});
