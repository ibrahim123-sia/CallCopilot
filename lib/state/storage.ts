import { ExportOptions, TeamProfile } from "../types";

const STORAGE_KEYS = {
  TEAM_PROFILE: "callcopilot_team_profile",
  EXPORT_OPTIONS: "callcopilot_export_options",
  KNOWN_TOPICS: "callcopilot_known_topics",
  NEW_TOPICS: "callcopilot_new_topics",
  UI_THEME: "callcopilot_theme",
  UI_LANGUAGE: "callcopilot_language",
  CONSENT_GIVEN: "callcopilot_consent_confirmed",
};

export const DEFAULT_TEAM_PROFILE: TeamProfile = {
  companyName: "CallCopilot Team",
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
  companyName: "CallCopilot Team",
};

export function loadTeamProfile(): TeamProfile {
  if (typeof window === "undefined") return DEFAULT_TEAM_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TEAM_PROFILE);
    if (!raw) return DEFAULT_TEAM_PROFILE;
    return { ...DEFAULT_TEAM_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TEAM_PROFILE;
  }
}

export function saveTeamProfile(profile: TeamProfile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.TEAM_PROFILE, JSON.stringify(profile));
  } catch (err) {
    console.warn("Failed to save team profile to localStorage:", err);
  }
}

export function loadExportOptions(): ExportOptions {
  if (typeof window === "undefined") return DEFAULT_EXPORT_OPTIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EXPORT_OPTIONS);
    if (!raw) return DEFAULT_EXPORT_OPTIONS;
    return { ...DEFAULT_EXPORT_OPTIONS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_EXPORT_OPTIONS;
  }
}

export function saveExportOptions(opts: Partial<ExportOptions>): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadExportOptions();
    localStorage.setItem(
      STORAGE_KEYS.EXPORT_OPTIONS,
      JSON.stringify({ ...current, ...opts })
    );
  } catch (err) {
    console.warn("Failed to save export options:", err);
  }
}

export function loadTopicOverrides(): { known: string[]; novel: string[] } {
  if (typeof window === "undefined") return { known: [], novel: [] };
  try {
    const known = JSON.parse(localStorage.getItem(STORAGE_KEYS.KNOWN_TOPICS) || "[]");
    const novel = JSON.parse(localStorage.getItem(STORAGE_KEYS.NEW_TOPICS) || "[]");
    return { known, novel };
  } catch {
    return { known: [], novel: [] };
  }
}

export function setTopicKnownStatus(topicTitle: string, isKnown: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const { known, novel } = loadTopicOverrides();
    const clean = topicTitle.trim().toLowerCase();

    const filteredKnown = known.filter((t) => t.toLowerCase() !== clean);
    const filteredNovel = novel.filter((t) => t.toLowerCase() !== clean);

    if (isKnown) {
      filteredKnown.push(topicTitle.trim());
    } else {
      filteredNovel.push(topicTitle.trim());
    }

    localStorage.setItem(STORAGE_KEYS.KNOWN_TOPICS, JSON.stringify(filteredKnown));
    localStorage.setItem(STORAGE_KEYS.NEW_TOPICS, JSON.stringify(filteredNovel));
  } catch (err) {
    console.warn("Failed to save topic override:", err);
  }
}

export function loadConsentGiven(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEYS.CONSENT_GIVEN) === "true";
}

export function saveConsentGiven(given: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.CONSENT_GIVEN, given ? "true" : "false");
}
