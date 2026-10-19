import { describe, it, expect } from "vitest";
import { buildQueryFromText, chunkText, ClientCorpus } from "../lib/memory/retrieval";

describe("chunkText", () => {
  it("keeps short text as one chunk and splits long text with overlap", () => {
    expect(chunkText("short note")).toEqual(["short note"]);
    const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} about the CRM migration.`).join(" ");
    const chunks = chunkText(long, 300, 50);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((c) => c.length <= 300)).toBe(true);
    // Overlap: the start of each chunk appeared at the end of the previous one
    expect(long.indexOf(chunks[1].slice(0, 20))).toBeLessThan(long.indexOf(chunks[0].slice(-20)) + 20);
  });
});

describe("ClientCorpus", () => {
  const corpus = new ClientCorpus([
    { ref: "M1", kind: "meeting", title: "Kickoff", date: 1, text: "Client said the budget is capped at 25k for the pilot. Timeline six weeks." },
    { ref: "M2", kind: "meeting", title: "Scope review", date: 2, text: "We discussed Salesforce integration and SSO with Okta." },
    { ref: "D1", kind: "document", title: "Proposal v2", date: 3, text: "Phase one covers vector search over customer notes. Budget estimate 24,000 USD." },
  ]);

  it("finds the right sources for a live question", () => {
    const hits = corpus.search("what was the budget for the pilot");
    expect(hits[0].ref).toBe("M1");
    expect(hits.map((h) => h.ref)).toContain("D1");
  });

  it("matches on title and returns nothing for empty queries", () => {
    expect(corpus.search("okta sso")[0].ref).toBe("M2");
    expect(corpus.search("   ")).toEqual([]);
  });
});

describe("buildQueryFromText", () => {
  it("drops filler words and keeps content words", () => {
    const q = buildQueryFromText("Um so yeah, we really want the Salesforce integration done by March");
    expect(q).toContain("salesforce");
    expect(q).toContain("march");
    expect(q).not.toMatch(/\bum\b|\byeah\b|\bthe\b/);
  });
});
