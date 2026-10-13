"use client";

import React from "react";
import {
  Play,
  Pause,
  PhoneOff,
  Settings,
  HelpCircle,
  Sun,
  Moon,
  Search,
} from "lucide-react";
import { TranscriptionStatus } from "@/lib/transcription/types";

interface TopBarProps {
  status: TranscriptionStatus;
  callDurationSeconds: number;
  clientTalkSeconds: number;
  teamTalkSeconds: number;
  isPaused: boolean;
  isDemo: boolean;
  onTogglePause: () => void;
  onEndCall: () => void;
  onOpenProfile: () => void;
  onOpenShortcuts: () => void;
  onFocusLookup: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export function TopBar({
  status,
  callDurationSeconds,
  clientTalkSeconds,
  teamTalkSeconds,
  isPaused,
  isDemo,
  onTogglePause,
  onEndCall,
  onOpenProfile,
  onOpenShortcuts,
  onFocusLookup,
  theme,
  onToggleTheme,
}: TopBarProps) {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const totalTalk = clientTalkSeconds + teamTalkSeconds || 1;
  const clientPct = Math.round((clientTalkSeconds / totalTalk) * 100);
  const teamPct = 100 - clientPct;

  return (
    <header className="h-12 border-b border-surface-border bg-surface px-4 flex items-center justify-between select-none z-20">
      {/* Left: Brand & Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-semibold text-xs tracking-tight text-foreground">
          <span className="w-2 h-2 rounded-full bg-stone-900 dark:bg-stone-100" />
          <span>CallCopilot</span>
          {isDemo && (
            <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-surface-border">
              Demo Mode
            </span>
          )}
        </div>

        <div className="h-4 w-[1px] bg-surface-border" />

        {/* Listening Status Badge */}
        <div className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300 font-mono">
          <span
            className={`w-2 h-2 rounded-full transition-colors ${
              isPaused
                ? "bg-amber-400"
                : status === "listening"
                ? "bg-emerald-500 animate-pulse"
                : status === "connecting"
                ? "bg-blue-400 animate-pulse"
                : "bg-stone-400"
            }`}
          />
          <span className="capitalize">
            {isPaused ? "Paused" : status}
          </span>
        </div>

        <div className="h-4 w-[1px] bg-surface-border" />

        {/* Timer */}
        <div className="text-xs font-mono text-stone-600 dark:text-stone-400">
          {formatTime(callDurationSeconds)}
        </div>
      </div>

      {/* Center: Talk Time Ratio */}
      <div className="hidden md:flex items-center gap-2 text-xs">
        <span className="text-[11px] text-stone-500 font-medium">Talk Split:</span>
        <div className="flex items-center gap-1 text-[11px] font-mono">
          <span className="text-stone-700 dark:text-stone-300">Client {clientPct}%</span>
          <div className="w-24 h-1.5 bg-surface-muted rounded-full overflow-hidden flex">
            <div
              className="bg-sky-600 dark:bg-sky-500 transition-all duration-300"
              style={{ width: `${clientPct}%` }}
              title={`Client: ${clientPct}%`}
            />
            <div
              className="bg-stone-400 dark:bg-stone-600 transition-all duration-300"
              style={{ width: `${teamPct}%` }}
              title={`Our Team: ${teamPct}%`}
            />
          </div>
          <span className="text-stone-500">Team {teamPct}%</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onFocusLookup}
          className="p-1.5 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 rounded hover:bg-surface-subtle transition-colors"
          title="Quick Lookup (L)"
        >
          <Search className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onTogglePause}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-surface-border hover:bg-surface-subtle text-foreground transition-colors"
          title="Pause / Resume Listening (Space)"
        >
          {isPaused ? (
            <>
              <Play className="w-3 h-3 text-emerald-600" />
              <span>Resume</span>
            </>
          ) : (
            <>
              <Pause className="w-3 h-3 text-stone-600 dark:text-stone-400" />
              <span>Pause</span>
            </>
          )}
        </button>

        <button
          onClick={onEndCall}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 transition-opacity"
        >
          <PhoneOff className="w-3 h-3" />
          <span>End Call</span>
        </button>

        <div className="h-4 w-[1px] bg-surface-border mx-1" />

        <button
          onClick={onOpenProfile}
          className="p-1.5 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 rounded hover:bg-surface-subtle transition-colors"
          title="Team Profile Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onOpenShortcuts}
          className="p-1.5 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 rounded hover:bg-surface-subtle transition-colors"
          title="Keyboard Shortcuts (?)"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onToggleTheme}
          className="p-1.5 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 rounded hover:bg-surface-subtle transition-colors"
          title="Toggle Theme"
        >
          {theme === "dark" ? (
            <Sun className="w-3.5 h-3.5" />
          ) : (
            <Moon className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </header>
  );
}
