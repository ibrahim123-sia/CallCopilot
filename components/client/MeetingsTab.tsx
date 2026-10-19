"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CalendarClock, FileInput } from "lucide-react";
import { MeetingRecord } from "@/lib/types";
import { formatDuration, formatLocalDate } from "@/lib/time";
import { MeetingStatusChip } from "@/components/meeting/MeetingStatusChip";
import { AddMaterialDialog } from "./AddMaterialDialog";

export function MeetingsTab({ clientId, meetings, onChanged }: { clientId: string; meetings: MeetingRecord[]; onChanged: () => void }) {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-500">Every meeting is saved with its full transcript and summary.</p>
        <button className="btn btn-secondary" onClick={() => setImportOpen(true)}>
          <FileInput className="h-3.5 w-3.5" /> Import previous meeting
        </button>
      </div>

      {meetings.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center text-sm text-stone-500">
          <CalendarClock className="h-6 w-6" />
          No meetings yet. Start one, or import notes from an earlier meeting so the AI has context.
        </div>
      ) : (
        <div className="card divide-y divide-surface-border">
          {meetings.map((m) => (
            <Link
              key={m.id}
              href={m.status === "live" ? `/live/${m.id}?mode=resume` : `/meetings/${m.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-subtle"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.title}</p>
                <p className="truncate text-xs text-stone-500">
                  {formatLocalDate(m.startedAt)}
                  {m.durationSeconds ? ` · ${formatDuration(m.durationSeconds)}` : ""}
                  {m.wrapUp ? ` · ${m.wrapUp.outcome.status}` : ""}
                </p>
                {m.wrapUp?.outcome.statement && (
                  <p className="mt-1 line-clamp-1 text-xs text-stone-600 dark:text-stone-400">{m.wrapUp.outcome.statement}</p>
                )}
              </div>
              <MeetingStatusChip status={m.status} />
            </Link>
          ))}
        </div>
      )}

      <AddMaterialDialog open={importOpen} onClose={() => setImportOpen(false)} clientId={clientId} defaultAsMeeting onAdded={onChanged} />
    </div>
  );
}
