import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import { handle } from "@/lib/http";

export const runtime = "nodejs";

export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await repo.deleteDocument(id);
  return NextResponse.json({ ok: true });
});
