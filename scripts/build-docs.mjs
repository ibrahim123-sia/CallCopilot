// Builds the PDF guides in docs/ from their HTML sources using headless Chrome.
// Usage: npm run docs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GUIDES = [
  { source: "technical-guide.html", output: "CallCopilot-Technical-Guide.pdf", title: "CallCopilot — Technical Guide" },
  { source: "cloudflare-guide.html", output: "CallCopilot-Cloudflare-Guide.pdf", title: "CallCopilot — Cloudflare Guide" },
];

const browser = await puppeteer.launch({ headless: true });
try {
  for (const guide of GUIDES) {
    const source = path.join(root, "docs", guide.source);
    if (!fs.existsSync(source)) continue;
    const output = path.join(root, "docs", guide.output);
    const page = await browser.newPage();
    await page.goto(pathToFileURL(source).href, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: output,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#78716c;padding:0 16mm;display:flex;justify-content:space-between;">' +
        `<span>${guide.title}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
    await page.close();
    console.log(`Wrote ${path.relative(root, output)}`);
  }
} finally {
  await browser.close();
}
