import "server-only";
import { generateJson } from "../ai/llm";
import { buildTranslatePrompt, SYSTEM_TRANSLATE_PROMPT } from "../analysis/prompts";
import { TranslationResultSchema } from "../analysis/schemas";
import * as repo from "../db/repo";

export interface TranslateLine {
  id: string;
  speaker: "client" | "team";
  text: string;
}

const label = (s: "client" | "team") => (s === "client" ? "Client" : "Our Team");

/** Translates caption lines to Roman Urdu and (optionally) stores them on the meeting's segments. */
export async function translateLines(
  lines: TranslateLine[],
  context: TranslateLine[],
  meetingId?: string
): Promise<Array<{ id: string; romanUrdu: string }>> {
  if (lines.length === 0) return [];
  const result = await generateJson({
    task: "translate",
    system: SYSTEM_TRANSLATE_PROMPT,
    prompt: buildTranslatePrompt(
      lines.map((l) => ({ id: l.id, speaker: label(l.speaker), text: l.text })),
      context.map((c) => ({ speaker: label(c.speaker), text: c.text }))
    ),
    schema: TranslationResultSchema,
    temperature: 0.2,
  });

  const wanted = new Set(lines.map((l) => l.id));
  const items = result.items.filter((i) => wanted.has(i.id) && i.romanUrdu.trim());
  if (meetingId && items.length) {
    await repo.setTranslations(
      meetingId,
      items.map((i) => ({ id: i.id, translation: i.romanUrdu.trim() }))
    );
  }
  return items;
}
