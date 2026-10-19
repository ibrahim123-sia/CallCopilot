"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { api, notifyClientsChanged } from "@/lib/client/api";
import { ClientRecord } from "@/lib/types";

export function NewClientDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { client } = await api<{ client: ClientRecord }>("/api/clients", {
        method: "POST",
        json: { name, company, notes },
      });
      notifyClientsChanged();
      setName("");
      setCompany("");
      setNotes("");
      onClose();
      router.push(`/clients/${client.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not create client", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New client"
      description="Each client gets its own meetings, chat, documents and memory."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="new-client-form" className="btn btn-primary" disabled={!name.trim() || saving}>
            {saving ? "Creating…" : "Create client"}
          </button>
        </>
      }
    >
      <form id="new-client-form" onSubmit={submit} className="space-y-3">
        <div>
          <label className="label" htmlFor="client-name">
            Client / contact name
          </label>
          <input id="client-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Ahmed Khan" />
        </div>
        <div>
          <label className="label" htmlFor="client-company">
            Company (optional)
          </label>
          <input id="client-company" className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme Logistics" />
        </div>
        <div>
          <label className="label" htmlFor="client-notes">
            Private notes (optional)
          </label>
          <textarea
            id="client-notes"
            className="input min-h-[72px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How you met them, what they care about…"
          />
        </div>
      </form>
    </Dialog>
  );
}
