import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { handle, HttpError, notFound, readJson } from "@/lib/http";
import { ClientBriefSchema } from "@/lib/analysis/schemas";
import { proposeBriefUpdate } from "@/lib/services/meetings";
import { ClientBrief } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const BriefAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), brief: ClientBriefSchema.optional() }),
  z.object({ action: z.literal("reject") }),
  // Re-run the merge from the most recent summarized meeting (e.g. after a rate-limit)
  z.object({ action: z.literal("regenerate") }),
]);

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const client = await repo.getClient(id) ?? notFound("Client not found");
  const body = await readJson(req, BriefAction);

  if (body.action === "accept") {
    return NextResponse.json({ client: await repo.acceptPendingBrief(id, body.brief as ClientBrief | undefined) });
  }
  if (body.action === "reject") {
    return NextResponse.json({ client: await repo.updateClient(id, { pendingBrief: null }) });
  }

  const latest = (await repo.listMeetings(id)).find((m) => m.wrapUp);
  if (!latest) throw new HttpError(400, "No summarized meeting to build the brief from yet.");
  await proposeBriefUpdate(client.id, latest);
  return NextResponse.json({ client: await repo.getClient(id) });
});
