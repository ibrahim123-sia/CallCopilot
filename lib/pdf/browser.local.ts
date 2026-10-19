import "server-only";
import type { Browser } from "puppeteer";
import { PDF_OPTIONS } from "./pdfOptions";

/**
 * Local PDF engine: a headless Chrome downloaded by Puppeteer, kept open for the whole
 * server process (launching per request is slow).
 * Cloudflare builds replace this module with ./browser.cf (see next.config.mjs).
 */

const globalForPdf = globalThis as unknown as { __pdfBrowser?: Promise<Browser> };

async function getBrowser(): Promise<Browser> {
  if (!globalForPdf.__pdfBrowser) {
    const puppeteer = await import("puppeteer");
    globalForPdf.__pdfBrowser = puppeteer.default.launch({ headless: true });
    globalForPdf.__pdfBrowser.then((b) => b.on("disconnected", () => (globalForPdf.__pdfBrowser = undefined)));
  }
  return globalForPdf.__pdfBrowser;
}

export async function htmlToPdf(html: string): Promise<Uint8Array> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Fonts load from Google Fonts when online; system fonts are used offline.
    await page.setContent(html, { waitUntil: "load", timeout: 20000 }).catch(async () => {
      await page.setContent(html, { waitUntil: "domcontentloaded" });
    });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf(PDF_OPTIONS);
  } finally {
    await page.close();
  }
}
