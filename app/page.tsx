"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
} from "@/lib/analysis/contextBuilder";
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
    language: "auto",
  });
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [clientTalkSeconds, setClientTalkSeconds] = useState(0);
  const [teamTalkSeconds, setTeamTalkSeconds] = useState(0);
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionStatus>("idle");
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

  // Modals & Panels
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"transcript" | "insights" | "replies">("insights");

  // Refs for audio and streaming sessions
  const audioSessionRef = useRef<AudioCaptureSession | null>(null);
  const providerRef = useRef<TranscriptionProvider | null>(null);
  const triggerControllerRef = useRef<AnalysisTriggerController | null>(null);
  const lookupInputRef = useRef<HTMLInputElement | null>(null);

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

  // Call timer and talk-time incrementer
  useEffect(() => {
    if (screen !== "calling" || isPaused) return;

    const timer = setInterval(() => {
      setCallDurationSeconds((prev) => prev + 1);

      // Increment talk split according to current interim / recent speaker
      if (interimEntry) {
        if (interimEntry.speaker === "client") {
          setClientTalkSeconds((prev) => prev + 1);
        } else {
          setTeamTalkSeconds((prev) => prev + 1);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [screen, isPaused, interimEntry]);

  // Execute server analysis with rolling context
  const triggerAnalysis = useCallback(
    async (abortSignal: AbortSignal) => {
      if (transcript.length === 0) return;

      const { recent } = partitionTranscriptWindow(transcript, 240000);
      const recentText = formatTranscriptForPrompt(recent);

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortSignal,
          body: JSON.stringify({
            recentTranscript: recentText,
            rollingSummary: "",
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
          return; // Superseeded by newer utterance
        }
        console.warn("Analysis call error:", err);
      }
    },
    [transcript, teamProfile, callContext, isDemo]
  );

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

  // Handle incoming transcripts
  const handleIncomingTranscript = useCallback(
    (entry: TranscriptEntry) => {
      if (!entry.isFinal) {
        setInterimEntry(entry);
        return;
      }

      setInterimEntry(null);
      setTranscript((prev) => [...prev, entry]);

      // Calculate approximate turn duration towards talk-time
      const words = entry.text.split(" ").length;
      const estSeconds = Math.max(1, Math.round(words / 2.5));
      if (entry.speaker === "client") {
        setClientTalkSeconds((prev) => prev + estSeconds);
      } else {
        setTeamTalkSeconds((prev) => prev + estSeconds);
      }

      // Pass utterance to debounced analysis controller
      if (triggerControllerRef.current) {
        triggerControllerRef.current.handleUtterance(entry, (signal) =>
          triggerAnalysis(signal)
        );
      }
    },
    [triggerAnalysis]
  );

  // Start Call
  const handleStartCall = async (
    mode: "dual" | "mic-only" | "demo",
    context: CallContext
  ) => {
    setCallContext(context);
    setIsDemo(mode === "demo");
    setTranscript([]);
    setTopicCards([]);
    setClientIntent("");
    setSignals([]);
    setSuggestedReplies([]);
    setCrossQuestions([]);
    setRedFlags([]);
    setUserNotes("");
    setCallDurationSeconds(0);
    setClientTalkSeconds(0);
    setTeamTalkSeconds(0);
    setIsPaused(false);
    setScreen("calling");

    if (mode === "demo") {
      const demoProvider = new DemoTranscriptionProvider();
      providerRef.current = demoProvider;

      demoProvider.onStatusChange((status) => setTranscriptionStatus(status));
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

      deepgramProvider.onStatusChange((status) => setTranscriptionStatus(status));
      deepgramProvider.onTranscript(handleIncomingTranscript);

      await deepgramProvider.connect({
        language: context.language,
        sampleRate: 16000,
        multichannel: !isMicOnly,
      });
    } catch (err: unknown) {
      console.error("Audio capture start failed:", err);
      alert(err instanceof Error ? err.message : "Audio initialization failed.");
      setScreen("ready");
    }
  };

  // Pause / Resume
  const handleTogglePause = useCallback(() => {
    if (isPaused) {
      providerRef.current?.resume();
      setIsPaused(false);
      setTranscriptionStatus("listening");
    } else {
      providerRef.current?.pause();
      setIsPaused(true);
      setTranscriptionStatus("paused");
    }
  }, [isPaused]);

  // End Call & Summarize
  const handleEndCall = async () => {
    // Teardown live capture
    triggerControllerRef.current?.cancelPending();
    providerRef.current?.disconnect();
    providerRef.current = null;
    audioSessionRef.current?.stop();
    audioSessionRef.current = null;

    setTranscriptionStatus("disconnected");

    // Fetch meeting wrap-up
    const fullTranscriptText = formatTranscriptForPrompt(transcript);
    const pinnedTitles = topicCards.filter((c) => c.pinned).map((c) => c.title);

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullTranscript: fullTranscriptText || "Sample CRM discussion",
          userNotes,
          pinnedTopics: pinnedTitles,
          teamProfile,
          callContext,
          isDemo,
        }),
      });

      if (res.ok) {
        const wrapUp = await res.json();
        setWrapUpData(wrapUp);
      } else {
        // Fallback to canned wrap-up
        setWrapUpData(CANNED_DEMO_WRAPUP);
      }
    } catch (err) {
      console.warn("Summarize fetch error, fallback to canned wrap up:", err);
      setWrapUpData(CANNED_DEMO_WRAPUP);
    }

    setScreen("wrapup");
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
      // Don't trigger shortcuts if inside textarea or input
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea") {
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
  }, [handleTogglePause, suggestedReplies]);

  // Clean wipe
  const handleClearEverything = () => {
    setTranscript([]);
    setTopicCards([]);
    setUserNotes("");
    setWrapUpData(null);
    setScreen("ready");
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

  // Screen 2: Wrap-Up Screen
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
        onBackToCall={() => setScreen("calling")}
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
