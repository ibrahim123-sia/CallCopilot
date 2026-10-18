"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { TranscriptPane } from "@/components/TranscriptPane";
import { InsightCardsPane } from "@/components/InsightCardsPane";
import { RepliesPane } from "@/components/RepliesPane";
import { ReadyScreen } from "@/components/ReadyScreen";
import { WrapUpScreen } from "@/components/WrapUpScreen";
import { TeamProfileModal } from "@/components/TeamProfileModal";
import { ShortcutsModal } from "@/components/ShortcutsModal";
import {
  CallContext,
  ExportOptions,
  MeetingWrapUp,
  TeamProfile,
  TopicCard,
  TranscriptEntry,
  Signal,
  SuggestedReply,
  CrossQuestion,
  RedFlag,
} from "@/lib/types";
import {
  DEFAULT_EXPORT_OPTIONS,
  DEFAULT_TEAM_PROFILE,
  loadConsentGiven,
  loadExportOptions,
  loadTeamProfile,
  loadTopicOverrides,
  saveConsentGiven,
  saveExportOptions,
  saveTeamProfile,
  setTopicKnownStatus,
} from "@/lib/state/storage";
import { AudioCaptureSession, startAudioCapture } from "@/lib/audio/capture";
import { TranscriptionProvider, TranscriptionStatus } from "@/lib/transcription/types";
import { DemoTranscriptionProvider } from "@/lib/transcription/demoProvider";
import { DeepgramTranscriptionProvider } from "@/lib/transcription/deepgramProvider";
import { AnalysisTriggerController } from "@/lib/analysis/triggerLogic";
import {
  formatTranscriptForPrompt,
  partitionTranscriptWindow,
  truncateTranscriptBuffer,
} from "@/lib/analysis/contextBuilder";
import { downloadBlob, generatePlainTranscriptText } from "@/lib/export";
import { formatLocalDate } from "@/lib/time";
import { CANNED_DEMO_WRAPUP } from "@/lib/analysis/cannedData";

export default function CallCopilotApp() {
  // Screen Mode: ready | calling | wrapup
  const [screen, setScreen] = useState<"ready" | "calling" | "wrapup">("ready");

  // Storage and preferences
  const [teamProfile, setTeamProfile] = useState<TeamProfile>(DEFAULT_TEAM_PROFILE);
  const [exportOptions, setExportOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [consentGiven, setConsentGiven] = useState<boolean>(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Call runtime state
  const [isDemo, setIsDemo] = useState(false);
  const [callContext, setCallContext] = useState<CallContext>({
    clientName: "Client",
    projectName: "Project",
    meetingGoal: "Discovery",
    language: "en",
  });
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [clientTalkSeconds, setClientTalkSeconds] = useState(0);
  const [teamTalkSeconds, setTeamTalkSeconds] = useState(0);
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionStatus>("idle");
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // In-memory Call Data
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interimEntry, setInterimEntry] = useState<TranscriptEntry | null>(null);
  const [topicCards, setTopicCards] = useState<TopicCard[]>([]);
  const [clientIntent, setClientIntent] = useState("");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [suggestedReplies, setSuggestedReplies] = useState<SuggestedReply[]>([]);
  const [crossQuestions, setCrossQuestions] = useState<CrossQuestion[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [userNotes, setUserNotes] = useState("");
  const [wrapUpData, setWrapUpData] = useState<MeetingWrapUp | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Modals & Panels
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"transcript" | "insights" | "replies">("insights");

  // Refs for audio and streaming sessions
  const audioSessionRef = useRef<AudioCaptureSession | null>(null);
  const providerRef = useRef<TranscriptionProvider | null>(null);
  const triggerControllerRef = useRef<AnalysisTriggerController | null>(null);
  const lookupInputRef = useRef<HTMLInputElement | null>(null);

  // Provider callbacks are registered once per call, so anything they read must come
  // from refs — closures over state would be frozen at the moment the call started.
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const analysisInputsRef = useRef({ teamProfile, callContext, isDemo });
  analysisInputsRef.current = { teamProfile, callContext, isDemo };

  // Load local preferences on mount
  useEffect(() => {
    const loadedProfile = loadTeamProfile();
    const loadedExport = loadExportOptions();
    const loadedConsent = loadConsentGiven();
    setTeamProfile(loadedProfile);
    setExportOptions(loadedExport);
    setConsentGiven(loadedConsent);

    const savedTheme = localStorage.getItem("callcopilot_theme");
    if (savedTheme === "dark") {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    }
  }, []);

  // Theme toggle
  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("callcopilot_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Warn before accidental reload during active call
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (screen === "calling" || (screen === "wrapup" && transcript.length > 0)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [screen, transcript.length]);

  // Call timer (talk-time is accumulated from final segment durations instead)
  useEffect(() => {
    if (screen !== "calling" || isPaused) return;
    const timer = setInterval(() => setCallDurationSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [screen, isPaused]);

  // Execute server analysis with rolling context
  const triggerAnalysis = useCallback(async (abortSignal: AbortSignal) => {
    const currentTranscript = transcriptRef.current;
    if (currentTranscript.length === 0) return;
    const { teamProfile, callContext, isDemo } = analysisInputsRef.current;

    const { recent, older } = partitionTranscriptWindow(currentTranscript, 240000);
    const recentText = formatTranscriptForPrompt(recent);
    const earlierText = older.length
      ? truncateTranscriptBuffer(formatTranscriptForPrompt(older), 8000)
      : "";

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortSignal,
        body: JSON.stringify({
          recentTranscript: recentText,
          rollingSummary: earlierText,
          teamProfile,
          callContext,
          isDemo,
        }),
      });

      if (!res.ok) {
        console.warn("Analysis response returned non-ok:", res.status);
        return;
      }

      const data = await res.json();
      const overrides = loadTopicOverrides();

      if (Array.isArray(data.topics)) {
        // Merge topics and apply user overrides if exists
        const newTopicsWithOverrides = data.topics.map((t: TopicCard) => {
          const cleanTitle = t.title.toLowerCase().trim();
          const isKnownUser = overrides.known.some((k) => k.toLowerCase() === cleanTitle);
          const isNovelUser = overrides.novel.some((n) => n.toLowerCase() === cleanTitle);

          let isNewToTeam = t.isNewToTeam;
          if (isKnownUser) isNewToTeam = false;
          if (isNovelUser) isNewToTeam = true;

          return {
            ...t,
            isNewToTeam,
            timestamp: Date.now(),
          };
        });

        setTopicCards((prev) => {
          const existingIds = new Set(prev.map((c) => c.title.toLowerCase().trim()));
          const incoming = newTopicsWithOverrides.filter(
            (c: TopicCard) => !existingIds.has(c.title.toLowerCase().trim())
          );
          return [...incoming, ...prev];
        });
      }

      if (data.clientIntent) setClientIntent(data.clientIntent);
      if (Array.isArray(data.signals) && data.signals.length > 0) setSignals(data.signals);
      if (Array.isArray(data.suggestedReplies) && data.suggestedReplies.length > 0) {
        setSuggestedReplies(data.suggestedReplies);
      }
      if (Array.isArray(data.crossQuestions) && data.crossQuestions.length > 0) {
        setCrossQuestions(data.crossQuestions);
      }
      if (Array.isArray(data.redFlags) && data.redFlags.length > 0) {
        setRedFlags(data.redFlags);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // Superseded by newer utterance
      }
      console.warn("Analysis call error:", err);
    }
  }, []);

  // Initialize trigger controller
  useEffect(() => {
    triggerControllerRef.current = new AnalysisTriggerController({
      debounceMs: 2000,
      minIntervalMs: 5000,
    });
    return () => {
      triggerControllerRef.current?.cancelPending();
    };
  }, []);

  // Handle incoming transcripts (stable identity: registered once per call)
  const handleIncomingTranscript = useCallback(
    (entry: TranscriptEntry) => {
      if (!entry.isFinal) {
        setInterimEntry(entry);
        return;
      }

      setInterimEntry(null);
      transcriptRef.current = [...transcriptRef.current, entry];
      setTranscript(transcriptRef.current);

      // Talk-time from the provider's segment duration, falling back to a word-rate estimate
      const seconds = entry.durationMs
        ? entry.durationMs / 1000
        : Math.max(1, entry.text.split(/\s+/).length / 2.5);
      if (entry.speaker === "client") {
        setClientTalkSeconds((prev) => prev + seconds);
      } else {
        setTeamTalkSeconds((prev) => prev + seconds);
      }

      triggerControllerRef.current?.handleUtterance(entry, triggerAnalysis);
    },
    [triggerAnalysis]
  );

  const resetCallData = () => {
    transcriptRef.current = [];
    triggerControllerRef.current?.reset();
    setTranscript([]);
    setInterimEntry(null);
    setTopicCards([]);
    setClientIntent("");
    setSignals([]);
    setSuggestedReplies([]);
    setCrossQuestions([]);
    setRedFlags([]);
    setUserNotes("");
    setWrapUpData(null);
    setSummaryError(null);
    setCallDurationSeconds(0);
    setClientTalkSeconds(0);
    setTeamTalkSeconds(0);
    setIsPaused(false);
    setTranscriptionError(null);
  };

  const handleStatusChange = useCallback((status: TranscriptionStatus, detail?: string) => {
    setTranscriptionStatus(status);
    setTranscriptionError(status === "error" ? detail || "Transcription error" : null);
  }, []);

  // Start Call
  const handleStartCall = async (
    mode: "dual" | "mic-only" | "demo",
    context: CallContext
  ) => {
    resetCallData();
    setCallContext(context);
    setIsDemo(mode === "demo");
    analysisInputsRef.current = { teamProfile, callContext: context, isDemo: mode === "demo" };
    setScreen("calling");

    if (mode === "demo") {
      const demoProvider = new DemoTranscriptionProvider();
      providerRef.current = demoProvider;

      demoProvider.onStatusChange(handleStatusChange);
      demoProvider.onTranscript(handleIncomingTranscript);

      await demoProvider.connect({
        speedMultiplier: 1.0,
        language: context.language,
      });
      return;
    }

    // Real Audio Capture Mode (Dual-Channel or Mic-Only)
    try {
      const isMicOnly = mode === "mic-only";
      const audioSession = await startAudioCapture({
        micOnly: isMicOnly,
        sampleRate: 16000,
        onAudioData: (pcm) => {
          providerRef.current?.sendAudio(pcm);
        },
      });
      audioSessionRef.current = audioSession;

      const deepgramProvider = new DeepgramTranscriptionProvider();
      providerRef.current = deepgramProvider;

      deepgramProvider.onStatusChange(handleStatusChange);
      deepgramProvider.onTranscript(handleIncomingTranscript);

      await deepgramProvider.connect({
        language: context.language,
        sampleRate: 16000,
        multichannel: !isMicOnly,
        keyterms: [
          context.clientName,
          context.projectName,
          teamProfile.companyName,
          ...teamProfile.coreSkills,
        ],
      });
    } catch (err: unknown) {
      console.error("Audio capture start failed:", err);
      audioSessionRef.current?.stop();
      audioSessionRef.current = null;
      alert(err instanceof Error ? err.message : "Audio initialization failed.");
      setScreen("ready");
    }
  };

  // Pause / Resume (provider stops sending audio and reports status itself)
  const handleTogglePause = useCallback(() => {
    if (isPaused) {
      providerRef.current?.resume();
      setIsPaused(false);
    } else {
      providerRef.current?.pause();
      setIsPaused(true);
    }
  }, [isPaused]);

  const requestWrapUp = async () => {
    const { teamProfile, callContext, isDemo } = analysisInputsRef.current;
    const finalTranscript = transcriptRef.current;
    setIsSummarizing(true);
    setSummaryError(null);

    try {
      if (finalTranscript.length === 0 && !isDemo) {
        throw new Error("No speech was transcribed during this call, so there is nothing to summarize.");
      }

      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullTranscript: truncateTranscriptBuffer(formatTranscriptForPrompt(finalTranscript), 79000),
          userNotes,
          pinnedTopics: topicCards.filter((c) => c.pinned).map((c) => c.title),
          teamProfile,
          callContext,
          isDemo,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Summary request failed (${res.status})`);
      }
      setWrapUpData(await res.json());
    } catch (err: unknown) {
      console.warn("Summarize failed:", err);
      if (isDemo) {
        setWrapUpData(CANNED_DEMO_WRAPUP);
      } else {
        // Never substitute canned demo content for a real meeting.
        setSummaryError(err instanceof Error ? err.message : "Summary generation failed.");
      }
    } finally {
      setIsSummarizing(false);
    }
  };

  // End Call & Summarize
  const handleEndCall = async () => {
    triggerControllerRef.current?.cancelPending();
    providerRef.current?.disconnect();
    providerRef.current = null;
    audioSessionRef.current?.stop();
    audioSessionRef.current = null;
    setInterimEntry(null);
    setTranscriptionStatus("disconnected");
    setScreen("wrapup");
    await requestWrapUp();
  };

  // Quick lookup
  const handleQuickLookup = async (phrase: string) => {
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: phrase,
          context: clientIntent,
          teamSkills: teamProfile.coreSkills,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.topic) {
          setTopicCards((prev) => [data.topic, ...prev]);
        }
      }
    } catch (err) {
      console.error("Lookup error:", err);
    }
  };

  // Topic card actions
  const handlePinCard = (id: string) => {
    setTopicCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  };

  const handleDismissCard = (id: string) => {
    setTopicCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, dismissed: true } : c))
    );
  };

  const handleToggleKnownStatus = (card: TopicCard) => {
    const nextStatus = !card.isNewToTeam;
    setTopicKnownStatus(card.title, !nextStatus);
    setTopicCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, isNewToTeam: nextStatus } : c))
    );
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen !== "calling") return;
      // Don't trigger shortcuts if inside textarea or input
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea" || targetTag === "select") {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (e.key === " ") {
        e.preventDefault();
        handleTogglePause();
      } else if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        lookupInputRef.current?.focus();
      } else if (e.key.toLowerCase() === "c" && suggestedReplies.length > 0) {
        e.preventDefault();
        navigator.clipboard.writeText(suggestedReplies[0].text);
      } else if (e.key === "?") {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsProfileModalOpen(false);
        setIsShortcutsModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screen, handleTogglePause, suggestedReplies]);

  // Clean wipe
  const handleClearEverything = () => {
    resetCallData();
    setScreen("ready");
  };

  const handleDownloadRawTranscript = () => {
    const safeClient = (callContext.clientName || "Client").replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadBlob(
      generatePlainTranscriptText(transcriptRef.current),
      `Call-Transcript_${safeClient}_${formatLocalDate()}.txt`,
      "text/plain"
    );
  };

  // Screen 1: Ready Screen
  if (screen === "ready") {
    return (
      <ReadyScreen
        consentGiven={consentGiven}
        onConsentChange={(given) => {
          setConsentGiven(given);
          saveConsentGiven(given);
        }}
        onStartCall={handleStartCall}
      />
    );
  }

  // Screen 2a: Wrap-Up loading / failure
  if (screen === "wrapup" && !wrapUpData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface border border-surface-border rounded-xl shadow-card p-6 space-y-4 text-center">
          {isSummarizing ? (
            <>
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-stone-500" />
              <p className="text-sm font-medium text-foreground">Generating meeting summary…</p>
              <p className="text-xs text-stone-500">
                {transcript.length} transcript lines • this usually takes 10–30 seconds
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="w-6 h-6 mx-auto text-red-600" />
              <p className="text-sm font-medium text-foreground">Summary could not be generated</p>
              <p className="text-xs text-stone-500 break-words">{summaryError}</p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <button
                  onClick={requestWrapUp}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900"
                >
                  Retry summary
                </button>
                {transcript.length > 0 && (
                  <button
                    onClick={handleDownloadRawTranscript}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-surface-border hover:bg-surface-subtle"
                  >
                    Download transcript (.txt)
                  </button>
                )}
                <button
                  onClick={handleClearEverything}
                  className="px-3 py-1.5 text-xs font-medium rounded border border-surface-border hover:bg-surface-subtle text-stone-500"
                >
                  Discard &amp; start over
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Screen 2b: Wrap-Up Screen
  if (screen === "wrapup" && wrapUpData) {
    return (
      <WrapUpScreen
        wrapUp={wrapUpData}
        transcript={transcript}
        callContext={callContext}
        callDurationSeconds={callDurationSeconds}
        exportOptions={exportOptions}
        onUpdateExportOptions={(opts) => {
          const updated = { ...exportOptions, ...opts };
          setExportOptions(updated);
          saveExportOptions(updated);
        }}
        onUpdateWrapUp={(updated) => setWrapUpData(updated)}
        onClearEverything={handleClearEverything}
      />
    );
  }

  // Screen 3: Live 3-Pane Workspace
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      {/* Top Bar */}
      <TopBar
        status={transcriptionStatus}
        callDurationSeconds={callDurationSeconds}
        clientTalkSeconds={clientTalkSeconds}
        teamTalkSeconds={teamTalkSeconds}
        isPaused={isPaused}
        isDemo={isDemo}
        onTogglePause={handleTogglePause}
        onEndCall={handleEndCall}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        onFocusLookup={() => lookupInputRef.current?.focus()}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {transcriptionError && (
        <div
          role="alert"
          className="px-4 py-1.5 text-xs bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border-b border-red-200 dark:border-red-900/40 flex items-center gap-2"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Transcription stopped: {transcriptionError}</span>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="flex md:hidden border-b border-surface-border bg-surface px-2 py-1 text-xs">
        <button
          onClick={() => setMobileTab("transcript")}
          className={`flex-1 py-1 rounded text-center font-medium ${
            mobileTab === "transcript"
              ? "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900"
              : "text-stone-500"
          }`}
        >
          Transcript ({transcript.length})
        </button>
        <button
          onClick={() => setMobileTab("insights")}
          className={`flex-1 py-1 rounded text-center font-medium ${
            mobileTab === "insights"
              ? "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900"
              : "text-stone-500"
          }`}
        >
          Cards ({topicCards.length})
        </button>
        <button
          onClick={() => setMobileTab("replies")}
          className={`flex-1 py-1 rounded text-center font-medium ${
            mobileTab === "replies"
              ? "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900"
              : "text-stone-500"
          }`}
        >
          Replies
        </button>
      </div>

      {/* Desktop 3-Pane Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Pane: Transcript (30% desktop) */}
        <section
          className={`w-full md:w-[32%] h-full ${
            mobileTab === "transcript" ? "block" : "hidden md:block"
          }`}
        >
          <TranscriptPane
            entries={transcript}
            interimEntry={interimEntry}
            onSelectPhrase={(phrase) => handleQuickLookup(phrase)}
          />
        </section>

        {/* Center Pane: Insight Cards (38% desktop) */}
        <section
          className={`w-full md:w-[38%] h-full ${
            mobileTab === "insights" ? "block" : "hidden md:block"
          }`}
        >
          <InsightCardsPane
            cards={topicCards}
            onPinCard={handlePinCard}
            onDismissCard={handleDismissCard}
            onToggleKnownStatus={handleToggleKnownStatus}
          />
        </section>

        {/* Right Pane: Replies, Questions, Notes (30% desktop) */}
        <section
          className={`w-full md:w-[30%] h-full ${
            mobileTab === "replies" ? "block" : "hidden md:block"
          }`}
        >
          <RepliesPane
            clientIntent={clientIntent}
            signals={signals}
            suggestedReplies={suggestedReplies}
            crossQuestions={crossQuestions}
            redFlags={redFlags}
            userNotes={userNotes}
            onChangeNotes={setUserNotes}
            onQuickLookup={handleQuickLookup}
            lookupInputRef={lookupInputRef}
          />
        </section>
      </main>

      {/* Modals */}
      <TeamProfileModal
        profile={teamProfile}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onSave={(updated) => {
          setTeamProfile(updated);
          saveTeamProfile(updated);
        }}
      />

      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </div>
  );
}
