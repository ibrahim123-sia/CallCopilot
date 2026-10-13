"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, ArrowDown, Copy, Check, MessageSquare } from "lucide-react";
import { TranscriptEntry } from "@/lib/types";
import { containsUrdu } from "@/lib/pdf/printTemplate";

interface TranscriptPaneProps {
  entries: TranscriptEntry[];
  interimEntry: TranscriptEntry | null;
  onSelectPhrase?: (phrase: string) => void;
}

export function TranscriptPane({
  entries,
  interimEntry,
  onSelectPhrase,
}: TranscriptPaneProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);

  // Filtered entries
  const filteredEntries = entries.filter((e) =>
    e.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Detect scroll position
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setIsScrolledUp(!isAtBottom);
  };

  // Auto-scroll to bottom on new final entry if not scrolled up
  useEffect(() => {
    if (!isScrolledUp && bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, interimEntry, isScrolledUp]);

  const scrollToBottom = () => {
    if (bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({ behavior: "smooth" });
      setIsScrolledUp(false);
    }
  };

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toISOString().substring(11, 19);
  };

  return (
    <div className="flex flex-col h-full bg-surface border-r border-surface-border">
      {/* Pane Header & Search */}
      <div className="p-3 border-b border-surface-border flex flex-col gap-2 bg-surface">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-stone-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">
              Live Transcript
            </h2>
          </div>
          <span className="text-[11px] font-mono text-stone-600 dark:text-stone-400">
            {entries.length} turns
          </span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-600 dark:text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcript..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded focus:outline-none focus:ring-1 focus:ring-stone-400 dark:focus:ring-stone-600 text-foreground placeholder:text-stone-600 dark:placeholder:text-stone-400"
          />
        </div>
      </div>

      {/* Transcript Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 relative"
        aria-live="polite"
      >
        {filteredEntries.length === 0 && !interimEntry && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-600 dark:text-stone-400">
            <MessageSquare className="w-8 h-8 mb-2 stroke-1" />
            <p className="text-xs font-medium">Listening for conversation...</p>
            <p className="text-[11px] mt-1 max-w-[200px]">
              Transcripts will appear here with speaker separation as team or client speaks.
            </p>
          </div>
        )}

        {filteredEntries.map((entry) => {
          const isClient = entry.speaker === "client";
          const isUrdu = containsUrdu(entry.text) || entry.language === "ur";

          return (
            <div
              key={entry.id}
              className={`group text-xs rounded-md p-2.5 transition-colors border ${
                isClient
                  ? "bg-sky-50/60 dark:bg-sky-950/20 border-sky-100 dark:border-sky-900/30"
                  : "bg-surface-subtle border-surface-border"
              }`}
            >
              {/* Speaker Header */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-semibold tracking-tight text-[11px] ${
                      isClient
                        ? "text-sky-700 dark:text-sky-400"
                        : "text-stone-700 dark:text-stone-300"
                    }`}
                  >
                    {isClient ? "Client" : "Our Team"}
                  </span>
                  <span className="text-[10px] font-mono text-stone-600 dark:text-stone-400">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  {onSelectPhrase && (
                    <button
                      onClick={() => onSelectPhrase(entry.text)}
                      className="px-1.5 py-0.5 text-[10px] rounded hover:bg-surface text-stone-600 dark:text-stone-400 hover:text-foreground"
                      title="Quick lookup this text"
                    >
                      Lookup
                    </button>
                  )}
                  <button
                    onClick={() => copyText(entry.id, entry.text)}
                    className="p-1 rounded hover:bg-surface text-stone-600 dark:text-stone-400 hover:text-foreground"
                    title="Copy utterance"
                  >
                    {copiedId === entry.id ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              {/* Text content */}
              <p
                className={`text-foreground leading-relaxed select-text ${
                  isUrdu ? "lang-urdu text-[13px]" : ""
                }`}
                dir={isUrdu ? "rtl" : "ltr"}
              >
                {entry.text}
              </p>
            </div>
          );
        })}

        {/* Interim Streaming Speech (shown in lighter style) */}
        {interimEntry && (
          <div
            className={`text-xs rounded-md p-2.5 border border-dashed animate-pulse ${
              interimEntry.speaker === "client"
                ? "bg-sky-50/30 dark:bg-sky-950/10 border-sky-300 dark:border-sky-800"
                : "bg-surface-subtle/50 border-surface-border"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`font-semibold text-[11px] ${
                  interimEntry.speaker === "client"
                    ? "text-sky-600 dark:text-sky-400"
                    : "text-stone-600 dark:text-stone-400"
                }`}
              >
                {interimEntry.speaker === "client" ? "Client (speaking...)" : "Our Team (speaking...)"}
              </span>
              <span className="text-[10px] font-mono text-stone-600 dark:text-stone-400">
                live
              </span>
            </div>
            <p
              className={`text-stone-500 dark:text-stone-400 italic leading-relaxed ${
                containsUrdu(interimEntry.text) ? "lang-urdu text-[13px]" : ""
              }`}
              dir={containsUrdu(interimEntry.text) ? "rtl" : "ltr"}
            >
              {interimEntry.text}
            </p>
          </div>
        )}

        <div ref={bottomAnchorRef} className="h-1" />
      </div>

      {/* Jump to latest floating pill */}
      {isScrolledUp && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 text-xs rounded-full shadow-md hover:opacity-90 transition-all z-10"
        >
          <ArrowDown className="w-3 h-3" />
          <span>Jump to latest</span>
        </button>
      )}
    </div>
  );
}
