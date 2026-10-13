"use client";

import React, { useState } from "react";
import {
  Mic,
  Monitor,
  Play,
  ShieldCheck,
  Sparkles,
  Info,
  AlertCircle,
} from "lucide-react";
import { CallContext } from "@/lib/types";

interface ReadyScreenProps {
  onStartCall: (
    mode: "dual" | "mic-only" | "demo",
    context: CallContext
  ) => void;
  consentGiven: boolean;
  onConsentChange: (given: boolean) => void;
}

export function ReadyScreen({
  onStartCall,
  consentGiven,
  onConsentChange,
}: ReadyScreenProps) {
  const [selectedMode, setSelectedMode] = useState<"dual" | "mic-only" | "demo">("demo");
  const [clientName, setClientName] = useState("Alex Rivers");
  const [projectName, setProjectName] = useState("CRM AI Assistant Pilot");
  const [meetingGoal, setMeetingGoal] = useState("Scope & Architecture Discovery");
  const [language, setLanguage] = useState<"en" | "ur" | "auto">("auto");
  const [consentError, setConsentError] = useState(false);

  const handleStart = () => {
    if (!consentGiven) {
      setConsentError(true);
      return;
    }
    setConsentError(false);
    onStartCall(selectedMode, {
      clientName,
      projectName,
      meetingGoal,
      language,
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 selection:bg-stone-200 dark:selection:bg-stone-800">
      <div className="w-full max-w-xl bg-surface border border-surface-border rounded-xl shadow-card overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-surface-border bg-surface-subtle">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-900 dark:bg-stone-100" />
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              CallCopilot
            </h1>
            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface border border-surface-border text-stone-500">
              Live Assistant
            </span>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            Stateless real-time call copilot for software teams. Provides dual-channel speaker separation, instant tech insight cards, NEW skill detection, and executive wrap-up PDF reports.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* 1. Mode Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
              1. Select Session Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedMode("demo")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  selectedMode === "demo"
                    ? "border-stone-900 bg-stone-50 dark:border-stone-100 dark:bg-stone-900/50 ring-1 ring-stone-900 dark:ring-stone-100"
                    : "border-surface-border hover:bg-surface-subtle"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Demo Mode</span>
                </div>
                <p className="text-[11px] text-stone-500 leading-snug">
                  Scripted client call. Tests MCP & vector search without keys.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMode("dual")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  selectedMode === "dual"
                    ? "border-stone-900 bg-stone-50 dark:border-stone-100 dark:bg-stone-900/50 ring-1 ring-stone-900 dark:ring-stone-100"
                    : "border-surface-border hover:bg-surface-subtle"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground mb-1">
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Dual-Channel</span>
                </div>
                <p className="text-[11px] text-stone-500 leading-snug">
                  Tab Audio (Client) + Mic (Team). Best for Google Meet/Teams.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMode("mic-only")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  selectedMode === "mic-only"
                    ? "border-stone-900 bg-stone-50 dark:border-stone-100 dark:bg-stone-900/50 ring-1 ring-stone-900 dark:ring-stone-100"
                    : "border-surface-border hover:bg-surface-subtle"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground mb-1">
                  <Mic className="w-3.5 h-3.5" />
                  <span>Mic-Only</span>
                </div>
                <p className="text-[11px] text-stone-500 leading-snug">
                  Single microphone input for in-person or solo practice.
                </p>
              </button>
            </div>

            {selectedMode === "dual" && (
              <div className="p-2.5 rounded bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>Browser Tab Audio Tip:</strong> Works best on Chrome and Edge. When the browser displays the screen picker, select <em>&quot;Chrome Tab&quot;</em> and make sure the <strong>&quot;Share tab audio&quot;</strong> checkbox at the bottom is checked.
                </span>
              </div>
            )}
          </div>

          {/* 2. Call Context (Optional metadata) */}
          <div className="space-y-3 pt-2 border-t border-surface-border">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
              2. Meeting Details (Optional)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-stone-500 mb-1 block">Client Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Alex Rivers"
                  className="w-full px-2.5 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded focus:outline-none focus:ring-1 focus:ring-stone-400 text-foreground"
                />
              </div>

              <div>
                <label className="text-[11px] text-stone-500 mb-1 block">Project / Topic</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. AI CRM Pilot"
                  className="w-full px-2.5 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded focus:outline-none focus:ring-1 focus:ring-stone-400 text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-stone-500 mb-1 block">Meeting Goal</label>
                <input
                  type="text"
                  value={meetingGoal}
                  onChange={(e) => setMeetingGoal(e.target.value)}
                  placeholder="e.g. Scope Alignment"
                  className="w-full px-2.5 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded focus:outline-none focus:ring-1 focus:ring-stone-400 text-foreground"
                />
              </div>

              <div>
                <label className="text-[11px] text-stone-500 mb-1 block">Transcription Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as "en" | "ur" | "auto")}
                  className="w-full px-2.5 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded focus:outline-none focus:ring-1 focus:ring-stone-400 text-foreground"
                >
                  <option value="auto">Auto / Mixed (English + Urdu)</option>
                  <option value="en">English (US/UK)</option>
                  <option value="ur">Urdu (اردو)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Privacy & Consent Notice (Mandatory) */}
          <div className="space-y-2 pt-2 border-t border-surface-border">
            <div className="p-3 rounded-lg bg-surface-subtle border border-surface-border">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                <span>Privacy & Consent Confirmation</span>
              </div>
              <p className="text-[11px] text-stone-600 dark:text-stone-400 mb-2.5 leading-relaxed">
                CallCopilot is 100% stateless: no transcripts or audio recordings are stored on servers or in databases. Data is processed ephemerally in browser memory and passed to transcription (Deepgram) and AI intelligence (Google Gemini).
              </p>

              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => {
                    onConsentChange(e.target.checked);
                    if (e.target.checked) setConsentError(false);
                  }}
                  className="mt-0.5 rounded border-stone-300 text-stone-900 focus:ring-stone-500"
                />
                <span className="text-xs text-foreground font-medium leading-snug">
                  I confirm that all call participants will be notified that this call is being transcribed, in compliance with applicable two-party consent laws.
                </span>
              </label>

              {consentError && (
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Consent confirmation is required before starting.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Launch Button */}
        <div className="p-4 bg-surface-subtle border-t border-surface-border flex items-center justify-between">
          <div className="text-[11px] text-stone-500">
            {selectedMode === "demo" ? "Instant start with sample audio" : "Browser permissions will be requested"}
          </div>

          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 transition-opacity"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Call Copilot</span>
          </button>
        </div>
      </div>
    </div>
  );
}
