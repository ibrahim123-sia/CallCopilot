import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { errorResponse, handle, notFound, readJson } from "@/lib/http";
import { streamClientChat } from "@/lib/services/chat";
import { aiErrorResponse } from "@/lib/ai/common";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return NextResponse.json({ messages: await repo.listChatMessages(id) });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await repo.clearChat(id);
  return NextResponse.json({ ok: true });
});

const ChatBody = z.object({ message: z.string().trim().min(1).max(8000) });

/** Streams NDJSON events: {type:"delta",text} … {type:"done",sources} | {type:"error",error}. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!await repo.getClient(id)) notFound("Client not found");
    const { message } = await readJson(req, ChatBody);

    const encoder = new TextEncoder();
    const gen = streamClientChat(id, message);
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        try {
          while (true) {
            const { value, done } = await gen.next();
            if (done) {
              send({ type: "done", sources: value ?? [] });
              break;
            }
            send({ type: "delta", text: value });
          }
        } catch (err) {
          send({ type: "error", ...aiErrorResponse(err).body });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
