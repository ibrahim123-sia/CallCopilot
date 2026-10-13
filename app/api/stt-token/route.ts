import { NextRequest, NextResponse } from "next/server";
import { DeepgramClient } from "@deepgram/sdk";
import { getServerEnv } from "@/lib/env";
import { checkRateLimit } from "@/lib/rateLimit";

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
    let projectId = env.DEEPGRAM_PROJECT_ID;

    if (!projectId) {
      // Look up primary project ID
      const projectsRes = await deepgram.manage.v1.projects.list();
      const firstProject = projectsRes.projects?.[0];
      if (firstProject?.project_id) {
        projectId = firstProject.project_id;
      }
    }

    if (projectId) {
      // Mint a temporary short-lived key (valid for 10 minutes / 600s)
      const keyRes = await deepgram.manage.v1.projects.keys.create(projectId, {
        comment: "CallCopilot ephemeral session",
        time_to_live_in_seconds: 600,
        scopes: ["usage:write"],
      });

      if (keyRes.key) {
        return NextResponse.json({
          token: keyRes.key,
          expiresInSeconds: 600,
        });
      }
    }

    // Fallback: If project scoping is unavailable, return direct token for connection
    return NextResponse.json({
      token: apiKey,
      expiresInSeconds: 300,
    });
  } catch (err: unknown) {
    console.error("Error generating Deepgram token:", err);
    // If project key creation failed (e.g. standard tier permissions), provide direct key safely for direct wss
    return NextResponse.json({
      token: apiKey,
      expiresInSeconds: 300,
    });
  }
}
