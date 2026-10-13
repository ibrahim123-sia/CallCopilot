import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { checkRateLimit } from "@/lib/rateLimit";
import { cleanJsonString, safeParseJson } from "@/lib/analysis/jsonRepair";
import {
  SYSTEM_ANALYSIS_PROMPT_V1,
  buildAnalysisUserPrompt,
} from "@/lib/analysis/prompts";
import { AnalysisResultSchema } from "@/lib/analysis/schemas";
import { CANNED_DEMO_ANALYSIS } from "@/lib/analysis/cannedData";
import { AnalysisResult } from "@/lib/types";

const AnalyzeRequestBodySchema = z.object({
  recentTranscript: z.string().max(30000),
  rollingSummary: z.string().max(10000).optional().default(""),
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

  const rate = checkRateLimit(ip, env.RATE_LIMIT_PER_MINUTE);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Analysis rate limit exceeded. Please wait a few seconds." },
      { status: 429 }
    );
  }

  let body: z.infer<typeof AnalyzeRequestBodySchema>;
  try {
    const rawJson = await req.json();
    body = AnalyzeRequestBodySchema.parse(rawJson);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "Invalid request payload",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 400 }
    );
  }

  // If no Gemini key is set, or if requested in demo mode without key, return canned analysis
  if (!env.GEMINI_API_KEY) {
    if (body.isDemo || process.env.NODE_ENV !== "production") {
      return NextResponse.json(CANNED_DEMO_ANALYSIS);
    }
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY is not configured on the server. Please add your key to .env, or run in Demo Mode.",
      },
      { status: 503 }
    );
  }

  const userPrompt = buildAnalysisUserPrompt(
    body.recentTranscript,
    body.rollingSummary,
    body.teamProfile,
    body.callContext
  );

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const modelName = env.GEMINI_MODEL || "gemini-2.5-flash";

  let rawOutputText = "";
  const groundingSources: Array<{ title: string; url: string }> = [];

  try {
    // Attempt with Google Search grounding
    const response = await ai.models.generateContent({
      model: modelName,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_ANALYSIS_PROMPT_V1,
        responseMimeType: "application/json",
        // Enable Google Search grounding tool
        tools: [{ googleSearch: {} }],
      },
    });

    rawOutputText = response.text || "";

    // Extract search grounding metadata if available
    const candidate = response.candidates?.[0];
    const groundingChunks = (candidate as unknown as { groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } })?.groundingMetadata?.groundingChunks;
    if (Array.isArray(groundingChunks)) {
      for (const chunk of groundingChunks) {
        if (chunk.web?.uri) {
          groundingSources.push({
            title: chunk.web.title || "Google Search Source",
            url: chunk.web.uri,
          });
        }
      }
    }
  } catch (apiError: unknown) {
    console.warn("Gemini generation with search grounding failed, retrying plain JSON:", apiError);
    // Retry once without search grounding tool in case model or tier doesn't support grounding
    try {
      const fallbackResponse = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_ANALYSIS_PROMPT_V1,
          responseMimeType: "application/json",
        },
      });
      rawOutputText = fallbackResponse.text || "";
    } catch (retryError: unknown) {
      console.error("Gemini retry failed:", retryError);
      if (body.isDemo) {
        return NextResponse.json(CANNED_DEMO_ANALYSIS);
      }
      return NextResponse.json(
        {
          error: "AI analysis service is temporarily unavailable.",
          details: retryError instanceof Error ? retryError.message : String(retryError),
        },
        { status: 502 }
      );
    }
  }

  // Parse and validate with Zod
  try {
    const cleanedJson = cleanJsonString(rawOutputText);
    const parsedObj = JSON.parse(cleanedJson);

    // If grounding sources were discovered, augment topics that have no sources
    if (groundingSources.length > 0 && Array.isArray(parsedObj.topics)) {
      for (const t of parsedObj.topics) {
        if (!t.sources || t.sources.length === 0) {
          t.sources = groundingSources.slice(0, 3);
        }
      }
    }

    const validated: AnalysisResult = AnalysisResultSchema.parse(parsedObj);
    return NextResponse.json(validated);
  } catch (parseError: unknown) {
    console.warn("Zod validation failed, attempting repair:", parseError);
    const repaired = safeParseJson<AnalysisResult | null>(rawOutputText, null);
    if (repaired && repaired.topics && Array.isArray(repaired.topics)) {
      const validated = AnalysisResultSchema.safeParse(repaired);
      if (validated.success) {
        return NextResponse.json(validated.data);
      }
    }

    if (body.isDemo) {
      return NextResponse.json(CANNED_DEMO_ANALYSIS);
    }

    return NextResponse.json(
      {
        error: "AI returned malformed analysis response",
        details: parseError instanceof Error ? parseError.message : String(parseError),
      },
      { status: 502 }
    );
  }
}
