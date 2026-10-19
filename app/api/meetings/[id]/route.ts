import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { handle, notFound, readJson } from "@/lib/http";
import { MeetingWrapUpSchema } from "@/lib/analysis/schemas";
import { MeetingWrapUp } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const meeting = await repo.getMeeting(id) ?? notFound("Meeting not found");
  const client = await repo.getClient(meeting.clientId);
  return NextResponse.json({ meeting, client, segments: await repo.listSegments(id) });
});

const PatchMeeting = z.object({
  title: z.string().max(200).optional(),
  goal: z.string().max(1000).optional(),
  notes: z.string().max(50_000).optional(),
  status: z.enum(["live", "ended", "summarized", "imported"]).optional(),
  endedAt: z.number().nullable().optional(),
  durationSeconds: z.number().int().min(0).optional(),
  clientTalkSeconds: z.number().int().min(0).optional(),
  teamTalkSeconds: z.number().int().min(0).optional(),
  pinnedTopics: z.array(z.string()).optional(),
  wrapUp: MeetingWrapUpSchema.nullable().optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!await repo.getMeeting(id)) notFound("Meeting not found");
  const body = await readJson(req, PatchMeeting);
  const meeting = await repo.updateMeeting(id, { ...body, wrapUp: body.wrapUp as MeetingWrapUp | null | undefined });
  return NextResponse.json({ meeting });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await repo.deleteMeeting(id);
  return NextResponse.json({ ok: true });
});
