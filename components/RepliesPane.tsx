"use client";

import React, { useState } from "react";
import {
  MessageSquareQuote,
  HelpCircle,
  Copy,
  Check,
  AlertTriangle,
  FileText,
  Search,
  Compass,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  CrossQuestion,
  RedFlag,
  Signal,
  SuggestedReply,
} from "@/lib/types";

interface RepliesPaneProps {
  clientIntent: string;
  signals: Signal[];
  suggestedReplies: SuggestedReply[];
  crossQuestions: CrossQuestion[];
  redFlags: RedFlag[];
  userNotes: string;
  onChangeNotes: (notes: string) => void;
  onQuickLookup: (phrase: string) => void;
  lookupInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function RepliesPane({
  clientIntent,
  signals,
  suggestedReplies,
  crossQuestions,
  redFlags,
  userNotes,
  onChangeNotes,
  onQuickLookup,
  lookupInputRef,
}: RepliesPaneProps) {
  const [lookupText, setLookupText] = useState("");
  const [copiedReplyIdx, setCopiedReplyIdx] = useState<number | null>(null);
  const [expandedWhyIdx, setExpandedWhyIdx] = useState<number | null>(null);

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupText.trim()) return;
    onQuickLookup(lookupText.trim());
    setLookupText("");
  };

  const copyReply = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedReplyIdx(idx);
    setTimeout(() => setCopiedReplyIdx(null), 1500);
  };

  const toggleWhyAsk = (idx: number) => {
    setExpandedWhyIdx(expandedWhyIdx === idx ? null : idx);
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Pane Header: Quick Lookup Box */}
      <div className="p-3 border-b border-surface-border bg-surface">
        <form onSubmit={handleLookupSubmit} className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-600 dark:text-stone-400" />
          <input
            ref={lookupInputRef}
            type="text"
            value={lookupText}
            onChange={(e) => setLookupText(e.target.value)}
            placeholder="Quick lookup term or tech (Press Enter)..."
            className="w-full pl-8 pr-16 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded focus:outline-none focus:ring-1 focus:ring-stone-400 dark:focus:ring-stone-600 text-foreground placeholder:text-stone-600 dark:placeholder:text-stone-400"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 px-2 py-0.5 text-[10px] font-medium bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 rounded hover:opacity-90 transition-opacity"
          >
            Lookup
          </button>
        </form>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 1. Client Intent Banner */}
        {clientIntent && (
          <div className="p-3 rounded-lg bg-surface-subtle border border-surface-border">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1">
              <Compass className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400" />
              <span>Current Client Intent</span>
            </div>
            <p className="text-xs font-medium text-foreground leading-snug">
              {clientIntent}
            </p>
          </div>
        )}

        {/* 2. Signals Ticker */}
        {signals.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-stone-600 dark:text-stone-400">
              Live Signals Detected
            </span>
            <div className="space-y-1.5">
              {signals.map((sig, i) => (
                <div
                  key={i}
                  className="p-2 rounded bg-surface border border-surface-border text-xs flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-semibold px-1 py-0.2 rounded bg-surface-muted text-stone-700 dark:text-stone-300">
                      {sig.type}
                    </span>
                  </div>
                  {sig.quote && (
                    <p className="text-stone-600 dark:text-stone-400 italic text-[11px]">
                      &ldquo;{sig.quote}&rdquo;
                    </p>
                  )}
                  <p className="text-stone-700 dark:text-stone-300 text-[11px] font-medium">
                    {sig.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Suggested Replies */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-stone-600 dark:text-stone-400">
              <MessageSquareQuote className="w-3.5 h-3.5" />
              <span>Suggested Responses</span>
            </div>
          </div>

          {suggestedReplies.length === 0 ? (
            <p className="text-xs text-stone-600 dark:text-stone-400 italic">
              Awaiting client utterance to generate tailored replies...
            </p>
          ) : (
            <div className="space-y-2">
              {suggestedReplies.map((reply, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg border border-surface-border bg-surface hover:border-stone-400 dark:hover:border-stone-600 transition-colors text-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase font-mono font-semibold text-stone-600 dark:text-stone-400">
                      {reply.tone} tone
                    </span>
                    <button
                      onClick={() => copyReply(reply.text, i)}
                      className="inline-flex items-center gap-1 text-[10px] text-stone-500 hover:text-foreground font-medium px-1.5 py-0.5 rounded hover:bg-surface-subtle transition-colors"
                      title="Copy reply"
                    >
                      {copiedReplyIdx === i ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-foreground leading-relaxed">
                    {reply.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Cross-Questions */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-stone-600 dark:text-stone-400">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Smart Cross-Questions</span>
          </div>

          {crossQuestions.length === 0 ? (
            <p className="text-xs text-stone-600 dark:text-stone-400 italic">
              Cross-questions to probe requirements will appear here...
            </p>
          ) : (
            <div className="space-y-2">
              {crossQuestions.map((cq, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg border border-surface-border bg-surface text-xs"
                >
                  <p className="font-medium text-foreground leading-snug mb-1">
                    {cq.question}
                  </p>

                  <button
                    onClick={() => toggleWhyAsk(i)}
                    className="flex items-center gap-1 text-[10px] text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 mt-1"
                  >
                    <span>Why ask this?</span>
                    {expandedWhyIdx === i ? (
                      <ChevronUp className="w-2.5 h-2.5" />
                    ) : (
                      <ChevronDown className="w-2.5 h-2.5" />
                    )}
                  </button>

                  {expandedWhyIdx === i && (
                    <p className="text-[11px] text-stone-600 dark:text-stone-400 italic mt-1.5 pt-1.5 border-t border-surface-border">
                      {cq.whyAsk}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Red Flags Warnings */}
        {redFlags.length > 0 && (
          <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-xs">
            <div className="flex items-center gap-1.5 text-red-800 dark:text-red-400 font-semibold mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Potential Red Flags</span>
            </div>
            <div className="space-y-1.5 mt-2">
              {redFlags.map((rf, i) => (
                <div key={i} className="text-[11px]">
                  <p className="text-red-900 dark:text-red-300 font-medium">
                    • {rf.issue}
                  </p>
                  <p className="text-stone-600 dark:text-stone-400 pl-3">
                    {rf.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. In-Call Scratchpad Notes */}
        <div className="pt-2 border-t border-surface-border">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>Call Notes (Exported with Wrap-Up)</span>
          </div>
          <textarea
            value={userNotes}
            onChange={(e) => onChangeNotes(e.target.value)}
            placeholder="Jot down quick thoughts, follow-up items, or pricing discussed..."
            rows={4}
            className="w-full p-2.5 text-xs bg-surface-subtle border border-surface-border rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400 dark:focus:ring-stone-600 text-foreground placeholder:text-stone-600 dark:placeholder:text-stone-400 resize-y"
          />
        </div>
      </div>
    </div>
  );
}
