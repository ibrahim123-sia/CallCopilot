import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { handle, readJson } from "@/lib/http";

export const runtime = "nodejs";

export const GET = handle(async () => NextResponse.json({ clients: await repo.listClients() }));

const CreateClient = z.object({
  name: z.string().trim().min(1).max(120),
  company: z.string().max(120).optional(),
  notes: z.string().max(5000).optional(),
});

export const POST = handle(async (req: Request) => {
  const body = await readJson(req, CreateClient);
  return NextResponse.json({ client: await repo.createClient(body) }, { status: 201 });
});
