"use client";

import React, { useState } from "react";
import { AlertTriangle, Check, Compass, Copy, History, Loader2, MessageSquareQuote, Radar } from "lucide-react";
import { CrossQuestion, RedFlag, Signal, SuggestedReply } from "@/lib/types";

interface Props {
  intent: string;
  replies: SuggestedReply[];
  questions: CrossQuestion[];
  signals: Signal[];
  redFlags: RedFlag[];
  analyzing: boolean;
  notice: string | null;
  provider?: string | null;
}

export function SuggestionsPanel({ intent, replies, questions, signals, redFlags, analyzing, notice, provider }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1200);
  };

  const empty = !intent && replies.length === 0 && questions.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-2.5">
        <h2 className="section-title">AI copilot</h2>
        <span className="flex items-center gap-1.5 text-[11px] text-stone-500">
          {analyzing ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> thinking
            </>
          ) : (
            provider && <span className="chip chip-neutral capitalize">via {provider}</span>
          )}
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {notice && <p className="rounded-md bg-amber-50 p-2 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{notice}</p>}

        {empty && (
          <p className="py-10 text-center text-sm text-stone-500">
            Suggestions appear a few seconds after the client speaks — what to say next, sharp follow-up questions, and
            anything that connects to earlier meetings.
          </p>
        )}

        {intent && (
          <div className="rounded-lg border border-surface-border bg-surface-subtle p-3">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              <Compass className="h-3.5 w-3.5" /> Client wants
            </p>
            <p className="text-sm font-medium leading-snug">{intent}</p>
          </div>
        )}

        {replies.length > 0 && (
          <div className="space-y-2">
            <p className="section-title flex items-center gap-1.5">
              <MessageSquareQuote className="h-3.5 w-3.5" /> Say next
            </p>
            {replies.map((r, i) => (
              <div key={i} className={`group rounded-lg border p-3 ${i === 0 ? "border-foreground/40 bg-surface" : "border-surface-border bg-surface"}`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">{r.tone}</span>
                  <button onClick={() => copy(`r${i}`, r.text)} className="btn btn-ghost px-1.5 py-0.5 text-[10px]" aria-label="Copy reply">
                    {copied === `r${i}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <p className={`leading-relaxed ${i === 0 ? "text-[15px] font-medium" : "text-sm"}`}>{r.text}</p>
              </div>
            ))}
          </div>
        )}

        {questions.length > 0 && (
          <div className="space-y-2">
            <p className="section-title">Ask next</p>
            {questions.map((q, i) => (
              <div key={i} className="rounded-lg border border-surface-border bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{q.question}</p>
                  <button onClick={() => copy(`q${i}`, q.question)} className="btn btn-ghost px-1.5 py-0.5" aria-label="Copy question">
                    {copied === `q${i}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {q.basedOn === "history" && /^[MD]\d+$/.test((q.reference || "").trim()) && (
                    <span className="chip chip-history">
                      <History className="h-3 w-3" /> from {q.reference!.trim()}
                    </span>
                  )}
                  <span className="text-[11px] text-stone-500">{q.whyAsk}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {signals.length > 0 && (
          <div className="space-y-1.5">
            <p className="section-title flex items-center gap-1.5">
              <Radar className="h-3.5 w-3.5" /> Signals
            </p>
            {signals.map((s, i) => (
              <div key={i} className="rounded-md border border-surface-border bg-surface px-2.5 py-2 text-xs">
                <span className="chip chip-neutral mr-1.5 uppercase">{s.type}</span>
                {s.note}
                {s.quote && <p className="mt-0.5 italic text-stone-500">&ldquo;{s.quote}&rdquo;</p>}
              </div>
            ))}
          </div>
        )}

        {redFlags.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-red-200 bg-red-50/60 p-3 dark:border-red-900/50 dark:bg-red-950/20">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-red-800 dark:text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" /> Watch out
            </p>
            {redFlags.map((r, i) => (
              <div key={i} className="text-xs">
                <p className="font-medium text-red-900 dark:text-red-200">{r.issue}</p>
                <p className="text-stone-600 dark:text-stone-400">{r.recommendation}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
