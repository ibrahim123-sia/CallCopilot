"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, Copy, Check, Languages } from "lucide-react";
import { Speaker } from "@/lib/types";
import { formatClockTime } from "@/lib/time";
import { containsUrdu } from "@/lib/pdf/printTemplate";

export interface CaptionRow {
  id: string;
  speaker: Speaker;
  text: string;
  translation?: string | null;
  timestamp: number;
}

interface Props {
  rows: CaptionRow[];
  /** In-progress lines (one per speaker) shown below the final captions. */
  interims?: CaptionRow[];
  layout: "side-by-side" | "stacked";
  showTranslation: boolean;
  /** Message shown in the Roman Urdu column when a line isn't translated (yet). */
  pendingLabel?: string;
  autoScroll?: boolean;
  search?: string;
  emptyText?: string;
  clientLabel?: string;
}

/**
 * Captions with an optional Roman Urdu column. Each English line and its translation share a
 * grid row, so the two "screens" always stay aligned and scroll together.
 */
export function TranscriptView({
  rows,
  interims = [],
  layout,
  showTranslation,
  pendingLabel = "…",
  autoScroll = true,
  search = "",
  emptyText = "Waiting for speech…",
  clientLabel = "Client",
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) => r.text.toLowerCase().includes(q) || (r.translation ?? "").toLowerCase().includes(q))
    : rows;

  const interimKey = interims.map((i) => i.text).join("|");
  useEffect(() => {
    if (!autoScroll || !pinnedToBottom) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible.length, interimKey, autoScroll, pinnedToBottom, rows]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setPinnedToBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const copy = (row: CaptionRow) => {
    navigator.clipboard.writeText(row.translation ? `${row.text}\n${row.translation}` : row.text);
    setCopied(row.id);
    setTimeout(() => setCopied(null), 1200);
  };

  const sideBySide = showTranslation && layout === "side-by-side";

  const speakerLabel = (s: Speaker) => (
    <span className={`text-[11px] font-semibold ${s === "client" ? "text-sky-700 dark:text-sky-400" : "text-stone-600 dark:text-stone-300"}`}>
      {s === "client" ? clientLabel : "You / team"}
    </span>
  );

  const englishCell = (row: CaptionRow, isInterim = false) => {
    const urdu = containsUrdu(row.text);
    return (
      <div className={`min-w-0 ${isInterim ? "opacity-70" : ""}`}>
        <div className="mb-0.5 flex items-center gap-2">
          {speakerLabel(row.speaker)}
          <span className="font-mono text-[10px] text-stone-400">{isInterim ? "speaking…" : formatClockTime(row.timestamp)}</span>
        </div>
        <p className={`text-sm leading-relaxed ${urdu ? "lang-urdu" : ""} ${isInterim ? "italic" : ""}`} dir={urdu ? "rtl" : "ltr"}>
          {row.text}
        </p>
      </div>
    );
  };

  const translationText = (row: CaptionRow) =>
    row.translation ? (
      <p className="text-sm leading-relaxed text-emerald-900 dark:text-emerald-200">{row.translation}</p>
    ) : (
      <p className="text-xs italic text-stone-400">{pendingLabel}</p>
    );

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {sideBySide && (
        <div className="grid grid-cols-2 gap-4 border-b border-surface-border bg-surface-subtle px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
          <span>English (live)</span>
          <span className="flex items-center gap-1">
            <Languages className="h-3 w-3" /> Roman Urdu
          </span>
        </div>
      )}

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
        {visible.length === 0 && interims.length === 0 && <p className="py-10 text-center text-sm text-stone-500">{q ? "No matches" : emptyText}</p>}

        <div className="space-y-1">
          {visible.map((row) => (
            <div
              key={row.id}
              className={`group relative rounded-md px-2 py-1.5 transition-colors hover:bg-surface-subtle ${
                row.speaker === "client" ? "border-l-2 border-sky-400/70" : "border-l-2 border-transparent"
              } ${sideBySide ? "grid grid-cols-2 gap-4" : ""}`}
            >
              {englishCell(row)}
              {showTranslation &&
                (sideBySide ? (
                  <div className="min-w-0 pt-[18px]">{translationText(row)}</div>
                ) : (
                  <div className="mt-1 border-l-2 border-emerald-300/60 pl-2 dark:border-emerald-700/60">{translationText(row)}</div>
                ))}
              <button
                onClick={() => copy(row)}
                className="absolute right-1 top-1 hidden rounded p-1 text-stone-400 hover:bg-surface hover:text-foreground group-hover:block"
                title="Copy"
                aria-label="Copy line"
              >
                {copied === row.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          ))}

          {!q &&
            interims.map((row) => (
              <div key={`interim-${row.speaker}`} className={`rounded-md border border-dashed border-surface-border px-2 py-1.5 ${sideBySide ? "grid grid-cols-2 gap-4" : ""}`}>
                {englishCell(row, true)}
                {sideBySide && <div />}
              </div>
            ))}
        </div>
      </div>

      {!pinnedToBottom && autoScroll && (
        <button
          onClick={() => {
            const el = scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
            setPinnedToBottom(true);
          }}
          className="btn btn-primary absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-lg"
        >
          <ArrowDown className="h-3.5 w-3.5" /> Latest
        </button>
      )}
    </div>
  );
}
