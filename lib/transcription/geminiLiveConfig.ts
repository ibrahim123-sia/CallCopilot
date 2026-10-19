/**
 * Live transcription session config, shared by the browser (setup message) and the server
 * (locked into the ephemeral token). Ephemeral tokens with liveConnectConstraints LOCK the
 * session config, so anything the browser sends that isn't in the token is silently ignored —
 * which is why the token must carry the full config.
 */

export type LiveLanguage = "en" | "ur" | "auto";

export function languageCodesFor(language: LiveLanguage | undefined): string[] {
  if (language === "ur") return ["ur-PK"];
  if (language === "auto") return []; // automatic detection (handles code-switching)
  return ["en-US"];
}

/**
 * Voice-activity detection tuned by measurement (speech over music, 33 s sample):
 * default server VAD kept ~70% of words because audio around segment boundaries was dropped;
 * these values kept 98–100% and finalize roughly once per sentence.
 */
export const LIVE_VAD = {
  startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
  endOfSpeechSensitivity: "END_SENSITIVITY_HIGH",
  prefixPaddingMs: 800,
  silenceDurationMs: 500,
} as const;

export const MAX_VOCABULARY = 100;

export function cleanVocabulary(terms: string[] | undefined): string[] {
  return Array.from(new Set((terms || []).map((t) => t.trim()).filter((t) => t.length > 1 && t.length <= 60))).slice(0, MAX_VOCABULARY);
}

/** The `config` part of a Live session (camelCase, as used by setup messages and token constraints). */
export function buildLiveSessionConfig(opts: { language?: LiveLanguage; vocabulary?: string[] }) {
  const vocabulary = cleanVocabulary(opts.vocabulary);
  return {
    responseModalities: ["TEXT"] as ["TEXT"],
    inputAudioTranscription: {
      languageCodes: languageCodesFor(opts.language),
      ...(vocabulary.length ? { customVocabulary: vocabulary } : {}),
      mode: "VERBATIM" as const,
    },
    realtimeInputConfig: { automaticActivityDetection: { ...LIVE_VAD } },
  };
}
