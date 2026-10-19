import { NextRequest } from "next/server";
import { handle } from "@/lib/http";
import { buildMeetingReport } from "@/lib/services/report";

export const runtime = "nodejs";

/**
 * GET /api/meetings/:id/report?…&print=1
 * The same report as an HTML page. Fallback when server-side PDF rendering is unavailable
 * (e.g. Browser Rendering quota): the browser's own "Save as PDF" produces the file.
 */
export const GET = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { html } = await buildMeetingReport(id, req.nextUrl.searchParams);
  const autoPrint = req.nextUrl.searchParams.get("print") === "1";
  const page = autoPrint
    ? html.replace("</body>", `<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),400));</script></body>`)
    : html;
  return new Response(page, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
});
