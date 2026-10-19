/** A4 report with page numbers, shared by the local and Cloudflare PDF engines. */
export const PDF_OPTIONS = {
  format: "A4" as const,
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate:
    '<div style="width:100%;font-size:8px;color:#78716c;padding:0 16mm;text-align:right;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  margin: { top: "16mm", bottom: "18mm", left: "14mm", right: "14mm" },
};
