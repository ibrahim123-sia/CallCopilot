import { ExportOptions, TeamProfile } from "./types";

export const DEFAULT_TEAM_PROFILE: TeamProfile = {
  companyName: "",
  coreSkills: [
    "React",
    "Next.js",
    "Node.js",
    ".NET",
    "Python",
    "Rust",
    "QA automation",
    "AWS",
    "AI agents",
    "TypeScript",
    "PostgreSQL",
  ],
  industries: ["FinTech", "HealthTech", "SaaS", "E-Commerce", "Logistics"],
  excludedAreas: ["Hardware & Firmware", "Legacy COBOL", "Crypto/Web3 token engineering"],
  knownTopics: [],
};

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  audience: "client",
  includeOutcome: true,
  includeSummary: true,
  includeRequirements: true,
  includeDecisions: true,
  includeTasks: true,
  includeNotes: false,
  includeInternalSections: false,
  includeFullTranscript: false, // unchecked by default as required
  includeTranslation: false,
  companyName: "",
};
