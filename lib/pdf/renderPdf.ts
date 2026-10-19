import "server-only";
// Local Chrome engine. Cloudflare builds swap this import for ./browser.cf (next.config.mjs).
import { htmlToPdf } from "./browser.local";

/**
 * Renders report HTML to a real PDF with Chromium, so Urdu/RTL text shapes correctly and the
 * user gets a file download instead of a print dialog.
 */
export async function renderHtmlToPdf(html: string): Promise<Uint8Array> {
  return htmlToPdf(html);
}
