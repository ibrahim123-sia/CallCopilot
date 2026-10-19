import { z } from "zod";

const ServerEnvSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  // Long-form work: summaries, client brief updates, chat
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  // Low-latency live analysis and lookups
  GEMINI_LIVE_MODEL: z.string().default("gemini-3.5-flash-lite"),
  // Live Roman Urdu caption translation (separate free-tier quota)
  GEMINI_TRANSLATE_MODEL: z.string().default("gemini-3.1-flash-lite"),
  // Free real-time speech-to-text over the Live API
  GEMINI_STT_MODEL: z.string().default("gemini-3.5-transcribe-live"),
  // Groq (primary LLM by default; OpenAI-compatible, free tier with small per-minute token limits)
  GROQ_API_KEY: z.string().optional(),
  GROQ_LIVE_MODEL: z.string().default("openai/gpt-oss-20b"),
  GROQ_TRANSLATE_MODEL: z.string().default("qwen/qwen3.8-27b"),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
  // Requests whose prompt + answer would exceed this many tokens skip Groq and go to Gemini
  GROQ_MAX_TOKENS_PER_REQUEST: z.coerce.number().default(7000),
  DEEPGRAM_API_KEY: z.string().optional(),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().default(60),
  MAX_TRANSCRIPT_BUFFER_CHARS: z.coerce.number().default(40000),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

// Empty values and untouched .env.example placeholders count as "not configured"
const orUndefined = (v: string | undefined) => {
  const t = v?.trim();
  return t && !/^your_.*_here$/i.test(t) ? t : undefined;
};

export function getServerEnv(): ServerEnv {
  return ServerEnvSchema.parse({
    GEMINI_API_KEY: orUndefined(process.env.GEMINI_API_KEY),
    GEMINI_MODEL: orUndefined(process.env.GEMINI_MODEL),
    GEMINI_LIVE_MODEL: orUndefined(process.env.GEMINI_LIVE_MODEL),
    GEMINI_TRANSLATE_MODEL: orUndefined(process.env.GEMINI_TRANSLATE_MODEL),
    GEMINI_STT_MODEL: orUndefined(process.env.GEMINI_STT_MODEL),
    GROQ_API_KEY: orUndefined(process.env.GROQ_API_KEY),
    GROQ_LIVE_MODEL: orUndefined(process.env.GROQ_LIVE_MODEL),
    GROQ_TRANSLATE_MODEL: orUndefined(process.env.GROQ_TRANSLATE_MODEL),
    GROQ_MODEL: orUndefined(process.env.GROQ_MODEL),
    GROQ_MAX_TOKENS_PER_REQUEST: orUndefined(process.env.GROQ_MAX_TOKENS_PER_REQUEST),
    DEEPGRAM_API_KEY: orUndefined(process.env.DEEPGRAM_API_KEY),
    RATE_LIMIT_PER_MINUTE: process.env.RATE_LIMIT_PER_MINUTE,
    MAX_TRANSCRIPT_BUFFER_CHARS: process.env.MAX_TRANSCRIPT_BUFFER_CHARS,
  });
}
