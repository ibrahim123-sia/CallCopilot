import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./index";
import { chatMessages, clients, documents, meetings, settings, transcriptSegments } from "./schema";
import {
  AppSettings,
  ChatMessageRecord,
  ClientBrief,
  ClientListItem,
  ClientRecord,
  DocumentRecord,
  MeetingRecord,
  StoredSegment,
  TopicSource,
} from "../types";
import { DEFAULT_APP_SETTINGS, mergeSettings } from "../settings";

/**
 * All queries are async so the same code runs on better-sqlite3 (local) and D1 (Cloudflare).
 * D1 allows at most 100 bound parameters per statement, so bulk writes are chunked, and D1 has
 * no interactive transactions, so none are used.
 */

const now = () => Date.now();
const uuid = () => crypto.randomUUID();

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------- clients

export async function listClients(): Promise<ClientListItem[]> {
  const rows = await getDb()
    .select({
      client: clients,
      meetingCount: sql<number>`count(${meetings.id})`,
      lastMeetingAt: sql<number | null>`max(${meetings.startedAt})`,
    })
    .from(clients)
    .leftJoin(meetings, eq(meetings.clientId, clients.id))
    .groupBy(clients.id)
    .all();

  return rows
    .map((r) => ({ ...r.client, meetingCount: Number(r.meetingCount), lastMeetingAt: r.lastMeetingAt }))
    .sort((a, b) => (b.lastMeetingAt ?? b.updatedAt) - (a.lastMeetingAt ?? a.updatedAt));
}

export async function getClient(id: string): Promise<ClientRecord | null> {
  return (await getDb().select().from(clients).where(eq(clients.id, id)).get()) ?? null;
}

export async function createClient(input: { name: string; company?: string; notes?: string }): Promise<ClientRecord> {
  const ts = now();
  const row: ClientRecord = {
    id: uuid(),
    name: input.name.trim(),
    company: input.company?.trim() ?? "",
    notes: input.notes ?? "",
    brief: null,
    pendingBrief: null,
    createdAt: ts,
    updatedAt: ts,
  };
  await getDb().insert(clients).values(row).run();
  return row;
}

export async function updateClient(
  id: string,
  patch: Partial<Pick<ClientRecord, "name" | "company" | "notes" | "brief" | "pendingBrief">>
): Promise<ClientRecord | null> {
  await getDb()
    .update(clients)
    .set({ ...patch, updatedAt: now() })
    .where(eq(clients.id, id))
    .run();
  return getClient(id);
}

export async function acceptPendingBrief(id: string, edited?: ClientBrief): Promise<ClientRecord | null> {
  const client = await getClient(id);
  if (!client) return null;
  const brief = edited ?? client.pendingBrief;
  if (!brief) return client;
  return updateClient(id, { brief, pendingBrief: null });
}

export async function deleteClient(id: string): Promise<void> {
  await getDb().delete(clients).where(eq(clients.id, id)).run();
}

// ---------------------------------------------------------------- meetings

export async function createMeeting(input: {
  clientId: string;
  title: string;
  goal?: string;
  language?: string;
  source?: string;
  status?: string;
  startedAt?: number;
}): Promise<MeetingRecord> {
  const row: MeetingRecord = {
    id: uuid(),
    clientId: input.clientId,
    title: input.title.trim() || "Meeting",
    goal: input.goal ?? "",
    language: input.language ?? "en",
    status: input.status ?? "live",
    source: input.source ?? "live",
    startedAt: input.startedAt ?? now(),
    endedAt: null,
    durationSeconds: 0,
    clientTalkSeconds: 0,
    teamTalkSeconds: 0,
    notes: "",
    wrapUp: null,
    pinnedTopics: [],
  };
  await getDb().insert(meetings).values(row).run();
  return row;
}

export async function getMeeting(id: string): Promise<MeetingRecord | null> {
  return (await getDb().select().from(meetings).where(eq(meetings.id, id)).get()) ?? null;
}

export async function listMeetings(clientId: string): Promise<MeetingRecord[]> {
  return getDb().select().from(meetings).where(eq(meetings.clientId, clientId)).orderBy(desc(meetings.startedAt)).all();
}

export async function listRecentMeetings(limit = 10): Promise<Array<MeetingRecord & { clientName: string }>> {
  const rows = await getDb()
    .select({ meeting: meetings, clientName: clients.name })
    .from(meetings)
    .innerJoin(clients, eq(clients.id, meetings.clientId))
    .orderBy(desc(meetings.startedAt))
    .limit(limit)
    .all();
  return rows.map((r) => ({ ...r.meeting, clientName: r.clientName }));
}

export async function updateMeeting(
  id: string,
  patch: Partial<Omit<MeetingRecord, "id" | "clientId">>
): Promise<MeetingRecord | null> {
  if (Object.keys(patch).length > 0) {
    await getDb().update(meetings).set(patch).where(eq(meetings.id, id)).run();
  }
  return getMeeting(id);
}

export async function deleteMeeting(id: string): Promise<void> {
  await getDb().delete(meetings).where(eq(meetings.id, id)).run();
}

// ---------------------------------------------------------------- transcript

export async function appendSegments(
  meetingId: string,
  segments: Array<Omit<StoredSegment, "meetingId" | "seq" | "translation"> & { translation?: string | null }>
): Promise<void> {
  if (segments.length === 0) return;
  const db = getDb();

  // Retried saves must not duplicate lines: skip ids that are already stored
  const existing = new Set<string>();
  for (const ids of chunk(
    segments.map((s) => s.id),
    90
  )) {
    const rows = await db
      .select({ id: transcriptSegments.id })
      .from(transcriptSegments)
      .where(and(eq(transcriptSegments.meetingId, meetingId), inArray(transcriptSegments.id, ids)))
      .all();
    rows.forEach((r) => existing.add(r.id));
  }
  const fresh = segments.filter((s, i) => !existing.has(s.id) && segments.findIndex((x) => x.id === s.id) === i);
  if (fresh.length === 0) return;

  const last = await db
    .select({ max: sql<number | null>`max(${transcriptSegments.seq})` })
    .from(transcriptSegments)
    .where(eq(transcriptSegments.meetingId, meetingId))
    .get();
  let seq = (last?.max ?? -1) + 1;

  const rows = fresh.map((s) => ({
    id: s.id,
    meetingId,
    seq: seq++,
    speaker: s.speaker,
    text: s.text,
    translation: s.translation ?? null,
    timestamp: s.timestamp,
    durationMs: s.durationMs ?? null,
  }));
  // 8 columns per row → 10 rows stays under D1's 100-parameter limit
  for (const part of chunk(rows, 10)) {
    await db.insert(transcriptSegments).values(part).onConflictDoNothing().run();
  }
}

export async function listSegments(meetingId: string): Promise<StoredSegment[]> {
  return getDb()
    .select()
    .from(transcriptSegments)
    .where(eq(transcriptSegments.meetingId, meetingId))
    .orderBy(asc(transcriptSegments.seq))
    .all();
}

export async function setTranslations(meetingId: string, items: Array<{ id: string; translation: string }>): Promise<void> {
  const db = getDb();
  for (const item of items) {
    await db
      .update(transcriptSegments)
      .set({ translation: item.translation })
      .where(and(eq(transcriptSegments.meetingId, meetingId), eq(transcriptSegments.id, item.id)))
      .run();
  }
}

// ---------------------------------------------------------------- documents

export async function createDocument(input: {
  clientId: string;
  title: string;
  text: string;
  kind?: string;
  mimeType?: string;
}): Promise<DocumentRecord> {
  const row: DocumentRecord = {
    id: uuid(),
    clientId: input.clientId,
    title: input.title.trim() || "Untitled",
    kind: input.kind ?? "upload",
    mimeType: input.mimeType ?? "text/plain",
    text: input.text,
    createdAt: now(),
  };
  await getDb().insert(documents).values(row).run();
  return row;
}

export async function listDocuments(clientId: string): Promise<DocumentRecord[]> {
  return getDb().select().from(documents).where(eq(documents.clientId, clientId)).orderBy(desc(documents.createdAt)).all();
}

export async function deleteDocument(id: string): Promise<void> {
  await getDb().delete(documents).where(eq(documents.id, id)).run();
}

// ---------------------------------------------------------------- chat

export async function listChatMessages(clientId: string, limit = 200): Promise<ChatMessageRecord[]> {
  const rows = await getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.clientId, clientId))
    // rowid breaks ties when a question and its answer are saved in the same millisecond
    .orderBy(desc(chatMessages.createdAt), desc(sql`rowid`))
    .limit(limit)
    .all();
  return rows.reverse();
}

export async function addChatMessage(input: {
  clientId: string;
  role: "user" | "assistant";
  content: string;
  sources?: TopicSource[];
}): Promise<ChatMessageRecord> {
  const row: ChatMessageRecord = {
    id: uuid(),
    clientId: input.clientId,
    role: input.role,
    content: input.content,
    sources: input.sources ?? [],
    createdAt: now(),
  };
  await getDb().insert(chatMessages).values(row).run();
  return row;
}

export async function clearChat(clientId: string): Promise<void> {
  await getDb().delete(chatMessages).where(eq(chatMessages.clientId, clientId)).run();
}

// ---------------------------------------------------------------- settings

const SETTINGS_KEY = "app";

export async function getSettings(): Promise<AppSettings> {
  const row = await getDb().select().from(settings).where(eq(settings.key, SETTINGS_KEY)).get();
  return row ? mergeSettings(DEFAULT_APP_SETTINGS, row.value as Partial<AppSettings>) : DEFAULT_APP_SETTINGS;
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = mergeSettings(await getSettings(), patch);
  await getDb()
    .insert(settings)
    .values({ key: SETTINGS_KEY, value: next })
    .onConflictDoUpdate({ target: settings.key, set: { value: next } })
    .run();
  return next;
}
