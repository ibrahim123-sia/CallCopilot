"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Send, Trash2, User } from "lucide-react";
import { api } from "@/lib/client/api";
import { ChatMessageRecord, TopicSource } from "@/lib/types";
import { Markdown } from "@/components/ui/Markdown";
import { useToast } from "@/components/ui/Toast";

const SUGGESTIONS = [
  "Pichli meeting mein kya tay hua tha?",
  "What did they say about budget and timeline?",
  "Which questions are still open for the next meeting?",
  "Draft an agenda for our next call",
  "Write a follow-up email based on the last meeting",
];

export function ChatTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sourcesByRef = useRef<Map<string, TopicSource>>(new Map());

  useEffect(() => {
    api<{ messages: ChatMessageRecord[] }>(`/api/clients/${clientId}/chat`)
      .then((d) => setMessages(d.messages))
      .catch(() => {});
  }, [clientId]);

  useEffect(() => {
    for (const m of messages) for (const s of m.sources) sourcesByRef.current.set(s.title.split(":")[0], s);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || streaming) return;
    setInput("");
    setStreaming(true);
    const now = Date.now();
    const assistantId = `pending-${now}`;
    setMessages((prev) => [
      ...prev,
      { id: `u-${now}`, clientId, role: "user", content: message, sources: [], createdAt: now },
      { id: assistantId, clientId, role: "assistant", content: "", sources: [], createdAt: now },
    ]);

    try {
      const res = await fetch(`/api/clients/${clientId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Chat failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "delta") {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + event.text } : m)));
          } else if (event.type === "done") {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, sources: event.sources } : m)));
          } else if (event.type === "error") {
            throw new Error(event.error || "Chat failed");
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Chat failed";
      toast(msg, "error");
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId && !m.content ? { ...m, content: `⚠️ ${msg}` } : m))
      );
    } finally {
      setStreaming(false);
    }
  };

  const clear = async () => {
    if (!confirm(`Clear the whole chat with ${clientName}? Meetings and documents are not affected.`)) return;
    await api(`/api/clients/${clientId}/chat`, { method: "DELETE" });
    setMessages([]);
  };

  const openRef = (ref: string) => {
    const src = sourcesByRef.current.get(ref);
    if (src) router.push(src.url);
  };

  return (
    <div className="card flex h-[calc(100vh-15rem)] min-h-[420px] flex-col">
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-2.5">
        <p className="text-xs text-stone-500">
          Answers use this client&apos;s meetings, documents and brief. Sources appear as <span className="chip chip-history">M1</span> /{" "}
          <span className="chip chip-history">D1</span>.
        </p>
        {messages.length > 0 && (
          <button className="btn btn-ghost" onClick={clear} title="Clear chat">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Bot className="h-8 w-8 text-stone-400" />
            <p className="text-sm text-stone-500">Ask anything about {clientName} — in English or Roman Urdu.</p>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="btn btn-secondary" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-muted">
                <Bot className="h-4 w-4" />
              </span>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "border border-surface-border bg-surface-subtle"
              }`}
            >
              {m.role === "user" ? (
                <p className="whitespace-pre-wrap text-sm">{m.content}</p>
              ) : m.content ? (
                <Markdown text={m.content} onRef={openRef} />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
              )}
              {m.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 border-t border-surface-border pt-2">
                  {m.sources.map((s) => (
                    <button key={s.url + s.title} onClick={() => router.push(s.url)} className="chip chip-history">
                      {s.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {m.role === "user" && (
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-muted">
                <User className="h-4 w-4" />
              </span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-end gap-2 border-t border-surface-border p-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={1}
          placeholder={`Message about ${clientName}…`}
          className="input max-h-40 min-h-[38px] resize-y"
          aria-label="Chat message"
        />
        <button type="submit" className="btn btn-primary h-[38px]" disabled={!input.trim() || streaming}>
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
