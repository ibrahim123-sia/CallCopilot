"use client";

import React, { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  HelpCircle,
  Languages,
  Loader2,
  Mic,
  Monitor,
  Pause,
  PhoneOff,
  Play,
  Search,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/client/api";
import { AppSettings, ClientRecord, MeetingRecord, StoredSegment, TopicCard } from "@/lib/types";
import { CaptureMode, LiveSessionInit, useLiveSession } from "@/lib/client/useLiveSession";
import { formatDuration } from "@/lib/time";
import { TranscriptView } from "@/components/meeting/TranscriptView";
import { SuggestionsPanel } from "@/components/live/SuggestionsPanel";
import { ContextPanel } from "@/components/live/ContextPanel";
import { InsightCardsPane } from "@/components/InsightCardsPane";
import { ShortcutsModal } from "@/components/ShortcutsModal";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { useToast } from "@/components/ui/Toast";

interface Loaded {
  init: LiveSessionInit;
  lastMeeting: MeetingRecord | null;
}

export default function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<FullScreenMessage text="Loading…" />}>
      <LiveWorkspace id={id} />
    </Suspense>
  );
}

function FullScreenMessage({ text, error }: { text: string; error?: boolean }) {
  return (
    <div className={`grid h-screen place-items-center text-sm ${error ? "text-red-600" : "text-stone-500"}`}>
      <p className="flex items-center gap-2">
        {!error && <Loader2 className="h-4 w-4 animate-spin" />} {text}
      </p>
    </div>
  );
}

function LiveWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ meeting, client, segments }, settingsRes] = await Promise.all([
          api<{ meeting: MeetingRecord; client: ClientRecord; segments: StoredSegment[] }>(`/api/meetings/${id}`),
          api<{ settings: AppSettings }>("/api/settings"),
        ]);
        if (meeting.status !== "live") {
          router.replace(`/meetings/${id}`);
          return;
        }
        const clientData = await api<{ meetings: MeetingRecord[]; openItems: string[] }>(`/api/clients/${meeting.clientId}`);
        setLoaded({
          init: { meeting, client, settings: settingsRes.settings, existingSegments: segments, openItems: clientData.openItems },
          lastMeeting: clientData.meetings.find((m) => m.id !== id && m.wrapUp) ?? null,
        });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Could not load meeting");
      }
    })();
  }, [id, router]);

  const session = useLiveSession(loaded?.init ?? null);
  const [layout, setLayout] = useState<"side-by-side" | "stacked">("side-by-side");
  const [rightTab, setRightTab] = useState<"context" | "insights" | "notes">("context");
  const [mobileTab, setMobileTab] = useState<"captions" | "copilot" | "context">("captions");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [lookupText, setLookupText] = useState("");
  const lookupRef = useRef<HTMLInputElement>(null);
  const autoStarted = useRef(false);

  useEffect(() => {
    if (loaded) setLayout(loaded.init.settings.captionLayout);
  }, [loaded]);

  // The demo needs no browser permission prompt, so it can start immediately
  useEffect(() => {
    if (loaded && requestedMode === "demo" && !autoStarted.current) {
      autoStarted.current = true;
      void session.start("demo");
    }
  }, [loaded, requestedMode, session]);

  // Warn before closing the tab mid-call
  useEffect(() => {
    if (session.phase !== "live") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [session.phase]);

  const endCall = async () => {
    try {
      await session.end();
      router.push(`/meetings/${id}`);
    } catch (err) {
      toast(err instanceof Error ? `Could not finish: ${err.message}` : "Could not finish the meeting", "error");
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (session.phase !== "live") return;
      if (e.key === " ") {
        e.preventDefault();
        session.togglePause();
      } else if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        lookupRef.current?.focus();
      } else if (e.key.toLowerCase() === "c" && session.replies[0]) {
        navigator.clipboard.writeText(session.replies[0].text);
        toast("Top reply copied", "success");
      } else if (e.key.toLowerCase() === "t") {
        session.setTranslation(!session.translationOn);
      } else if (e.key === "?") {
        setShortcutsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, toast]);

  const markKnown = async (card: TopicCard) => {
    const nextIsNew = !card.isNewToTeam;
    session.setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, isNewToTeam: nextIsNew } : c)));
    if (!loaded) return;
    const known = loaded.init.settings.teamProfile.knownTopics;
    const knownTopics = nextIsNew ? known.filter((k) => k.toLowerCase() !== card.title.toLowerCase()) : Array.from(new Set([...known, card.title]));
    loaded.init.settings.teamProfile.knownTopics = knownTopics;
    api("/api/settings", { method: "PUT", json: { teamProfile: { knownTopics } } }).catch(() => {});
  };

  const talkTotal = session.talk.client + session.talk.team;
  const clientPct = talkTotal ? Math.round((session.talk.client / talkTotal) * 100) : 0;
  const statusDot = useMemo(() => {
    if (session.paused) return "bg-amber-400";
    if (session.status === "listening") return "bg-emerald-500 animate-pulse";
    if (session.status === "connecting") return "bg-sky-400 animate-pulse";
    if (session.status === "error") return "bg-red-500";
    return "bg-stone-400";
  }, [session.paused, session.status]);

  if (loadError) return <FullScreenMessage text={loadError} error />;
  if (!loaded) return <FullScreenMessage text="Loading meeting…" />;

  const { meeting, client } = loaded.init;

  // ------------------------------------------------------------- pre-call screen
  if (session.phase === "setup") {
    const resuming = loaded.init.existingSegments.length > 0;
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-8">
          <Link href={`/clients/${client.id}`} className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> {client.name}
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{meeting.title}</h1>
            <p className="text-sm text-stone-500">
              with {client.name}
              {meeting.goal ? ` · goal: ${meeting.goal}` : ""}
            </p>
          </div>

          {session.statusDetail && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {session.statusDetail}
            </p>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-5">
            <div className="card md:col-span-3">
              <div className="border-b border-surface-border px-4 py-2.5">
                <h2 className="section-title">Before you start — context from earlier</h2>
              </div>
              <ContextPanel client={client} lastMeeting={loaded.lastMeeting} openItems={session.openItems} onToggleItem={session.toggleOpenItem} />
            </div>
            <div className="card space-y-3 p-4 md:col-span-2">
              <h2 className="section-title">{resuming ? "Resume this meeting" : "Start listening"}</h2>
              {resuming && (
                <p className="text-xs text-stone-500">
                  {loaded.init.existingSegments.length} lines were already saved. Continue and new speech is added to the same transcript.
                </p>
              )}
              <button className="btn btn-primary btn-lg w-full" onClick={() => session.start("dual")}>
                <Monitor className="h-4 w-4" /> Meeting tab + my mic
              </button>
              <button className="btn btn-secondary w-full" onClick={() => session.start("mic-only")}>
                <Mic className="h-4 w-4" /> Mic only
              </button>
              {meeting.source === "demo" && (
                <button className="btn btn-secondary w-full" onClick={() => session.start("demo" as CaptureMode)}>
                  <Sparkles className="h-4 w-4 text-amber-500" /> Play demo script
                </button>
              )}
              <p className="text-[11px] leading-relaxed text-stone-500">
                Chrome/Edge: pick the meeting tab and tick <strong>Share tab audio</strong>. Use headphones. Transcription:{" "}
                {loaded.init.settings.sttProvider === "deepgram" ? "Deepgram" : "Gemini Live (free)"}.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- live workspace
  const captions = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-surface-border px-4 py-2">
        <h2 className="section-title">Live captions</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => session.setTranslation(!session.translationOn)}
            aria-pressed={session.translationOn}
            className={`btn px-2 py-1 ${session.translationOn ? "btn-secondary border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300" : "btn-ghost"}`}
            title="Roman Urdu captions (T)"
          >
            <Languages className="h-3.5 w-3.5" /> Roman Urdu
          </button>
          {session.translationOn && (
            <div className="segmented hidden sm:inline-flex">
              <button aria-pressed={layout === "side-by-side"} onClick={() => setLayout("side-by-side")}>
                Side by side
              </button>
              <button aria-pressed={layout === "stacked"} onClick={() => setLayout("stacked")}>
                Stacked
              </button>
            </div>
          )}
        </div>
      </div>
      {session.captionNotice && <p className="bg-amber-50 px-4 py-1 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{session.captionNotice}</p>}
      <div className="min-h-0 flex-1">
        <TranscriptView
          rows={session.rows}
          interims={session.interims}
          layout={layout}
          showTranslation={session.translationOn}
          pendingLabel={session.translationAvailable ? "translating…" : "unavailable"}
          clientLabel={client.name}
          emptyText={session.status === "connecting" ? "Connecting…" : "Listening — captions appear as people speak."}
        />
      </div>
    </div>
  );

  const copilot = (
    <SuggestionsPanel
      intent={session.intent}
      replies={session.replies}
      questions={session.questions}
      signals={session.signals}
      redFlags={session.redFlags}
      analyzing={session.analyzing}
      notice={session.aiNotice}
      provider={session.aiProvider}
    />
  );

  const contextColumn = (
    <div className="flex h-full min-h-0 flex-col">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (lookupText.trim()) {
            void session.lookup(lookupText.trim());
            setLookupText("");
            setRightTab("insights");
          }
        }}
        className="border-b border-surface-border p-3"
      >
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-stone-400" />
          <input ref={lookupRef} value={lookupText} onChange={(e) => setLookupText(e.target.value)} className="input py-1 pl-8 text-xs" placeholder="Quick lookup a term (L)" />
        </div>
      </form>
      <nav className="tabs px-2">
        {(["context", "insights", "notes"] as const).map((t) => (
          <button key={t} className={`tab capitalize ${rightTab === t ? "tab-active" : ""}`} onClick={() => setRightTab(t)}>
            {t}
            {t === "insights" && session.cards.length > 0 && <span className="ml-1 text-stone-400">{session.cards.filter((c) => !c.dismissed).length}</span>}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rightTab === "context" && <ContextPanel client={client} lastMeeting={loaded.lastMeeting} openItems={session.openItems} onToggleItem={session.toggleOpenItem} />}
        {rightTab === "insights" && (
          <InsightCardsPane
            cards={session.cards}
            onPinCard={(cid) => session.setCards((prev) => prev.map((c) => (c.id === cid ? { ...c, pinned: !c.pinned } : c)))}
            onDismissCard={(cid) => session.setCards((prev) => prev.map((c) => (c.id === cid ? { ...c, dismissed: true } : c)))}
            onToggleKnownStatus={markKnown}
          />
        )}
        {rightTab === "notes" && (
          <div className="p-3">
            <textarea
              value={session.notes}
              onChange={(e) => session.updateNotes(e.target.value)}
              className="input min-h-[300px] text-sm"
              placeholder="Your notes — saved automatically and used in the summary."
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-surface-border bg-surface px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <span className={`h-2 w-2 rounded-full ${statusDot}`} />
            <span className="hidden capitalize sm:inline">{session.paused ? "paused" : session.status}</span>
          </span>
          <span className="font-mono text-xs text-stone-500">{formatDuration(session.duration)}</span>
          <span className="hidden min-w-0 truncate text-sm font-semibold md:inline">
            {client.name} · <span className="font-normal text-stone-500">{meeting.title}</span>
          </span>
        </div>
        <div className="hidden items-center gap-2 text-[11px] text-stone-500 lg:flex">
          <span>Client {clientPct}%</span>
          <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted">
            <div className="bg-sky-500" style={{ width: `${clientPct}%` }} />
          </div>
          <span>You {talkTotal ? 100 - clientPct : 0}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="btn btn-ghost btn-icon hidden sm:inline-flex" onClick={() => setShortcutsOpen(true)} title="Shortcuts (?)" aria-label="Keyboard shortcuts">
            <HelpCircle className="h-4 w-4" />
          </button>
          <ThemeToggle className="hidden sm:inline-flex" />
          <button className="btn btn-secondary" onClick={session.togglePause} title="Pause / resume (Space)" disabled={session.phase !== "live"}>
            {session.paused ? <Play className="h-3.5 w-3.5 text-emerald-600" /> : <Pause className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{session.paused ? "Resume" : "Pause"}</span>
          </button>
          <button className="btn btn-danger" onClick={endCall} disabled={session.phase === "ending"}>
            {session.phase === "ending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneOff className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{session.phase === "ending" ? "Saving…" : "End meeting"}</span>
          </button>
        </div>
      </header>

      {(session.status === "error" || session.status === "connecting") && session.statusDetail && (
        <div role="alert" className={`flex items-center gap-2 border-b px-4 py-1.5 text-xs ${session.status === "error" ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" : "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300"}`}>
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{session.statusDetail}</span>
        </div>
      )}
      {session.saveNotice && <div className="border-b border-amber-200 bg-amber-50 px-4 py-1 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{session.saveNotice}</div>}

      {/* Mobile tabs */}
      <div className="flex border-b border-surface-border bg-surface md:hidden">
        {(["captions", "copilot", "context"] as const).map((t) => (
          <button key={t} className={`tab flex-1 capitalize ${mobileTab === t ? "tab-active" : ""}`} onClick={() => setMobileTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <main className="flex min-h-0 flex-1">
        <section className={`min-h-0 border-r border-surface-border bg-surface md:block md:w-[44%] ${mobileTab === "captions" ? "block w-full" : "hidden"}`}>{captions}</section>
        <section className={`min-h-0 border-r border-surface-border bg-background md:block md:w-[30%] ${mobileTab === "copilot" ? "block w-full" : "hidden"}`}>{copilot}</section>
        <section className={`min-h-0 bg-surface md:block md:w-[26%] ${mobileTab === "context" ? "block w-full" : "hidden"}`}>{contextColumn}</section>
      </main>

      <ShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
