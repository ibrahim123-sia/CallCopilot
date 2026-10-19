import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import { handle, notFound } from "@/lib/http";
import { hasLlmKey } from "@/lib/ai/llm";
import { summarizeMeeting } from "@/lib/services/meetings";
import { CANNED_DEMO_WRAPUP } from "@/lib/analysis/cannedData";

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const meeting = await repo.getMeeting(id) ?? notFound("Meeting not found");

  // Demo calls work without a key; real meetings never get canned content.
  if (meeting.source === "demo" && !hasLlmKey()) {
    const updated = await repo.updateMeeting(id, { wrapUp: { ...CANNED_DEMO_WRAPUP, notes: meeting.notes }, status: "summarized" });
    return NextResponse.json({ meeting: updated });
  }

  const updated = await summarizeMeeting(id);
  return NextResponse.json({ meeting: updated, client: await repo.getClient(updated.clientId) });
});
