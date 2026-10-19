import { z } from "zod";

export const TopicSourceSchema = z.object({
  title: z.string().default("Web Reference"),
  url: z.string().default("#"),
});

export const TopicCardSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  title: z.string(),
  type: z.enum([
    "technology",
    "approach",
    "business",
    "regulation",
    "competitor",
    "other",
  ]).default("technology"),
  isNewToTeam: z.boolean().default(false),
  whyItMatters: z.string(),
  explanation: z.string(),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  sources: z.array(TopicSourceSchema).default([]),
  confidence: z.enum(["high", "medium", "low"]).default("high"),
  timestamp: z.number().default(() => Date.now()),
});

export const SignalSchema = z.object({
  type: z.enum([
    "budget",
    "timeline",
    "objection",
    "decision-maker",
    "urgency",
    "competitor",
    "risk",
  ]),
  quote: z.string().default(""),
  note: z.string(),
});

export const SuggestedReplySchema = z.object({
  tone: z.enum(["professional", "friendly"]).default("professional"),
  text: z.string(),
});

export const CrossQuestionSchema = z.object({
  question: z.string(),
  whyAsk: z.string(),
  basedOn: z.enum(["current", "history"]).default("current"),
  reference: z.string().optional(),
});

export const RedFlagSchema = z.object({
  issue: z.string(),
  quote: z.string().optional(),
  recommendation: z.string(),
});

export const AnalysisResultSchema = z.object({
  topics: z.array(TopicCardSchema).default([]),
  clientIntent: z.string().default(""),
  signals: z.array(SignalSchema).default([]),
  suggestedReplies: z.array(SuggestedReplySchema).default([]),
  crossQuestions: z.array(CrossQuestionSchema).default([]),
  redFlags: z.array(RedFlagSchema).default([]),
  addressedOpenItems: z.array(z.string()).default([]),
});

export const QuickLookupRequestSchema = z.object({
  query: z.string().min(1).max(300),
  context: z.string().optional(),
  teamSkills: z.array(z.string()).optional(),
});

export const QuickLookupResultSchema = z.object({
  topic: TopicCardSchema,
  suggestedReply: z.string().optional(),
  crossQuestion: z.string().optional(),
});

export const TaskItemSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  title: z.string(),
  details: z.string().default(""),
  owner: z.string().default("Our Team"),
  dueDate: z.string().optional(),
  isSuggested: z.boolean().default(false),
  isClientRequested: z.boolean().default(false),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  sourceQuote: z.string().optional(),
  completed: z.boolean().default(false),
});

export const MeetingWrapUpSchema = z.object({
  outcome: z.object({
    statement: z.string(),
    status: z.enum(["Agreed", "Needs follow-up", "Undecided", "Not a fit"]),
    nextStep: z.string(),
    nextStepDate: z.string().optional(),
  }),
  executiveSummary: z.string(),
  keyDiscussionPoints: z.array(
    z.object({
      topic: z.string(),
      summary: z.string(),
    })
  ).default([]),
  clientRequirements: z.object({
    deliverables: z.array(z.string()).default([]),
    budgetConstraints: z.string().optional(),
    timelineConstraints: z.string().optional(),
    technicalPreferences: z.array(z.string()).default([]),
  }),
  decisions: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
  tasks: z.array(TaskItemSchema).default([]),
  risksAndRedFlags: z.array(
    z.object({
      risk: z.string(),
      mitigation: z.string(),
    })
  ).default([]),
  newToTeamResearch: z.array(
    z.object({
      topic: z.string(),
      reason: z.string(),
      sources: z.array(TopicSourceSchema).default([]),
    })
  ).default([]),
  notes: z.string().default(""),
  followUpEmail: z.object({
    subject: z.string(),
    body: z.string(),
    tone: z.enum(["formal", "consultative", "concise"]).default("consultative"),
  }),
});

export const ClientBriefSchema = z.object({
  summary: z.string().default(""),
  stakeholders: z
    .array(z.object({ name: z.string(), role: z.string().default(""), notes: z.string().optional() }))
    .default([]),
  goals: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  budget: z.string().optional(),
  timeline: z.string().optional(),
  techStack: z.array(z.string()).default([]),
  decisions: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
  ourCommitments: z.array(z.string()).default([]),
  clientCommitments: z.array(z.string()).default([]),
  preferences: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});

export const TranslationResultSchema = z.object({
  items: z.array(z.object({ id: z.string(), romanUrdu: z.string() })).default([]),
});

export type AnalysisResultParsed = z.infer<typeof AnalysisResultSchema>;
export type QuickLookupResultParsed = z.infer<typeof QuickLookupResultSchema>;
export type MeetingWrapUpParsed = z.infer<typeof MeetingWrapUpSchema>;
