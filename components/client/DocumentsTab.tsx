"use client";

import React, { useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { formatLocalDate } from "@/lib/time";
import { useToast } from "@/components/ui/Toast";
import { AddMaterialDialog } from "./AddMaterialDialog";

export interface DocumentSummary {
  id: string;
  title: string;
  kind: string;
  mimeType: string;
  createdAt: number;
  chars: number;
  preview: string;
}

export function DocumentsTab({ clientId, documents, onChanged }: { clientId: string; documents: DocumentSummary[]; onChanged: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const remove = async (doc: DocumentSummary) => {
    if (!confirm(`Delete "${doc.title}"? It will no longer be used as context.`)) return;
    try {
      await api(`/api/documents/${doc.id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-500">Proposals, specs, emails, previous notes. Used as searchable context in live calls and chat.</p>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add document
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center text-sm text-stone-500">
          <FileText className="h-6 w-6" />
          No documents yet.
        </div>
      ) : (
        <div className="card divide-y divide-surface-border">
          {documents.map((d) => (
            <div key={d.id} className="flex items-start gap-3 px-4 py-3">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.title}</p>
                <p className="text-[11px] text-stone-500">
                  {formatLocalDate(d.createdAt)} · {d.kind === "paste" ? "pasted" : "uploaded"} · {Math.round(d.chars / 1000) || "<1"}k chars
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-stone-600 dark:text-stone-400">{d.preview}</p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => remove(d)} aria-label={`Delete ${d.title}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AddMaterialDialog open={open} onClose={() => setOpen(false)} clientId={clientId} defaultAsMeeting={false} onAdded={onChanged} />
    </div>
  );
}
