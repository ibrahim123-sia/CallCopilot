import "server-only";
import puppeteer from "@cloudflare/puppeteer";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PDF_OPTIONS } from "./pdfOptions";

/**
 * Cloudflare PDF engine: Browser Rendering (headless Chrome run by Cloudflare), bound as
 * `BROWSER` in wrangler.jsonc. Each PDF opens a short browser session and closes it.
 * Errors name the step that failed, which makes production logs much easier to read.
 */
export async function htmlToPdf(html: string): Promise<Uint8Array> {
  const env = getCloudflareContext().env as unknown as { BROWSER?: Parameters<typeof puppeteer.launch>[0] };
  if (!env.BROWSER) throw new Error('Browser Rendering binding "BROWSER" is missing. Check wrangler.jsonc.');

  let step = "launch browser";
  const started = Date.now();
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    step = "open page";
    const page = await browser.newPage();
    step = "load report HTML";
    await page.setContent(html, { waitUntil: "load", timeout: 20000 }).catch(async () => {
      step = "load report HTML (fallback)";
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });
    });
    step = "wait for fonts";
    // Don't let a slow font server block the report
    await Promise.race([page.evaluate(() => document.fonts.ready.then(() => true)), new Promise((r) => setTimeout(r, 5000))]);
    step = "print PDF";
    // Header/footer templates are skipped here: page numbers come from the report's CSS @page rules
    const { displayHeaderFooter, headerTemplate, footerTemplate, ...options } = PDF_OPTIONS;
    void displayHeaderFooter;
    void headerTemplate;
    void footerTemplate;
    return await page.pdf({ ...options, timeout: 60000 });
  } catch (err) {
    throw new Error(`PDF step "${step}" failed after ${Date.now() - started} ms: ${err instanceof Error ? err.message : err}`);
  } finally {
    await browser.close().catch(() => {});
  }
}
