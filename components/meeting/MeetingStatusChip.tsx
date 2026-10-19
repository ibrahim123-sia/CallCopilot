import React from "react";

const LABELS: Record<string, { label: string; cls: string }> = {
  live: { label: "Live / unfinished", cls: "chip-danger" },
  ended: { label: "Needs summary", cls: "chip-new" },
  summarized: { label: "Summarized", cls: "chip-success" },
  imported: { label: "Imported notes", cls: "chip-history" },
};

export function MeetingStatusChip({ status }: { status: string }) {
  const s = LABELS[status] ?? { label: status, cls: "chip-neutral" };
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}
