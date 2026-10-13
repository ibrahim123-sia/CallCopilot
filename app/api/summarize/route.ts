import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { checkRateLimit } from "@/lib/rateLimit";
import { cleanJsonString, safeParseJson } from "@/lib/analysis/jsonRepair";
import {
  SYSTEM_SUMMARIZE_PROMPT_V1,
  buildSummarizeUserPrompt,
} from "@/lib/analysis/prompts";
import { MeetingWrapUpSchema } from "@/lib/analysis/schemas";
import { CANNED_DEMO_WRAPUP } from "@/lib/analysis/cannedData";
import { MeetingWrapUp } from "@/lib/types";

const SummarizeRequestBodySchema = z.object({
  fullTranscript: z.string().max(80000),
  userNotes: z.string().max(10000).optional().default(""),
  pinnedTopics: z.array(z.string()).default([]),
  teamProfile: z.object({
    companyName: z.string().default("Software Services Agency"),
    coreSkills: z.array(z.string()).default([]),
    industries: z.array(z.string()).default([]),
    excludedAreas: z.array(z.string()).default([]),
    knownTopics: z.array(z.string()).default([]),
  }),
  callContext: z.object({
    clientName: z.string().default("Client"),
    projectName: z.string().default("Project"),
    meetingGoal: z.string().default("Discovery"),
    language: z.enum(["en", "ur", "auto"]).default("en"),
  }),
  isDemo: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const env = getServerEnv();

  const rate = checkRateLimit(ip, 20);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Summarization rate limit exceeded. Please wait a moment." },
      { status: 429 }
    );
  }

  let body: z.infer<typeof SummarizeRequestBodySchema>;
  try {
    const raw = await req.json();
    body = SummarizeRequestBodySchema.parse(raw);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "Invalid summarize payload",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 400 }
    );
  }

  if (!env.GEMINI_API_KEY) {
    if (body.isDemo || process.env.NODE_ENV !== "production") {
      // Return realistic canned wrap up merged with any user scratchpad notes
      const wrapUpCopy: MeetingWrapUp = {
        ...CANNED_DEMO_WRAPUP,
        notes: body.userNotes || CANNED_DEMO_WRAPUP.notes,
      };
      return NextResponse.json(wrapUpCopy);
    }
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY is not configured on the server. Please configure it in .env to generate live summaries, or run in Demo Mode.",
      },
      { status: 503 }
    );
  }

  const prompt = buildSummarizeUserPrompt(
    body.fullTranscript,
    body.userNotes,
    body.pinnedTopics,
    body.teamProfile,
    body.callContext
  );

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const modelName = env.GEMINI_MODEL || "gemini-2.5-flash";

  let rawOutput = "";
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_SUMMARIZE_PROMPT_V1,
        responseMimeType: "application/json",
      },
    });

    rawOutput = response.text || "";
  } catch (apiError: unknown) {
    console.error("Gemini wrap-up generation error:", apiError);
    if (body.isDemo) {
      return NextResponse.json(CANNED_DEMO_WRAPUP);
    }
    return NextResponse.json(
      {
        error: "Failed to generate meeting wrap-up",
        details: apiError instanceof Error ? apiError.message : String(apiError),
      },
      { status: 502 }
    );
  }

  try {
    const cleaned = cleanJsonString(rawOutput);
    const parsed = JSON.parse(cleaned);

    // Ensure all tasks conform to anti-hallucination tagging rules
    if (Array.isArray(parsed.tasks)) {
      parsed.tasks = parsed.tasks.map((task: Record<string, unknown>, idx: number) => ({
        id: task.id || `task-${Date.now()}-${idx}`,
        title: task.title || "Action item",
        details: task.details || "",
        owner: task.owner || "Our Team",
        dueDate: task.dueDate || undefined,
        isSuggested: Boolean(task.isSuggested),
        isClientRequested: Boolean(task.isClientRequested),
        priority: task.priority || "medium",
        sourceQuote: task.sourceQuote || undefined,
        completed: Boolean(task.completed),
      }));
    }

    const validated: MeetingWrapUp = MeetingWrapUpSchema.parse(parsed);
    return NextResponse.json(validated);
  } catch (parseError: unknown) {
    console.warn("Meeting wrap-up parse error, attempting repair:", parseError);
    const repaired = safeParseJson<MeetingWrapUp | null>(rawOutput, null);
    if (repaired && repaired.outcome && repaired.executiveSummary) {
      const validated = MeetingWrapUpSchema.safeParse(repaired);
      if (validated.success) {
        return NextResponse.json(validated.data);
      }
    }

    if (body.isDemo) {
      return NextResponse.json(CANNED_DEMO_WRAPUP);
    }

    return NextResponse.json(
      {
        error: "Malformed meeting wrap-up generated by model",
        details: parseError instanceof Error ? parseError.message : String(parseError),
      },
      { status: 502 }
    );
  }
}
