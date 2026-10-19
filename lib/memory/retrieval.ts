import MiniSearch from "minisearch";

/**
 * Local keyword retrieval (BM25-style via MiniSearch) over a client's past material.
 * Runs entirely on this machine, so it costs no API quota — important on the Gemini
 * free tier, where embedding calls would compete with live analysis.
 */

export interface SourceDoc {
  /** Stable citation key shown to the model and the user, e.g. "M2" or "D1". */
  ref: string;
  kind: "meeting" | "document";
  title: string;
  date: number;
  text: string;
}

export interface RetrievedChunk {
  ref: string;
  kind: SourceDoc["kind"];
  title: string;
  date: number;
  text: string;
  score: number;
}

const CHUNK_CHARS = 900;
const CHUNK_OVERLAP = 150;

export function chunkText(text: string, size = CHUNK_CHARS, overlap = CHUNK_OVERLAP): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      // Prefer to break on a line or sentence boundary
      const window = clean.slice(start, end);
      const breakAt = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(". "));
      if (breakAt > size * 0.5) end = start + breakAt + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter(Boolean);
}

export class ClientCorpus {
  private index: MiniSearch<{ id: string; text: string; title: string }>;
  private chunks = new Map<string, Omit<RetrievedChunk, "score">>();

  constructor(sources: SourceDoc[]) {
    this.index = new MiniSearch({
      fields: ["text", "title"],
      storeFields: [],
      searchOptions: { boost: { title: 2 }, prefix: true, fuzzy: 0.15, combineWith: "OR" },
    });

    const docs: Array<{ id: string; text: string; title: string }> = [];
    for (const src of sources) {
      chunkText(src.text).forEach((text, i) => {
        const id = `${src.ref}#${i}`;
        this.chunks.set(id, { ref: src.ref, kind: src.kind, title: src.title, date: src.date, text });
        docs.push({ id, text, title: src.title });
      });
    }
    this.index.addAll(docs);
  }

  get size(): number {
    return this.chunks.size;
  }

  search(query: string, limit = 5): RetrievedChunk[] {
    const q = query.trim();
    if (!q || this.chunks.size === 0) return [];
    const hits = this.index.search(q);
    const out: RetrievedChunk[] = [];
    const perRef = new Map<string, number>();
    for (const hit of hits) {
      const chunk = this.chunks.get(String(hit.id));
      if (!chunk) continue;
      // Keep results diverse: at most 2 chunks from the same source
      const n = perRef.get(chunk.ref) ?? 0;
      if (n >= 2) continue;
      perRef.set(chunk.ref, n + 1);
      out.push({ ...chunk, score: hit.score });
      if (out.length >= limit) break;
    }
    return out;
  }
}

/** Drops filler so retrieval keys on content words from the live conversation. */
export function buildQueryFromText(text: string, maxWords = 60): string {
  const STOP = new Set(
    "a an the and or but if so to of in on at for with from by is are was were be been it this that these those we you they i he she our your their my me us them do does did have has had will would can could should just like okay ok yeah yes no um uh hmm right well also very really about what which who how when where there here then than".split(
      " "
    )
  );
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}$%.\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  return words.slice(-maxWords).join(" ");
}
