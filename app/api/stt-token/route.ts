import { NextRequest, NextResponse } from "next/server";
import type { LiveConnectConfig } from "@google/genai";
import { buildLiveSessionConfig, LiveLanguage } from "@/lib/transcription/geminiLiveConfig";
import { getServerEnv } from "@/lib/env";
import { checkRateLimit } from "@/lib/rateLimit";
import { getGemini } from "@/lib/ai/gemini";

export const runtime = "nodejs";

/**
 * Issues a short-lived credential so the browser can stream audio directly to the STT
 * provider without ever seeing the real API key.
 *  - gemini (default, free tier): single-use Live API ephemeral token locked to the STT model
 *  - deepgram (optional, paid/trial): short-lived JWT
 */
function rateLimited(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  return !checkRateLimit(`stt:${ip}`, 30).allowed;
}

const tooMany = () => NextResponse.json({ error: "Rate limit exceeded. Please wait a moment." }, { status: 429 });

export async function GET(req: NextRequest) {
  if (rateLimited(req)) return tooMany();
  const provider = req.nextUrl.searchParams.get("provider") === "deepgram" ? "deepgram" : "gemini";
  return provider === "deepgram" ? deepgramToken() : geminiToken({});
}

/** Gemini tokens carry the session config (language, vocabulary, VAD), so the browser POSTs it. */
export async function POST(req: NextRequest) {
  if (rateLimited(req)) return tooMany();
  const body = (await req.json().catch(() => ({}))) as { language?: string; vocabulary?: unknown };
  const language: LiveLanguage = body.language === "ur" || body.language === "auto" ? body.language : "en";
  const vocabulary = Array.isArray(body.vocabulary) ? body.vocabulary.filter((v: unknown) => typeof v === "string") : [];
  return geminiToken({ language, vocabulary });
}

async function geminiToken(opts: { language?: LiveLanguage; vocabulary?: string[] }) {
  const env = getServerEnv();
  if (!env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured. Add a free key from aistudio.google.com to .env." },
      { status: 503 }
    );
  }
  try {
    const token = await getGemini().authTokens.create({
      config: {
        uses: 1,
        // A transcription session lasts up to ~10 minutes; the client rotates sessions before that.
        expireTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
        // Constraints LOCK the session config: whatever the browser sends in its setup message
        // is ignored, so the full transcription + VAD config must live here.
        liveConnectConstraints: {
          model: env.GEMINI_STT_MODEL,
          config: buildLiveSessionConfig(opts) as unknown as LiveConnectConfig,
        },
        httpOptions: { apiVersion: "v1alpha" },
      },
    });
    if (!token.name) throw new Error("Empty token returned");
    return NextResponse.json({ provider: "gemini", token: token.name, model: env.GEMINI_STT_MODEL });
  } catch (err) {
    console.error("Error creating Gemini ephemeral token:", err);
    return NextResponse.json(
      { error: `Could not create a Gemini live token: ${err instanceof Error ? err.message : err}` },
      { status: 502 }
    );
  }
}

const DEEPGRAM_TOKEN_TTL_SECONDS = 60;

async function deepgramToken() {
  const apiKey = getServerEnv().DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "DEEPGRAM_API_KEY is not configured on the server." }, { status: 503 });
  }
  try {
    // Plain REST call (no SDK) keeps the Cloudflare Worker bundle small
    const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl_seconds: DEEPGRAM_TOKEN_TTL_SECONDS }),
    });
    if (!res.ok) throw new Error(`Deepgram ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const grant = (await res.json()) as { access_token: string; expires_in?: number };
    return NextResponse.json({
      provider: "deepgram",
      token: grant.access_token,
      scheme: "bearer",
      expiresInSeconds: grant.expires_in ?? DEEPGRAM_TOKEN_TTL_SECONDS,
    });
  } catch (err: unknown) {
    // Never fall back to handing the master API key to the browser.
    console.error("Error generating Deepgram token:", err);
    return NextResponse.json(
      { error: "Could not mint a temporary Deepgram token. Make sure your API key has Member (or higher) permissions." },
      { status: 502 }
    );
  }
}
