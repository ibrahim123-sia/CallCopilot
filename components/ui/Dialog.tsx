"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

/** Accessible modal built on the native <dialog> element (focus trap + Esc for free). */
export function Dialog({ open, onClose, title, description, children, footer, size = "md" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const width = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`w-[calc(100%-2rem)] ${width} rounded-xl border border-surface-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40 backdrop:backdrop-blur-[1px]`}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-surface-border px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-xs text-stone-500">{description}</p>}
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-icon -mr-1" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-surface-border px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
