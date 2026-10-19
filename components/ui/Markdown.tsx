"use client";

import React from "react";

/**
 * Tiny, safe Markdown subset for chat answers: paragraphs, "-"/"1." lists, **bold**,
 * `code`, headings, and source refs like [M2] rendered as chips. No HTML injection.
 */
export function Markdown({ text, onRef }: { text: string; onRef?: (ref: string) => void }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ""), onRef)}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), onRef)}</li>
              ))}
            </ol>
          );
        }
        const heading = lines[0].match(/^#{1,4}\s+(.*)/);
        if (heading && lines.length === 1) {
          return (
            <p key={i} className="font-semibold">
              {inline(heading[1], onRef)}
            </p>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <React.Fragment key={j}>
                {j > 0 && <br />}
                {inline(l.replace(/^#{1,4}\s+/, ""), onRef)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function inline(text: string, onRef?: (ref: string) => void): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[\s*(?:M|D)\d+\s*\])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) out.push(<strong key={k++}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) out.push(<code key={k++} className="rounded bg-surface-muted px-1 text-[0.85em]">{token.slice(1, -1)}</code>);
    else {
      const ref = token.slice(1, -1).trim();
      out.push(
        <button
          key={k++}
          type="button"
          onClick={() => onRef?.(ref)}
          className="chip chip-history mx-0.5 align-baseline"
          title="Open source"
        >
          {ref}
        </button>
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
