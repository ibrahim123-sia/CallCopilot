import { NextRequest, NextResponse } from "next/server";
import { DeepgramClient } from "@deepgram/sdk";
import { getServerEnv } from "@/lib/env";
import { checkRateLimit } from "@/lib/rateLimit";

// Short-lived JWT: only needs to be valid long enough to open the WebSocket.
// An open connection stays alive after the token expires; reconnects fetch a fresh one.
const TOKEN_TTL_SECONDS = 60;

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const rate = checkRateLimit(ip, 30);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait a moment." },
      { status: 429 }
    );
  }

  const env = getServerEnv();
  const apiKey = env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "DEEPGRAM_API_KEY is not configured on the server. Please add your Deepgram key to .env, or use Demo Mode to explore without keys.",
      },
      { status: 503 }
    );
  }

  try {
    const deepgram = new DeepgramClient({ apiKey });
    const grant = await deepgram.auth.v1.tokens.grant({ ttl_seconds: TOKEN_TTL_SECONDS });

    return NextResponse.json({
      token: grant.access_token,
      scheme: "bearer",
      expiresInSeconds: grant.expires_in ?? TOKEN_TTL_SECONDS,
    });
  } catch (err: unknown) {
    // Never fall back to handing the master API key to the browser.
    console.error("Error generating Deepgram token:", err);
    return NextResponse.json(
      {
        error:
          "Could not mint a temporary Deepgram token. Make sure your API key has Member (or higher) permissions.",
      },
      { status: 502 }
    );
  }
}
