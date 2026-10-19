import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { handle, notFound, readJson } from "@/lib/http";

export const runtime = "nodejs";

const AppendSegments = z.object({
  segments: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        speaker: z.enum(["client", "team"]),
        text: z.string().min(1).max(20_000),
        timestamp: z.number(),
        durationMs: z.number().nullable().optional(),
      })
    )
    .max(500),
});

/** Called continuously during a live call so nothing is lost if the browser crashes. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!await repo.getMeeting(id)) notFound("Meeting not found");
  const { segments } = await readJson(req, AppendSegments);
  await repo.appendSegments(
    id,
    segments.map((s) => ({ ...s, durationMs: s.durationMs ?? null }))
  );
  return NextResponse.json({ ok: true, saved: segments.length });
});
