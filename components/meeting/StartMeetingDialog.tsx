"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Headphones, Mic, Monitor, ShieldCheck, Sparkles } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { api, notifyClientsChanged } from "@/lib/client/api";
import { ClientListItem, MeetingRecord } from "@/lib/types";

export type CaptureMode = "dual" | "mic-only" | "demo";

const CONSENT_KEY = "callcopilot_consent_confirmed";
const DEMO_CLIENT_NAME = "Demo Client";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Fixed client (from a client page); otherwise the user picks one. */
  clientId?: string;
  clientName?: string;
  defaultMode?: CaptureMode;
}

export function StartMeetingDialog({ open, onClose, clientId, clientName, defaultMode = "dual" }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [selectedClient, setSelectedClient] = useState(clientId ?? "");
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [mode, setMode] = useState<CaptureMode>(defaultMode);
  const [language, setLanguage] = useState<"en" | "ur" | "auto">("en");
  const [consent, setConsent] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(defaultMode);
    try {
      setConsent(localStorage.getItem(CONSENT_KEY) === "true");
    } catch {}
    if (!clientId) {
      api<{ clients: ClientListItem[] }>("/api/clients")
        .then((d) => {
          setClients(d.clients);
          setSelectedClient((prev) => prev || d.clients[0]?.id || "");
        })
        .catch(() => {});
    }
  }, [open, clientId, defaultMode]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) return;
    setStarting(true);
    try {
      let targetClient = clientId || selectedClient;
      if (mode === "demo") {
        // Scripted demo content must never land in a real client's memory
        const { clients: all } = await api<{ clients: ClientListItem[] }>("/api/clients");
        const existing = all.find((c) => c.name === DEMO_CLIENT_NAME);
        if (existing) {
          targetClient = existing.id;
        } else {
          const { client } = await api<{ client: { id: string } }>("/api/clients", {
            method: "POST",
            json: { name: DEMO_CLIENT_NAME, company: "Sample Co.", notes: "Created for the demo call. Safe to delete." },
          });
          targetClient = client.id;
          notifyClientsChanged();
        }
      }
      if (!targetClient) throw new Error("Pick a client first");

      const { meeting } = await api<{ meeting: MeetingRecord }>("/api/meetings", {
        method: "POST",
        json: {
          clientId: targetClient,
          title: title.trim() || (mode === "demo" ? "Demo call" : `Meeting ${new Date().toLocaleDateString()}`),
          goal,
          language,
          source: mode === "demo" ? "demo" : "live",
        },
      });
      try {
        localStorage.setItem(CONSENT_KEY, "true");
      } catch {}
      notifyClientsChanged();
      onClose();
      router.push(`/live/${meeting.id}?mode=${mode}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not start meeting", "error");
      setStarting(false);
    }
  };

  const modeCard = (value: CaptureMode, label: string, desc: string, Icon: typeof Mic) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={`rounded-lg border p-3 text-left transition-colors ${
        mode === value ? "border-foreground ring-1 ring-foreground" : "border-surface-border hover:bg-surface-subtle"
      }`}
    >
      <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="block text-[11px] leading-snug text-stone-500">{desc}</span>
    </button>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={clientName ? `Start meeting with ${clientName}` : "Start a meeting"}
      description="Previous meetings and documents for this client are loaded automatically as context."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="start-meeting-form" className="btn btn-primary" disabled={!consent || starting}>
            {starting ? "Starting…" : "Start"}
          </button>
        </>
      }
    >
      <form id="start-meeting-form" onSubmit={start} className="space-y-4">
        {mode === "demo" && (
          <p className="rounded-md bg-surface-subtle p-2 text-[11px] text-stone-500">
            The demo runs under a separate &ldquo;{DEMO_CLIENT_NAME}&rdquo; so sample data never mixes with real client memory.
          </p>
        )}
        {!clientId && mode !== "demo" && (
          <div>
            <label className="label" htmlFor="sm-client">
              Client
            </label>
            <select id="sm-client" className="input" value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}>
              {clients.length === 0 && <option value="">Create a client first</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.company ? ` — ${c.company}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sm-title">
              Meeting title
            </label>
            <input id="sm-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Scope review" />
          </div>
          <div>
            <label className="label" htmlFor="sm-lang">
              Spoken language
            </label>
            <select id="sm-lang" className="input" value={language} onChange={(e) => setLanguage(e.target.value as "en" | "ur" | "auto")}>
              <option value="en">English</option>
              <option value="auto">Auto-detect (mixed English / Urdu)</option>
              <option value="ur">Urdu</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="sm-goal">
            Goal for this meeting (optional)
          </label>
          <input id="sm-goal" className="input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Agree on phase-1 scope and budget" />
        </div>

        <div>
          <span className="label">Audio source</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {modeCard("dual", "Meeting tab + mic", "Client from the Meet/Zoom/Teams tab, you from the mic.", Monitor)}
            {modeCard("mic-only", "Mic only", "In-person meeting or a single microphone.", Mic)}
            {modeCard("demo", "Demo", "Scripted sample call. No audio needed.", Sparkles)}
          </div>
          {mode === "dual" && (
            <p className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <Headphones className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Use Chrome/Edge. In the share picker choose the <strong>meeting tab</strong> and tick <strong>&ldquo;Share tab audio&rdquo;</strong>.
                Wear <strong>headphones</strong> so the client&apos;s voice isn&apos;t picked up by your mic.
              </span>
            </p>
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-surface-border bg-surface-subtle p-3">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          <span className="text-xs leading-snug">
            <span className="mb-0.5 flex items-center gap-1 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Consent
            </span>
            Everyone on the call knows it is being transcribed. Audio is sent to Google Gemini for transcription and
            analysis; on the free tier Google may use this data to improve its products.
          </span>
        </label>
      </form>
    </Dialog>
  );
}
