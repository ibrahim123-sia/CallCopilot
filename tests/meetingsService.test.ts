import { describe, it, expect, beforeEach, vi } from "vitest";
import { createDb, setDbForTests } from "../lib/db";
import * as repo from "../lib/db/repo";
import { EMPTY_CLIENT_BRIEF } from "../lib/types";
import { makeWrapUp } from "./fixtures";

const generateJson = vi.fn();

vi.mock("../lib/ai/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/ai/llm")>();
  return { ...actual, generateJson: (...args: unknown[]) => generateJson(...args) };
});

const { summarizeMeeting, importPastMeeting } = await import("../lib/services/meetings");
const { AiRateLimitError } = await import("../lib/ai/common");

describe("meeting services", () => {
  beforeEach(() => {
    setDbForTests(createDb(":memory:"));
    generateJson.mockReset();
  });

  async function meetingWithTranscript(clientId: string) {
    const m = await repo.createMeeting({ clientId, title: "Scope call" });
    await repo.appendSegments(m.id, [{ id: "s1", speaker: "client", text: "Budget is 25k.", timestamp: 1, durationMs: 1000 }]);
    await repo.updateMeeting(m.id, { status: "ended" });
    return m;
  }

  it("summarizes a meeting, includes client memory in the prompt, and applies the first brief directly", async () => {
    const client = await repo.createClient({ name: "Acme" });
    const previous = await repo.createMeeting({ clientId: client.id, title: "Kickoff", startedAt: 1 });
    await repo.updateMeeting(previous.id, { status: "summarized", wrapUp: makeWrapUp({ decisions: ["Use AWS"] }) });
    const m = await meetingWithTranscript(client.id);

    generateJson
      .mockResolvedValueOnce(makeWrapUp({ executiveSummary: "New summary" }))
      .mockResolvedValueOnce({ ...EMPTY_CLIENT_BRIEF, summary: "Acme wants a pilot" });

    const updated = await summarizeMeeting(m.id);

    expect(updated.status).toBe("summarized");
    expect(updated.wrapUp?.executiveSummary).toBe("New summary");
    const summaryPrompt = generateJson.mock.calls[0][0].prompt as string;
    expect(summaryPrompt).toContain("Budget is 25k.");
    expect(summaryPrompt).toContain("Use AWS"); // memory of the previous meeting
    expect((await repo.getClient(client.id))?.brief?.summary).toBe("Acme wants a pilot");
    expect((await repo.getClient(client.id))?.pendingBrief).toBeNull();
  });

  it("proposes (not applies) later brief updates for review", async () => {
    const client = await repo.createClient({ name: "Acme" });
    await repo.updateClient(client.id, { brief: { ...EMPTY_CLIENT_BRIEF, summary: "Old" } });
    const m = await meetingWithTranscript(client.id);
    generateJson.mockResolvedValueOnce(makeWrapUp()).mockResolvedValueOnce({ ...EMPTY_CLIENT_BRIEF, summary: "New" });

    await summarizeMeeting(m.id);
    const c = (await repo.getClient(client.id))!;
    expect(c.brief?.summary).toBe("Old");
    expect(c.pendingBrief?.summary).toBe("New");
  });

  it("keeps the summary when the brief update hits the free-tier limit", async () => {
    const client = await repo.createClient({ name: "Acme" });
    const m = await meetingWithTranscript(client.id);
    generateJson.mockResolvedValueOnce(makeWrapUp()).mockRejectedValueOnce(new AiRateLimitError(20000, "gemini-3.8-flash"));

    const updated = await summarizeMeeting(m.id);
    expect(updated.wrapUp).not.toBeNull();
    expect((await repo.getClient(client.id))?.brief).toBeNull();
  });

  it("refuses to summarize an empty meeting instead of inventing content", async () => {
    const client = await repo.createClient({ name: "Acme" });
    const m = await repo.createMeeting({ clientId: client.id, title: "Empty" });
    (await expect(summarizeMeeting(m.id))).rejects.toThrow(/nothing to summarize/);
    expect(generateJson).not.toHaveBeenCalled();
  });

  it("imports notes from an earlier meeting as a past meeting with its date", async () => {
    const client = await repo.createClient({ name: "Acme" });
    generateJson.mockResolvedValueOnce(makeWrapUp()).mockResolvedValueOnce({ ...EMPTY_CLIENT_BRIEF, summary: "From notes" });

    const meeting = await importPastMeeting({ clientId: client.id, title: "Sept call", text: "They want SSO.", date: 123 });
    expect(meeting.status).toBe("imported");
    expect(meeting.startedAt).toBe(123);
    expect(meeting.notes).toBe("They want SSO.");
    expect((await repo.getClient(client.id))?.brief?.summary).toBe("From notes");
  });
});
