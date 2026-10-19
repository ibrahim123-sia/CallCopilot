"use client";

import React, { useState } from "react";
import { Check, Copy, Lock, Mail, Plus, Trash2 } from "lucide-react";
import { MeetingWrapUp, OutcomeStatus, TaskItem } from "@/lib/types";

const STATUSES: OutcomeStatus[] = ["Agreed", "Needs follow-up", "Undecided", "Not a fit"];

const toLines = (arr: string[]) => arr.join("\n");
const fromLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function ListEditor({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState(toLines(value));
  React.useEffect(() => setText(toLines(value)), [value]);
  return (
    <div>
      <label className="label">{label} (one per line)</label>
      <textarea
        className="input min-h-[72px] text-sm"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(fromLines(text))}
      />
    </div>
  );
}

export function WrapUpView({ wrapUp, onChange }: { wrapUp: MeetingWrapUp; onChange: (w: MeetingWrapUp) => void }) {
  const [newTask, setNewTask] = useState("");
  const [copied, setCopied] = useState(false);
  const set = (patch: Partial<MeetingWrapUp>) => onChange({ ...wrapUp, ...patch });

  const updateTask = (id: string, patch: Partial<TaskItem>) =>
    set({ tasks: wrapUp.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) });

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    set({
      tasks: [
        ...wrapUp.tasks,
        {
          id: `task-manual-${Date.now()}`,
          title: newTask.trim(),
          details: "",
          owner: "Our Team",
          isSuggested: false,
          isClientRequested: false,
          priority: "medium",
          completed: false,
        },
      ],
    });
    setNewTask("");
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(`Subject: ${wrapUp.followUpEmail.subject}\n\n${wrapUp.followUpEmail.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-5">
      {/* Outcome */}
      <section className="card space-y-3 border-2 border-foreground/80 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="section-title">Outcome</h3>
          <select
            className="input w-auto py-1 text-xs font-semibold"
            value={wrapUp.outcome.status}
            onChange={(e) => set({ outcome: { ...wrapUp.outcome, status: e.target.value as OutcomeStatus } })}
            aria-label="Outcome status"
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <textarea
          className="input min-h-[72px] border-transparent bg-transparent p-0 text-sm font-medium focus:ring-0"
          value={wrapUp.outcome.statement}
          onChange={(e) => set({ outcome: { ...wrapUp.outcome, statement: e.target.value } })}
          aria-label="Outcome statement"
        />
        <div className="grid grid-cols-1 gap-3 border-t border-surface-border pt-3 sm:grid-cols-2">
          <div>
            <label className="label">Agreed next step</label>
            <input className="input" value={wrapUp.outcome.nextStep} onChange={(e) => set({ outcome: { ...wrapUp.outcome, nextStep: e.target.value } })} />
          </div>
          <div>
            <label className="label">When</label>
            <input
              className="input"
              value={wrapUp.outcome.nextStepDate ?? ""}
              placeholder="e.g. Tuesday 3 PM"
              onChange={(e) => set({ outcome: { ...wrapUp.outcome, nextStepDate: e.target.value || undefined } })}
            />
          </div>
        </div>
      </section>

      {/* Summary */}
      <section className="card space-y-3 p-5">
        <h3 className="section-title">Executive summary</h3>
        <textarea className="input min-h-[110px] text-sm" value={wrapUp.executiveSummary} onChange={(e) => set({ executiveSummary: e.target.value })} />
        {wrapUp.keyDiscussionPoints.length > 0 && (
          <div className="space-y-2 border-t border-surface-border pt-3">
            <p className="label">Key discussion points</p>
            {wrapUp.keyDiscussionPoints.map((pt, i) => (
              <div key={i} className="rounded-md border border-surface-border bg-surface-subtle p-2.5">
                <input
                  className="w-full bg-transparent text-sm font-semibold focus:outline-none"
                  value={pt.topic}
                  onChange={(e) =>
                    set({ keyDiscussionPoints: wrapUp.keyDiscussionPoints.map((p, j) => (j === i ? { ...p, topic: e.target.value } : p)) })
                  }
                />
                <textarea
                  className="mt-1 w-full resize-y bg-transparent text-sm text-stone-600 focus:outline-none dark:text-stone-300"
                  rows={2}
                  value={pt.summary}
                  onChange={(e) =>
                    set({ keyDiscussionPoints: wrapUp.keyDiscussionPoints.map((p, j) => (j === i ? { ...p, summary: e.target.value } : p)) })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Requirements */}
      <section className="card space-y-3 p-5">
        <h3 className="section-title">Requirements & constraints</h3>
        <ListEditor
          label="Deliverables"
          value={wrapUp.clientRequirements.deliverables}
          onChange={(v) => set({ clientRequirements: { ...wrapUp.clientRequirements, deliverables: v } })}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Budget</label>
            <input
              className="input"
              value={wrapUp.clientRequirements.budgetConstraints ?? ""}
              onChange={(e) => set({ clientRequirements: { ...wrapUp.clientRequirements, budgetConstraints: e.target.value || undefined } })}
            />
          </div>
          <div>
            <label className="label">Timeline</label>
            <input
              className="input"
              value={wrapUp.clientRequirements.timelineConstraints ?? ""}
              onChange={(e) => set({ clientRequirements: { ...wrapUp.clientRequirements, timelineConstraints: e.target.value || undefined } })}
            />
          </div>
        </div>
        <ListEditor
          label="Technical preferences"
          value={wrapUp.clientRequirements.technicalPreferences}
          onChange={(v) => set({ clientRequirements: { ...wrapUp.clientRequirements, technicalPreferences: v } })}
        />
      </section>

      {/* Decisions */}
      <section className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <ListEditor label="Decisions" value={wrapUp.decisions} onChange={(v) => set({ decisions: v })} />
        <ListEditor label="Open questions" value={wrapUp.openQuestions} onChange={(v) => set({ openQuestions: v })} />
      </section>

      {/* Tasks */}
      <section className="card space-y-3 p-5">
        <div>
          <h3 className="section-title">Action items ({wrapUp.tasks.length})</h3>
          <p className="text-[11px] text-stone-500">&ldquo;Requested&rdquo; = someone explicitly asked. &ldquo;Suggested&rdquo; = AI-inferred next step.</p>
        </div>
        <div className="divide-y divide-surface-border">
          {wrapUp.tasks.map((t) => (
            <div key={t.id} className="flex items-start gap-2.5 py-2.5 first:pt-0">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(t.completed)}
                onChange={() => updateTask(t.id, { completed: !t.completed })}
                aria-label={`Mark ${t.title} done`}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <input
                  className={`w-full bg-transparent text-sm font-medium focus:outline-none ${t.completed ? "text-stone-400 line-through" : ""}`}
                  value={t.title}
                  onChange={(e) => updateTask(t.id, { title: e.target.value })}
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  {t.isClientRequested && <span className="chip chip-client">Requested</span>}
                  {t.isSuggested && <span className="chip chip-neutral border-dashed">Suggested</span>}
                  <input
                    className="w-28 rounded border border-transparent bg-transparent px-1 text-[11px] text-stone-500 hover:border-surface-border focus:border-surface-border focus:outline-none"
                    value={t.owner}
                    onChange={(e) => updateTask(t.id, { owner: e.target.value })}
                    aria-label="Owner"
                  />
                  <input
                    className="w-28 rounded border border-transparent bg-transparent px-1 text-[11px] text-stone-500 hover:border-surface-border focus:border-surface-border focus:outline-none"
                    value={t.dueDate ?? ""}
                    placeholder="due date"
                    onChange={(e) => updateTask(t.id, { dueDate: e.target.value || undefined })}
                    aria-label="Due date"
                  />
                </div>
                {t.sourceQuote && <p className="text-[11px] italic text-stone-400">&ldquo;{t.sourceQuote}&rdquo;</p>}
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => set({ tasks: wrapUp.tasks.filter((x) => x.id !== t.id) })} aria-label="Delete task">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={addTask} className="flex gap-2 border-t border-surface-border pt-3">
          <input className="input" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add an action item…" />
          <button className="btn btn-secondary" type="submit">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </form>
      </section>

      {/* Internal */}
      {(wrapUp.risksAndRedFlags.length > 0 || wrapUp.newToTeamResearch.length > 0) && (
        <section className="card space-y-3 border-amber-300 bg-amber-50/30 p-5 dark:border-amber-800 dark:bg-amber-950/10">
          <h3 className="section-title flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
            <Lock className="h-3.5 w-3.5" /> Internal only — never in client-facing PDFs
          </h3>
          {wrapUp.risksAndRedFlags.length > 0 && (
            <div>
              <p className="label">Risks</p>
              <ul className="space-y-1 text-sm">
                {wrapUp.risksAndRedFlags.map((r, i) => (
                  <li key={i}>
                    <strong className="text-red-700 dark:text-red-400">{r.risk}</strong> — {r.mitigation}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {wrapUp.newToTeamResearch.length > 0 && (
            <div>
              <p className="label">New to our team — research</p>
              <ul className="space-y-1 text-sm">
                {wrapUp.newToTeamResearch.map((r, i) => (
                  <li key={i}>
                    <strong>{r.topic}</strong> — {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Email */}
      <section className="card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="section-title flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Follow-up email draft
          </h3>
          <button className="btn btn-secondary" onClick={copyEmail}>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <input
          className="input font-medium"
          value={wrapUp.followUpEmail.subject}
          onChange={(e) => set({ followUpEmail: { ...wrapUp.followUpEmail, subject: e.target.value } })}
          aria-label="Email subject"
        />
        <textarea
          className="input min-h-[200px] text-sm"
          value={wrapUp.followUpEmail.body}
          onChange={(e) => set({ followUpEmail: { ...wrapUp.followUpEmail, body: e.target.value } })}
          aria-label="Email body"
        />
      </section>
    </div>
  );
}
