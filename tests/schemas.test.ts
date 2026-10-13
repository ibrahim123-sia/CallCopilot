import { describe, it, expect } from "vitest";
import {
  AnalysisResultSchema,
  MeetingWrapUpSchema,
  TaskItemSchema,
  TopicCardSchema,
} from "@/lib/analysis/schemas";
import { CANNED_DEMO_ANALYSIS, CANNED_DEMO_WRAPUP } from "@/lib/analysis/cannedData";

describe("Schema Validation Tests", () => {
  it("successfully validates realistic analysis result schema", () => {
    const result = AnalysisResultSchema.safeParse(CANNED_DEMO_ANALYSIS);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topics.length).toBeGreaterThan(0);
      expect(result.data.topics[0].isNewToTeam).toBe(true);
      expect(result.data.suggestedReplies.length).toBe(2);
      expect(result.data.crossQuestions.length).toBe(3);
    }
  });

  it("populates default values for missing optional fields in TopicCard", () => {
    const raw = {
      title: "GraphQL Subscriptions",
      whyItMatters: "Client needs real-time data push",
      explanation: "A WebSocket-based mechanism to stream data updates to clients.",
    };
    const parsed = TopicCardSchema.parse(raw);
    expect(parsed.id).toBeDefined();
    expect(parsed.type).toBe("technology");
    expect(parsed.isNewToTeam).toBe(false);
    expect(parsed.confidence).toBe("high");
    expect(parsed.pros).toEqual([]);
    expect(parsed.sources).toEqual([]);
  });

  it("validates task item tagging rules (Requested by client vs Suggested)", () => {
    const clientTask = TaskItemSchema.parse({
      title: "Send sanitized CRM schema",
      owner: "Client",
      isClientRequested: true,
      isSuggested: false,
      priority: "high",
    });
    expect(clientTask.isClientRequested).toBe(true);
    expect(clientTask.isSuggested).toBe(false);

    const inferredTask = TaskItemSchema.parse({
      title: "Benchmark vector latency",
      owner: "Our Team",
      isClientRequested: false,
      isSuggested: true,
    });
    expect(inferredTask.isClientRequested).toBe(false);
    expect(inferredTask.isSuggested).toBe(true);
  });

  it("validates MeetingWrapUpSchema on canned post-call data", () => {
    const parsed = MeetingWrapUpSchema.safeParse(CANNED_DEMO_WRAPUP);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.outcome.status).toBe("Agreed");
      expect(parsed.data.tasks.length).toBe(3);
      expect(parsed.data.tasks.some((t) => t.isClientRequested)).toBe(true);
      expect(parsed.data.tasks.some((t) => t.isSuggested)).toBe(true);
    }
  });

  it("rejects MeetingWrapUp if outcome status is invalid enum", () => {
    const invalidWrapUp = {
      ...CANNED_DEMO_WRAPUP,
      outcome: {
        ...CANNED_DEMO_WRAPUP.outcome,
        status: "InvalidStatus",
      },
    };
    const parsed = MeetingWrapUpSchema.safeParse(invalidWrapUp);
    expect(parsed.success).toBe(false);
  });
});
