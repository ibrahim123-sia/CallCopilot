import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { checkRateLimit } from "@/lib/rateLimit";
import { safeParseJson } from "@/lib/analysis/jsonRepair";
import { SYSTEM_LOOKUP_PROMPT_V1 } from "@/lib/analysis/prompts";
import { QuickLookupRequestSchema, QuickLookupResultSchema } from "@/lib/analysis/schemas";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const env = getServerEnv();

  const rate = checkRateLimit(ip, env.RATE_LIMIT_PER_MINUTE);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait a moment." },
      { status: 429 }
    );
  }

  let body: z.infer<typeof QuickLookupRequestSchema>;
  try {
    const raw = await req.json();
    body = QuickLookupRequestSchema.parse(raw);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "Invalid lookup request",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 400 }
    );
  }

  if (!env.GEMINI_API_KEY) {
    // Return high quality offline fallback lookup
    const fallbackResponse = {
      topic: {
        id: `lookup-${Date.now()}`,
        title: body.query,
        type: "technology" as const,
        isNewToTeam: !(body.teamSkills || []).some((s) =>
          s.toLowerCase().includes(body.query.toLowerCase())
        ),
        whyItMatters: `Client mentioned "${body.query}" in the live discussion.`,
        explanation: `A key concept or technical capability in modern software architecture. Typically evaluated for performance, scalability, and ease of integration into existing systems.`,
        pros: ["Improves developer productivity", "Widely adopted ecosystem"],
        cons: ["Requires learning curve and testing", "Possible operational overhead"],
        sources: [
          {
            title: `${body.query} Reference`,
            url: `https://www.google.com/search?q=${encodeURIComponent(body.query)}`,
          },
        ],
        confidence: "medium" as const,
        timestamp: Date.now(),
      },
      suggestedReply: `We have worked with similar architectures and can evaluate if ${body.query} is the best fit for your workload.`,
      crossQuestion: `What specific performance or compliance requirements are driving your interest in ${body.query}?`,
    };
    return NextResponse.json(fallbackResponse);
  }

  const prompt = `
A team member in a client meeting needs an instant lookup on: "${body.query}".
${body.context ? `Meeting context: "${body.context}"` : ""}
${body.teamSkills?.length ? `Our team skills: ${body.teamSkills.join(", ")}` : ""}

Generate a JSON object matching this schema:
{
  "topic": {
    "title": "${body.query}",
    "type": "technology" | "approach" | "business" | "regulation" | "competitor" | "other",
    "isNewToTeam": boolean (true if outside our team skills),
    "whyItMatters": "1 short line",
    "explanation": "2-3 short plain sentences",
    "pros": ["pro 1", "pro 2"],
    "cons": ["con 1", "con 2"],
    "sources": [{ "title": "Source Name", "url": "https://..." }],
    "confidence": "high" | "medium" | "low"
  },
  "suggestedReply": "What our team should say next (1-2 sentences)",
  "crossQuestion": "A smart cross question to ask the client"
}
`;

  try {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const modelName = env.GEMINI_LIVE_MODEL;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_LOOKUP_PROMPT_V1,
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "";
    const parsed = safeParseJson(text, null);
    const validated = QuickLookupResultSchema.parse(parsed);

    return NextResponse.json(validated);
  } catch (err: unknown) {
    console.error("Lookup error:", err);
    return NextResponse.json(
      {
        error: "Failed to perform lookup",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
