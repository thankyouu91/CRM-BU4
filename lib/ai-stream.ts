// The built-in AI answer streams as NDJSON: one event per line. Shared by the
// route (app/api/ai/report) and the AI page; no server-only imports.

import type { AgentAction } from "./ai-actions";

export type AiStreamEvent =
  | { t: "text"; v: string }
  /** Sent before the answer, e.g. an attached file was too large to send whole. */
  | { t: "notice"; message: string }
  /** A change Claude proposes (lib/ai-actions.ts); nothing is written until the person applies it. */
  | { t: "action"; action: AgentAction }
  | { t: "done"; model: string; inputTokens: number; outputTokens: number; truncated: boolean; remaining: number }
  | { t: "refused"; message: string }
  | { t: "error"; message: string };

export function encodeEvent(event: AiStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/** Split buffered stream text into complete events; `rest` is an unfinished last line to keep for the next chunk. */
export function parseEvents(buffer: string): { events: AiStreamEvent[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: AiStreamEvent[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as AiStreamEvent;
      if (e && typeof e === "object" && typeof e.t === "string") events.push(e);
    } catch {
      // A line we can't read is skipped rather than ending the answer.
    }
  }
  return { events, rest };
}
