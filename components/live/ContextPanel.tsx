"use client";

import React from "react";
import { CheckCircle2, Circle, History } from "lucide-react";
import { ClientRecord, MeetingRecord } from "@/lib/types";
import { formatLocalDate } from "@/lib/time";
import { OpenItem } from "@/lib/client/useLiveSession";

interface Props {
  client: ClientRecord;
  lastMeeting: MeetingRecord | null;
  openItems: OpenItem[];
  onToggleItem: (text: string) => void;
}

/** What the consultant should remember from previous meetings, visible during the call. */
export function ContextPanel({ client, lastMeeting, openItems, onToggleItem }: Props) {
  const brief = client.brief;
  const doneCount = openItems.filter((o) => o.done).length;

  return (
    <div className="space-y-4 p-4">
      {openItems.length > 0 && (
        <div>
          <p className="section-title mb-2 flex items-center justify-between">
            <span>Open items to cover</span>
            <span className="font-mono normal-case text-stone-400">
              {doneCount}/{openItems.length}
            </span>
          </p>
          <ul className="space-y-1">
            {openItems.map((o) => (
              <li key={o.text}>
                <button
                  onClick={() => onToggleItem(o.text)}
                  className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-surface-subtle"
                >
                  {o.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                  )}
                  <span className={o.done ? "text-stone-400 line-through" : ""}>
                    {o.text}
                    {o.done && o.auto && <span className="ml-1 text-[10px] text-emerald-600 no-underline">(discussed)</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lastMeeting?.wrapUp ? (
        <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-900/50 dark:bg-violet-950/20">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
            <History className="h-3.5 w-3.5" /> Last meeting · {formatLocalDate(lastMeeting.startedAt)}
          </p>
          <p className="text-sm">{lastMeeting.wrapUp.outcome.statement}</p>
          {lastMeeting.wrapUp.outcome.nextStep && (
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              <strong>Agreed next step:</strong> {lastMeeting.wrapUp.outcome.nextStep}
            </p>
          )}
          {lastMeeting.wrapUp.decisions.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-stone-600 dark:text-stone-400">
              {lastMeeting.wrapUp.decisions.slice(0, 5).map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-surface-border p-3 text-xs text-stone-500">
          First meeting with {client.name} — no history yet. After this call the AI builds a brief so next time it knows the context.
        </p>
      )}

      {brief?.summary && (
        <div>
          <p className="section-title mb-1">Client brief</p>
          <p className="text-sm text-stone-700 dark:text-stone-300">{brief.summary}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {brief.budget && <span className="chip chip-neutral">Budget: {brief.budget}</span>}
            {brief.timeline && <span className="chip chip-neutral">Timeline: {brief.timeline}</span>}
          </div>
          {brief.stakeholders.length > 0 && (
            <p className="mt-2 text-xs text-stone-500">
              People: {brief.stakeholders.map((s) => `${s.name}${s.role ? ` (${s.role})` : ""}`).join(", ")}
            </p>
          )}
          {brief.preferences.length > 0 && <p className="mt-1 text-xs text-stone-500">Style: {brief.preferences.join("; ")}</p>}
        </div>
      )}
    </div>
  );
}
