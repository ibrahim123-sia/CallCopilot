export interface DemoStep {
  speaker: "client" | "team";
  channel: 0 | 1; // 0: Team, 1: Client
  text: string;
  interimDelayMs: number; // time to simulate speech typing
  pauseAfterMs: number; // pause after speech finishes
  language?: string;
}

export const DEMO_CALL_SCRIPT: DemoStep[] = [
  {
    speaker: "team",
    channel: 0,
    text: "Hi Alex! Thanks for jumping on the call. We're excited to learn more about what you're building and where your team is running into friction.",
    interimDelayMs: 2500,
    pauseAfterMs: 2000,
  },
  {
    speaker: "client",
    channel: 1,
    text: "Thanks for meeting on short notice. Our sales reps are drowning in unstructured customer notes in Salesforce, and we really want to give them an AI search assistant.",
    interimDelayMs: 3000,
    pauseAfterMs: 2500,
  },
  {
    speaker: "client",
    channel: 1,
    text: "Specifically, our leadership team was reading about Anthropic's Model Context Protocol—MCP. Could we build an MCP server that directly interfaces our CRM data with Claude or other models?",
    interimDelayMs: 3500,
    pauseAfterMs: 3000,
  },
  {
    speaker: "team",
    channel: 0,
    text: "Model Context Protocol is a very clean architecture for that. Instead of writing custom plugins for every LLM, an MCP server gives you a standardized, secure tool protocol.",
    interimDelayMs: 3000,
    pauseAfterMs: 2000,
  },
  {
    speaker: "client",
    channel: 1,
    text: "That's exactly what we need! But here's the catch: our Salesforce schema is 12 years old with custom un-indexed fields, and we also need hybrid vector search across 100k customer notes.",
    interimDelayMs: 3800,
    pauseAfterMs: 2500,
  },
  {
    speaker: "client",
    channel: 1,
    text: "Also on budget—we don't have infinite budget. Our cap is around $25,000 for this pilot, and we have a hard 6-week deadline before our annual Q4 sales kickoff.",
    interimDelayMs: 3200,
    pauseAfterMs: 2000,
  },
  {
    speaker: "client",
    channel: 1,
    text: "Can your team send over a short architecture summary by Friday so I can brief Sarah, our VP of Engineering? And I'll have our DB admin send over the sanitized schema by Monday.",
    interimDelayMs: 3500,
    pauseAfterMs: 2500,
  },
  {
    speaker: "team",
    channel: 0,
    text: "We can absolutely do that. We will scope Phase 1 strictly to a read-only MCP server with local vector caching, which guarantees we hit your 6-week target inside the $25k budget.",
    interimDelayMs: 3200,
    pauseAfterMs: 2000,
  },
  {
    speaker: "client",
    channel: 1,
    text: "بہت شکریہ! That sounds like a solid plan. Let's schedule the technical review with Sarah for next Tuesday at 2 PM.",
    interimDelayMs: 3000,
    pauseAfterMs: 2000,
    language: "ur",
  },
];
