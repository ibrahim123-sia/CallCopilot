import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { handle, HttpError, notFound, readJson } from "@/lib/http";
import { extractText, UnsupportedFileError } from "@/lib/documents/parse";
import { importPastMeeting } from "@/lib/services/meetings";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const PasteBody = z.object({
  title: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(500_000),
  importAsMeeting: z.boolean().default(false),
  date: z.number().optional(),
});

/**
 * Adds reference material for a client: multipart upload (DOCX/PDF/TXT/MD) or pasted text.
 * With importAsMeeting, the text is also summarized into a past meeting so it feeds the brief.
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!await repo.getClient(id)) notFound("Client not found");

  let title: string;
  let text: string;
  let mimeType = "text/plain";
  let kind = "paste";
  let importAsMeeting = false;
  let date: number | undefined;

  if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "No file uploaded");
    try {
      const extracted = await extractText({ name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
      text = extracted.text;
      mimeType = extracted.mimeType;
    } catch (err) {
      if (err instanceof UnsupportedFileError) throw new HttpError(415, err.message);
      throw new HttpError(422, `Could not read "${file.name}": ${err instanceof Error ? err.message : err}`);
    }
    title = String(form.get("title") || file.name);
    kind = "upload";
    importAsMeeting = form.get("importAsMeeting") === "true";
    const d = Number(form.get("date"));
    date = Number.isFinite(d) && d > 0 ? d : undefined;
  } else {
    const body = await readJson(req, PasteBody);
    ({ title, text, importAsMeeting, date } = body);
  }

  if (!text.trim()) throw new HttpError(422, "No readable text found in that file.");

  const document = await repo.createDocument({ clientId: id, title, text, kind, mimeType });
  const meeting = importAsMeeting ? await importPastMeeting({ clientId: id, title, text, date }) : null;

  return NextResponse.json(
    { document: { ...document, text: undefined, chars: text.length, preview: text.slice(0, 280) }, meeting },
    { status: 201 }
  );
});
