import { NextRequest } from "next/server";
import { handle } from "@/lib/http";
import { renderHtmlToPdf } from "@/lib/pdf/renderPdf";
import { buildMeetingReport } from "@/lib/services/report";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/meetings/:id/pdf?audience=client|internal&transcript=1&translation=1&internal=1
 * Renders the report with headless Chrome (local Puppeteer or Cloudflare Browser Rendering).
 */
export const GET = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { html, filename } = await buildMeetingReport(id, req.nextUrl.searchParams);
  const pdf = await renderHtmlToPdf(html);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
