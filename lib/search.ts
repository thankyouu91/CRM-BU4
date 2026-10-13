// Quick search (Ctrl+K): accent-insensitive matching, shared by the API's SQL
// (lib/search-queries.ts) and the palette (no server-only imports).
import { hasPermission, type Actor, type PermissionKey } from "./permissions";

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 100;
/** Results per group. */
export const SEARCH_LIMIT = 6;

// Vietnamese letters with tone marks (and đ), by the plain letter they fold to.
const VIETNAMESE: Record<string, string> = {
  a: "àáảãạăằắẳẵặâầấẩẫậ",
  e: "èéẻẽẹêềếểễệ",
  i: "ìíỉĩị",
  o: "òóỏõọôồốổỗộơờớởỡợ",
  u: "ùúủũụưừứửữự",
  y: "ỳýỷỹỵ",
  d: "đ",
};
// Combining marks of decomposed (NFD) Vietnamese text: dropped on both sides.
const MARKS = "̛̣̀́̂̃̆̉";

const PAIRS = Object.entries(VIETNAMESE).flatMap(([plain, chars]) => [...chars, ...chars.toUpperCase()].map((c) => [c, plain] as const));
const FOLD = new Map<string, string>(PAIRS);

/**
 * Arguments of Postgres translate(): each accented letter in either case maps to
 * its plain lowercase letter; the marks at the end of FOLD_FROM have no partner
 * in FOLD_TO, so translate() deletes them. No `unaccent` extension needed.
 */
export const FOLD_FROM = PAIRS.map(([c]) => c).join("") + MARKS;
export const FOLD_TO = PAIRS.map(([, plain]) => plain).join("");

const foldUnit = (ch: string) => FOLD.get(ch) ?? (MARKS.includes(ch) ? "" : ch.toLowerCase());

/** Lowercase without Vietnamese tone marks: "Đào TẠO" → "dao tao". Same result as foldSql on the database. */
export function foldSearch(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) out += foldUnit(ch);
  return out;
}

/** The term from ?q=: trimmed (inner spaces collapsed), 2–100 characters, or null. */
export function parseSearchQuery(raw: string | null | undefined): string | null {
  const q = (raw ?? "").trim().replace(/\s+/g, " ");
  if (q.length < SEARCH_MIN || q.length > SEARCH_MAX || !foldSearch(q).trim()) return null;
  return q;
}

/** Escape LIKE wildcards so the term matches literally (with ESCAPE '\'). */
export const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

/** LIKE patterns of a term, folded and escaped: anywhere, at the start, at a word start. */
export function likePatterns(query: string) {
  const term = escapeLike(foldSearch(query));
  return { contains: `%${term}%`, prefix: `${term}%`, word: `% ${term}%` };
}

/**
 * Where `query` matches in `text` ignoring case and tone marks, as [start, end)
 * offsets into `text` (for highlighting), or null. A word-start match wins.
 */
export function matchRange(text: string, query: string): [number, number] | null {
  const q = foldSearch(query.trim());
  if (!q) return null;
  // Fold one UTF-16 unit at a time, remembering where each folded unit came from.
  let folded = "";
  const from: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const f = foldUnit(text[i]);
    folded += f;
    for (let k = 0; k < f.length; k++) from.push(i);
  }
  let at = -1;
  for (let i = folded.indexOf(q); i !== -1; i = folded.indexOf(q, i + 1)) {
    if (i === 0 || folded[i - 1] === " ") { at = i; break; }
    if (at === -1) at = i;
  }
  if (at === -1) return null;
  let end = from[at + q.length - 1] + 1;
  while (end < text.length && MARKS.includes(text[end])) end++; // marks belong to the last letter
  return [from[at], end];
}

export interface PageShortcut {
  href: string;
  label: string;
  /** Other words people may type for this page. */
  keywords: string;
  permission?: PermissionKey;
}

/** Pages offered by the palette, in menu order. */
export const PAGE_SHORTCUTS: PageShortcut[] = [
  { href: "/dashboard", label: "Tổng quan", keywords: "dashboard trang chủ kpi biểu đồ" },
  { href: "/projects", label: "Dự án", keywords: "projects lịch hoạt động" },
  { href: "/tasks", label: "Công việc của tôi", keywords: "tasks việc được giao báo cáo tuần tháng" },
  { href: "/ai", label: "Trợ lý AI", keywords: "claude chat prompt" },
  { href: "/inbox", label: "Hộp báo cáo", keywords: "inbox duyệt báo cáo" },
  { href: "/reports", label: "Trung tâm báo cáo", keywords: "reports trình chiếu pdf powerpoint" },
  { href: "/contracts", label: "Hợp đồng & chi phí", keywords: "contracts tài chính lợi nhuận công nợ", permission: "FINANCE_MANAGE" },
  { href: "/team", label: "Nhân sự", keywords: "team nhân viên tài khoản phân quyền" },
  { href: "/settings", label: "Cài đặt", keywords: "settings đổi mật khẩu giao diện" },
];

/** Shortcuts the user may open that match `text` (all of them when it is empty); name matches first. */
export function matchPages(user: Pick<Actor, "role" | "permissions">, text: string): PageShortcut[] {
  const q = foldSearch(text.trim().replace(/\s+/g, " "));
  const allowed = PAGE_SHORTCUTS.filter((p) => !p.permission || hasPermission(user, p.permission));
  if (!q) return allowed;
  const byName = allowed.filter((p) => foldSearch(p.label).includes(q));
  return [...byName, ...allowed.filter((p) => !byName.includes(p) && foldSearch(p.keywords).includes(q))];
}

/** GET /api/search answer (dates as ISO strings). `contracts` only for holders of "Hợp đồng & chi phí". */
export interface SearchResults {
  projects: { id: string; name: string; status: string; color: string }[];
  tasks: { id: string; title: string; status: string; dueDate: string | null; project: { id: string; name: string; color: string }; assignee: string | null }[];
  contracts?: { id: string; code: string | null; name: string; partner: string | null; status: string }[];
  people: { id: string; name: string; jobTitle: string | null; email: string; avatarColor: string }[];
}
