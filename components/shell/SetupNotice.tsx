"use client";

import React from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { useApi } from "@/lib/client/api";

interface SettingsStatus {
  status: { geminiConfigured: boolean; groqConfigured: boolean };
}

/** Shown until a (free) Gemini API key is configured. */
export function SetupNotice() {
  const { data } = useApi<SettingsStatus>("/api/settings");
  if (!data || data.status.geminiConfigured) return null;
  return (
    <div className="card flex items-start gap-3 border-amber-300 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/20">
      <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="space-y-1 text-sm">
        <p className="font-semibold">Add your free Gemini API key</p>
        <ol className="list-decimal space-y-0.5 pl-4 text-xs text-stone-600 dark:text-stone-300">
          <li>
            Open{" "}
            <a className="underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
              aistudio.google.com/apikey
            </a>{" "}
            and create a key (free, no card needed).
          </li>
          <li>
            Optional but recommended: a free Groq key from{" "}
            <a className="underline" href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">
              console.groq.com/keys
            </a>{" "}
            for faster suggestions (Gemini becomes the fallback).
          </li>
          <li>
            Copy <code>.env.example</code> to <code>.env</code> and set <code>GEMINI_API_KEY=…</code>
            {data.status.groqConfigured ? "" : " (and GROQ_API_KEY=…)"}.
          </li>
          <li>Restart the app (<code>npm run dev</code>).</li>
        </ol>
        <p className="text-xs text-stone-500">
          Gemini is needed for live captions (speech-to-text). Until then only the demo call works. <Link href="/settings" className="underline">Settings</Link> shows what&apos;s configured.
        </p>
      </div>
    </div>
  );
}
