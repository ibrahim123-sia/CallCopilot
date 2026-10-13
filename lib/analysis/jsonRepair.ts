/**
 * Utility to clean markdown fences and repair common malformed JSON issues
 * emitted by LLMs (trailing commas, unclosed brackets, extra text).
 */
export function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();

  // Strip ```json ... ``` or ``` ... ``` code blocks
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/, "");
    cleaned = cleaned.trim();
  }

  // Find first { or [ and last } or ]
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let startIdx = 0;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }

  const lastBrace = cleaned.lastIndexOf("}");
  const lastBracket = cleaned.lastIndexOf("]");
  let endIdx = cleaned.length;
  if (lastBrace !== -1 && (lastBracket === -1 || lastBrace > lastBracket)) {
    endIdx = lastBrace + 1;
  } else if (lastBracket !== -1) {
    endIdx = lastBracket + 1;
  }

  if (startIdx >= 0 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx);
  }

  // Strip trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");

  return cleaned;
}

export function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    const cleaned = cleanJsonString(raw);
    return JSON.parse(cleaned) as T;
  } catch {
    // Attempt relaxed bracket and brace balancing if truncated
    try {
      let balanced = cleanJsonString(raw);
      // Close unclosed quotes if count is odd
      const quoteCount = (balanced.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        balanced += '"';
      }
      // Remove trailing comma
      balanced = balanced.replace(/,\s*$/, "");

      const openBrackets = (balanced.match(/\[/g) || []).length;
      const closeBrackets = (balanced.match(/\]/g) || []).length;
      if (openBrackets > closeBrackets) {
        balanced += "]".repeat(openBrackets - closeBrackets);
      }

      const openBraces = (balanced.match(/\{/g) || []).length;
      const closeBraces = (balanced.match(/\}/g) || []).length;
      if (openBraces > closeBraces) {
        balanced += "}".repeat(openBraces - closeBraces);
      }

      return JSON.parse(balanced) as T;
    } catch {
      return fallback;
    }
  }
}
