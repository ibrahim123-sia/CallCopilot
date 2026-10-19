"use client";

import React, { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";

interface Props {
  open: boolean;
  onClose: () => void;
  clientId: string;
  /** Default for the "previous meeting" checkbox (true when opened from the Meetings tab). */
  defaultAsMeeting: boolean;
  onAdded: () => void;
}

export function AddMaterialDialog({ open, onClose, clientId, defaultAsMeeting, onAdded }: Props) {
  const toast = useToast();
  const [source, setSource] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [asMeeting, setAsMeeting] = useState(defaultAsMeeting);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setAsMeeting(defaultAsMeeting);
      setFile(null);
      setTitle("");
      setText("");
      setDate("");
    }
  }, [open, defaultAsMeeting]);

  const canSubmit = source === "upload" ? Boolean(file) : Boolean(title.trim() && text.trim());
  const dateMs = date ? new Date(`${date}T12:00:00`).getTime() : undefined;

  const submit = async () => {
    setBusy(true);
    try {
      let res: Response;
      if (source === "upload" && file) {
        const form = new FormData();
        form.append("file", file);
        form.append("title", title.trim() || file.name.replace(/\.[^.]+$/, ""));
        form.append("importAsMeeting", String(asMeeting));
        if (dateMs) form.append("date", String(dateMs));
        res = await fetch(`/api/clients/${clientId}/documents`, { method: "POST", body: form });
      } else {
        res = await fetch(`/api/clients/${clientId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, text, importAsMeeting: asMeeting, date: dateMs }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      toast(asMeeting ? "Added and summarized into client memory" : "Document added", "success");
      onAdded();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      size="lg"
      title={defaultAsMeeting ? "Import a previous meeting" : "Add document"}
      description="DOCX, PDF, TXT or Markdown — or paste text. Everything stays on this computer."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!canSubmit || busy}>
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {asMeeting ? "Summarizing…" : "Saving…"}
              </>
            ) : (
              "Add"
            )}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="segmented">
          <button aria-pressed={source === "upload"} onClick={() => setSource("upload")}>
            Upload file
          </button>
          <button aria-pressed={source === "paste"} onClick={() => setSource("paste")}>
            Paste text
          </button>
        </div>

        {source === "upload" ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) setFile(f);
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragging ? "border-foreground bg-surface-subtle" : "border-surface-border hover:bg-surface-subtle"
            }`}
          >
            <FileUp className="h-6 w-6 text-stone-400" />
            <p className="text-sm">{file ? file.name : "Drop a file here or click to choose"}</p>
            <p className="text-[11px] text-stone-500">.docx · .pdf · .txt · .md (max 15 MB)</p>
            <input
              ref={inputRef}
              type="file"
              accept=".docx,.pdf,.txt,.md,.markdown,.vtt,.srt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="mat-text">
              Text
            </label>
            <textarea
              id="mat-text"
              className="input min-h-[180px] text-xs"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste meeting notes, a transcript, an email thread, a proposal…"
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="mat-title">
              Title {source === "upload" && "(optional)"}
            </label>
            <input id="mat-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kickoff call notes" />
          </div>
          {asMeeting && (
            <div>
              <label className="label" htmlFor="mat-date">
                Meeting date (optional)
              </label>
              <input id="mat-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-surface-border bg-surface-subtle p-3 text-xs">
          <input type="checkbox" checked={asMeeting} onChange={(e) => setAsMeeting(e.target.checked)} className="mt-0.5" />
          <span>
            <strong>This is from a previous meeting.</strong> AI summarizes it into a past meeting (decisions, open
            questions, tasks) and updates the client brief. Leave unticked for reference material like proposals or specs
            — they are still searchable during live calls and chat.
          </span>
        </label>
      </div>
    </Dialog>
  );
}
