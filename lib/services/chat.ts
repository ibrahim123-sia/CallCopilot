import "server-only";
import { generateTextStream } from "../ai/llm";
import { SYSTEM_CHAT_PROMPT } from "../analysis/prompts";
import * as repo from "../db/repo";
import { formatMemoryForPrompt, formatRetrieved, loadClientMemory, sourcesForRefs } from "../memory/clientMemory";
import { buildQueryFromText } from "../memory/retrieval";
import { TopicSource } from "../types";

const HISTORY_TURNS = 12;

export function extractRefs(text: string): string[] {
  // Models sometimes add spaces inside the brackets: "[ M1 ]"
  return Array.from(new Set(Array.from(text.matchAll(/\[\s*(M\d+|D\d+)\s*\]/g), (m) => m[1])));
}

/**
 * Streams an answer about one client grounded in its memory, and persists both turns.
 * Yields text deltas; returns the cited sources once the stream finishes.
 */
export async function* streamClientChat(
  clientId: string,
  userMessage: string
): AsyncGenerator<string, TopicSource[]> {
  const memory = await loadClientMemory(clientId);
  if (!memory) throw new Error("Client not found");

  const history = (await repo.listChatMessages(clientId)).slice(-HISTORY_TURNS);

  const retrieved = memory.corpus.search(
    buildQueryFromText([...history.slice(-2).map((h) => h.content), userMessage].join(" ")) || userMessage,
    6
  );

  const system = `${SYSTEM_CHAT_PROMPT}

${formatMemoryForPrompt(memory, { recentMeetings: 5, maxChars: 16000 })}

${retrieved.length ? `RELEVANT EXCERPTS:\n"""\n${formatRetrieved(retrieved)}\n"""` : ""}`;

  const messages = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user" as const, content: userMessage },
  ];

  let answer = "";
  for await (const delta of generateTextStream({ task: "chat", system, messages })) {
    answer += delta;
    yield delta;
  }

  // Persist both turns only once the answer completed, so a failed request leaves no orphan question
  const sources = sourcesForRefs(memory, extractRefs(answer));
  await repo.addChatMessage({ clientId, role: "user", content: userMessage });
  await repo.addChatMessage({ clientId, role: "assistant", content: answer, sources });
  return sources;
}
