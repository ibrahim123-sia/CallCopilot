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
  /** "history" when the question builds on a previous meeting or document. */
  basedOn?: "current" | "history";
  reference?: string;
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
  /** Open items from earlier meetings that the conversation just covered (verbatim text). */
  addressedOpenItems?: string[];
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
  includeTranslation?: boolean; // Roman Urdu next to each transcript line
  companyName: string;
  logoDataUrl?: string;
}

/** AI-maintained living memory for a client, updated after every meeting. */
export interface ClientBrief {
  summary: string;
  stakeholders: Array<{ name: string; role: string; notes?: string }>;
  goals: string[];
  requirements: string[];
  budget?: string;
  timeline?: string;
  techStack: string[];
  decisions: string[];
  openQuestions: string[];
  ourCommitments: string[];
  clientCommitments: string[];
  preferences: string[];
  risks: string[];
}

export const EMPTY_CLIENT_BRIEF: ClientBrief = {
  summary: "",
  stakeholders: [],
  goals: [],
  requirements: [],
  techStack: [],
  decisions: [],
  openQuestions: [],
  ourCommitments: [],
  clientCommitments: [],
  preferences: [],
  risks: [],
};

export interface ClientRecord {
  id: string;
  name: string;
  company: string;
  notes: string;
  brief: ClientBrief | null;
  pendingBrief: ClientBrief | null;
  createdAt: number;
  updatedAt: number;
}

export interface ClientListItem extends ClientRecord {
  meetingCount: number;
  lastMeetingAt: number | null;
}

export type MeetingStatus = "live" | "ended" | "summarized" | "imported";

export interface MeetingRecord {
  id: string;
  clientId: string;
  title: string;
  goal: string;
  language: string;
  status: MeetingStatus | string;
  source: string;
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number;
  clientTalkSeconds: number;
  teamTalkSeconds: number;
  notes: string;
  wrapUp: MeetingWrapUp | null;
  pinnedTopics: string[];
}

export interface StoredSegment {
  id: string;
  meetingId: string;
  seq: number;
  speaker: Speaker;
  text: string;
  translation: string | null;
  timestamp: number;
  durationMs: number | null;
}

export interface DocumentRecord {
  id: string;
  clientId: string;
  title: string;
  kind: string;
  mimeType: string;
  text: string;
  createdAt: number;
}

export interface ChatMessageRecord {
  id: string;
  clientId: string;
  role: "user" | "assistant";
  content: string;
  sources: TopicSource[];
  createdAt: number;
}

export type SttProviderId = "gemini" | "deepgram";

export interface AiPacingSettings {
  /** Minimum seconds between live analysis requests (free-tier friendly). */
  analysisMinIntervalSec: number;
  /** Live Roman Urdu captions on/off. */
  translationEnabled: boolean;
  /** Seconds to batch final caption lines before translating. */
  translationBatchSec: number;
}

export interface AppSettings {
  teamProfile: TeamProfile;
  exportOptions: ExportOptions;
  pacing: AiPacingSettings;
  sttProvider: SttProviderId;
  /** Which LLM provider is tried first; the other is the automatic fallback. */
  llmPrimary: "groq" | "gemini";
  captionLayout: "side-by-side" | "stacked";
}
