"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Database, KeyRound, XCircle } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { AppSettings } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

interface Payload {
  settings: AppSettings;
  status: {
    geminiConfigured: boolean;
    groqConfigured: boolean;
    deepgramConfigured: boolean;
    models: { live: string; translate: string; summary: string; stt: string };
    groqModels: { live: string; translate: string; summary: string };
  };
}

const listToText = (l: string[]) => l.join(", ");
const textToList = (t: string) => t.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

export default function SettingsPage() {
  const toast = useToast();
  const { data, setData } = useApi<Payload>("/api/settings");
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [lists, setLists] = useState({ coreSkills: "", industries: "", excludedAreas: "", knownTopics: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setDraft(data.settings);
    const tp = data.settings.teamProfile;
    setLists({
      coreSkills: listToText(tp.coreSkills),
      industries: listToText(tp.industries),
      excludedAreas: listToText(tp.excludedAreas),
      knownTopics: listToText(tp.knownTopics),
    });
  }, [data]);

  if (!data || !draft) return <div className="p-8 text-sm text-stone-500">Loading…</div>;
  const { status } = data;

  const save = async () => {
    setSaving(true);
    try {
      const payload: Partial<AppSettings> = {
        teamProfile: {
          ...draft.teamProfile,
          coreSkills: textToList(lists.coreSkills),
          industries: textToList(lists.industries),
          excludedAreas: textToList(lists.excludedAreas),
          knownTopics: textToList(lists.knownTopics),
        },
        exportOptions: draft.exportOptions,
        pacing: draft.pacing,
        sttProvider: draft.sttProvider,
        llmPrimary: draft.llmPrimary,
        captionLayout: draft.captionLayout,
      };
      const res = await api<Payload>("/api/settings", { method: "PUT", json: payload });
      setData(res);
      toast("Settings saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const StatusRow = ({ ok, label, hint }: { ok: boolean; label: string; hint: string }) => (
    <div className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 text-stone-400" />}
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-stone-500">{hint}</p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </header>

      <section className="card space-y-3 p-5">
        <h2 className="section-title flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5" /> API keys (set in .env)
        </h2>
        <StatusRow
          ok={status.groqConfigured}
          label="Groq (free tier) — fast suggestions, Roman Urdu, summaries, chat"
          hint={status.groqConfigured ? `Models: live ${status.groqModels.live} · captions ${status.groqModels.translate} · summary/chat ${status.groqModels.summary}` : "Free key at console.groq.com/keys → set GROQ_API_KEY in .env, then restart."}
        />
        <StatusRow
          ok={status.geminiConfigured}
          label="Gemini (free tier) — live transcription (required for captions) + AI fallback"
          hint={status.geminiConfigured ? `Models: live ${status.models.live} · captions ${status.models.translate} · summary ${status.models.summary} · speech ${status.models.stt}` : "Get a free key at aistudio.google.com/apikey and set GEMINI_API_KEY in .env, then restart."}
        />
        <StatusRow
          ok={status.deepgramConfigured}
          label="Deepgram (optional, paid after trial credit)"
          hint="Only needed if you prefer Deepgram transcription. Set DEEPGRAM_API_KEY."
        />
        <div className="max-w-xs">
          <label className="label">Try this AI provider first</label>
          <select className="input" value={draft.llmPrimary} onChange={(e) => setDraft({ ...draft, llmPrimary: e.target.value as AppSettings["llmPrimary"] })}>
            <option value="groq">Groq first, Gemini as fallback</option>
            <option value="gemini">Gemini first, Groq as fallback</option>
          </select>
          <p className="mt-1 text-[11px] text-stone-500">If the first one is rate-limited or fails, the other is used automatically. Very long requests always go to Gemini.</p>
        </div>
        <p className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Free-tier note: Google may use free-tier API data to improve its products. Avoid the free tier for meetings
          under a strict NDA, or enable billing on the Google project for those. Check Groq&apos;s data policy in its console as well.
        </p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="section-title">Your team</h2>
        <p className="text-xs text-stone-500">The AI uses this to flag topics that are new to you and to tailor suggested replies.</p>
        <div>
          <label className="label">Company name (also shown on PDF reports)</label>
          <input
            className="input"
            value={draft.teamProfile.companyName}
            onChange={(e) =>
              setDraft({ ...draft, teamProfile: { ...draft.teamProfile, companyName: e.target.value }, exportOptions: { ...draft.exportOptions, companyName: e.target.value } })
            }
          />
        </div>
        {(
          [
            ["coreSkills", "Core skills & tech stack"],
            ["industries", "Industries"],
            ["excludedAreas", "Things you don't do"],
            ["knownTopics", "Topics you already know (never flagged as new)"],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <label className="label">{label} — comma separated</label>
            <textarea className="input min-h-[56px] text-sm" value={lists[key]} onChange={(e) => setLists({ ...lists, [key]: e.target.value })} />
          </div>
        ))}
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="section-title">Live call</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Transcription</label>
            <select className="input" value={draft.sttProvider} onChange={(e) => setDraft({ ...draft, sttProvider: e.target.value as AppSettings["sttProvider"] })}>
              <option value="gemini">Gemini Live (free)</option>
              <option value="deepgram" disabled={!status.deepgramConfigured}>
                Deepgram Nova-3 {status.deepgramConfigured ? "" : "(no key)"}
              </option>
            </select>
          </div>
          <div>
            <label className="label">Caption layout</label>
            <select className="input" value={draft.captionLayout} onChange={(e) => setDraft({ ...draft, captionLayout: e.target.value as AppSettings["captionLayout"] })}>
              <option value="side-by-side">English | Roman Urdu side by side</option>
              <option value="stacked">Roman Urdu under each line</option>
            </select>
          </div>
          <div>
            <label className="label">Seconds between AI suggestion updates</label>
            <input
              type="number"
              min={5}
              max={120}
              className="input"
              value={draft.pacing.analysisMinIntervalSec}
              onChange={(e) => setDraft({ ...draft, pacing: { ...draft.pacing, analysisMinIntervalSec: Number(e.target.value) || 12 } })}
            />
            <p className="mt-1 text-[11px] text-stone-500">Lower = fresher suggestions but uses free quota faster. 10–15s works well.</p>
          </div>
          <div>
            <label className="label">Seconds to batch captions before translating</label>
            <input
              type="number"
              min={2}
              max={60}
              className="input"
              value={draft.pacing.translationBatchSec}
              onChange={(e) => setDraft({ ...draft, pacing: { ...draft.pacing, translationBatchSec: Number(e.target.value) || 6 } })}
            />
            <p className="mt-1 text-[11px] text-stone-500">Roman Urdu appears about this many seconds after a sentence ends.</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.pacing.translationEnabled}
            onChange={(e) => setDraft({ ...draft, pacing: { ...draft.pacing, translationEnabled: e.target.checked } })}
          />
          Show live Roman Urdu captions by default
        </label>
      </section>

      <section className="card space-y-2 p-5">
        <h2 className="section-title flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5" /> Your data
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Clients, meetings, transcripts, documents and chats are stored only on this computer in{" "}
          <code className="rounded bg-surface-muted px-1">data/callcopilot.db</code> (SQLite). Back it up by copying that file
          while the app is stopped. Deleting a client deletes all of its data.
        </p>
      </section>
    </div>
  );
}
