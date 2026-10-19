import "server-only";
import { generateJson, generateJsonWithMeta } from "../ai/llm";
import { buildAnalysisUserPrompt, buildLookupPrompt, SYSTEM_ANALYSIS_PROMPT, SYSTEM_LOOKUP_PROMPT } from "../analysis/prompts";
import { AnalysisResultSchema, QuickLookupResultSchema } from "../analysis/schemas";
import { formatMemoryForPrompt, formatRetrieved, loadClientMemory } from "../memory/clientMemory";
import { buildQueryFromText } from "../memory/retrieval";
import { AnalysisResult, CallContext, TeamProfile } from "../types";

export interface LiveAnalysisInput {
  clientId?: string;
  meetingId?: string;
  recentTranscript: string;
  earlierTranscript: string;
  /** Latest client-side speech, used as the retrieval query. */
  recentClientText: string;
  callContext: CallContext;
  teamProfile: TeamProfile;
}

export async function buildLiveContext(input: LiveAnalysisInput): Promise<{ clientMemory?: string; retrievedContext?: string }> {
  if (!input.clientId) return {};
  const memory = await loadClientMemory(input.clientId, { excludeMeetingId: input.meetingId });
  if (!memory) return {};
  const query = buildQueryFromText(input.recentClientText || input.recentTranscript);
  const retrieved = memory.corpus.search(query, 4);
  return {
    clientMemory: formatMemoryForPrompt(memory, { recentMeetings: 2, maxChars: 8000 }),
    retrievedContext: formatRetrieved(retrieved) || undefined,
  };
}

export async function runLiveAnalysis(input: LiveAnalysisInput): Promise<AnalysisResult & { provider: string }> {
  const context = await buildLiveContext(input);
  const { data, provider } = await generateJsonWithMeta({
    task: "live",
    system: SYSTEM_ANALYSIS_PROMPT,
    prompt: buildAnalysisUserPrompt({
      recentTranscript: input.recentTranscript,
      earlierTranscript: input.earlierTranscript,
      teamProfile: input.teamProfile,
      callContext: input.callContext,
      ...context,
    }),
    schema: AnalysisResultSchema,
    temperature: 0.4,
  });
  return { ...(data as AnalysisResult), provider };
}

export async function runQuickLookup(query: string, context: string, teamSkills: string[]) {
  return generateJson({
    task: "live",
    system: SYSTEM_LOOKUP_PROMPT,
    prompt: buildLookupPrompt(query, context, teamSkills),
    schema: QuickLookupResultSchema,
    temperature: 0.3,
  });
}
