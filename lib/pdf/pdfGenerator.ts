import { ExportOptions, MeetingWrapUp, TranscriptEntry } from "../types";
import { buildPrintableHtml } from "./printTemplate";

export function triggerPrintOrSavePdf(
  wrapUp: MeetingWrapUp,
  options: ExportOptions,
  transcript: TranscriptEntry[],
  metadata: {
    clientName: string;
    projectName: string;
    dateStr: string;
    durationStr: string;
  }
): void {
  const html = buildPrintableHtml(wrapUp, options, transcript, metadata);

  // Create an iframe to render and print cleanly without displacing current page state
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    // Fallback: open print window
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 500);
    }
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for fonts and styling to stabilize
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    // Clean up after print dialog closes
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  }, 500);
}

export function downloadHtmlReport(
  wrapUp: MeetingWrapUp,
  options: ExportOptions,
  transcript: TranscriptEntry[],
  metadata: {
    clientName: string;
    projectName: string;
    dateStr: string;
    durationStr: string;
  }
): void {
  const html = buildPrintableHtml(wrapUp, options, transcript, metadata);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const safeClient = (metadata.clientName || "Client").replace(/[^a-zA-Z0-9_-]/g, "_");
  const a = document.createElement("a");
  a.href = url;
  a.download = `Meeting-Report_${safeClient}_${metadata.dateStr}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
