import { describe, it, expect } from "vitest";
import { toModelJsonSchema } from "../lib/ai/common";
import { AnalysisResultSchema, ClientBriefSchema } from "../lib/analysis/schemas";
import { buildAnalysisUserPrompt, buildTranslatePrompt, SYSTEM_TRANSLATE_PROMPT } from "../lib/analysis/prompts";
import { extractRefs } from "../lib/services/chat";
import { DEFAULT_TEAM_PROFILE } from "../lib/defaults";

describe("model JSON schema", () => {
  it("strips defaults and $schema but keeps structure", () => {
    const schema = toModelJsonSchema(ClientBriefSchema) as Record<string, unknown>;
    const text = JSON.stringify(schema);
    expect(text).not.toContain('"default"');
    expect(text).not.toContain("$schema");
    expect((schema.properties as Record<string, unknown>).openQuestions).toBeDefined();
  });

  it("analysis schema exposes history-aware cross questions", () => {
    const text = JSON.stringify(toModelJsonSchema(AnalysisResultSchema));
    expect(text).toContain("basedOn");
    expect(text).toContain("addressedOpenItems");
  });

  it("parses model output and fills defaults", () => {
    const parsed = AnalysisResultSchema.parse({ crossQuestions: [{ question: "Q?", whyAsk: "because" }] });
    expect(parsed.crossQuestions[0].basedOn).toBe("current");
    expect(parsed.topics).toEqual([]);
  });
});

describe("prompts", () => {
  it("live analysis prompt carries client memory and retrieved excerpts", () => {
    const prompt = buildAnalysisUserPrompt({
      recentTranscript: "[10:00:00] Client: Can we revisit pricing?",
      earlierTranscript: "",
      teamProfile: DEFAULT_TEAM_PROFILE,
      callContext: { clientName: "Acme", projectName: "Pilot", meetingGoal: "Pricing", language: "en" },
      clientMemory: "CLIENT: Acme\nPREVIOUS MEETINGS: [M1] budget 25k",
      retrievedContext: "[D1] Proposal: 24,000 USD",
    });
    expect(prompt).toContain("[M1] budget 25k");
    expect(prompt).toContain("RELEVANT EXCERPTS");
    expect(prompt).toContain("[D1] Proposal");
  });

  it("translation prompt keeps line ids and separates context", () => {
    const prompt = buildTranslatePrompt([{ id: "x1", speaker: "Client", text: "Budget is tight." }], [{ speaker: "Our Team", text: "Hello" }]);
    expect(prompt).toContain("id=x1 | Client: Budget is tight.");
    expect(prompt).toContain("CONTEXT");
    expect(SYSTEM_TRANSLATE_PROMPT).toMatch(/Roman Urdu/);
  });

  it("extracts cited refs from chat answers", () => {
    expect(extractRefs("Budget was 25k [M2], see [D1] and again [M2].")).toEqual(["M2", "D1"]);
    expect(extractRefs("Confirmed [ M1 ] and [D3 ]")).toEqual(["M1", "D3"]);
  });
});
