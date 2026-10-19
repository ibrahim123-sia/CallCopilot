import { AppSettings } from "./types";
import { DEFAULT_EXPORT_OPTIONS, DEFAULT_TEAM_PROFILE } from "./defaults";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  teamProfile: DEFAULT_TEAM_PROFILE,
  exportOptions: DEFAULT_EXPORT_OPTIONS,
  pacing: {
    // Conservative defaults so a 1-hour call stays inside Gemini free-tier quotas
    analysisMinIntervalSec: 12,
    translationEnabled: true,
    translationBatchSec: 6,
  },
  sttProvider: "gemini",
  llmPrimary: "groq",
  captionLayout: "side-by-side",
};

/** Shallow merge per section so partial updates never drop nested defaults. */
export function mergeSettings(base: AppSettings, patch: Partial<AppSettings>): AppSettings {
  return {
    ...base,
    ...patch,
    teamProfile: { ...base.teamProfile, ...(patch.teamProfile ?? {}) },
    exportOptions: { ...base.exportOptions, ...(patch.exportOptions ?? {}) },
    pacing: { ...base.pacing, ...(patch.pacing ?? {}) },
  };
}
