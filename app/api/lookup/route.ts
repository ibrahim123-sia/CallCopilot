import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/http";
import { hasLlmKey } from "@/lib/ai/llm";
import { QuickLookupRequestSchema } from "@/lib/analysis/schemas";
import { runQuickLookup } from "@/lib/services/analysis";

export const runtime = "nodejs";

export const POST = handle(async (req: Request) => {
  const body = await readJson(req, QuickLookupRequestSchema);

  if (!hasLlmKey()) {
    // Offline placeholder so the UI still works without a key
    return NextResponse.json({
      topic: {
        id: `lookup-${Date.now()}`,
        title: body.query,
        type: "other",
        isNewToTeam: !(body.teamSkills || []).some((s) => s.toLowerCase().includes(body.query.toLowerCase())),
        whyItMatters: "Add a free GROQ_API_KEY or GEMINI_API_KEY to get a real explanation.",
        explanation: "Quick lookup needs an AI key. Groq (console.groq.com) and Gemini (aistudio.google.com) both have free keys.",
        pros: [],
        cons: [],
        sources: [{ title: `Search "${body.query}"`, url: `https://www.google.com/search?q=${encodeURIComponent(body.query)}` }],
        confidence: "low",
        timestamp: Date.now(),
      },
    });
  }

  const result = await runQuickLookup(body.query, body.context || "", body.teamSkills || []);
  return NextResponse.json({ ...result, topic: { ...result.topic, id: `lookup-${Date.now()}`, timestamp: Date.now() } });
});
