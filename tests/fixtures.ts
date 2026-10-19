import { MeetingWrapUp } from "../lib/types";

export function makeWrapUp(overrides: Partial<MeetingWrapUp> = {}): MeetingWrapUp {
  return {
    outcome: { statement: "Agreed to scope a pilot.", status: "Needs follow-up", nextStep: "Send proposal", nextStepDate: "Friday" },
    executiveSummary: "Discussed a CRM search pilot.",
    keyDiscussionPoints: [{ topic: "Budget", summary: "Capped at 25k" }],
    clientRequirements: { deliverables: ["Search prototype"], budgetConstraints: "25k", timelineConstraints: "6 weeks", technicalPreferences: ["AWS"] },
    decisions: ["Start with read-only access"],
    openQuestions: ["Who owns data access approvals?"],
    tasks: [
      { id: "t1", title: "Send proposal", details: "", owner: "Our Team", isSuggested: false, isClientRequested: true, priority: "high", completed: false },
      { id: "t2", title: "Share schema", details: "", owner: "Client", isSuggested: false, isClientRequested: true, priority: "medium", completed: true },
    ],
    risksAndRedFlags: [],
    newToTeamResearch: [],
    notes: "",
    followUpEmail: { subject: "Next steps", body: "Thanks for your time.", tone: "consultative" },
    ...overrides,
  };
}
