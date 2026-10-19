import "server-only";
import * as repo from "../db/repo";
import { HttpError, notFound } from "../http";
import { buildPrintableHtml } from "../pdf/printTemplate";
import { formatDuration, formatLocalDate } from "../time";
import { ExportOptions, TranscriptEntry } from "../types";

const flag = (v: string | null) => (v === null ? undefined : v === "1" || v === "true");

/**
 * Builds the meeting report HTML (used for the server PDF and the printable fallback page).
 * Query flags: audience=client|internal, transcript, translation, notes, internal (1/0);
 * they override the saved export defaults for this one report.
 */
export async function buildMeetingReport(meetingId: string, q: URLSearchParams): Promise<{ html: string; filename: string }> {
  const meeting = (await repo.getMeeting(meetingId)) ?? notFound("Meeting not found");
  if (!meeting.wrapUp) throw new HttpError(409, "This meeting has no summary yet. Generate the summary first.");
  const client = await repo.getClient(meeting.clientId);
  const settings = await repo.getSettings();

  const audience = q.get("audience") === "internal" ? "internal" : q.get("audience") === "client" ? "client" : settings.exportOptions.audience;
  const options: ExportOptions = {
    ...settings.exportOptions,
    companyName: settings.exportOptions.companyName || settings.teamProfile.companyName,
    audience,
    includeFullTranscript: flag(q.get("transcript")) ?? settings.exportOptions.includeFullTranscript,
    includeTranslation: flag(q.get("translation")) ?? settings.exportOptions.includeTranslation,
    includeNotes: flag(q.get("notes")) ?? settings.exportOptions.includeNotes,
    includeInternalSections: audience === "internal" && (flag(q.get("internal")) ?? settings.exportOptions.includeInternalSections),
  };

  const segments = await repo.listSegments(meetingId);
  const transcript: TranscriptEntry[] = segments.map((s) => ({
    id: s.id,
    speaker: s.speaker,
    text: s.text,
    timestamp: s.timestamp,
    isFinal: true,
    channel: s.speaker === "client" ? 1 : 0,
  }));
  const translations = Object.fromEntries(segments.filter((s) => s.translation).map((s) => [s.id, s.translation!]));

  const metadata = {
    clientName: client?.name || "Client",
    projectName: meeting.title,
    dateStr: formatLocalDate(meeting.startedAt),
    durationStr: meeting.durationSeconds ? formatDuration(meeting.durationSeconds) : "—",
  };

  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "Meeting";
  const filename = `${safe(metadata.clientName)}_${safe(meeting.title)}_${metadata.dateStr}${audience === "internal" ? "_internal" : ""}.pdf`;

  return { html: buildPrintableHtml(meeting.wrapUp, options, transcript, metadata, translations), filename };
}
