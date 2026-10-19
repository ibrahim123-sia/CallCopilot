"use client";

import React, { useState } from "react";
import { FileDown, Globe, Loader2, Lock, Printer } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";

export function ExportDialog({ open, onClose, meetingId, hasTranslations }: { open: boolean; onClose: () => void; meetingId: string; hasTranslations: boolean }) {
  const toast = useToast();
  const [audience, setAudience] = useState<"client" | "internal">("client");
  const [transcript, setTranscript] = useState(true);
  const [translation, setTranslation] = useState(hasTranslations);
  const [notes, setNotes] = useState(false);
  const [busy, setBusy] = useState(false);

  const params = () =>
    new URLSearchParams({
      audience,
      transcript: transcript ? "1" : "0",
      translation: translation ? "1" : "0",
      notes: notes ? "1" : "0",
      internal: audience === "internal" ? "1" : "0",
    });

  /** Fallback: open the report as a page and let the browser's "Save as PDF" make the file. */
  const openPrintable = () => {
    window.open(`/api/meetings/${meetingId}/report?${params()}&print=1`, "_blank", "noopener");
  };

  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/pdf?${params()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `PDF failed (${res.status})`);
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || "meeting.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      toast(`${err instanceof Error ? err.message : "PDF failed"} — use "Printable version" and choose Save as PDF.`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Download PDF report"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-secondary" onClick={openPrintable} title="Opens the report; use your browser's Save as PDF">
            <Printer className="h-3.5 w-3.5" /> Printable version
          </button>
          <button className="btn btn-primary" onClick={download} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} {busy ? "Generating…" : "Download"}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div>
          <span className="label">Audience</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setAudience("client")}
              aria-pressed={audience === "client"}
              className={`rounded-lg border p-3 text-left ${audience === "client" ? "border-foreground ring-1 ring-foreground" : "border-surface-border"}`}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <Globe className="h-3.5 w-3.5 text-sky-600" /> Client-facing
              </span>
              <span className="text-[11px] text-stone-500">No internal risks, signals or research notes.</span>
            </button>
            <button
              onClick={() => setAudience("internal")}
              aria-pressed={audience === "internal"}
              className={`rounded-lg border p-3 text-left ${audience === "internal" ? "border-foreground ring-1 ring-foreground" : "border-surface-border"}`}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <Lock className="h-3.5 w-3.5 text-amber-600" /> Internal
              </span>
              <span className="text-[11px] text-stone-500">Everything, including confidential sections.</span>
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={transcript} onChange={(e) => setTranscript(e.target.checked)} /> Include full transcript
        </label>
        <label className={`flex items-center gap-2 ${!transcript ? "opacity-50" : ""}`}>
          <input type="checkbox" disabled={!transcript} checked={translation && transcript} onChange={(e) => setTranslation(e.target.checked)} />
          Add Roman Urdu under each transcript line
          {!hasTranslations && <span className="text-[11px] text-stone-500">(none saved yet)</span>}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={notes} onChange={(e) => setNotes(e.target.checked)} /> Include my notes
        </label>
      </div>
    </Dialog>
  );
}
