import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import type { ClientBrief, MeetingWrapUp, TopicSource } from "../types";

/** One row per client. The brief is the AI-maintained "living memory" for that client. */
export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  notes: text("notes").notNull().default(""),
  brief: text("brief", { mode: "json" }).$type<ClientBrief | null>(),
  // AI-proposed brief update waiting for the user to accept/reject
  pendingBrief: text("pending_brief", { mode: "json" }).$type<ClientBrief | null>(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const meetings = sqliteTable(
  "meetings",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    goal: text("goal").notNull().default(""),
    language: text("language").notNull().default("en"),
    // live | ended | summarized | imported
    status: text("status").notNull().default("live"),
    source: text("source").notNull().default("live"), // live | demo | imported
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at"),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    clientTalkSeconds: integer("client_talk_seconds").notNull().default(0),
    teamTalkSeconds: integer("team_talk_seconds").notNull().default(0),
    notes: text("notes").notNull().default(""),
    wrapUp: text("wrap_up", { mode: "json" }).$type<MeetingWrapUp | null>(),
    pinnedTopics: text("pinned_topics", { mode: "json" }).$type<string[]>().notNull().default([]),
  },
  (t) => [index("meetings_client_idx").on(t.clientId, t.startedAt)]
);

export const transcriptSegments = sqliteTable(
  "transcript_segments",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    speaker: text("speaker").$type<"client" | "team">().notNull(),
    text: text("text").notNull(),
    translation: text("translation"), // Roman Urdu
    timestamp: integer("timestamp").notNull(),
    durationMs: integer("duration_ms"),
  },
  (t) => [index("segments_meeting_idx").on(t.meetingId, t.seq)]
);

/** Uploaded or pasted reference material (previous notes, proposals, emails). */
export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind").notNull().default("upload"), // upload | paste
    mimeType: text("mime_type").notNull().default("text/plain"),
    text: text("text").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("documents_client_idx").on(t.clientId)]
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    sources: text("sources", { mode: "json" }).$type<TopicSource[]>().notNull().default([]),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("chat_client_idx").on(t.clientId, t.createdAt)]
);

/** Key/value app settings (team profile, export defaults, AI pacing). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
});
