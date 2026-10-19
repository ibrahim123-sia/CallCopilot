import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { handle, notFound, readJson } from "@/lib/http";
import { ClientBriefSchema } from "@/lib/analysis/schemas";
import { computeOpenItems } from "@/lib/memory/clientMemory";
import { ClientBrief } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const client = await repo.getClient(id) ?? notFound("Client not found");
  const meetings = await repo.listMeetings(id);
  const documents = (await repo.listDocuments(id)).map((d) => ({ ...d, text: undefined, chars: d.text.length, preview: d.text.slice(0, 280) }));
  return NextResponse.json({
    client,
    meetings,
    documents,
    openItems: computeOpenItems(client.brief, meetings.filter((m) => m.status !== "live")),
  });
});

const PatchClient = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  company: z.string().max(120).optional(),
  notes: z.string().max(5000).optional(),
  brief: ClientBriefSchema.nullable().optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!await repo.getClient(id)) notFound("Client not found");
  const body = await readJson(req, PatchClient);
  const client = await repo.updateClient(id, { ...body, brief: body.brief as ClientBrief | null | undefined });
  return NextResponse.json({ client });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await repo.deleteClient(id);
  return NextResponse.json({ ok: true });
});
