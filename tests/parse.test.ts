import { describe, it, expect } from "vitest";
import { extractText, UnsupportedFileError } from "../lib/documents/parse";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("document text extraction", () => {
  it("reads plain text and markdown, normalising line endings", async () => {
    const { text } = await extractText({ name: "notes.md", type: "", bytes: bytes("# Kickoff\r\n\r\n\r\n\r\nBudget 25k") });
    expect(text).toBe("# Kickoff\n\nBudget 25k");
  });

  it("rejects legacy .doc and unknown types with a helpful message", async () => {
    await expect(extractText({ name: "old.doc", type: "", bytes: bytes("x") })).rejects.toThrow(/docx/);
    await expect(extractText({ name: "image.png", type: "image/png", bytes: bytes("x") })).rejects.toBeInstanceOf(UnsupportedFileError);
  });

  it("extracts text from a real DOCX", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
    );
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Previous meeting: budget agreed at 25k</w:t></w:r></w:p><w:p><w:r><w:t>Next step: send proposal</w:t></w:r></w:p></w:body></w:document>`
    );
    const docx = await zip.generateAsync({ type: "uint8array" });
    const { text } = await extractText({ name: "notes.docx", type: "", bytes: docx });
    expect(text).toContain("budget agreed at 25k");
    expect(text).toContain("Next step: send proposal");
  }, 30_000); // first import of mammoth/jszip can be slow on a busy machine

  it("extracts text from a real PDF", async () => {
    // Minimal single-page PDF containing "Hello CallCopilot"
    const pdf = [
      "%PDF-1.4",
      "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 100]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
      "4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 10 50 Td (Hello CallCopilot) Tj ET\nendstream endobj",
      "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
      "trailer<</Root 1 0 R>>",
      "%%EOF",
    ].join("\n");
    const { text } = await extractText({ name: "a.pdf", type: "application/pdf", bytes: bytes(pdf) });
    expect(text).toContain("Hello CallCopilot");
  }, 30_000);
});
