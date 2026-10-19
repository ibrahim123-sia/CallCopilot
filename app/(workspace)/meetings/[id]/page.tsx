"use client";

import React, { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, FileDown, FileText, Languages, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { api, ApiError, notifyClientsChanged, useApi } from "@/lib/client/api";
import { ClientRecord, MeetingRecord, MeetingWrapUp, StoredSegment } from "@/lib/types";
import { formatDuration, formatLocalDate } from "@/lib/time";
import { downloadBlob, generateMarkdownReport, generatePlainTranscriptText } from "@/lib/export";
import { DEFAULT_EXPORT_OPTIONS } from "@/lib/defaults";
import { WrapUpView } from "@/components/meeting/WrapUpView";
import { TranscriptView } from "@/components/meeting/TranscriptView";
import { ExportDialog } from "@/components/meeting/ExportDialog";
import { MeetingStatusChip } from "@/components/meeting/MeetingStatusChip";
import { useToast } from "@/components/ui/Toast";

interface Payload {
  meeting: MeetingRecord;
  client: ClientRecord | null;
  segments: StoredSegment[];
}

type Tab = "summary" | "transcript" | "notes";

export default function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { data, setData, error } = useApi<Payload>(`/api/meetings/${id}`);
  const [tab, setTab] = useState<Tab>("summary");
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<"side-by-side" | "stacked">("side-by-side");
  const [showTranslation, setShowTranslation] = useState(true);
  const [translating, setTranslating] = useState<string | null>(null);
  const autoTried = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<Partial<MeetingRecord>>({});

  const summarize = useCallback(async () => {
    setSummarizing(true);
    setSummaryError(null);
    try {
      const res = await api<{ meeting: MeetingRecord }>(`/api/meetings/${id}/summarize`, { method: "POST" });
      setData((prev) => (prev ? { ...prev, meeting: res.meeting } : prev));
      notifyClientsChanged();
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Summary failed");
    } finally {
      setSummarizing(false);
    }
  }, [id, setData]);

  // A meeting that just ended is summarized automatically on first open
  useEffect(() => {
    if (!data || autoTried.current) return;
    autoTried.current = true;
    if (!data.meeting.wrapUp && data.meeting.status === "ended") void summarize();
  }, [data, summarize]);

  const persist = (patch: Partial<MeetingRecord>) => {
    if (!data) return;
    setData({ ...data, meeting: { ...data.meeting, ...patch } });
    setSaveState("saving");
    // Merge edits made within the debounce window so none are dropped
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const toSave = pendingPatch.current;
      pendingPatch.current = {};
      try {
        await api(`/api/meetings/${id}`, { method: "PATCH", json: toSave });
        setSaveState("saved");
      } catch (err) {
        setSaveState("idle");
        toast(err instanceof Error ? err.message : "Save failed", "error");
      }
    }, 800);
  };

  const translateMissing = async () => {
    if (!data) return;
    const missing = data.segments.filter((s) => !s.translation);
    let done = 0;
    try {
      for (let i = 0; i < missing.length; i += 20) {
        const batch = missing.slice(i, i + 20);
        setTranslating(`${done}/${missing.length}`);
        const context = data.segments.filter((s) => s.seq < batch[0].seq).slice(-3);
        const { items } = await api<{ items: Array<{ id: string; romanUrdu: string }> }>("/api/translate", {
          method: "POST",
          json: {
            meetingId: id,
            lines: batch.map((s) => ({ id: s.id, speaker: s.speaker, text: s.text })),
            context: context.map((s) => ({ id: s.id, speaker: s.speaker, text: s.text })),
          },
        });
        const map = new Map(items.map((t) => [t.id, t.romanUrdu]));
        setData((prev) =>
          prev ? { ...prev, segments: prev.segments.map((s) => (map.has(s.id) ? { ...s, translation: map.get(s.id)! } : s)) } : prev
        );
        done += batch.length;
      }
      toast("Roman Urdu added", "success");
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 429 ? `${err.message} Translated ${done} lines so far — try again shortly.` : err instanceof Error ? err.message : "Translation failed";
      toast(msg, "error");
    } finally {
      setTranslating(null);
    }
  };

  const remove = async () => {
    if (!data || !confirm("Delete this meeting, its transcript and summary? This cannot be undone.")) return;
    await api(`/api/meetings/${id}`, { method: "DELETE" });
    notifyClientsChanged();
    router.push(`/clients/${data.meeting.clientId}?tab=meetings`);
  };

  if (error) return <div className="p-8 text-sm text-red-600">{error}</div>;
  if (!data) return <div className="p-8 text-sm text-stone-500">Loading…</div>;

  const { meeting, client, segments } = data;
  const clientName = client?.name || "Client";
  const meta = {
    clientName,
    projectName: meeting.title,
    dateStr: formatLocalDate(meeting.startedAt),
    durationStr: meeting.durationSeconds ? formatDuration(meeting.durationSeconds) : "—",
  };
  const entries = segments.map((s) => ({ id: s.id, speaker: s.speaker, text: s.text, timestamp: s.timestamp, isFinal: true, channel: (s.speaker === "client" ? 1 : 0) as 0 | 1 }));
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]+/g, "_");
  const talkTotal = meeting.clientTalkSeconds + meeting.teamTalkSeconds;
  const missingTranslations = segments.filter((s) => !s.translation).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8">
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <Link href={`/clients/${meeting.clientId}?tab=meetings`} className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {clientName}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            className="w-full bg-transparent text-xl font-semibold tracking-tight focus:outline-none"
            value={meeting.title}
            onChange={(e) => persist({ title: e.target.value })}
            aria-label="Meeting title"
          />
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <span>{formatLocalDate(meeting.startedAt)}</span>
            {meeting.durationSeconds > 0 && <span>· {formatDuration(meeting.durationSeconds)}</span>}
            {talkTotal > 0 && <span>· client spoke {Math.round((meeting.clientTalkSeconds / talkTotal) * 100)}%</span>}
            <MeetingStatusChip status={meeting.status} />
            {saveState === "saving" && <span>Saving…</span>}
            {saveState === "saved" && <span className="text-emerald-600">Saved</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost btn-icon text-red-600" onClick={remove} title="Delete meeting" aria-label="Delete meeting">
            <Trash2 className="h-4 w-4" />
          </button>
          {segments.length > 0 && (
            <button className="btn btn-secondary" onClick={() => downloadBlob(generatePlainTranscriptText(entries), `${safe(clientName)}_transcript_${meta.dateStr}.txt`, "text/plain")}>
              <FileText className="h-3.5 w-3.5" /> Transcript .txt
            </button>
          )}
          {meeting.wrapUp && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() =>
                  downloadBlob(
                    generateMarkdownReport(meeting.wrapUp!, { ...DEFAULT_EXPORT_OPTIONS, includeFullTranscript: true, includeNotes: true }, entries, meta),
                    `${safe(clientName)}_${safe(meeting.title)}_${meta.dateStr}.md`,
                    "text/markdown"
                  )
                }
              >
                Markdown
              </button>
              <button className="btn btn-primary" onClick={() => setExportOpen(true)}>
                <FileDown className="h-3.5 w-3.5" /> Download PDF
              </button>
            </>
          )}
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {(["summary", "transcript", "notes"] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab capitalize ${tab === t ? "tab-active" : ""}`} onClick={() => setTab(t)}>
            {t}
            {t === "transcript" && <span className="ml-1 text-stone-400">{segments.length}</span>}
          </button>
        ))}
      </nav>

      {tab === "summary" &&
        (meeting.wrapUp ? (
          <WrapUpView wrapUp={meeting.wrapUp} onChange={(w: MeetingWrapUp) => persist({ wrapUp: w })} />
        ) : (
          <div className="card flex flex-col items-center gap-3 p-10 text-center">
            {summarizing ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-stone-500" />
                <p className="text-sm font-medium">Writing the summary and updating the client brief…</p>
                <p className="text-xs text-stone-500">{segments.length} transcript lines · usually 10–40 seconds</p>
              </>
            ) : (
              <>
                {summaryError ? <AlertCircle className="h-6 w-6 text-red-600" /> : <FileText className="h-6 w-6 text-stone-400" />}
                <p className="text-sm font-medium">{summaryError ? "Summary could not be generated" : "No summary yet"}</p>
                {summaryError && <p className="max-w-md text-xs text-stone-500">{summaryError}</p>}
                <p className="max-w-md text-xs text-stone-500">The transcript is saved, so nothing is lost. You can retry any time.</p>
                <button className="btn btn-primary" onClick={summarize}>
                  <RefreshCw className="h-3.5 w-3.5" /> {summaryError ? "Retry summary" : "Generate summary"}
                </button>
              </>
            )}
          </div>
        ))}

      {tab === "transcript" && (
        <div className="card flex h-[calc(100vh-17rem)] min-h-[420px] flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-surface-border p-3">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-stone-400" />
              <input className="input py-1 pl-8 text-xs" placeholder="Search transcript" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={showTranslation} onChange={(e) => setShowTranslation(e.target.checked)} /> Roman Urdu
            </label>
            {showTranslation && (
              <div className="segmented">
                <button aria-pressed={layout === "side-by-side"} onClick={() => setLayout("side-by-side")}>
                  Side by side
                </button>
                <button aria-pressed={layout === "stacked"} onClick={() => setLayout("stacked")}>
                  Stacked
                </button>
              </div>
            )}
            {showTranslation && missingTranslations > 0 && (
              <button className="btn btn-secondary" onClick={translateMissing} disabled={Boolean(translating)}>
                {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                {translating ? `Translating ${translating}` : `Translate ${missingTranslations} lines`}
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1">
            <TranscriptView
              rows={segments}
              layout={layout}
              showTranslation={showTranslation}
              pendingLabel="not translated"
              autoScroll={false}
              search={search}
              clientLabel={clientName}
              emptyText="No transcript for this meeting."
            />
          </div>
        </div>
      )}

      {tab === "notes" && (
        <div className="card p-4">
          <label className="label" htmlFor="meeting-notes">
            Your notes (used in the summary and client memory)
          </label>
          <textarea id="meeting-notes" className="input min-h-[300px]" value={meeting.notes} onChange={(e) => persist({ notes: e.target.value })} />
        </div>
      )}

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} meetingId={id} hasTranslations={segments.some((s) => s.translation)} />
    </div>
  );
}
