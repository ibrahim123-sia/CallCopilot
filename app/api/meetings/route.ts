import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { handle, notFound, readJson } from "@/lib/http";

export const runtime = "nodejs";

export const GET = handle(async () => NextResponse.json({ meetings: await repo.listRecentMeetings(15) }));

const CreateMeeting = z.object({
  clientId: z.string().min(1),
  title: z.string().max(200).default(""),
  goal: z.string().max(1000).default(""),
  language: z.enum(["en", "ur", "auto"]).default("en"),
  source: z.enum(["live", "demo"]).default("live"),
});

export const POST = handle(async (req: Request) => {
  const body = await readJson(req, CreateMeeting);
  if (!await repo.getClient(body.clientId)) notFound("Client not found");
  const meeting = await repo.createMeeting({ ...body, title: body.title || "Meeting", status: "live" });
  return NextResponse.json({ meeting }, { status: 201 });
});
