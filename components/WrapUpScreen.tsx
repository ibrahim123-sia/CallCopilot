"use client";

import React, { useState } from "react";
import {
  FileDown,
  Copy,
  Check,
  Trash2,
  Plus,
  ArrowLeft,
  Mail,
  FileText,
  AlertTriangle,
  Download,
  Lock,
  Globe,
} from "lucide-react";
import {
  CallContext,
  ExportOptions,
  MeetingWrapUp,
  OutcomeStatus,
  ReportAudience,
  TaskItem,
  TranscriptEntry,
} from "@/lib/types";
import {
  downloadBlob,
  generateMarkdownReport,
  generatePlainTranscriptText,
} from "@/lib/export";
import { triggerPrintOrSavePdf } from "@/lib/pdf/pdfGenerator";

interface WrapUpScreenProps {
  wrapUp: MeetingWrapUp;
  transcript: TranscriptEntry[];
  callContext: CallContext;
  callDurationSeconds: number;
  exportOptions: ExportOptions;
  onUpdateExportOptions: (opts: Partial<ExportOptions>) => void;
  onUpdateWrapUp: (updated: MeetingWrapUp) => void;
  onBackToCall: () => void;
  onClearEverything: () => void;
}

export function WrapUpScreen({
  wrapUp,
  transcript,
  callContext,
  callDurationSeconds,
  exportOptions,
  onUpdateExportOptions,
  onUpdateWrapUp,
  onBackToCall,
  onClearEverything,
}: WrapUpScreenProps) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const durationStr = `${Math.floor(callDurationSeconds / 60)}m ${callDurationSeconds % 60}s`;
  const dateStr = new Date().toISOString().substring(0, 10);

  const metadata = {
    clientName: callContext.clientName || "Client",
    projectName: callContext.projectName || "Software Project",
    dateStr,
    durationStr,
  };

  const handleAudienceChange = (audience: ReportAudience) => {
    onUpdateExportOptions({
      audience,
      // If switching to client-facing, force internal sections off
      includeInternalSections: audience === "internal" ? exportOptions.includeInternalSections : false,
    });
  };

  // Task Mutations
  const handleToggleTask = (id: string) => {
    const updatedTasks = wrapUp.tasks.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    onUpdateWrapUp({ ...wrapUp, tasks: updatedTasks });
  };

  const handleDeleteTask = (id: string) => {
    const updatedTasks = wrapUp.tasks.filter((t) => t.id !== id);
    onUpdateWrapUp({ ...wrapUp, tasks: updatedTasks });
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask: TaskItem = {
      id: `task-manual-${Date.now()}`,
      title: newTaskTitle.trim(),
      details: "",
      owner: "Our Team",
      isSuggested: false,
      isClientRequested: false,
      priority: "medium",
      completed: false,
    };
    onUpdateWrapUp({ ...wrapUp, tasks: [...wrapUp.tasks, newTask] });
    setNewTaskTitle("");
  };

  const copyEmail = () => {
    const emailContent = `Subject: ${wrapUp.followUpEmail.subject}\n\n${wrapUp.followUpEmail.body}`;
    navigator.clipboard.writeText(emailContent);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const copyMarkdown = () => {
    const md = generateMarkdownReport(wrapUp, exportOptions, transcript, metadata);
    navigator.clipboard.writeText(md);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const md = generateMarkdownReport(wrapUp, exportOptions, transcript, metadata);
    const safeClient = metadata.clientName.replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadBlob(md, `Meeting-Report_${safeClient}_${dateStr}.md`, "text/markdown");
  };

  const handleDownloadTranscriptTxt = () => {
    const txt = generatePlainTranscriptText(transcript);
    const safeClient = metadata.clientName.replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadBlob(txt, `Call-Transcript_${safeClient}_${dateStr}.txt`, "text/plain");
  };

  const handleDownloadPdf = () => {
    triggerPrintOrSavePdf(wrapUp, exportOptions, transcript, metadata);
  };

  const isClientMode = exportOptions.audience === "client";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-surface-border bg-surface px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToCall}
            className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400 hover:text-foreground font-medium px-2 py-1 rounded hover:bg-surface-subtle"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Resume Call</span>
          </button>
          <div className="h-4 w-[1px] bg-surface-border" />
          <h1 className="text-sm font-semibold tracking-tight text-foreground">
            Meeting Wrap-Up & Report
          </h1>
          <span className="text-[11px] font-mono text-stone-400">
            ({metadata.clientName} • {metadata.durationStr})
          </span>
        </div>

        {/* Audience Toggle & Actions */}
        <div className="flex items-center gap-3">
          {/* Audience Switcher */}
          <div className="flex items-center bg-surface-subtle p-0.5 rounded-lg border border-surface-border text-xs">
            <button
              onClick={() => handleAudienceChange("client")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all font-medium ${
                isClientMode
                  ? "bg-surface text-foreground shadow-subtle border border-surface-border"
                  : "text-stone-500 hover:text-foreground"
              }`}
            >
              <Globe className="w-3 h-3 text-sky-600 dark:text-sky-400" />
              <span>Client-Facing</span>
            </button>
            <button
              onClick={() => handleAudienceChange("internal")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all font-medium ${
                !isClientMode
                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/50"
                  : "text-stone-500 hover:text-amber-700 dark:hover:text-amber-300"
              }`}
            >
              <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Internal Team</span>
            </button>
          </div>

          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 transition-opacity shadow-subtle"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>
        </div>
      </header>

      {/* Main Wrap-Up Layout: Left Content, Right Options */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Editable Report Sections */}
        <div className="lg:col-span-2 space-y-6">
          {/* Audience Alert Notice */}
          <div
            className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
              isClientMode
                ? "bg-sky-50/50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/40 text-sky-900 dark:text-sky-300"
                : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/40 text-amber-900 dark:text-amber-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {isClientMode ? (
                <Globe className="w-4 h-4 text-sky-600 shrink-0" />
              ) : (
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>
                <strong>{isClientMode ? "Client-Facing Mode Active:" : "Internal Team Mode Active:"}</strong>{" "}
                {isClientMode
                  ? "Internal strategy, red flags, and 'New to us' research will be excluded from the generated PDF."
                  : "All confidential internal risks, buying signals, and team research notes will be included in the export."}
              </span>
            </div>
          </div>

          {/* 1. Meeting Outcome Box */}
          <section className="bg-surface border-2 border-stone-800 dark:border-stone-200 rounded-xl p-5 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-stone-500">
                Meeting Outcome Statement
              </span>

              {/* Status Select */}
              <select
                value={wrapUp.outcome.status}
                onChange={(e) =>
                  onUpdateWrapUp({
                    ...wrapUp,
                    outcome: {
                      ...wrapUp.outcome,
                      status: e.target.value as OutcomeStatus,
                    },
                  })
                }
                className="text-xs font-semibold px-2 py-0.5 rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 border-none focus:outline-none"
              >
                <option value="Agreed">Agreed</option>
                <option value="Needs follow-up">Needs follow-up</option>
                <option value="Undecided">Undecided</option>
                <option value="Not a fit">Not a fit</option>
              </select>
            </div>

            <textarea
              value={wrapUp.outcome.statement}
              onChange={(e) =>
                onUpdateWrapUp({
                  ...wrapUp,
                  outcome: { ...wrapUp.outcome, statement: e.target.value },
                })
              }
              rows={3}
              className="w-full text-sm font-medium text-foreground bg-transparent border-0 focus:ring-0 p-0 resize-y leading-relaxed"
            />

            <div className="pt-2 border-t border-surface-border grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] uppercase font-mono text-stone-500 block mb-0.5">
                  Agreed Next Step
                </label>
                <input
                  type="text"
                  value={wrapUp.outcome.nextStep}
                  onChange={(e) =>
                    onUpdateWrapUp({
                      ...wrapUp,
                      outcome: { ...wrapUp.outcome, nextStep: e.target.value },
                    })
                  }
                  className="w-full px-2 py-1 bg-surface-subtle border border-surface-border rounded text-foreground font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-stone-500 block mb-0.5">
                  Target Date / Time
                </label>
                <input
                  type="text"
                  value={wrapUp.outcome.nextStepDate || ""}
                  onChange={(e) =>
                    onUpdateWrapUp({
                      ...wrapUp,
                      outcome: {
                        ...wrapUp.outcome,
                        nextStepDate: e.target.value,
                      },
                    })
                  }
                  placeholder="e.g. Next Tuesday at 2 PM"
                  className="w-full px-2 py-1 bg-surface-subtle border border-surface-border rounded text-foreground"
                />
              </div>
            </div>
          </section>

          {/* 2. Executive Summary */}
          <section className="bg-surface border border-surface-border rounded-xl p-5 shadow-card space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Executive Summary
            </h2>
            <textarea
              value={wrapUp.executiveSummary}
              onChange={(e) =>
                onUpdateWrapUp({ ...wrapUp, executiveSummary: e.target.value })
              }
              rows={4}
              className="w-full text-xs text-foreground bg-transparent border border-surface-border rounded p-2.5 resize-y leading-relaxed"
            />

            {/* Key Discussion Points */}
            <div className="space-y-2 pt-2 border-t border-surface-border">
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">
                Key Discussion Points
              </span>
              <div className="space-y-2">
                {wrapUp.keyDiscussionPoints.map((pt, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded bg-surface-subtle border border-surface-border text-xs"
                  >
                    <input
                      type="text"
                      value={pt.topic}
                      onChange={(e) => {
                        const updated = [...wrapUp.keyDiscussionPoints];
                        updated[i].topic = e.target.value;
                        onUpdateWrapUp({
                          ...wrapUp,
                          keyDiscussionPoints: updated,
                        });
                      }}
                      className="font-semibold text-foreground bg-transparent border-0 p-0 mb-1 w-full"
                    />
                    <textarea
                      value={pt.summary}
                      onChange={(e) => {
                        const updated = [...wrapUp.keyDiscussionPoints];
                        updated[i].summary = e.target.value;
                        onUpdateWrapUp({
                          ...wrapUp,
                          keyDiscussionPoints: updated,
                        });
                      }}
                      rows={2}
                      className="text-stone-600 dark:text-stone-400 bg-transparent border-0 p-0 w-full text-xs resize-y"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 3. Client Requirements & Expectations */}
          <section className="bg-surface border border-surface-border rounded-xl p-5 shadow-card space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Client Requirements & Constraints
            </h2>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-foreground block">
                Deliverables:
              </label>
              <ul className="list-disc list-inside space-y-1 text-xs text-stone-600 dark:text-stone-400">
                {wrapUp.clientRequirements.deliverables.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-surface-border text-xs">
              <div>
                <span className="font-semibold text-foreground block mb-0.5">Budget Constraints:</span>
                <input
                  type="text"
                  value={wrapUp.clientRequirements.budgetConstraints || ""}
                  onChange={(e) =>
                    onUpdateWrapUp({
                      ...wrapUp,
                      clientRequirements: {
                        ...wrapUp.clientRequirements,
                        budgetConstraints: e.target.value,
                      },
                    })
                  }
                  className="w-full px-2 py-1 bg-surface-subtle border border-surface-border rounded text-xs"
                />
              </div>
              <div>
                <span className="font-semibold text-foreground block mb-0.5">Timeline Constraints:</span>
                <input
                  type="text"
                  value={wrapUp.clientRequirements.timelineConstraints || ""}
                  onChange={(e) =>
                    onUpdateWrapUp({
                      ...wrapUp,
                      clientRequirements: {
                        ...wrapUp.clientRequirements,
                        timelineConstraints: e.target.value,
                      },
                    })
                  }
                  className="w-full px-2 py-1 bg-surface-subtle border border-surface-border rounded text-xs"
                />
              </div>
            </div>
          </section>

          {/* 4. Action Items & Deliverables Table */}
          <section className="bg-surface border border-surface-border rounded-xl p-5 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Action Items & Deliverables ({wrapUp.tasks.length})
                </h2>
                <p className="text-[11px] text-stone-400">
                  Tasks tagged &quot;Requested by client&quot; were explicitly assigned. Inferred items are tagged &quot;Suggested&quot;.
                </p>
              </div>
            </div>

            {/* Tasks list */}
            <div className="divide-y divide-surface-border">
              {wrapUp.tasks.map((task) => (
                <div
                  key={task.id}
                  className="py-2.5 flex items-start gap-2.5 text-xs first:pt-0 last:pb-0"
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => handleToggleTask(task.id)}
                    className="mt-1 rounded border-stone-300 text-stone-900 focus:ring-stone-500 cursor-pointer"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-semibold ${
                          task.completed ? "line-through text-stone-400" : "text-foreground"
                        }`}
                      >
                        {task.title}
                      </span>
                      {task.isClientRequested && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200">
                          Requested by client
                        </span>
                      )}
                      {task.isSuggested && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 border border-dashed border-stone-300">
                          Suggested
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-stone-500">
                        Owner: {task.owner} {task.dueDate ? `• Due: ${task.dueDate}` : ""}
                      </span>
                    </div>

                    {task.details && (
                      <p className="text-stone-500 text-[11px]">{task.details}</p>
                    )}
                    {task.sourceQuote && (
                      <p className="text-stone-400 text-[10px] italic">
                        &ldquo;{task.sourceQuote}&rdquo;
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1 rounded text-stone-400 hover:text-red-600 transition-colors"
                    title="Delete task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Task Form */}
            <form onSubmit={handleAddTask} className="flex gap-2 pt-2 border-t border-surface-border">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add custom task or action item..."
                className="flex-1 px-2.5 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded text-foreground focus:outline-none"
              />
              <button
                type="submit"
                className="flex items-center gap-1 px-3 py-1.5 bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 text-xs font-medium rounded hover:opacity-90"
              >
                <Plus className="w-3 h-3" />
                <span>Add Task</span>
              </button>
            </form>
          </section>

          {/* 5. Internal Sections (ONLY SHOWN IN INTERNAL MODE) */}
          {!isClientMode && (
            <section className="bg-amber-50/20 dark:bg-amber-950/10 border-2 border-amber-400/80 rounded-xl p-5 shadow-card space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                  Internal Team Strategy & Risk Assessment (Confidential)
                </h2>
              </div>

              {/* Risks */}
              {wrapUp.risksAndRedFlags.length > 0 && (
                <div className="space-y-1.5 text-xs">
                  <span className="font-semibold text-stone-700 dark:text-stone-300">
                    Risks & Technical Debt:
                  </span>
                  <div className="space-y-1">
                    {wrapUp.risksAndRedFlags.map((r, i) => (
                      <div key={i} className="p-2 rounded bg-surface border border-surface-border">
                        <strong className="text-red-700 dark:text-red-400">{r.risk}:</strong>{" "}
                        <span className="text-stone-600 dark:text-stone-400">{r.mitigation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New to Team Research List */}
              {wrapUp.newToTeamResearch.length > 0 && (
                <div className="space-y-1.5 text-xs">
                  <span className="font-semibold text-amber-800 dark:text-amber-300">
                    New to Our Team - Research Follow-Up:
                  </span>
                  <div className="space-y-1">
                    {wrapUp.newToTeamResearch.map((item, i) => (
                      <div key={i} className="p-2 rounded bg-surface border border-surface-border">
                        <strong>{item.topic}:</strong> {item.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* 6. Follow-Up Email Draft */}
          <section className="bg-surface border border-surface-border rounded-xl p-5 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-stone-500" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Follow-Up Email Draft
                </h2>
              </div>
              <button
                onClick={copyEmail}
                className="flex items-center gap-1 text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-foreground px-2 py-1 rounded bg-surface-subtle border border-surface-border"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Email</span>
                  </>
                )}
              </button>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-stone-500 block mb-0.5">
                Subject Line
              </label>
              <input
                type="text"
                value={wrapUp.followUpEmail.subject}
                onChange={(e) =>
                  onUpdateWrapUp({
                    ...wrapUp,
                    followUpEmail: {
                      ...wrapUp.followUpEmail,
                      subject: e.target.value,
                    },
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded font-semibold text-foreground"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-stone-500 block mb-0.5">
                Email Body
              </label>
              <textarea
                value={wrapUp.followUpEmail.body}
                onChange={(e) =>
                  onUpdateWrapUp({
                    ...wrapUp,
                    followUpEmail: {
                      ...wrapUp.followUpEmail,
                      body: e.target.value,
                    },
                  })
                }
                rows={8}
                className="w-full p-2.5 text-xs bg-surface-subtle border border-surface-border rounded text-foreground resize-y leading-relaxed"
              />
            </div>
          </section>
        </div>

        {/* Right 1 Column: Export Options, Downloads & Wipes */}
        <div className="space-y-6">
          {/* Export Options Card */}
          <div className="bg-surface border border-surface-border rounded-xl p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                PDF & Export Options
              </h3>
              <span className="text-[10px] font-mono text-stone-400">Preferences</span>
            </div>

            {/* Checkbox Options */}
            <div className="space-y-2.5 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeOutcome}
                  onChange={(e) =>
                    onUpdateExportOptions({ includeOutcome: e.target.checked })
                  }
                  className="rounded border-stone-300 text-stone-900"
                />
                <span className="text-foreground">Meeting outcome and next steps</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeSummary}
                  onChange={(e) =>
                    onUpdateExportOptions({ includeSummary: e.target.checked })
                  }
                  className="rounded border-stone-300 text-stone-900"
                />
                <span className="text-foreground">Summary and key discussion points</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeRequirements}
                  onChange={(e) =>
                    onUpdateExportOptions({ includeRequirements: e.target.checked })
                  }
                  className="rounded border-stone-300 text-stone-900"
                />
                <span className="text-foreground">Client requirements & scope</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeDecisions}
                  onChange={(e) =>
                    onUpdateExportOptions({ includeDecisions: e.target.checked })
                  }
                  className="rounded border-stone-300 text-stone-900"
                />
                <span className="text-foreground">Decisions and open questions</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeTasks}
                  onChange={(e) =>
                    onUpdateExportOptions({ includeTasks: e.target.checked })
                  }
                  className="rounded border-stone-300 text-stone-900"
                />
                <span className="text-foreground">Tasks and action items</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeNotes}
                  onChange={(e) =>
                    onUpdateExportOptions({ includeNotes: e.target.checked })
                  }
                  className="rounded border-stone-300 text-stone-900"
                />
                <span className="text-foreground">Meeting scratchpad notes</span>
              </label>

              {/* Internal Section Checkbox (Disabled in Client mode) */}
              <label
                className={`flex items-center gap-2 ${
                  isClientMode ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={isClientMode}
                  checked={!isClientMode && exportOptions.includeInternalSections}
                  onChange={(e) =>
                    onUpdateExportOptions({ includeInternalSections: e.target.checked })
                  }
                  className="rounded border-stone-300 text-stone-900"
                />
                <span className="text-foreground">
                  Internal strategy & risks (Internal mode only)
                </span>
              </label>

              {/* Transcript Appendix Checkbox (UNCHECKED BY DEFAULT) */}
              <div className="pt-2 border-t border-surface-border">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeFullTranscript}
                    onChange={(e) =>
                      onUpdateExportOptions({ includeFullTranscript: e.target.checked })
                    }
                    className="mt-0.5 rounded border-stone-300 text-stone-900"
                  />
                  <div>
                    <span className="text-foreground font-medium block">
                      Full word-for-word transcript (Appendix)
                    </span>
                    <span className="text-[10px] text-stone-500 block leading-tight mt-0.5">
                      Some people only want the summary, tasks and outcome. Turn this on only if you want the complete transcript included.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Company Name in Report */}
            <div className="pt-2 border-t border-surface-border">
              <label className="text-[11px] text-stone-500 block mb-1">
                Prepared By (Header in PDF)
              </label>
              <input
                type="text"
                value={exportOptions.companyName}
                onChange={(e) =>
                  onUpdateExportOptions({ companyName: e.target.value })
                }
                className="w-full px-2.5 py-1 text-xs bg-surface-subtle border border-surface-border rounded text-foreground"
              />
            </div>
          </div>

          {/* Quick Export Downloads Card */}
          <div className="bg-surface border border-surface-border rounded-xl p-5 shadow-card space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Download & Share
            </h3>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={handleDownloadPdf}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 transition-opacity"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Download Executive PDF</span>
              </button>

              <button
                onClick={copyMarkdown}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded border border-surface-border hover:bg-surface-subtle text-foreground transition-colors"
              >
                {copiedMarkdown ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>Copy as Markdown</span>
              </button>

              <button
                onClick={handleDownloadMarkdown}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded border border-surface-border hover:bg-surface-subtle text-foreground transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Markdown (.md)</span>
              </button>

              <button
                onClick={handleDownloadTranscriptTxt}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded border border-surface-border hover:bg-surface-subtle text-foreground transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Download Transcript (.txt)</span>
              </button>
            </div>
          </div>

          {/* Danger Zone: Clear Everything */}
          <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Wipe In-Memory Call</span>
            </div>
            <p className="text-[11px] text-stone-500">
              Permanently purges the live in-memory transcript and notes. Make sure you have exported your PDF or markdown first.
            </p>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-xs text-red-600 dark:text-red-400 font-medium hover:underline pt-1 block"
            >
              Clear everything...
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal to Clear Everything */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Confirm Data Wipe</span>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              Have you downloaded your PDF or Markdown report? Because CallCopilot is stateless, clearing everything will immediately erase the transcript from browser memory.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium rounded border border-surface-border text-foreground hover:bg-surface-subtle"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowClearConfirm(false);
                  onClearEverything();
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700"
              >
                Yes, Wipe Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
