"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppSettings,
  CallContext,
  ClientRecord,
  CrossQuestion,
  MeetingRecord,
  RedFlag,
  Signal,
  StoredSegment,
  SuggestedReply,
  TopicCard,
  TranscriptEntry,
} from "../types";
import { AudioCaptureSession, startAudioCapture } from "../audio/capture";
import { TranscriptionProvider, TranscriptionStatus } from "../transcription/types";
import { DemoTranscriptionProvider } from "../transcription/demoProvider";
import { DeepgramTranscriptionProvider } from "../transcription/deepgramProvider";
import { GeminiLiveTranscriptionProvider } from "../transcription/geminiLiveProvider";
import { AnalysisTriggerController } from "../analysis/triggerLogic";
import { formatTranscriptForPrompt, partitionTranscriptWindow, truncateTranscriptBuffer } from "../analysis/contextBuilder";
import { SegmentSaver } from "./segmentSaver";
import { TranslationQueue } from "./translationQueue";
import { api } from "./api";

export type CaptureMode = "dual" | "mic-only" | "demo";

export interface LiveRow {
  id: string;
  speaker: "client" | "team";
  text: string;
  translation?: string | null;
  timestamp: number;
  durationMs?: number | null;
}

export interface OpenItem {
  text: string;
  done: boolean;
  auto: boolean;
}

export interface LiveSessionInit {
  meeting: MeetingRecord;
  client: ClientRecord;
  settings: AppSettings;
  existingSegments: StoredSegment[];
  openItems: string[];
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function useLiveSession(init: LiveSessionInit | null) {
  const [phase, setPhase] = useState<"setup" | "live" | "ending">("setup");
  const [status, setStatus] = useState<TranscriptionStatus>("idle");
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [interims, setInterims] = useState<{ client: LiveRow | null; team: LiveRow | null }>({ client: null, team: null });
  const [duration, setDuration] = useState(0);
  const [talk, setTalk] = useState({ client: 0, team: 0 });
  const [cards, setCards] = useState<TopicCard[]>([]);
  const [intent, setIntent] = useState("");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [replies, setReplies] = useState<SuggestedReply[]>([]);
  const [questions, setQuestions] = useState<CrossQuestion[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [openItems, setOpenItems] = useState<OpenItem[]>([]);
  const [notes, setNotes] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [captionNotice, setCaptionNotice] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [translationOn, setTranslationOn] = useState(true);
  const [translationAvailable, setTranslationAvailable] = useState(true);

  const providerRef = useRef<TranscriptionProvider | null>(null);
  const audioRef = useRef<AudioCaptureSession | null>(null);
  const saverRef = useRef<SegmentSaver | null>(null);
  const translatorRef = useRef<TranslationQueue | null>(null);
  const triggerRef = useRef<AnalysisTriggerController | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const aiCooldownUntil = useRef(0);
  const translationOnRef = useRef(true);
  const isDemoRef = useRef(false);
  const initRef = useRef(init);
  initRef.current = init;
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed state from the stored meeting (supports resuming after a crash/refresh)
  useEffect(() => {
    if (!init) return;
    const seeded: TranscriptEntry[] = init.existingSegments.map((s) => ({
      id: s.id,
      speaker: s.speaker,
      text: s.text,
      timestamp: s.timestamp,
      durationMs: s.durationMs ?? undefined,
      isFinal: true,
      channel: s.speaker === "client" ? 1 : 0,
    }));
    transcriptRef.current = seeded;
    setRows(init.existingSegments.map((s) => ({ ...s })));
    setNotes(init.meeting.notes);
    setDuration(init.meeting.durationSeconds);
    setTalk({ client: init.meeting.clientTalkSeconds, team: init.meeting.teamTalkSeconds });
    setOpenItems(init.openItems.map((text) => ({ text, done: false, auto: false })));
    const on = init.settings.pacing.translationEnabled;
    setTranslationOn(on);
    translationOnRef.current = on;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init?.meeting.id]);

  // Call timer
  useEffect(() => {
    if (phase !== "live" || paused) return;
    const t = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, [phase, paused]);

  const callContext = useCallback((): CallContext => {
    const i = initRef.current!;
    return {
      clientName: i.client.name,
      projectName: i.meeting.title,
      meetingGoal: i.meeting.goal,
      language: (i.meeting.language as CallContext["language"]) || "en",
    };
  }, []);

  const runAnalysis = useCallback(
    async (signal: AbortSignal) => {
      const i = initRef.current;
      const all = transcriptRef.current;
      if (!i || all.length === 0) return;
      if (Date.now() < aiCooldownUntil.current) return;

      const { recent, older } = partitionTranscriptWindow(all, 240000);
      const recentClientText = all
        .filter((e) => e.speaker === "client")
        .slice(-4)
        .map((e) => e.text)
        .join(" ");

      setAnalyzing(true);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            clientId: i.client.id,
            meetingId: i.meeting.id,
            recentTranscript: truncateTranscriptBuffer(formatTranscriptForPrompt(recent), 28000),
            earlierTranscript: older.length ? truncateTranscriptBuffer(formatTranscriptForPrompt(older), 10000) : "",
            recentClientText,
            callContext: callContext(),
            isDemo: isDemoRef.current,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          const wait = Number(data.retryAfterMs) || 30000;
          aiCooldownUntil.current = Date.now() + wait;
          setAiNotice(`Free-tier limit reached — suggestions resume in ${Math.ceil(wait / 1000)}s`);
          setTimeout(() => setAiNotice(null), wait);
          return;
        }
        if (!res.ok) {
          setAiNotice(data.error || `Suggestions unavailable (${res.status})`);
          return;
        }
        setAiNotice(null);
        if (data.provider) setAiProvider(data.provider);

        if (Array.isArray(data.topics) && data.topics.length) {
          setCards((prev) => {
            const seen = new Set(prev.map((c) => c.title.toLowerCase().trim()));
            const incoming = (data.topics as TopicCard[])
              .filter((t) => !seen.has(t.title.toLowerCase().trim()))
              .map((t) => ({ ...t, id: t.id || `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: Date.now() }));
            return [...incoming, ...prev];
          });
        }
        if (data.clientIntent) setIntent(data.clientIntent);
        if (data.signals?.length) setSignals(data.signals);
        if (data.suggestedReplies?.length) setReplies(data.suggestedReplies);
        if (data.crossQuestions?.length) setQuestions(data.crossQuestions);
        if (data.redFlags?.length) setRedFlags(data.redFlags);
        if (data.addressedOpenItems?.length) {
          const addressed = (data.addressedOpenItems as string[]).map(normalize);
          setOpenItems((prev) =>
            prev.map((o) =>
              !o.done && addressed.some((a) => a && (normalize(o.text).includes(a) || a.includes(normalize(o.text))))
                ? { ...o, done: true, auto: true }
                : o
            )
          );
        }
      } catch (err) {
        if (!(err instanceof Error && err.name === "AbortError")) setAiNotice("Suggestions request failed — will retry on next utterance");
      } finally {
        setAnalyzing(false);
      }
    },
    [callContext]
  );

  const handleEntry = useCallback(
    (entry: TranscriptEntry) => {
      if (!entry.isFinal) {
        setInterims((cur) => ({ ...cur, [entry.speaker]: { id: entry.id, speaker: entry.speaker, text: entry.text, timestamp: entry.timestamp } }));
        return;
      }
      setInterims((cur) => ({ ...cur, [entry.speaker]: null }));
      transcriptRef.current = [...transcriptRef.current, entry];
      setRows((prev) => [...prev, { id: entry.id, speaker: entry.speaker, text: entry.text, timestamp: entry.timestamp, durationMs: entry.durationMs }]);

      const seconds = entry.durationMs ? entry.durationMs / 1000 : Math.max(1, entry.text.split(/\s+/).length / 2.5);
      setTalk((t) => (entry.speaker === "client" ? { ...t, client: t.client + seconds } : { ...t, team: t.team + seconds }));

      saverRef.current?.add(entry);
      if (translationOnRef.current) translatorRef.current?.add({ id: entry.id, speaker: entry.speaker, text: entry.text });
      triggerRef.current?.handleUtterance(entry, runAnalysis);
    },
    [runAnalysis]
  );

  const start = useCallback(
    async (mode: CaptureMode) => {
      const i = initRef.current;
      if (!i) return;
      isDemoRef.current = mode === "demo";
      setStatusDetail(null);

      saverRef.current = new SegmentSaver(i.meeting.id, { onError: setSaveNotice });
      translatorRef.current = new TranslationQueue({
        meetingId: i.meeting.id,
        batchMs: i.settings.pacing.translationBatchSec * 1000,
        onTranslated: (items) => {
          const map = new Map(items.map((x) => [x.id, x.romanUrdu]));
          setRows((prev) => prev.map((r) => (map.has(r.id) ? { ...r, translation: map.get(r.id) } : r)));
        },
        onStatus: (s) => {
          setCaptionNotice(s.message ?? null);
          if (s.state === "disabled") setTranslationAvailable(false);
        },
      });
      triggerRef.current = new AnalysisTriggerController({
        debounceMs: 1500,
        minIntervalMs: i.settings.pacing.analysisMinIntervalSec * 1000,
      });

      const onStatus = (s: TranscriptionStatus, detail?: string) => {
        setStatus(s);
        setStatusDetail(s === "error" || s === "connecting" ? detail ?? null : null);
      };

      setPhase("live");

      if (mode === "demo") {
        const demo = new DemoTranscriptionProvider();
        providerRef.current = demo;
        demo.onStatusChange(onStatus);
        demo.onTranscript(handleEntry);
        await demo.connect({ speedMultiplier: 1 });
        return;
      }

      try {
        const micOnly = mode === "mic-only";
        audioRef.current = await startAudioCapture({
          micOnly,
          sampleRate: 16000,
          onAudioData: (pcm) => providerRef.current?.sendAudio(pcm),
        });

        const provider: TranscriptionProvider =
          i.settings.sttProvider === "deepgram" ? new DeepgramTranscriptionProvider() : new GeminiLiveTranscriptionProvider();
        providerRef.current = provider;
        provider.onStatusChange(onStatus);
        provider.onTranscript(handleEntry);

        const keyterms = [
          i.client.name,
          i.client.company,
          i.meeting.title,
          ...(i.client.brief?.stakeholders.map((s) => s.name) ?? []),
          ...(i.client.brief?.techStack ?? []),
          i.settings.teamProfile.companyName,
          ...i.settings.teamProfile.coreSkills,
        ].filter(Boolean) as string[];

        await provider.connect({
          language: (i.meeting.language as "en" | "ur" | "auto") || "en",
          sampleRate: 16000,
          multichannel: !micOnly,
          keyterms,
        });
      } catch (err) {
        audioRef.current?.stop();
        audioRef.current = null;
        providerRef.current?.disconnect();
        providerRef.current = null;
        setPhase("setup");
        setStatus("error");
        setStatusDetail(err instanceof Error ? err.message : "Could not start audio");
      }
    },
    [handleEntry]
  );

  const togglePause = useCallback(() => {
    if (!providerRef.current) return;
    if (paused) providerRef.current.resume();
    else providerRef.current.pause();
    setPaused(!paused);
  }, [paused]);

  const setTranslation = useCallback((on: boolean) => {
    setTranslationOn(on);
    translationOnRef.current = on;
  }, []);

  const updateNotes = useCallback((value: string) => {
    setNotes(value);
    const i = initRef.current;
    if (!i) return;
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      api(`/api/meetings/${i.meeting.id}`, { method: "PATCH", json: { notes: value } }).catch(() => {});
    }, 1500);
  }, []);

  const toggleOpenItem = useCallback((text: string) => {
    setOpenItems((prev) => prev.map((o) => (o.text === text ? { ...o, done: !o.done, auto: false } : o)));
  }, []);

  const lookup = useCallback(async (query: string) => {
    const i = initRef.current;
    try {
      const data = await api<{ topic?: TopicCard }>("/api/lookup", {
        method: "POST",
        json: { query, context: intent, teamSkills: i?.settings.teamProfile.coreSkills ?? [] },
      });
      if (data.topic) setCards((prev) => [{ ...data.topic!, pinned: true }, ...prev]);
    } catch (err) {
      setAiNotice(err instanceof Error ? err.message : "Lookup failed");
    }
  }, [intent]);

  /** Stops capture, saves everything, and marks the meeting ended. */
  const end = useCallback(async () => {
    const i = initRef.current;
    if (!i) return;
    setPhase("ending");
    triggerRef.current?.cancelPending();
    providerRef.current?.disconnect();
    providerRef.current = null;
    audioRef.current?.stop();
    audioRef.current = null;
    translatorRef.current?.stop();
    if (notesTimer.current) clearTimeout(notesTimer.current);
    await saverRef.current?.flush();
    saverRef.current?.stop();

    await api(`/api/meetings/${i.meeting.id}`, {
      method: "PATCH",
      json: {
        status: "ended",
        endedAt: Date.now(),
        durationSeconds: Math.round(duration),
        clientTalkSeconds: Math.round(talk.client),
        teamTalkSeconds: Math.round(talk.team),
        notes,
        pinnedTopics: cards.filter((c) => c.pinned).map((c) => c.title),
      },
    });
  }, [duration, talk, notes, cards]);

  // Safety net: stop audio if the page unmounts mid-call
  useEffect(() => {
    return () => {
      providerRef.current?.disconnect();
      audioRef.current?.stop();
      translatorRef.current?.stop();
      void saverRef.current?.flush();
    };
  }, []);

  return {
    phase,
    status,
    statusDetail,
    paused,
    rows,
    interims: [interims.client, interims.team].filter((x): x is LiveRow => x !== null),
    duration,
    talk,
    cards,
    setCards,
    intent,
    signals,
    replies,
    questions,
    redFlags,
    openItems,
    notes,
    analyzing,
    aiProvider,
    aiNotice,
    captionNotice,
    saveNotice,
    translationOn,
    translationAvailable,
    start,
    end,
    togglePause,
    setTranslation,
    updateNotes,
    toggleOpenItem,
    lookup,
  };
}
