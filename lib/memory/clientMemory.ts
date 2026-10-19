import "server-only";
import * as repo from "../db/repo";
import { ClientBrief, ClientRecord, DocumentRecord, MeetingRecord, MeetingWrapUp, TopicSource } from "../types";
import { formatLocalDate } from "../time";
import { ClientCorpus, RetrievedChunk, SourceDoc } from "./retrieval";

export interface PastMeeting {
  ref: string;
  meeting: MeetingRecord;
}

export interface ClientMemory {
  client: ClientRecord;
  /** Newest first; excludes the meeting currently in progress. */
  pastMeetings: PastMeeting[];
  documents: Array<DocumentRecord & { ref: string }>;
  openItems: string[];
  corpus: ClientCorpus;
}

const cache = new Map<string, { signature: string; memory: ClientMemory }>();

function signatureFor(client: ClientRecord, meetings: MeetingRecord[], docs: DocumentRecord[]): string {
  const m = meetings.map((x) => `${x.id}:${x.status}:${x.endedAt ?? 0}`).join(",");
  const d = docs.map((x) => x.id).join(",");
  return `${client.updatedAt}|${m}|${d}`;
}

export async function loadClientMemory(clientId: string, opts: { excludeMeetingId?: string } = {}): Promise<ClientMemory | null> {
  const client = await repo.getClient(clientId);
  if (!client) return null;

  const meetings = (await repo.listMeetings(clientId)).filter(
    (m) => m.id !== opts.excludeMeetingId && m.status !== "live"
  );
  const docs = await repo.listDocuments(clientId);

  const key = `${clientId}:${opts.excludeMeetingId ?? ""}`;
  const signature = signatureFor(client, meetings, docs);
  const cached = cache.get(key);
  if (cached && cached.signature === signature) return cached.memory;

  // Citation refs are chronological (M1 = first meeting) so they stay stable over time
  const chronological = [...meetings].sort((a, b) => a.startedAt - b.startedAt);
  const pastMeetings: PastMeeting[] = chronological
    .map((meeting, i) => ({ ref: `M${i + 1}`, meeting }))
    .reverse();
  const documents = [...docs]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((d, i) => ({ ...d, ref: `D${i + 1}` }));

  const meetingTexts = await Promise.all(pastMeetings.map(({ meeting }) => meetingCorpusText(meeting)));
  const sources: SourceDoc[] = [
    ...pastMeetings.map(({ ref, meeting }, i) => ({
      ref,
      kind: "meeting" as const,
      title: meeting.title,
      date: meeting.startedAt,
      text: meetingTexts[i],
    })),
    ...documents.map((d) => ({ ref: d.ref, kind: "document" as const, title: d.title, date: d.createdAt, text: d.text })),
  ];

  const memory: ClientMemory = {
    client,
    pastMeetings,
    documents,
    openItems: computeOpenItems(client.brief, pastMeetings.map((p) => p.meeting)),
    corpus: new ClientCorpus(sources),
  };
  cache.set(key, { signature, memory });
  return memory;
}

async function meetingCorpusText(meeting: MeetingRecord): Promise<string> {
  const parts: string[] = [];
  if (meeting.wrapUp) parts.push(formatWrapUpCompact(meeting.wrapUp));
  if (meeting.notes) parts.push(`Notes: ${meeting.notes}`);
  const segments = await repo.listSegments(meeting.id);
  if (segments.length) {
    parts.push(
      segments.map((s) => `${s.speaker === "client" ? "Client" : "Our Team"}: ${s.text}`).join("\n")
    );
  }
  return parts.join("\n\n");
}

/** Things still unresolved going into the next meeting: brief open questions, our promises, open tasks. */
export function computeOpenItems(brief: ClientBrief | null, pastMeetings: MeetingRecord[], max = 12): string[] {
  const items: string[] = [];
  const seen = new Set<string>();
  const push = (s: string | undefined) => {
    const t = s?.trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    items.push(t);
  };

  brief?.openQuestions.forEach(push);
  brief?.ourCommitments.forEach((c) => push(`We committed: ${c}`));

  const last = pastMeetings.find((m) => m.wrapUp);
  last?.wrapUp?.openQuestions.forEach(push);
  last?.wrapUp?.tasks.filter((t) => !t.completed).forEach((t) => push(`Task (${t.owner}): ${t.title}`));

  return items.slice(0, max);
}

export function formatWrapUpCompact(w: MeetingWrapUp): string {
  const lines: string[] = [];
  lines.push(`Outcome (${w.outcome.status}): ${w.outcome.statement}`);
  if (w.outcome.nextStep) lines.push(`Next step: ${w.outcome.nextStep}${w.outcome.nextStepDate ? ` (${w.outcome.nextStepDate})` : ""}`);
  if (w.executiveSummary) lines.push(`Summary: ${w.executiveSummary}`);
  if (w.clientRequirements.deliverables.length) lines.push(`Deliverables: ${w.clientRequirements.deliverables.join("; ")}`);
  if (w.clientRequirements.budgetConstraints) lines.push(`Budget: ${w.clientRequirements.budgetConstraints}`);
  if (w.clientRequirements.timelineConstraints) lines.push(`Timeline: ${w.clientRequirements.timelineConstraints}`);
  if (w.decisions.length) lines.push(`Decisions: ${w.decisions.join("; ")}`);
  if (w.openQuestions.length) lines.push(`Open questions: ${w.openQuestions.join("; ")}`);
  if (w.tasks.length) {
    lines.push(
      `Tasks: ${w.tasks
        .map((t) => `${t.title} [${t.owner}${t.dueDate ? `, due ${t.dueDate}` : ""}${t.completed ? ", done" : ""}]`)
        .join("; ")}`
    );
  }
  return lines.join("\n");
}

export function formatBrief(brief: ClientBrief | null): string {
  if (!brief || !brief.summary) return "(No client brief yet — this may be the first meeting.)";
  const lines = [`Summary: ${brief.summary}`];
  const list = (label: string, arr: string[]) => {
    if (arr.length) lines.push(`${label}: ${arr.join("; ")}`);
  };
  if (brief.stakeholders.length) {
    lines.push(`Stakeholders: ${brief.stakeholders.map((s) => `${s.name} (${s.role})${s.notes ? ` — ${s.notes}` : ""}`).join("; ")}`);
  }
  list("Goals", brief.goals);
  list("Requirements", brief.requirements);
  if (brief.budget) lines.push(`Budget: ${brief.budget}`);
  if (brief.timeline) lines.push(`Timeline: ${brief.timeline}`);
  list("Tech stack", brief.techStack);
  list("Decisions so far", brief.decisions);
  list("Open questions", brief.openQuestions);
  list("What we committed to", brief.ourCommitments);
  list("What the client committed to", brief.clientCommitments);
  list("Preferences / style", brief.preferences);
  list("Risks", brief.risks);
  return lines.join("\n");
}

/** Static part of the prompt: who the client is and what happened in recent meetings. */
export function formatMemoryForPrompt(memory: ClientMemory, opts: { recentMeetings?: number; maxChars?: number } = {}): string {
  const { recentMeetings = 3, maxChars = 12000 } = opts;
  const parts: string[] = [];
  parts.push(`CLIENT: ${memory.client.name}${memory.client.company ? ` (${memory.client.company})` : ""}`);
  if (memory.client.notes) parts.push(`Our private notes about this client: ${memory.client.notes}`);
  parts.push(`CLIENT BRIEF (living memory):\n${formatBrief(memory.client.brief)}`);

  const recent = memory.pastMeetings.filter((p) => p.meeting.wrapUp).slice(0, recentMeetings);
  if (recent.length) {
    parts.push(
      `PREVIOUS MEETINGS (newest first):\n${recent
        .map(({ ref, meeting }) => `[${ref}] ${formatLocalDate(meeting.startedAt)} — ${meeting.title}\n${formatWrapUpCompact(meeting.wrapUp!)}`)
        .join("\n\n")}`
    );
  } else {
    parts.push("PREVIOUS MEETINGS: none recorded.");
  }

  if (memory.openItems.length) {
    parts.push(`OPEN ITEMS CARRIED OVER:\n${memory.openItems.map((o) => `- ${o}`).join("\n")}`);
  }

  if (memory.documents.length) {
    parts.push(`REFERENCE DOCUMENTS ON FILE: ${memory.documents.map((d) => `[${d.ref}] ${d.title}`).join(", ")}`);
  }

  const text = parts.join("\n\n");
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n[... client memory truncated ...]` : text;
}

export function formatRetrieved(chunks: RetrievedChunk[]): string {
  if (!chunks.length) return "";
  return chunks
    .map((c) => `[${c.ref}] ${c.kind === "meeting" ? "Meeting" : "Document"} "${c.title}" (${formatLocalDate(c.date)}):\n${c.text}`)
    .join("\n---\n");
}

export function sourcesForRefs(memory: ClientMemory, refs: string[]): TopicSource[] {
  const out: TopicSource[] = [];
  for (const ref of Array.from(new Set(refs))) {
    const m = memory.pastMeetings.find((p) => p.ref === ref);
    if (m) {
      out.push({ title: `${ref}: ${m.meeting.title} (${formatLocalDate(m.meeting.startedAt)})`, url: `/meetings/${m.meeting.id}` });
      continue;
    }
    const d = memory.documents.find((x) => x.ref === ref);
    if (d) out.push({ title: `${ref}: ${d.title}`, url: `/clients/${memory.client.id}?tab=documents` });
  }
  return out;
}
