import { describe, it, expect, beforeEach } from "vitest";
import { createDb, setDbForTests } from "../lib/db";
import * as repo from "../lib/db/repo";
import { computeOpenItems, formatMemoryForPrompt, loadClientMemory, sourcesForRefs } from "../lib/memory/clientMemory";
import { EMPTY_CLIENT_BRIEF } from "../lib/types";
import { makeWrapUp } from "./fixtures";

describe("client memory", () => {
  beforeEach(() => setDbForTests(createDb(":memory:")));

  async function seed() {
    const client = await repo.createClient({ name: "Acme", company: "Acme Logistics" });
    const first = await repo.createMeeting({ clientId: client.id, title: "Kickoff", startedAt: 1_000 });
    await repo.appendSegments(first.id, [
      { id: "a", speaker: "client", text: "Our budget is capped at 25k and we use Salesforce.", timestamp: 1_000, durationMs: 2000 },
    ]);
    await repo.updateMeeting(first.id, { status: "summarized", wrapUp: makeWrapUp(), endedAt: 2_000 });
    await repo.createDocument({ clientId: client.id, title: "Security questionnaire", text: "They require SOC 2 and data residency in the EU." });
    const live = await repo.createMeeting({ clientId: client.id, title: "Follow-up", startedAt: 5_000 });
    return { client, first, live };
  }

  it("builds stable refs, excludes the meeting in progress, and searches past material", async () => {
    const { client, first, live } = await seed();
    const memory = (await loadClientMemory(client.id, { excludeMeetingId: live.id }))!;

    expect(memory.pastMeetings.map((p) => p.ref)).toEqual(["M1"]);
    expect(memory.pastMeetings[0].meeting.id).toBe(first.id);
    expect(memory.documents.map((d) => d.ref)).toEqual(["D1"]);

    expect(memory.corpus.search("salesforce budget")[0].ref).toBe("M1");
    expect(memory.corpus.search("data residency EU")[0].ref).toBe("D1");
  });

  it("formats prompt context with previous meeting outcome and carried-over items", async () => {
    const { client, live } = await seed();
    const text = formatMemoryForPrompt((await loadClientMemory(client.id, { excludeMeetingId: live.id }))!);
    expect(text).toContain("CLIENT: Acme (Acme Logistics)");
    expect(text).toContain("[M1]");
    expect(text).toContain("Agreed to scope a pilot.");
    expect(text).toContain("Who owns data access approvals?");
    expect(text).toContain("[D1] Security questionnaire");
  });

  it("open items combine brief questions, our commitments and unfinished tasks only", async () => {
    const items = computeOpenItems(
      { ...EMPTY_CLIENT_BRIEF, summary: "x", openQuestions: ["Hosting region?"], ourCommitments: ["Send pricing"] },
      [await repo.createMeeting({ clientId: (await repo.createClient({ name: "B" })).id, title: "m" })].map((m) => ({ ...m, wrapUp: makeWrapUp() }))
    );
    expect(items).toContain("Hosting region?");
    expect(items).toContain("We committed: Send pricing");
    expect(items).toContain("Task (Our Team): Send proposal");
    expect(items.some((i) => i.includes("Share schema"))).toBe(false); // completed task
  });

  it("refreshes cached memory when new material is added", async () => {
    const { client } = await seed();
    expect((await loadClientMemory(client.id))!.documents).toHaveLength(1);
    await repo.createDocument({ clientId: client.id, title: "Pricing", text: "Monthly retainer" });
    expect((await loadClientMemory(client.id))!.documents).toHaveLength(2);
  });

  it("maps cited refs to links", async () => {
    const { client, first } = await seed();
    const memory = (await loadClientMemory(client.id))!;
    const sources = sourcesForRefs(memory, ["M1", "D1", "M9"]);
    expect(sources).toHaveLength(2);
    expect(sources[0].url).toBe(`/meetings/${first.id}`);
  });
});
