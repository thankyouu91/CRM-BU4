// Trao đổi chung (company chat): message text, no database. A message keeps its references
// inline: @[Tên](u:<userId>) mentions a person, #[Tiêu đề](t:<taskId>) tags a task. The
// composer shows plain "@Tên" / "#Tiêu đề" and turns them into tokens when sending.
// Shared by the API (lib/chat-queries.ts), the chat page and the tests.

export const CHAT_MAX = 4000;
export const CHAT_PAGE = 50;

const TOKEN = /([@#])\[([^\]\n]{1,120})\]\((u|t):([A-Za-z0-9_-]{1,40})\)/g;

export type ChatPart = { kind: "text"; text: string } | { kind: "mention"; id: string; name: string } | { kind: "task"; id: string; title: string };

/** A message cut into text, mentions and task tags, in order. */
export function chatParts(content: string): ChatPart[] {
  const parts: ChatPart[] = [];
  let last = 0;
  for (const m of content.matchAll(TOKEN)) {
    if (m.index > last) parts.push({ kind: "text", text: content.slice(last, m.index) });
    // "@[…](t:…)" or "#[…](u:…)" is not a reference: kept as text.
    if (m[1] === "@" && m[3] === "u") parts.push({ kind: "mention", id: m[4], name: m[2] });
    else if (m[1] === "#" && m[3] === "t") parts.push({ kind: "task", id: m[4], title: m[2] });
    else parts.push({ kind: "text", text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push({ kind: "text", text: content.slice(last) });
  return parts;
}

/** The message as people read it: "@Tên", "#Tiêu đề". For notices, task titles, search. */
export const chatPlain = (content: string) =>
  chatParts(content)
    .map((p) => (p.kind === "text" ? p.text : p.kind === "mention" ? `@${p.name}` : `#${p.title}`))
    .join("");

/** The people and tasks a message refers to, each once. */
export function chatRefs(content: string): { users: string[]; tasks: string[] } {
  const parts = chatParts(content);
  return {
    users: [...new Set(parts.flatMap((p) => (p.kind === "mention" ? [p.id] : [])))],
    tasks: [...new Set(parts.flatMap((p) => (p.kind === "task" ? [p.id] : [])))],
  };
}

/**
 * Turns references that may not stay (unknown person, task the author cannot see) back into
 * plain text, and gives the others their real name or title, so "@[Giám đốc](u:<anyone>)" cannot pass.
 */
export function keepRefs(content: string, users: ReadonlyMap<string, string>, tasks: ReadonlyMap<string, string>): string {
  return chatParts(content)
    .map((p) =>
      p.kind === "text"
        ? p.text
        : p.kind === "mention"
          ? users.has(p.id) ? token("@", users.get(p.id)!, "u", p.id) : `@${p.name}`
          : tasks.has(p.id) ? token("#", tasks.get(p.id)!, "t", p.id) : `#${p.title}`,
    )
    .join("");
}

const clean = (label: string) => label.replace(/[[\]\n]/g, " ").trim().slice(0, 120);
const token = (sign: "@" | "#", label: string, kind: "u" | "t", id: string) => `${sign}[${clean(label)}](${kind}:${id})`;
export const mentionToken = (u: { id: string; name: string }) => token("@", u.name, "u", u.id);
export const taskToken = (t: { id: string; title: string }) => token("#", t.title, "t", t.id);

/**
 * The composer's text with the people and tasks picked from its suggestions turned into
 * tokens: "@Trần Thị Bình" → @[Trần Thị Bình](u:…). Only after a space or at the start, and
 * longest names first, so "@An" does not eat the start of "@An Nhiên".
 */
export function withRefs(draft: string, picked: { users: { id: string; name: string }[]; tasks: { id: string; title: string }[] }): string {
  const refs = [
    ...picked.users.map((u) => ({ text: `@${u.name}`, out: mentionToken(u) })),
    ...picked.tasks.map((t) => ({ text: `#${t.title}`, out: taskToken(t) })),
  ].sort((a, b) => b.text.length - a.text.length);
  let out = "";
  let i = 0;
  outer: while (i < draft.length) {
    if ((draft[i] === "@" || draft[i] === "#") && (i === 0 || /\s/.test(draft[i - 1]))) {
      for (const r of refs) {
        if (draft.startsWith(r.text, i) && !/[\p{L}\p{N}]/u.test(draft[i + r.text.length] ?? "")) {
          out += r.out;
          i += r.text.length;
          continue outer;
        }
      }
    }
    out += draft[i++];
  }
  return out;
}

/** What is being typed right before the caret after "@" or "#", for the suggestion list. */
export function pendingRef(beforeCaret: string): { sign: "@" | "#"; query: string; start: number } | null {
  const m = /(?:^|\s)([@#])([^\s@#]{0,40})$/.exec(beforeCaret);
  if (!m) return null;
  return { sign: m[1] as "@" | "#", query: m[2], start: beforeCaret.length - m[2].length - 1 };
}
