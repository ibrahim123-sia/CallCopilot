import { z } from "zod";

const ServerEnvSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  DEEPGRAM_API_KEY: z.string().optional(),
  DEEPGRAM_PROJECT_ID: z.string().optional(),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().default(60),
  MAX_TRANSCRIPT_BUFFER_CHARS: z.coerce.number().default(40000),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export function getServerEnv(): ServerEnv {
  return ServerEnvSchema.parse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
    DEEPGRAM_PROJECT_ID: process.env.DEEPGRAM_PROJECT_ID,
    RATE_LIMIT_PER_MINUTE: process.env.RATE_LIMIT_PER_MINUTE,
    MAX_TRANSCRIPT_BUFFER_CHARS: process.env.MAX_TRANSCRIPT_BUFFER_CHARS,
  });
}
