import { describe, it, expect } from "vitest";
import { cleanJsonString, safeParseJson } from "@/lib/analysis/jsonRepair";

describe("JSON Cleaning and Resilient Repair", () => {
  it("strips markdown json fences cleanly", () => {
    const raw = "```json\n{\"topics\": []}\n```";
    expect(cleanJsonString(raw)).toBe("{\"topics\": []}");
  });

  it("strips leading conversational preamble and markdown blocks", () => {
    const raw = "Here is the response:\n```\n{\"key\": \"value\"}\n```\nHope this helps!";
    expect(cleanJsonString(raw)).toBe("{\"key\": \"value\"}");
  });

  it("removes illegal trailing commas before closing braces/brackets", () => {
    const raw = "{\"items\": [\"a\", \"b\",], \"flag\": true,}";
    const cleaned = cleanJsonString(raw);
    expect(cleaned).toBe("{\"items\": [\"a\", \"b\"], \"flag\": true}");
    expect(() => JSON.parse(cleaned)).not.toThrow();
  });

  it("safely attempts bracket repair on truncated JSON", () => {
    const truncated = "{\"title\": \"MCP Server\", \"details\": [\"Fast\", \"Standard\"";
    const parsed = safeParseJson<{ title: string; details: string[] } | null>(
      truncated,
      null
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe("MCP Server");
    expect(parsed?.details).toContain("Fast");
  });

  it("returns fallback value on unrepairable garbage input", () => {
    const garbage = "Some random text without any braces or brackets";
    const result = safeParseJson<string>(garbage, "fallback_default");
    expect(result).toBe("fallback_default");
  });
});
