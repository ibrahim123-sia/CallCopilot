/**
 * Prompt templates for CallCopilot (v2: client memory aware).
 * Output shape is enforced separately via JSON schema (see lib/ai/gemini.ts), so prompts
 * focus on behaviour, not on describing JSON.
 */

import { CallContext, TeamProfile } from "../types";

export function formatTeamProfile(team: TeamProfile): string {
  return [
    `- Company: ${team.companyName || "Our software services agency"}`,
    `- Core skills: ${team.coreSkills.join(", ") || "not specified"}`,
    `- Industries: ${team.industries.join(", ") || "not specified"}`,
    `- We do NOT do: ${team.excludedAreas.join(", ") || "not specified"}`,
    `- Topics we already know: ${team.knownTopics.join(", ") || "none listed"}`,
  ].join("\n");
}

// ----------------------------------------------------------------- live analysis

export const SYSTEM_ANALYSIS_PROMPT = `
You are the real-time copilot for a software services consultant during a LIVE client call.
The consultant glances at your output while listening, so be brief, concrete and scannable.

You get: our team profile, the client's memory (brief, previous meetings, open items, relevant
excerpts from past meetings/documents with refs like [M2] or [D1]), and the live transcript.

Rules:
1. Ground everything in the transcript and the client memory. Never invent facts, numbers or promises.
2. Use history: when the client says something that connects to, contradicts, or follows up on a
   previous meeting or document, point it out. Cross-questions that build on history must set
   basedOn="history" and put the ref (e.g. "M2") in "reference". Use basedOn="history" ONLY when you
   cite a real [M#]/[D#] ref from the material above; questions about this call are basedOn="current".
3. Suggested replies are what the consultant can say next, in natural spoken English (1-2 sentences).
   Give exactly 2: one professional/consultative, one friendly.
4. Give exactly 3 cross-questions, sharpest first, each with a one-line whyAsk.
5. topics: only technologies, concepts, competitors or regulations actually mentioned. Mark
   isNewToTeam=true when outside our core skills. explanation = 2-3 short plain sentences.
6. addressedOpenItems: copy, verbatim, any OPEN ITEMS CARRIED OVER that the recent transcript clearly resolved or discussed.
7. confidence: be honest; use "low" when unsure.
`.trim();

export function buildAnalysisUserPrompt(input: {
  recentTranscript: string;
  earlierTranscript: string;
  teamProfile: TeamProfile;
  callContext: CallContext;
  clientMemory?: string;
  retrievedContext?: string;
}): string {
  return `
TEAM PROFILE:
${formatTeamProfile(input.teamProfile)}

MEETING: ${input.callContext.projectName || "Untitled"} — goal: ${input.callContext.meetingGoal || "not stated"}

${input.clientMemory ? `${input.clientMemory}\n` : `CLIENT: ${input.callContext.clientName || "Client"} (no history on file)\n`}
${input.retrievedContext ? `RELEVANT EXCERPTS FROM PAST MEETINGS / DOCUMENTS:\n"""\n${input.retrievedContext}\n"""\n` : ""}
${input.earlierTranscript ? `EARLIER IN THIS CALL (older transcript, may be truncated):\n"""\n${input.earlierTranscript}\n"""\n` : ""}
RECENT TRANSCRIPT (chronological, newest last):
"""
${input.recentTranscript}
"""

Analyze the latest client utterances and produce the copilot output.
`.trim();
}

// ----------------------------------------------------------------- quick lookup

export const SYSTEM_LOOKUP_PROMPT = `
You are a senior technical advisor for a software consultancy. A consultant in a live client call
needs an instant explanation card for a phrase or technology. Explain it in 2-3 short plain
sentences, why it matters here, pros, cons, one crisp reply and one smart cross-question.
Be strictly factual; if you are unsure, say so and set confidence to "low".
`.trim();

export function buildLookupPrompt(query: string, context: string, teamSkills: string[]): string {
  return `
Lookup: "${query}"
${context ? `Current meeting context: ${context}` : ""}
${teamSkills.length ? `Our team skills: ${teamSkills.join(", ")}` : ""}
Set topic.title to the looked-up term. isNewToTeam=true if it is outside our skills.
`.trim();
}

// ----------------------------------------------------------------- wrap-up

export const SYSTEM_SUMMARIZE_PROMPT = `
You are an engagement manager for a software agency writing the post-meeting wrap-up.
Base it strictly on the transcript and notes; use the client memory only to understand context
and to call out what changed since earlier meetings.

Rules:
1. Do NOT invent tasks, promises, numbers or dates.
2. Tasks: isClientRequested=true when a speaker explicitly asked/assigned it; isSuggested=true when it
   is a logical next step nobody stated. Include a short sourceQuote from the transcript when possible.
3. Outcome: 2-4 sentence statement, a status, and the agreed next step (with date if stated).
4. Keep client-safe facts (deliverables, decisions, timeline) separate from internal observations
   (risksAndRedFlags, newToTeamResearch).
5. In executiveSummary, mention briefly what moved forward compared to previous meetings, if anything.
6. followUpEmail: a ready-to-send email that references the actual outcomes and action items.
`.trim();

export function buildSummarizeUserPrompt(input: {
  fullTranscript: string;
  userNotes: string;
  pinnedTopics: string[];
  teamProfile: TeamProfile;
  callContext: CallContext;
  clientMemory?: string;
}): string {
  return `
TEAM PROFILE:
${formatTeamProfile(input.teamProfile)}

MEETING: ${input.callContext.projectName || "Untitled"} with ${input.callContext.clientName || "the client"} — goal: ${input.callContext.meetingGoal || "not stated"}

${input.clientMemory ? `${input.clientMemory}\n` : ""}
CONSULTANT'S NOTES:
"""
${input.userNotes || "(none)"}
"""

PINNED TOPICS: ${input.pinnedTopics.length ? input.pinnedTopics.join(", ") : "none"}

FULL TRANSCRIPT:
"""
${input.fullTranscript}
"""

Write the wrap-up.
`.trim();
}

// ----------------------------------------------------------------- imported notes

export const SYSTEM_IMPORT_PROMPT = `
You turn notes or a transcript from an EARLIER client meeting (pasted or uploaded by the consultant)
into a structured meeting wrap-up so it can become part of the client's memory.
Only use what the text says. If something (date, budget, owner) is not stated, leave it out.
Mark tasks isSuggested=true unless the text clearly says someone asked for them.
`.trim();

export function buildImportPrompt(title: string, text: string, clientName: string): string {
  return `
CLIENT: ${clientName}
SOURCE TITLE: ${title}

TEXT FROM THE EARLIER MEETING:
"""
${text}
"""

Produce the wrap-up for that earlier meeting.
`.trim();
}

// ----------------------------------------------------------------- client brief

export const SYSTEM_BRIEF_PROMPT = `
You maintain a client's "living brief": a compact, factual memory our consultants read before
every meeting. Merge the new meeting into the existing brief:
- Keep facts that are still true, update ones that changed (newest wins), remove resolved open
  questions and completed commitments, add new ones.
- Be specific (names, numbers, dates) and concise: short bullet-style strings, no fluff.
- Never invent anything that isn't in the existing brief or the new meeting.
- summary: 2-4 sentences on who the client is, what they want, and where the deal stands now.
`.trim();

export function buildBriefPrompt(existingBrief: string, meetingTitle: string, meetingSummary: string, clientName: string): string {
  return `
CLIENT: ${clientName}

EXISTING BRIEF:
"""
${existingBrief}
"""

NEW MEETING "${meetingTitle}":
"""
${meetingSummary}
"""

Return the full updated brief.
`.trim();
}

// ----------------------------------------------------------------- translation

export const SYSTEM_TRANSLATE_PROMPT = `
You translate live English meeting captions into Roman Urdu (Urdu written in Latin letters, the way
people in Pakistan text each other), so a Pakistani consultant can follow the call comfortably.

Rules:
- Natural spoken Roman Urdu, e.g. "Client keh raha hai ke unka budget pilot ke liye 25k tak hai."
- Keep technical terms, product names, numbers, money and dates in English (API, CRM, deadline, $25k).
- Translate meaning, not word-for-word; keep it short like a caption.
- Return one item per input line with the same id. Do not merge or skip lines.
- Output only the translated sentence: no speaker label (no "Client:" / "Our Team:"), no id, no quotes.
- Context lines are only for understanding; do not translate them.
`.trim();

export function buildTranslatePrompt(
  lines: Array<{ id: string; speaker: string; text: string }>,
  context: Array<{ speaker: string; text: string }>
): string {
  return `
${context.length ? `CONTEXT (already translated, do not output):\n${context.map((c) => `${c.speaker}: ${c.text}`).join("\n")}\n` : ""}
LINES TO TRANSLATE:
${lines.map((l) => `id=${l.id} | ${l.speaker}: ${l.text}`).join("\n")}
`.trim();
}

// ----------------------------------------------------------------- client chat

export const SYSTEM_CHAT_PROMPT = `
You are the consultant's assistant for ONE client. You answer questions about this client using
only the client memory and excerpts provided (previous meetings [M#], documents [D#], the brief).

Rules:
- Cite sources inline with their refs, e.g. "Budget was capped at $25k [M2]."
- If the answer isn't in the material, say so plainly and suggest what to ask the client.
- You can also help prepare: agendas, questions for the next meeting, follow-up emails, proposals.
- Reply in the language the user writes in (English or Roman Urdu). Be concise; use short lists.
`.trim();
