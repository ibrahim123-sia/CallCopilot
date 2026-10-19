import { describe, it, expect, beforeEach } from "vitest";
import { createDb, setDbForTests } from "../lib/db";
import * as repo from "../lib/db/repo";
import { EMPTY_CLIENT_BRIEF } from "../lib/types";

describe("repository", () => {
  beforeEach(() => {
    setDbForTests(createDb(":memory:"));
  });

  it("keeps each client's meetings, documents and chat separate", async () => {
    const a = await repo.createClient({ name: "Acme" });
    const b = await repo.createClient({ name: "Globex" });
    await repo.createMeeting({ clientId: a.id, title: "Kickoff" });
    await repo.createDocument({ clientId: a.id, title: "Notes", text: "Budget 25k" });
    await repo.addChatMessage({ clientId: a.id, role: "user", content: "hi" });

    expect(await repo.listMeetings(a.id)).toHaveLength(1);
    expect(await repo.listMeetings(b.id)).toHaveLength(0);
    expect(await repo.listDocuments(b.id)).toHaveLength(0);
    expect(await repo.listChatMessages(b.id)).toHaveLength(0);

    const list = await repo.listClients();
    expect(list.find((c) => c.id === a.id)?.meetingCount).toBe(1);
    expect(list.find((c) => c.id === b.id)?.meetingCount).toBe(0);
  });

  it("appends transcript segments in order and ignores duplicate saves", async () => {
    const c = await repo.createClient({ name: "Acme" });
    const m = await repo.createMeeting({ clientId: c.id, title: "Call" });
    const seg = { id: "s1", speaker: "client" as const, text: "Hello", timestamp: 1, durationMs: 500 };
    await repo.appendSegments(m.id, [seg]);
    await repo.appendSegments(m.id, [seg, { ...seg, id: "s2", text: "Second" }]);

    const rows = await repo.listSegments(m.id);
    expect(rows.map((r) => r.text)).toEqual(["Hello", "Second"]);
    expect(rows.map((r) => r.seq)).toEqual([0, 1]);

    await repo.setTranslations(m.id, [{ id: "s2", translation: "Doosra" }]);
    expect((await repo.listSegments(m.id))[1].translation).toBe("Doosra");
  });

  it("deleting a client cascades to its meetings and segments", async () => {
    const c = await repo.createClient({ name: "Acme" });
    const m = await repo.createMeeting({ clientId: c.id, title: "Call" });
    await repo.appendSegments(m.id, [{ id: "x", speaker: "team", text: "t", timestamp: 1, durationMs: null }]);
    await repo.deleteClient(c.id);
    expect(await repo.getMeeting(m.id)).toBeNull();
    expect(await repo.listSegments(m.id)).toHaveLength(0);
  });

  it("promotes a pending brief only when accepted", async () => {
    const c = await repo.createClient({ name: "Acme" });
    const proposal = { ...EMPTY_CLIENT_BRIEF, summary: "Wants a CRM pilot" };
    await repo.updateClient(c.id, { pendingBrief: proposal });
    expect((await repo.getClient(c.id))?.brief).toBeNull();

    const accepted = await repo.acceptPendingBrief(c.id);
    expect(accepted?.brief?.summary).toBe("Wants a CRM pilot");
    expect(accepted?.pendingBrief).toBeNull();
  });

  it("merges partial settings without losing nested defaults", async () => {
    await repo.saveSettings({ pacing: { analysisMinIntervalSec: 20 } as never });
    const s = await repo.getSettings();
    expect(s.pacing.analysisMinIntervalSec).toBe(20);
    expect(s.pacing.translationEnabled).toBe(true);
    expect(s.sttProvider).toBe("gemini");
  });
});

describe("chat ordering", () => {
  beforeEach(() => setDbForTests(createDb(":memory:")));

  it("keeps question before answer even when saved in the same millisecond", async () => {
    const c = await repo.createClient({ name: "Acme" });
    const realNow = Date.now;
    Date.now = () => 1000;
    try {
      await repo.addChatMessage({ clientId: c.id, role: "user", content: "Q" });
      await repo.addChatMessage({ clientId: c.id, role: "assistant", content: "A" });
    } finally {
      Date.now = realNow;
    }
    expect((await repo.listChatMessages(c.id)).map((m) => m.content)).toEqual(["Q", "A"]);
  });
});
