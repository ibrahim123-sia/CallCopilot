"use client";

import React from "react";
import { X, Command } from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "Space", desc: "Pause or Resume live audio transcription" },
    { key: "L", desc: "Focus the Quick Lookup input box" },
    { key: "C", desc: "Copy the top suggested response to clipboard" },
    { key: "T", desc: "Turn Roman Urdu captions on or off" },
    { key: "?", desc: "Toggle this Keyboard Shortcuts reference" },
    { key: "Esc", desc: "Close open modal dialogs" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-surface-border rounded-xl shadow-xl max-w-sm w-full overflow-hidden">
        <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface-subtle">
          <div className="flex items-center gap-2">
            <Command className="w-4 h-4 text-stone-500" />
            <h2 className="text-sm font-semibold text-foreground">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface text-stone-500 hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 divide-y divide-surface-border">
          {shortcuts.map((s, i) => (
            <div
              key={i}
              className="py-2.5 flex items-center justify-between text-xs first:pt-0 last:pb-0"
            >
              <span className="text-stone-600 dark:text-stone-300">{s.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-surface-muted border border-surface-border font-mono font-semibold text-[11px] text-foreground">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-surface-border bg-surface-subtle flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 hover:opacity-90"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
