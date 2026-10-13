"use client";

import React, { useState } from "react";
import {
  Pin,
  X,
  ExternalLink,
  Sparkles,
  ShieldAlert,
  Layers,
} from "lucide-react";
import { TopicCard } from "@/lib/types";

interface InsightCardsPaneProps {
  cards: TopicCard[];
  onPinCard: (id: string) => void;
  onDismissCard: (id: string) => void;
  onToggleKnownStatus: (card: TopicCard) => void;
}

export function InsightCardsPane({
  cards,
  onPinCard,
  onDismissCard,
  onToggleKnownStatus,
}: InsightCardsPaneProps) {
  const [activeTab, setActiveTab] = useState<"all" | "pinned" | "new">("all");

  const visibleCards = cards.filter((c) => !c.dismissed);
  const pinnedCards = visibleCards.filter((c) => c.pinned);
  const newCards = visibleCards.filter((c) => c.isNewToTeam);

  const displayedCards =
    activeTab === "pinned"
      ? pinnedCards
      : activeTab === "new"
      ? newCards
      : visibleCards;

  return (
    <div className="flex flex-col h-full bg-surface border-r border-surface-border">
      {/* Pane Header & Tabs */}
      <div className="p-3 border-b border-surface-border flex items-center justify-between bg-surface">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-stone-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">
            Live Insights
          </h2>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-surface-subtle p-0.5 rounded border border-surface-border text-xs">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeTab === "all"
                ? "bg-surface text-foreground font-medium shadow-subtle"
                : "text-stone-600 dark:text-stone-300 hover:text-foreground"
            }`}
          >
            All ({visibleCards.length})
          </button>
          <button
            onClick={() => setActiveTab("pinned")}
            className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
              activeTab === "pinned"
                ? "bg-surface text-foreground font-medium shadow-subtle"
                : "text-stone-600 dark:text-stone-300 hover:text-foreground"
            }`}
          >
            <Pin className="w-3 h-3" />
            <span>Pinned ({pinnedCards.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("new")}
            className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
              activeTab === "new"
                ? "bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-medium"
                : "text-stone-600 dark:text-stone-300 hover:text-amber-700 dark:hover:text-amber-400"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>New to Us ({newCards.length})</span>
          </button>
        </div>
      </div>

      {/* Cards List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5" aria-live="polite">
        {displayedCards.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-600 dark:text-stone-400">
            <Sparkles className="w-8 h-8 mb-2 stroke-1" />
            <p className="text-xs font-medium">
              {activeTab === "pinned"
                ? "No pinned cards yet"
                : activeTab === "new"
                ? "No unfamiliar topics detected yet"
                : "Waiting for topics..."}
            </p>
            <p className="text-[11px] mt-1 max-w-[220px]">
              {activeTab === "pinned"
                ? "Click the pin icon on any card to keep it prominently visible."
                : activeTab === "new"
                ? "Topics falling outside your team's core skills will appear here highlighted in amber."
                : "When the client mentions technologies, competitors, or regulations, explanations appear here automatically."}
            </p>
          </div>
        ) : (
          displayedCards.map((card) => {
            const isNew = card.isNewToTeam;

            return (
              <div
                key={card.id}
                className={`group rounded-lg border bg-surface p-3.5 shadow-card transition-all ${
                  isNew
                    ? "border-amber-400/80 dark:border-amber-600/60 border-l-4 border-l-amber-500 bg-amber-50/20 dark:bg-amber-950/10"
                    : "border-surface-border hover:border-stone-300 dark:hover:border-stone-700"
                }`}
              >
                {/* Card Top Row: Type & Tag, Pin/Dismiss */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-muted text-stone-600 dark:text-stone-400">
                      {card.type}
                    </span>

                    {/* Amber tag strictly reserved for NEW */}
                    {isNew && (
                      <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        NEW TO TEAM
                      </span>
                    )}

                    {card.confidence === "low" && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-1">
                        <ShieldAlert className="w-2.5 h-2.5" />
                        Low Confidence
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onPinCard(card.id)}
                      className={`p-1 rounded hover:bg-surface-subtle transition-colors ${
                        card.pinned
                          ? "text-stone-900 dark:text-stone-100 font-semibold"
                          : "text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
                      }`}
                      title={card.pinned ? "Unpin card" : "Pin card"}
                    >
                      <Pin
                        className={`w-3.5 h-3.5 ${
                          card.pinned ? "fill-current text-stone-800 dark:text-stone-200" : ""
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => onDismissCard(card.id)}
                      className="p-1 rounded hover:bg-surface-subtle text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                      title="Dismiss card"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Title & Why It Matters */}
                <h3 className="text-sm font-semibold text-foreground tracking-tight mb-1">
                  {card.title}
                </h3>

                <p className="text-xs font-medium text-stone-700 dark:text-stone-300 mb-2">
                  {card.whyItMatters}
                </p>

                {/* Explanation */}
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed mb-3">
                  {card.explanation}
                </p>

                {/* Pros and Cons compact grid */}
                {(card.pros?.length > 0 || card.cons?.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] mb-3 pt-2 border-t border-surface-border">
                    {card.pros?.length > 0 && (
                      <div>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400 block mb-0.5">
                          Advantages:
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-stone-600 dark:text-stone-400">
                          {card.pros.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {card.cons?.length > 0 && (
                      <div>
                        <span className="font-semibold text-stone-500 dark:text-stone-400 block mb-0.5">
                          Considerations:
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-stone-600 dark:text-stone-400">
                          {card.cons.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Sources & Override Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-surface-border text-[11px]">
                  {/* Sources Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {card.sources && card.sources.length > 0 ? (
                      card.sources.map((src, i) => (
                        <a
                          key={i}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-subtle hover:bg-surface-muted text-stone-600 dark:text-stone-400 hover:text-foreground text-[10px] transition-colors border border-surface-border"
                        >
                          <span className="max-w-[120px] truncate">{src.title}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ))
                    ) : (
                      <span className="text-[10px] text-stone-400 italic">No external sources</span>
                    )}
                  </div>

                  {/* Manual User Override */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleKnownStatus(card)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        isNew
                          ? "border-surface-border text-stone-500 hover:text-foreground hover:bg-surface-subtle"
                          : "border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      }`}
                      title={isNew ? "Mark as known by our team" : "Mark as new to our team"}
                    >
                      {isNew ? "I knew this" : "This is new to me"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
