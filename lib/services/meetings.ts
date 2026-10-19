import "server-only";
import { generateJson } from "../ai/llm";
import {
  buildBriefPrompt,
  buildImportPrompt,
  buildSummarizeUserPrompt,
  SYSTEM_BRIEF_PROMPT,
  SYSTEM_IMPORT_PROMPT,
  SYSTEM_SUMMARIZE_PROMPT,
} from "../analysis/prompts";
import { ClientBriefSchema, MeetingWrapUpSchema } from "../analysis/schemas";
import { formatTranscriptForPrompt, truncateTranscriptBuffer } from "../analysis/contextBuilder";
import * as repo from "../db/repo";
import { formatBrief, formatMemoryForPrompt, formatWrapUpCompact, loadClientMemory } from "../memory/clientMemory";
import { ClientBrief, MeetingRecord, MeetingWrapUp, TranscriptEntry } from "../types";

function normalizeTasks(w: MeetingWrapUp): MeetingWrapUp {
  return {
    ...w,
    tasks: w.tasks.map((t, i) => ({ ...t, id: t.id || `task-${Date.now()}-${i}`, completed: Boolean(t.completed) })),
  };
}

/** Generates and stores the wrap-up for a finished meeting, then proposes a brief update. */
export async function summarizeMeeting(meetingId: string): Promise<MeetingRecord> {
  const meeting = await repo.getMeeting(meetingId);
  if (!meeting) throw new Error("Meeting not found");
  const client = await repo.getClient(meeting.clientId);
  if (!client) throw new Error("Client not found");

  const segments = await repo.listSegments(meetingId);
  if (segments.length === 0 && !meeting.notes.trim()) {
    throw new Error("No speech was transcribed and there are no notes, so there is nothing to summarize.");
  }

  const entries: TranscriptEntry[] = segments.map((s) => ({
    id: s.id,
    speaker: s.speaker,
    text: s.text,
    timestamp: s.timestamp,
    isFinal: true,
    channel: s.speaker === "client" ? 1 : 0,
  }));

  const memory = await loadClientMemory(meeting.clientId, { excludeMeetingId: meetingId });
  const settings = await repo.getSettings();

  const wrapUp = await generateJson({
    task: "summary",
    system: SYSTEM_SUMMARIZE_PROMPT,
    prompt: buildSummarizeUserPrompt({
      fullTranscript: entries.length
        ? truncateTranscriptBuffer(formatTranscriptForPrompt(entries), 120000)
        : "(no transcript — summarize from notes)",
      userNotes: meeting.notes,
      pinnedTopics: meeting.pinnedTopics,
      teamProfile: settings.teamProfile,
      callContext: { clientName: client.name, projectName: meeting.title, meetingGoal: meeting.goal, language: "en" },
      clientMemory: memory ? formatMemoryForPrompt(memory, { recentMeetings: 2, maxChars: 6000 }) : undefined,
    }),
    schema: MeetingWrapUpSchema,
    temperature: 0.3,
  });

  const updated = (await repo.updateMeeting(meetingId, { wrapUp: normalizeTasks(wrapUp as MeetingWrapUp), status: "summarized" }))!;

  // The brief update is a second request; if the free-tier quota trips, the wrap-up is still saved.
  try {
    await proposeBriefUpdate(meeting.clientId, updated);
  } catch (err) {
    console.warn("Brief update deferred:", err instanceof Error ? err.message : err);
  }
  return updated;
}

/** Stores an AI-merged brief as `pendingBrief`; the user reviews and accepts it. */
export async function proposeBriefUpdate(clientId: string, meeting: MeetingRecord): Promise<ClientBrief> {
  const client = await repo.getClient(clientId);
  if (!client) throw new Error("Client not found");
  if (!meeting.wrapUp) throw new Error("Meeting has no summary yet");

  const brief = await generateJson({
    task: "summary",
    system: SYSTEM_BRIEF_PROMPT,
    prompt: buildBriefPrompt(
      client.brief ? formatBrief(client.brief) : "(empty — this is the first meeting on file)",
      meeting.title,
      formatWrapUpCompact(meeting.wrapUp),
      client.name
    ),
    schema: ClientBriefSchema,
    temperature: 0.2,
  });

  // First brief for a client is applied directly; later ones wait for review.
  if (!client.brief) {
    await repo.updateClient(clientId, { brief: brief as ClientBrief, pendingBrief: null });
  } else {
    await repo.updateClient(clientId, { pendingBrief: brief as ClientBrief });
  }
  return brief as ClientBrief;
}

/** Turns notes/transcript from an earlier meeting into a past meeting in the client's memory. */
export async function importPastMeeting(input: {
  clientId: string;
  title: string;
  text: string;
  date?: number;
}): Promise<MeetingRecord> {
  const client = await repo.getClient(input.clientId);
  if (!client) throw new Error("Client not found");

  const wrapUp = await generateJson({
    task: "summary",
    system: SYSTEM_IMPORT_PROMPT,
    prompt: buildImportPrompt(input.title, truncateTranscriptBuffer(input.text, 120000), client.name),
    schema: MeetingWrapUpSchema,
    temperature: 0.2,
  });

  const meeting = await repo.createMeeting({
    clientId: input.clientId,
    title: input.title,
    source: "imported",
    status: "imported",
    startedAt: input.date ?? Date.now(),
  });
  const saved = (await repo.updateMeeting(meeting.id, {
    wrapUp: normalizeTasks(wrapUp as MeetingWrapUp),
    notes: input.text,
    endedAt: meeting.startedAt,
  }))!;

  try {
    await proposeBriefUpdate(input.clientId, saved);
  } catch (err) {
    console.warn("Brief update deferred:", err instanceof Error ? err.message : err);
  }
  return saved;
}
