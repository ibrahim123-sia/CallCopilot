"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CalendarClock, Play, Plus, Sparkles, Users } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { ClientListItem, MeetingRecord } from "@/lib/types";
import { formatDuration, formatLocalDate } from "@/lib/time";
import { SetupNotice } from "@/components/shell/SetupNotice";
import { NewClientDialog } from "@/components/shell/NewClientDialog";
import { StartMeetingDialog, CaptureMode } from "@/components/meeting/StartMeetingDialog";
import { MeetingStatusChip } from "@/components/meeting/MeetingStatusChip";

export default function HomePage() {
  const clients = useApi<{ clients: ClientListItem[] }>("/api/clients");
  const meetings = useApi<{ meetings: Array<MeetingRecord & { clientName: string }> }>("/api/meetings");
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [startMode, setStartMode] = useState<CaptureMode | null>(null);

  const hasClients = (clients.data?.clients.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-stone-500">Prepare, run and follow up on client meetings — with memory of every past conversation.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => setStartMode("demo")}>
            <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Try demo call
          </button>
          {hasClients ? (
            <button className="btn btn-primary" onClick={() => setStartMode("dual")}>
              <Play className="h-3.5 w-3.5" /> Start meeting
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setNewClientOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add first client
            </button>
          )}
        </div>
      </header>

      <SetupNotice />

      <section className="space-y-2">
        <h2 className="section-title flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" /> Recent meetings
        </h2>
        <div className="card divide-y divide-surface-border">
          {meetings.data?.meetings.length ? (
            meetings.data.meetings.map((m) => (
              <Link
                key={m.id}
                href={m.status === "live" ? `/live/${m.id}?mode=resume` : `/meetings/${m.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-subtle"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.title}</p>
                  <p className="truncate text-xs text-stone-500">
                    {m.clientName} · {formatLocalDate(m.startedAt)}
                    {m.durationSeconds ? ` · ${formatDuration(m.durationSeconds)}` : ""}
                  </p>
                </div>
                <MeetingStatusChip status={m.status} />
              </Link>
            ))
          ) : (
            <p className="px-4 py-8 text-center text-sm text-stone-500">
              {meetings.loading ? "Loading…" : "No meetings yet. Start one from a client page, or try the demo call."}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="section-title flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Clients
          </h2>
          <button className="btn btn-ghost" onClick={() => setNewClientOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New client
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.data?.clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="card p-4 transition-colors hover:border-stone-400 dark:hover:border-stone-600">
              <p className="truncate text-sm font-semibold">{c.name}</p>
              <p className="truncate text-xs text-stone-500">{c.company || "—"}</p>
              <p className="mt-2 line-clamp-2 text-xs text-stone-600 dark:text-stone-400">
                {c.brief?.summary || "No brief yet — it builds up automatically after the first meeting."}
              </p>
              <p className="mt-2 text-[11px] text-stone-500">
                {c.meetingCount} meeting{c.meetingCount === 1 ? "" : "s"}
                {c.lastMeetingAt ? ` · last ${formatLocalDate(c.lastMeetingAt)}` : ""}
              </p>
            </Link>
          ))}
          {clients.data && clients.data.clients.length === 0 && (
            <button onClick={() => setNewClientOpen(true)} className="card flex flex-col items-center justify-center gap-1 border-dashed p-6 text-sm text-stone-500 hover:bg-surface-subtle">
              <Plus className="h-5 w-5" /> Add your first client
            </button>
          )}
        </div>
      </section>

      <NewClientDialog open={newClientOpen} onClose={() => setNewClientOpen(false)} />
      <StartMeetingDialog open={startMode !== null} onClose={() => setStartMode(null)} defaultMode={startMode ?? "dual"} />
    </div>
  );
}
