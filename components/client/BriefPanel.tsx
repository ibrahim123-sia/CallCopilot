"use client";

import React, { useState } from "react";
import { Check, Pencil, RefreshCw, Sparkles, X } from "lucide-react";
import { ClientBrief, ClientRecord, EMPTY_CLIENT_BRIEF } from "@/lib/types";
import { api } from "@/lib/client/api";
import { useToast } from "@/components/ui/Toast";

type ListKey =
  | "goals"
  | "requirements"
  | "techStack"
  | "decisions"
  | "openQuestions"
  | "ourCommitments"
  | "clientCommitments"
  | "preferences"
  | "risks";

const LIST_SECTIONS: Array<{ key: ListKey; label: string }> = [
  { key: "goals", label: "Goals" },
  { key: "requirements", label: "Requirements" },
  { key: "decisions", label: "Decisions so far" },
  { key: "openQuestions", label: "Open questions" },
  { key: "ourCommitments", label: "We committed to" },
  { key: "clientCommitments", label: "Client committed to" },
  { key: "techStack", label: "Tech stack" },
  { key: "preferences", label: "Preferences & style" },
  { key: "risks", label: "Risks" },
];

const linesToList = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

export function BriefPanel({ client, onChange }: { client: ClientRecord; onChange: (c: ClientRecord) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState<ClientBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const brief = client.brief;
  const pending = client.pendingBrief;

  const save = async (next: ClientBrief) => {
    setBusy(true);
    try {
      const { client: updated } = await api<{ client: ClientRecord }>(`/api/clients/${client.id}`, { method: "PATCH", json: { brief: next } });
      onChange(updated);
      setEditing(null);
      toast("Brief saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const briefAction = async (action: "accept" | "reject" | "regenerate", edited?: ClientBrief) => {
    setBusy(true);
    try {
      const { client: updated } = await api<{ client: ClientRecord }>(`/api/clients/${client.id}/brief`, {
        method: "POST",
        json: edited ? { action, brief: edited } : { action },
      });
      onChange(updated);
      setEditing(null);
      toast(action === "accept" ? "Brief updated" : action === "reject" ? "Proposal discarded" : "New proposal ready", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Request failed", "error");
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <BriefEditor
        value={editing}
        busy={busy}
        onCancel={() => setEditing(null)}
        onSave={(b) => (pending ? briefAction("accept", b) : save(b))}
        saveLabel={pending ? "Accept edited version" : "Save brief"}
      />
    );
  }

  return (
    <div className="space-y-4">
      {pending && (
        <div className="card border-violet-300 p-4 dark:border-violet-800">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-violet-500" /> AI proposed an update from the latest meeting
            </p>
            <div className="flex gap-2">
              <button className="btn btn-secondary" disabled={busy} onClick={() => briefAction("reject")}>
                <X className="h-3.5 w-3.5" /> Discard
              </button>
              <button className="btn btn-secondary" disabled={busy} onClick={() => setEditing(pending)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={() => briefAction("accept")}>
                <Check className="h-3.5 w-3.5" /> Accept
              </button>
            </div>
          </div>
          <BriefDiff before={brief ?? EMPTY_CLIENT_BRIEF} after={pending} />
        </div>
      )}

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="section-title">Client brief</h3>
          <div className="flex gap-1">
            <button className="btn btn-ghost" disabled={busy} onClick={() => briefAction("regenerate")} title="Rebuild from the latest summarized meeting">
              <RefreshCw className="h-3.5 w-3.5" /> Rebuild
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(brief ?? EMPTY_CLIENT_BRIEF)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          </div>
        </div>
        {!brief || !brief.summary ? (
          <p className="text-sm text-stone-500">
            No brief yet. It is written automatically after the first summarized meeting, or when you import notes from a
            past meeting. You can also write it yourself.
          </p>
        ) : (
          <BriefView brief={brief} />
        )}
      </div>
    </div>
  );
}

function BriefView({ brief }: { brief: ClientBrief }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="leading-relaxed">{brief.summary}</p>
      {(brief.budget || brief.timeline) && (
        <div className="flex flex-wrap gap-2">
          {brief.budget && <span className="chip chip-neutral text-xs">Budget: {brief.budget}</span>}
          {brief.timeline && <span className="chip chip-neutral text-xs">Timeline: {brief.timeline}</span>}
        </div>
      )}
      {brief.stakeholders.length > 0 && (
        <div>
          <p className="label">Stakeholders</p>
          <ul className="space-y-0.5">
            {brief.stakeholders.map((s, i) => (
              <li key={i}>
                <strong>{s.name}</strong>
                {s.role && <span className="text-stone-500"> — {s.role}</span>}
                {s.notes && <span className="text-stone-500"> · {s.notes}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {LIST_SECTIONS.filter((s) => brief[s.key].length > 0).map((s) => (
          <div key={s.key}>
            <p className="label">{s.label}</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {brief[s.key].map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function BriefDiff({ before, after }: { before: ClientBrief; after: ClientBrief }) {
  const rows: React.ReactNode[] = [];
  if (before.summary !== after.summary) {
    rows.push(
      <div key="summary">
        <p className="label">Summary</p>
        <p className="text-sm">{after.summary}</p>
      </div>
    );
  }
  for (const field of ["budget", "timeline"] as const) {
    if ((before[field] || "") !== (after[field] || "")) {
      rows.push(
        <p key={field} className="text-sm">
          <span className="label inline">{field === "budget" ? "Budget" : "Timeline"}: </span>
          {before[field] && <span className="mr-1 text-red-600 line-through">{before[field]}</span>}
          <span className="text-emerald-700 dark:text-emerald-400">{after[field] || "—"}</span>
        </p>
      );
    }
  }
  for (const s of LIST_SECTIONS) {
    const oldSet = new Set(before[s.key].map((x) => x.toLowerCase()));
    const newSet = new Set(after[s.key].map((x) => x.toLowerCase()));
    const added = after[s.key].filter((x) => !oldSet.has(x.toLowerCase()));
    const removed = before[s.key].filter((x) => !newSet.has(x.toLowerCase()));
    if (!added.length && !removed.length) continue;
    rows.push(
      <div key={s.key}>
        <p className="label">{s.label}</p>
        <ul className="space-y-0.5 text-sm">
          {added.map((x, i) => (
            <li key={`a${i}`} className="text-emerald-700 dark:text-emerald-400">
              + {x}
            </li>
          ))}
          {removed.map((x, i) => (
            <li key={`r${i}`} className="text-red-600 line-through dark:text-red-400">
              − {x}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return rows.length ? <div className="space-y-3">{rows}</div> : <p className="text-sm text-stone-500">No changes.</p>;
}

function BriefEditor({
  value,
  busy,
  onCancel,
  onSave,
  saveLabel,
}: {
  value: ClientBrief;
  busy: boolean;
  onCancel: () => void;
  onSave: (b: ClientBrief) => void;
  saveLabel: string;
}) {
  const [draft, setDraft] = useState<ClientBrief>(value);
  const [stakeholders, setStakeholders] = useState(
    value.stakeholders.map((s) => [s.name, s.role, s.notes].filter(Boolean).join(" | ")).join("\n")
  );
  const [lists, setLists] = useState<Record<ListKey, string>>(
    Object.fromEntries(LIST_SECTIONS.map((s) => [s.key, value[s.key].join("\n")])) as Record<ListKey, string>
  );

  const submit = () => {
    const next: ClientBrief = {
      ...draft,
      stakeholders: linesToList(stakeholders).map((line) => {
        const [name, role = "", notes] = line.split("|").map((x) => x.trim());
        return { name, role, ...(notes ? { notes } : {}) };
      }),
      ...(Object.fromEntries(LIST_SECTIONS.map((s) => [s.key, linesToList(lists[s.key])])) as Record<ListKey, string[]>),
    };
    onSave(next);
  };

  return (
    <div className="card space-y-4 p-4">
      <div>
        <label className="label">Summary</label>
        <textarea className="input min-h-[80px]" value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Budget</label>
          <input className="input" value={draft.budget ?? ""} onChange={(e) => setDraft({ ...draft, budget: e.target.value || undefined })} />
        </div>
        <div>
          <label className="label">Timeline</label>
          <input className="input" value={draft.timeline ?? ""} onChange={(e) => setDraft({ ...draft, timeline: e.target.value || undefined })} />
        </div>
      </div>
      <div>
        <label className="label">Stakeholders (one per line: name | role | notes)</label>
        <textarea className="input min-h-[64px] font-mono text-xs" value={stakeholders} onChange={(e) => setStakeholders(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {LIST_SECTIONS.map((s) => (
          <div key={s.key}>
            <label className="label">{s.label} (one per line)</label>
            <textarea
              className="input min-h-[72px] text-xs"
              value={lists[s.key]}
              onChange={(e) => setLists({ ...lists, [s.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
