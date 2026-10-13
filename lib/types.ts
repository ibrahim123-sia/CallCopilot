export type Speaker = "client" | "team";

export interface TranscriptEntry {
  id: string;
  speaker: Speaker;
  text: string;
  timestamp: number; // epoch milliseconds
  durationMs?: number;
  isFinal: boolean;
  channel: 0 | 1; // 0: Mic (Our Team), 1: Tab Audio (Client)
  language?: string;
}

export type TopicType =
  | "technology"
  | "approach"
  | "business"
  | "regulation"
  | "competitor"
  | "other";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface TopicSource {
  title: string;
  url: string;
}

export interface TopicCard {
  id: string;
  title: string;
  type: TopicType;
  isNewToTeam: boolean;
  manualNewOverride?: boolean; // user override
  whyItMatters: string;
  explanation: string; // 2-4 short plain lines
  pros: string[];
  cons: string[];
  sources: TopicSource[];
  confidence: ConfidenceLevel;
  timestamp: number;
  triggerTranscriptId?: string;
  pinned?: boolean;
  dismissed?: boolean;
}

export type SignalType =
  | "budget"
  | "timeline"
  | "objection"
  | "decision-maker"
  | "urgency"
  | "competitor"
  | "risk";

export interface Signal {
  type: SignalType;
  quote: string;
  note: string;
}

export interface SuggestedReply {
  tone: "professional" | "friendly";
  text: string;
}

export interface CrossQuestion {
  question: string;
  whyAsk: string;
}

export interface RedFlag {
  issue: string;
  quote?: string;
  recommendation: string;
}

export interface AnalysisResult {
  topics: TopicCard[];
  clientIntent: string;
  signals: Signal[];
  suggestedReplies: SuggestedReply[];
  crossQuestions: CrossQuestion[];
  redFlags: RedFlag[];
}

export interface TeamProfile {
  companyName: string;
  coreSkills: string[];
  industries: string[];
  excludedAreas: string[];
  knownTopics: string[]; // Explicitly acknowledged by user
}

export interface CallContext {
  clientName: string;
  projectName: string;
  meetingGoal: string;
  language: "en" | "ur" | "auto";
}

export type OutcomeStatus = "Agreed" | "Needs follow-up" | "Undecided" | "Not a fit";

export interface TaskItem {
  id: string;
  title: string;
  details: string;
  owner: string; // 'Client', 'Our Team', or specific name
  dueDate?: string;
  isSuggested: boolean;
  isClientRequested: boolean;
  priority: "high" | "medium" | "low";
  sourceQuote?: string;
  completed?: boolean;
}

export interface MeetingWrapUp {
  outcome: {
    statement: string; // 2-4 sentences
    status: OutcomeStatus;
    nextStep: string;
    nextStepDate?: string;
  };
  executiveSummary: string;
  keyDiscussionPoints: Array<{
    topic: string;
    summary: string;
  }>;
  clientRequirements: {
    deliverables: string[];
    budgetConstraints?: string;
    timelineConstraints?: string;
    technicalPreferences: string[];
  };
  decisions: string[];
  openQuestions: string[];
  tasks: TaskItem[];
  risksAndRedFlags: Array<{
    risk: string;
    mitigation: string;
  }>;
  newToTeamResearch: Array<{
    topic: string;
    reason: string;
    sources: TopicSource[];
  }>;
  notes: string;
  followUpEmail: {
    subject: string;
    body: string;
    tone: "formal" | "consultative" | "concise";
  };
}

export type ReportAudience = "client" | "internal";

export interface ExportOptions {
  audience: ReportAudience;
  includeOutcome: boolean;
  includeSummary: boolean;
  includeRequirements: boolean;
  includeDecisions: boolean;
  includeTasks: boolean;
  includeNotes: boolean;
  includeInternalSections: boolean; // only in internal mode
  includeFullTranscript: boolean; // unchecked by default
  companyName: string;
  logoDataUrl?: string;
}
