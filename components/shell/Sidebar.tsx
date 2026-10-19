"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, Search, Settings, Users } from "lucide-react";
import { CLIENTS_CHANGED, useApi } from "@/lib/client/api";
import { ClientListItem } from "@/lib/types";
import { formatLocalDate } from "@/lib/time";
import { ThemeToggle } from "./ThemeToggle";
import { NewClientDialog } from "./NewClientDialog";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data, reload } = useApi<{ clients: ClientListItem[] }>("/api/clients");
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    const handler = () => void reload();
    window.addEventListener(CLIENTS_CHANGED, handler);
    return () => window.removeEventListener(CLIENTS_CHANGED, handler);
  }, [reload]);

  const clients = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = data?.clients ?? [];
    return q ? all.filter((c) => `${c.name} ${c.company}`.toLowerCase().includes(q)) : all;
  }, [data, query]);

  const navItem = (href: string, label: string, Icon: typeof Home) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        href={href}
        onClick={onNavigate}
        className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
          active ? "bg-surface-muted font-medium text-foreground" : "text-stone-600 hover:bg-surface-subtle dark:text-stone-300"
        }`}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  };

  return (
    <aside className="flex h-full w-full flex-col border-r border-surface-border bg-surface">
      <div className="flex items-center justify-between px-4 py-3.5">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">CC</span>
          CallCopilot
        </Link>
        <ThemeToggle />
      </div>

      <nav className="space-y-0.5 px-2">{navItem("/", "Home", Home)}</nav>

      <div className="mt-4 flex items-center justify-between px-4">
        <span className="section-title flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Clients
        </span>
        <button onClick={() => setNewOpen(true)} className="btn btn-ghost btn-icon" title="New client" aria-label="New client">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 pt-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients"
            className="input py-1 pl-8 text-xs"
            aria-label="Search clients"
          />
        </div>
      </div>

      <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {clients.length === 0 && (
          <p className="px-2.5 py-6 text-center text-xs text-stone-500">
            {data ? (query ? "No matches" : "No clients yet") : "Loading…"}
          </p>
        )}
        {clients.map((c) => {
          const active = pathname.startsWith(`/clients/${c.id}`);
          return (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors ${
                active ? "bg-surface-muted" : "hover:bg-surface-subtle"
              }`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-stone-200 text-[10px] font-semibold text-stone-700 dark:bg-stone-700 dark:text-stone-200">
                {initials(c.name) || "?"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                <span className="block truncate text-[11px] text-stone-500">
                  {c.company ? `${c.company} · ` : ""}
                  {c.meetingCount} meeting{c.meetingCount === 1 ? "" : "s"}
                  {c.lastMeetingAt ? ` · ${formatLocalDate(c.lastMeetingAt)}` : ""}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="border-t border-surface-border p-2">{navItem("/settings", "Settings", Settings)}</div>

      <NewClientDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </aside>
  );
}
