import "server-only";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const TEXT_EXTENSIONS = ["txt", "md", "markdown", "csv", "json", "vtt", "srt", "log"];

export class UnsupportedFileError extends Error {}

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Extracts plain text from an uploaded DOCX, PDF or text file. */
export async function extractText(file: { name: string; type: string; bytes: Uint8Array }): Promise<{ text: string; mimeType: string }> {
  if (file.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new UnsupportedFileError(`File is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }
  const ext = extensionOf(file.name);

  if (ext === "docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(file.bytes) });
    return { text: normalize(value), mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }

  if (ext === "pdf" || file.type === "application/pdf") {
    const { extractText: extractPdf, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(file.bytes));
    const { text } = await extractPdf(pdf, { mergePages: true });
    return { text: normalize(Array.isArray(text) ? text.join("\n") : text), mimeType: "application/pdf" };
  }

  if (ext === "doc") {
    throw new UnsupportedFileError("Old .doc files aren't supported — save it as .docx or PDF and upload again.");
  }

  if (TEXT_EXTENSIONS.includes(ext) || file.type.startsWith("text/")) {
    return { text: normalize(new TextDecoder("utf-8").decode(file.bytes)), mimeType: file.type || "text/plain" };
  }

  throw new UnsupportedFileError(`Unsupported file type ".${ext || "unknown"}". Use DOCX, PDF, TXT or MD.`);
}

function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
