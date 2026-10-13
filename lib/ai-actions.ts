// Changes the AI chat proposes and the person applies (no server-only imports).
// Claude never writes: each create/update tool call becomes an AgentAction shown in
// the chat; "Áp dụng" sends the chosen ones to POST /api/ai/actions, which runs them
// through the normal API routes with the person's own permissions.

export const WRITE_TOOLS = [
  "create_project",
  "update_project",
  "create_category",
  "update_category",
  "create_task",
  "update_task",
  "create_contract",
  "update_contract",
  "add_note",
] as const;
export type WriteTool = (typeof WRITE_TOOLS)[number];

export const isWriteTool = (name: string): name is WriteTool => (WRITE_TOOLS as readonly string[]).includes(name);

/** Proposals per chat answer (a whole project plan fits). */
export const MAX_AGENT_ACTIONS = 100;
/** Actions per apply request: the chat sends larger sets in batches, carrying the refs. */
export const APPLY_BATCH = 25;

/** One proposed change, as shown in the chat. `input` is Claude's tool input, re-validated on apply. */
export interface AgentAction {
  /** The tool call id; unique within the answer. */
  id: string;
  tool: WriteTool;
  input: Record<string, unknown>;
  /** e.g. "Tạo dự án" */
  title: string;
  /** e.g. "“Đào tạo PCCC UEH”" */
  target: string;
  /** Field lines, e.g. "Hạn: 30/11/2026" or "Trạng thái: Đang làm → Hoàn thành". */
  lines: string[];
  /** Name later proposals in the same answer use as "ref:<name>" for the item this one creates. */
  ref?: string;
}

export interface AgentActionResult {
  id: string;
  ok: boolean;
  /** What happened, in Vietnamese ("Đã tạo dự án “X”" or the API's error). */
  message: string;
  /** Page to open the created or updated item. */
  link?: string;
  /** Id of the created or updated record. */
  entityId?: string;
}

/**
 * What the next questions should know about a proposal set: appended to that answer in the
 * chat history, so Claude has the new ids (or knows nothing was changed).
 */
export function actionsNote(actions: AgentAction[], results: AgentActionResult[] | null, dismissed: boolean): string {
  if (!actions.length) return "";
  if (dismissed && !results) return "\n\n[Người dùng chưa áp dụng các đề xuất trên; dữ liệu chưa thay đổi.]";
  if (!results) return "\n\n[Các đề xuất trên đang chờ người dùng áp dụng; dữ liệu chưa thay đổi.]";
  const byId = new Map(results.map((r) => [r.id, r]));
  const lines = actions.map((a) => {
    const r = byId.get(a.id);
    if (!r) return `- Không áp dụng: ${a.title} ${a.target}`;
    return r.ok ? `- Đã áp dụng: ${r.message}${r.entityId ? ` (id: ${r.entityId})` : ""}` : `- Lỗi: ${a.title} ${a.target}: ${r.message}`;
  });
  return `\n\n[Kết quả áp dụng đề xuất:\n${lines.join("\n")}]`;
}
