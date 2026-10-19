"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(message: string, public status: number, public retryAfterMs?: number, public code?: string) {
    super(message);
  }
}

/** JSON fetch against our own API routes; throws ApiError with the server's message. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.retryAfterMs, data.code);
  }
  return data as T;
}

/** Minimal data hook: load on mount / when the path changes, with manual reload. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!path) return;
    const mine = ++seq.current;
    setLoading(true);
    try {
      const result = await api<T>(path);
      if (mine === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mine === seq.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, setData, error, loading, reload };
}

/** Cross-component refresh signal (e.g. sidebar client list after a rename). */
export const CLIENTS_CHANGED = "callcopilot:clients-changed";
export function notifyClientsChanged(): void {
  window.dispatchEvent(new Event(CLIENTS_CHANGED));
}
