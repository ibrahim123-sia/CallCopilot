"use client";

import React, { Suspense, use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, Pencil, Play, Trash2 } from "lucide-react";
import { api, notifyClientsChanged, useApi } from "@/lib/client/api";
import { ClientRecord, MeetingRecord } from "@/lib/types";
import { formatLocalDate } from "@/lib/time";
import { BriefPanel } from "@/components/client/BriefPanel";
import { ChatTab } from "@/components/client/ChatTab";
import { DocumentsTab, DocumentSummary } from "@/components/client/DocumentsTab";
import { MeetingsTab } from "@/components/client/MeetingsTab";
import { StartMeetingDialog } from "@/components/meeting/StartMeetingDialog";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";

interface ClientPayload {
  client: ClientRecord;
  meetings: MeetingRecord[];
  documents: DocumentSummary[];
  openItems: string[];
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "meetings", label: "Meetings" },
  { id: "chat", label: "Chat" },
  { id: "documents", label: "Documents" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="p-8 text-sm text-stone-500">Loading…</div>}>
      <ClientWorkspace id={id} />
    </Suspense>
  );
}

function ClientWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { data, setData, error, reload } = useApi<ClientPayload>(`/api/clients/${id}`);
  const tab = (TABS.find((t) => t.id === searchParams.get("tab"))?.id ?? "overview") as TabId;
  const [startOpen, setStartOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const setTab = (t: TabId) => router.replace(`/clients/${id}${t === "overview" ? "" : `?tab=${t}`}`, { scroll: false });

  if (error) return <div className="p-8 text-sm text-red-600">{error}</div>;
  if (!data) return <div className="p-8 text-sm text-stone-500">Loading…</div>;

  const { client, meetings, documents, openItems } = data;
  const lastMeeting = meetings.find((m) => m.wrapUp);

  const removeClient = async () => {
    if (!confirm(`Delete ${client.name} with ALL meetings, transcripts, documents and chat? This cannot be undone.`)) return;
    try {
      await api(`/api/clients/${id}`, { method: "DELETE" });
      notifyClientsChanged();
      router.push("/");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{client.name}</h1>
          <p className="text-sm text-stone-500">
            {client.company || "No company set"} · {meetings.length} meeting{meetings.length === 1 ? "" : "s"}
            {lastMeeting ? ` · last ${formatLocalDate(lastMeeting.startedAt)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-icon" onClick={() => setEditOpen(true)} title="Edit client" aria-label="Edit client">
            <Pencil className="h-4 w-4" />
          </button>
          <button className="btn btn-ghost btn-icon text-red-600" onClick={removeClient} title="Delete client" aria-label="Delete client">
            <Trash2 className="h-4 w-4" />
          </button>
          <button className="btn btn-primary btn-lg" onClick={() => setStartOpen(true)}>
            <Play className="h-4 w-4" /> Start meeting
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? "tab-active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === "meetings" && meetings.length > 0 && <span className="ml-1 text-stone-400">{meetings.length}</span>}
            {t.id === "documents" && documents.length > 0 && <span className="ml-1 text-stone-400">{documents.length}</span>}
            {t.id === "overview" && client.pendingBrief && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <BriefPanel client={client} onChange={(c) => setData({ ...data, client: c })} />
          </div>
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="section-title mb-3 flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" /> Prep for next meeting
              </h3>
              {lastMeeting?.wrapUp ? (
                <div className="mb-3 space-y-1 text-sm">
                  <p className="text-xs text-stone-500">
                    Last time ({formatLocalDate(lastMeeting.startedAt)}) — <span className="font-medium">{lastMeeting.wrapUp.outcome.status}</span>
                  </p>
                  <p>{lastMeeting.wrapUp.outcome.statement}</p>
                  {lastMeeting.wrapUp.outcome.nextStep && (
                    <p className="text-xs">
                      <span className="text-stone-500">Agreed next step:</span> {lastMeeting.wrapUp.outcome.nextStep}
                      {lastMeeting.wrapUp.outcome.nextStepDate ? ` (${lastMeeting.wrapUp.outcome.nextStepDate})` : ""}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mb-3 text-sm text-stone-500">No previous meeting summary yet.</p>
              )}
              {openItems.length > 0 && (
                <>
                  <p className="label">Still open</p>
                  <ul className="list-disc space-y-1 pl-4 text-sm">
                    {openItems.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-3 text-[11px] text-stone-500">These appear as a checklist during the live call and tick off as they get discussed.</p>
            </div>

            <div className="card p-4">
              <h3 className="section-title mb-2">Private notes</h3>
              <p className="whitespace-pre-wrap text-sm text-stone-600 dark:text-stone-300">{client.notes || "—"}</p>
            </div>
          </div>
        </div>
      )}

      {tab === "meetings" && <MeetingsTab clientId={id} meetings={meetings} onChanged={reload} />}
      {tab === "chat" && <ChatTab clientId={id} clientName={client.name} />}
      {tab === "documents" && <DocumentsTab clientId={id} documents={documents} onChanged={reload} />}

      <StartMeetingDialog open={startOpen} onClose={() => setStartOpen(false)} clientId={id} clientName={client.name} />
      <EditClientDialog
        open={editOpen}
        client={client}
        onClose={() => setEditOpen(false)}
        onSaved={(c) => {
          setData({ ...data, client: c });
          notifyClientsChanged();
        }}
      />
    </div>
  );
}

function EditClientDialog({
  open,
  client,
  onClose,
  onSaved,
}: {
  open: boolean;
  client: ClientRecord;
  onClose: () => void;
  onSaved: (c: ClientRecord) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(client.name);
  const [company, setCompany] = useState(client.company);
  const [notes, setNotes] = useState(client.notes);

  React.useEffect(() => {
    if (open) {
      setName(client.name);
      setCompany(client.company);
      setNotes(client.notes);
    }
  }, [open, client]);

  const save = async () => {
    try {
      const { client: updated } = await api<{ client: ClientRecord }>(`/api/clients/${client.id}`, {
        method: "PATCH",
        json: { name, company, notes },
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit client"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>
            Save
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Company</label>
          <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div>
          <label className="label">Private notes (used as context by the AI)</label>
          <textarea className="input min-h-[100px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Dialog>
  );
}
