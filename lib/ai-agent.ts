// Tools for the AI chat (server only).
//
// Read tools run at once, with the caller's permissions: the same project list,
// workspace and contract data the screens show them. Write tools never write:
// each call is validated, checked against the caller's rights and turned into an
// AgentAction (lib/ai-actions.ts) that the person reviews and applies; applying
// runs the change through the normal API route (app/api/ai/actions).

import type Anthropic from "@anthropic-ai/sdk";
import { TZDate } from "@date-fns/tz";
import { z } from "zod";
import { prisma } from "./prisma";
import type { CurrentUser } from "./session";
import { listProjects, loadWorkspace } from "./queries";
import { canCreateProject, canManageProject, loadTaskForUser, projectAccess } from "./rbac";
import { hasPermission, PROJECT_ROLES } from "./permissions";
import { CONTRACT_STATUS, CONTRACT_STATUSES, formatVnd } from "./finance";
import { NOTE_TYPE, PRIORITY, PROJECT_STATUS, TASK_STATUS } from "./constants";
import { APP_TIMEZONE } from "./period";
import { isWriteTool, MAX_AGENT_ACTIONS, type AgentAction, type WriteTool } from "./ai-actions";

// ----------------------------------------------------------------------------
// Tool inputs (what Claude sends). Dates are calendar days in the business time
// zone; ids may be "ref:<name>" for an item proposed earlier in the same answer.
// ----------------------------------------------------------------------------

const REF = /^ref:([A-Za-z0-9_-]{1,40})$/;
const id = z.string().trim().min(1).max(100);
const refName = z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/, "ref chỉ gồm chữ không dấu, số, - và _ (tối đa 40 ký tự)");
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo dạng YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Ngày không hợp lệ");
const optDay = day.nullable().optional();
const optText = (max: number) => z.string().trim().max(max).nullable().optional();
const money = z.number().int("Số tiền phải là số nguyên VND").min(0).max(999_999_999_999_999);
const projectStatus = z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]);
const taskStatus = z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"]);
const priority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const contractStatus = z.enum(CONTRACT_STATUSES);

const D = {
  ref: "Tên tham chiếu (tuỳ chọn) để các đề xuất sau trong cùng câu trả lời dùng dạng \"ref:<tên>\" thay cho id của mục này.",
  projectId: "id dự án (từ find_projects/get_project), hoặc \"ref:<tên>\" của dự án mới đề xuất trong cùng câu trả lời.",
  day: "Ngày dạng YYYY-MM-DD.",
};

const INPUTS = {
  create_project: z.object({
    ref: refName.optional().describe(D.ref),
    name: z.string().trim().min(2).max(200).describe("Tên dự án."),
    description: optText(4000),
    status: projectStatus.optional().describe("Mặc định PLANNING."),
    startDate: optDay.describe(D.day),
    dueDate: optDay.describe(D.day),
    members: z
      .array(z.object({ userId: id.describe("id người dùng (find_users)."), role: z.enum(PROJECT_ROLES).optional().describe("Mặc định MEMBER.") }))
      .max(50)
      .optional()
      .describe("Thành viên dự án; người tạo luôn là quản lý dự án."),
  }),
  update_project: z.object({
    projectId: id,
    name: z.string().trim().min(2).max(200).optional(),
    description: optText(4000),
    status: projectStatus.optional(),
    startDate: optDay.describe(D.day),
    dueDate: optDay.describe(D.day),
  }),
  create_category: z.object({
    ref: refName.optional().describe(D.ref),
    projectId: id.describe(D.projectId),
    name: z.string().trim().min(1).max(200).describe("Tên hạng mục."),
    parentId: id.nullable().optional().describe("Hạng mục lớn chứa hạng mục con này: id hoặc \"ref:<tên>\". Bỏ trống = hạng mục lớn."),
    startDate: optDay.describe(D.day),
    dueDate: optDay.describe(D.day),
  }),
  update_category: z.object({
    categoryId: id,
    name: z.string().trim().min(1).max(200).optional(),
    startDate: optDay.describe(D.day),
    dueDate: optDay.describe(D.day),
  }),
  create_task: z.object({
    ref: refName.optional().describe(D.ref),
    projectId: id.describe(D.projectId),
    title: z.string().trim().min(1).max(300),
    description: optText(4000),
    categoryId: id.nullable().optional().describe("Hạng mục: id hoặc \"ref:<tên>\"."),
    parentId: id.nullable().optional().describe("Công việc cha (để tạo task con): id hoặc \"ref:<tên>\"."),
    assigneeId: id.nullable().optional().describe("Người phụ trách: id người dùng (find_users)."),
    status: taskStatus.optional().describe("Mặc định TODO."),
    priority: priority.optional().describe("Mặc định MEDIUM."),
    startDate: optDay.describe(D.day),
    dueDate: optDay.describe(D.day),
  }),
  update_task: z.object({
    taskId: id,
    title: z.string().trim().min(1).max(300).optional(),
    description: optText(4000),
    categoryId: id.nullable().optional(),
    assigneeId: id.nullable().optional(),
    status: taskStatus.optional(),
    priority: priority.optional(),
    progress: z.number().int().min(0).max(100).optional().describe("Tiến độ 0–100 (%)."),
    startDate: optDay.describe(D.day),
    dueDate: optDay.describe(D.day),
  }),
  create_contract: z.object({
    ref: refName.optional().describe(D.ref),
    name: z.string().trim().min(1).max(300).describe("Tên hợp đồng."),
    code: optText(120).describe("Số hợp đồng, giữ nguyên như tài liệu."),
    partner: optText(200).describe("Đối tác."),
    value: money.describe("Giá trị hợp đồng, số nguyên VND."),
    performedAt: day.describe("Ngày thực hiện, YYYY-MM-DD."),
    status: contractStatus.optional().describe("Mặc định IN_PROGRESS."),
    trainingCost: money.optional(),
    examCost: money.optional(),
    otherCost: money.optional(),
    collected: money.optional().describe("Đã thu, VND."),
    note: optText(2000),
    projectId: id.nullable().optional().describe(D.projectId),
  }),
  update_contract: z.object({
    contractId: id,
    name: z.string().trim().min(1).max(300).optional(),
    code: optText(120),
    partner: optText(200),
    value: money.optional(),
    performedAt: day.optional(),
    status: contractStatus.optional(),
    trainingCost: money.optional(),
    examCost: money.optional(),
    otherCost: money.optional(),
    collected: money.optional(),
    note: optText(2000),
    projectId: id.nullable().optional(),
  }),
  add_note: z.object({
    projectId: id.describe(D.projectId),
    content: z.string().trim().min(1).max(4000),
    type: z.enum(["NOTE", "FEEDBACK"]).optional().describe("NOTE (ghi chú) hoặc FEEDBACK (phản hồi). Mặc định NOTE."),
  }),
} satisfies Record<WriteTool, z.ZodType>;

type Input<T extends WriteTool> = z.infer<(typeof INPUTS)[T]>;

const WRITE_DESCRIPTIONS: Record<WriteTool, string> = {
  create_project: "Đề xuất tạo dự án mới. Không ghi ngay: người dùng xem và bấm Áp dụng.",
  update_project: "Đề xuất sửa tên, mô tả, trạng thái hoặc ngày của một dự án. Chỉ gửi các trường cần đổi.",
  create_category: "Đề xuất thêm hạng mục (hoặc hạng mục con) vào dự án.",
  update_category: "Đề xuất sửa tên hoặc ngày của một hạng mục.",
  create_task: "Đề xuất thêm công việc (hoặc task con) vào dự án, có thể giao người phụ trách.",
  update_task: "Đề xuất sửa công việc: trạng thái, tiến độ, người phụ trách, hạn… Chỉ gửi các trường cần đổi.",
  create_contract: "Đề xuất tạo hợp đồng (số HĐ, đối tác, giá trị, chi phí, đã thu). Cần quyền Hợp đồng & chi phí.",
  update_contract: "Đề xuất sửa hợp đồng. Chỉ gửi các trường cần đổi. Cần quyền Hợp đồng & chi phí.",
  add_note: "Đề xuất thêm ghi chú hoặc phản hồi vào dự án.",
};

const READ_INPUTS = {
  find_projects: z.object({ query: z.string().trim().max(200).optional().describe("Từ khoá trong tên dự án; bỏ trống để liệt kê.") }),
  get_project: z.object({ projectId: id }),
  find_users: z.object({ query: z.string().trim().max(200).optional().describe("Từ khoá trong tên, email hoặc chức danh.") }),
  find_contracts: z.object({ query: z.string().trim().max(200).optional().describe("Từ khoá trong tên, số HĐ hoặc đối tác."), projectId: id.optional() }),
};
type ReadTool = keyof typeof READ_INPUTS;

const READ_DESCRIPTIONS: Record<ReadTool, string> = {
  find_projects: "Tìm dự án người dùng được xem: id, tên, trạng thái, ngày, tiến độ.",
  get_project: "Xem chi tiết một dự án: thành viên, hạng mục, công việc (id, trạng thái, người phụ trách, hạn) và quyền của người dùng trên dự án.",
  find_users: "Tìm người dùng đang hoạt động (id, tên, chức danh) để giao việc hoặc thêm vào dự án.",
  find_contracts: "Tìm hợp đồng (id, số HĐ, đối tác, giá trị, dự án). Cần quyền Hợp đồng & chi phí.",
};

function jsonSchema(schema: z.ZodType): Anthropic.Beta.BetaTool.InputSchema {
  const out = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  delete out.$schema;
  return { ...out, type: "object" } as Anthropic.Beta.BetaTool.InputSchema;
}

/** All tool definitions, read tools first. Stable, so they stay in the cached prefix. */
export const AGENT_TOOL_DEFINITIONS: Anthropic.Beta.BetaTool[] = [
  ...(Object.keys(READ_INPUTS) as ReadTool[]).map((name) => ({ name, description: READ_DESCRIPTIONS[name], input_schema: jsonSchema(READ_INPUTS[name]) })),
  ...(Object.keys(INPUTS) as WriteTool[]).map((name) => ({ name, description: WRITE_DESCRIPTIONS[name], input_schema: jsonSchema(INPUTS[name]) })),
];

// ----------------------------------------------------------------------------
// Formatting
// ----------------------------------------------------------------------------

const showDay = (v: string) => v.split("-").reverse().join("/");
const showDate = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: APP_TIMEZONE }).format(new Date(d)) : "—";
const isoDay = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: APP_TIMEZONE }).format(new Date(d)) : null;
const short = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const quoted = (s: string) => `“${short(s, 120)}”`;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
const matches = (query: string | undefined, ...fields: (string | null | undefined)[]) =>
  !query || fields.some((f) => f && fold(f).includes(fold(query)));

/** A calendar day in the business time zone as the instant the forms send (start or end of the day). */
export function dayToIso(value: string, edge: "start" | "end"): string {
  const [y, m, d] = value.split("-").map(Number);
  const at = edge === "end" ? new TZDate(y, m - 1, d, 23, 59, 59, APP_TIMEZONE) : new TZDate(y, m - 1, d, 0, 0, 0, APP_TIMEZONE);
  return new Date(at.getTime()).toISOString();
}

const dayField = (v: string | null | undefined, edge: "start" | "end") => (v === undefined ? undefined : v === null ? null : dayToIso(v, edge));

// ----------------------------------------------------------------------------
// Read tools
// ----------------------------------------------------------------------------

async function runRead(me: CurrentUser, name: ReadTool, raw: unknown): Promise<unknown> {
  if (name === "find_projects") {
    const { query } = READ_INPUTS.find_projects.parse(raw);
    const projects = (await listProjects(me)).filter((p) => matches(query, p.name, p.description));
    return {
      total: projects.length,
      projects: projects.slice(0, 40).map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        startDate: isoDay(p.startDate),
        dueDate: isoDay(p.dueDate),
        progress: p.progress,
        owner: p.owner?.name ?? null,
        tasks: p.totalTasks,
        doneTasks: p.doneTasks,
      })),
    };
  }
  if (name === "get_project") {
    const { projectId } = READ_INPUTS.get_project.parse(raw);
    const ws = await loadWorkspace(me, projectId);
    if (!ws) throw new ToolError("Không tìm thấy dự án hoặc người dùng không được xem dự án này.");
    const p = ws.project;
    return {
      id: p.id,
      name: p.name,
      description: p.description ? short(p.description, 1000) : null,
      status: p.status,
      startDate: isoDay(p.startDate),
      dueDate: isoDay(p.dueDate),
      progress: p.progress,
      yourRights: { manage: ws.canManage, contribute: ws.canContribute },
      owner: p.owner?.name ?? null,
      members: p.members.map((m) => ({ id: m.id, name: m.name, role: m.projectRole })),
      categories: p.categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId, startDate: isoDay(c.startDate), dueDate: isoDay(c.dueDate) })),
      totalTasks: p.tasks.length,
      tasks: p.tasks.slice(0, 150).map((t) => ({
        id: t.id,
        title: short(t.title, 200),
        status: t.status,
        priority: t.priority,
        progress: t.effectiveProgress,
        assignee: t.assignee?.name ?? null,
        assigneeId: t.assigneeId,
        categoryId: t.categoryId,
        parentId: t.parentId,
        dueDate: isoDay(t.dueDate),
      })),
    };
  }
  if (name === "find_users") {
    const { query } = READ_INPUTS.find_users.parse(raw);
    const users = await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, jobTitle: true, email: true } });
    const found = users.filter((u) => matches(query, u.name, u.email, u.jobTitle));
    return { total: found.length, users: found.slice(0, 40).map((u) => ({ id: u.id, name: u.name, jobTitle: u.jobTitle })) };
  }
  const { query, projectId } = READ_INPUTS.find_contracts.parse(raw);
  if (!hasPermission(me, "FINANCE_MANAGE")) throw new ToolError("Người dùng chưa có quyền Hợp đồng & chi phí.");
  const contracts = await prisma.contract.findMany({
    where: projectId ? { projectId } : {},
    orderBy: { performedAt: "desc" },
    take: 500,
    select: { id: true, code: true, name: true, partner: true, value: true, status: true, performedAt: true, collected: true, project: { select: { id: true, name: true } } },
  });
  const found = contracts.filter((c) => matches(query, c.name, c.code, c.partner));
  return {
    total: found.length,
    contracts: found.slice(0, 40).map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      partner: c.partner,
      value: Number(c.value),
      collected: Number(c.collected),
      status: c.status,
      performedAt: isoDay(c.performedAt),
      project: c.project ? { id: c.project.id, name: c.project.name } : null,
    })),
  };
}

/** A tool call Claude should correct (shown to it as an error result, not to the person). */
export class ToolError extends Error {}

// ----------------------------------------------------------------------------
// Proposals
// ----------------------------------------------------------------------------

type RefKind = "project" | "category" | "task" | "contract";
const REF_KIND: Partial<Record<WriteTool, RefKind>> = { create_project: "project", create_category: "category", create_task: "task", create_contract: "contract" };

/** Per answer: refs proposed so far, and names looked up once. */
interface ProposalContext {
  me: CurrentUser;
  refs: Map<string, { kind: RefKind; label: string; projectRef?: string; projectId?: string }>;
  users?: Map<string, string>;
  count: number;
}

async function userName(ctx: ProposalContext, userId: string): Promise<string> {
  if (!ctx.users) {
    const users = await prisma.user.findMany({ where: { active: true }, select: { id: true, name: true } });
    ctx.users = new Map(users.map((u) => [u.id, u.name]));
  }
  const name = ctx.users.get(userId);
  if (!name) throw new ToolError(`Không có người dùng đang hoạt động với id ${userId}. Dùng find_users để lấy đúng id.`);
  return name;
}

function refOf(ctx: ProposalContext, value: string, kind: RefKind) {
  const m = REF.exec(value);
  if (!m) return null;
  const ref = ctx.refs.get(m[1]);
  if (!ref) throw new ToolError(`Chưa có đề xuất nào đặt ref "${m[1]}" trong câu trả lời này.`);
  if (ref.kind !== kind) throw new ToolError(`ref "${m[1]}" là một ${ref.kind}, không dùng được ở đây.`);
  return ref;
}

/** Project for a new item: an existing one the caller may add to, or a project proposed earlier. */
async function projectTarget(ctx: ProposalContext, projectId: string, need: "manage" | "contribute" | "view") {
  const ref = refOf(ctx, projectId, "project");
  if (ref) return { label: `dự án mới ${ref.label}`, projectId: undefined, projectRef: projectId };
  const access = await projectAccess(ctx.me, projectId);
  const project = access.view ? await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }) : null;
  if (!project) throw new ToolError("Không tìm thấy dự án hoặc người dùng không được xem dự án này. Dùng find_projects để lấy đúng id.");
  if (need === "manage" && !access.manage) throw new ToolError(`Người dùng không có quyền quản lý dự án “${project.name}”.`);
  if (need === "contribute" && !access.contribute) throw new ToolError(`Người dùng chỉ có quyền xem dự án “${project.name}”.`);
  return { label: `“${project.name}”`, projectId, projectRef: undefined };
}

async function categoryLabel(ctx: ProposalContext, categoryId: string, project: { projectId?: string; projectRef?: string }) {
  const ref = refOf(ctx, categoryId, "category");
  if (ref) {
    if ((project.projectRef ?? project.projectId) !== (ref.projectRef ?? ref.projectId)) throw new ToolError(`Hạng mục ref "${categoryId}" thuộc dự án khác.`);
    return `hạng mục mới ${ref.label}`;
  }
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { name: true, projectId: true } });
  if (!category || category.projectId !== project.projectId) throw new ToolError("Không tìm thấy hạng mục trong dự án này. Dùng get_project để lấy đúng id.");
  return `“${category.name}”`;
}

const change = (label: string, from: string, to: string) => (from === to ? null : `${label}: ${from} → ${to}`);
const dayChange = (label: string, before: Date | null, next: string | null | undefined) =>
  next === undefined ? null : change(label, showDate(before), next ? showDay(next) : "—");

async function buildProposal(ctx: ProposalContext, callId: string, tool: WriteTool, raw: unknown): Promise<AgentAction> {
  const parsed = INPUTS[tool].safeParse(raw);
  if (!parsed.success) {
    throw new ToolError(`Dữ liệu chưa hợp lệ: ${parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`);
  }
  const input = parsed.data as Record<string, unknown>;
  const lines: string[] = [];
  const push = (line: string | null | false | undefined) => line && lines.push(line);
  let title: string;
  let target: string;
  let refMeta: { projectRef?: string; projectId?: string } = {};

  switch (tool) {
    case "create_project": {
      const d = input as Input<"create_project">;
      if (!canCreateProject(ctx.me)) throw new ToolError("Người dùng chưa được cấp quyền “Tạo dự án”.");
      title = "Tạo dự án";
      target = quoted(d.name);
      push(`Trạng thái: ${PROJECT_STATUS[d.status ?? "PLANNING"].label}`);
      push(d.startDate && `Bắt đầu: ${showDay(d.startDate)}`);
      push(d.dueDate && `Hạn: ${showDay(d.dueDate)}`);
      push(d.description && `Mô tả: ${short(d.description)}`);
      if (d.members?.length) {
        const names = await Promise.all(d.members.map(async (m) => `${await userName(ctx, m.userId)}${m.role && m.role !== "MEMBER" ? ` (${m.role === "MANAGER" ? "quản lý" : "chỉ xem"})` : ""}`));
        push(`Thành viên: ${names.join(", ")}`);
      }
      break;
    }
    case "update_project": {
      const d = input as Input<"update_project">;
      if (!(await canManageProject(ctx.me, d.projectId))) throw new ToolError("Không tìm thấy dự án hoặc người dùng không có quyền quản lý dự án này.");
      const p = await prisma.project.findUnique({ where: { id: d.projectId }, select: { name: true, description: true, status: true, startDate: true, dueDate: true } });
      if (!p) throw new ToolError("Không tìm thấy dự án.");
      title = "Cập nhật dự án";
      target = quoted(p.name);
      push(d.name !== undefined && change("Tên", p.name, d.name));
      push(d.status && change("Trạng thái", PROJECT_STATUS[p.status as keyof typeof PROJECT_STATUS]?.label ?? p.status, PROJECT_STATUS[d.status].label));
      push(dayChange("Bắt đầu", p.startDate, d.startDate));
      push(dayChange("Hạn", p.dueDate, d.dueDate));
      push(d.description !== undefined && (d.description ? `Mô tả mới: ${short(d.description)}` : "Xoá mô tả"));
      break;
    }
    case "create_category": {
      const d = input as Input<"create_category">;
      const project = await projectTarget(ctx, d.projectId, "manage");
      refMeta = { projectId: project.projectId, projectRef: project.projectRef };
      title = d.parentId ? "Thêm hạng mục con" : "Thêm hạng mục";
      target = quoted(d.name);
      push(`Dự án: ${project.label}`);
      push(d.parentId && `Thuộc hạng mục: ${await categoryLabel(ctx, d.parentId, project)}`);
      push(d.startDate && `Bắt đầu: ${showDay(d.startDate)}`);
      push(d.dueDate && `Hạn: ${showDay(d.dueDate)}`);
      break;
    }
    case "update_category": {
      const d = input as Input<"update_category">;
      const c = await prisma.category.findUnique({ where: { id: d.categoryId }, select: { name: true, projectId: true, startDate: true, dueDate: true, project: { select: { name: true } } } });
      if (!c || !(await canManageProject(ctx.me, c.projectId))) throw new ToolError("Không tìm thấy hạng mục hoặc người dùng không có quyền quản lý dự án của nó.");
      title = "Cập nhật hạng mục";
      target = `${quoted(c.name)} · dự án “${c.project.name}”`;
      push(d.name !== undefined && change("Tên", c.name, d.name));
      push(dayChange("Bắt đầu", c.startDate, d.startDate));
      push(dayChange("Hạn", c.dueDate, d.dueDate));
      break;
    }
    case "create_task": {
      const d = input as Input<"create_task">;
      const project = await projectTarget(ctx, d.projectId, "contribute");
      refMeta = { projectId: project.projectId, projectRef: project.projectRef };
      title = d.parentId ? "Thêm task con" : "Thêm công việc";
      target = quoted(d.title);
      push(`Dự án: ${project.label}`);
      push(d.categoryId && `Hạng mục: ${await categoryLabel(ctx, d.categoryId, project)}`);
      if (d.parentId) {
        const ref = refOf(ctx, d.parentId, "task");
        if (ref) push(`Thuộc công việc: công việc mới ${ref.label}`);
        else {
          const parent = await prisma.task.findUnique({ where: { id: d.parentId }, select: { title: true, projectId: true } });
          if (!parent || parent.projectId !== project.projectId) throw new ToolError("Không tìm thấy công việc cha trong dự án này.");
          push(`Thuộc công việc: “${short(parent.title, 80)}”`);
        }
      }
      push(d.assigneeId && `Phụ trách: ${await userName(ctx, d.assigneeId)}`);
      push(`Trạng thái: ${TASK_STATUS[d.status ?? "TODO"].label} · Ưu tiên: ${PRIORITY[d.priority ?? "MEDIUM"].label}`);
      push(d.startDate && `Bắt đầu: ${showDay(d.startDate)}`);
      push(d.dueDate && `Hạn: ${showDay(d.dueDate)}`);
      push(d.description && `Mô tả: ${short(d.description)}`);
      break;
    }
    case "update_task": {
      const d = input as Input<"update_task">;
      const loaded = await loadTaskForUser(ctx.me, d.taskId);
      if (!loaded) throw new ToolError("Không tìm thấy công việc hoặc người dùng không được xem công việc này.");
      const t = await prisma.task.findUnique({
        where: { id: d.taskId },
        select: { title: true, status: true, priority: true, progress: true, startDate: true, dueDate: true, assigneeId: true, assignee: { select: { name: true } }, project: { select: { name: true } }, categoryId: true, category: { select: { name: true } } },
      });
      if (!t) throw new ToolError("Không tìm thấy công việc.");
      title = "Cập nhật công việc";
      target = `${quoted(t.title)} · dự án “${t.project.name}”`;
      push(d.title !== undefined && change("Tên", t.title, d.title));
      push(d.status && change("Trạng thái", TASK_STATUS[t.status as keyof typeof TASK_STATUS]?.label ?? t.status, TASK_STATUS[d.status].label));
      push(d.priority && change("Ưu tiên", PRIORITY[t.priority as keyof typeof PRIORITY]?.label ?? t.priority, PRIORITY[d.priority].label));
      push(d.progress !== undefined && change("Tiến độ", `${t.progress}%`, `${d.progress}%`));
      if (d.assigneeId !== undefined) push(change("Phụ trách", t.assignee?.name ?? "—", d.assigneeId ? await userName(ctx, d.assigneeId) : "—"));
      if (d.categoryId !== undefined) {
        let next = "—";
        if (d.categoryId) {
          const c = await prisma.category.findUnique({ where: { id: d.categoryId }, select: { name: true, projectId: true } });
          const task = await prisma.task.findUnique({ where: { id: d.taskId }, select: { projectId: true } });
          if (!c || c.projectId !== task?.projectId) throw new ToolError("Hạng mục không thuộc dự án của công việc này.");
          next = c.name;
        }
        push(change("Hạng mục", t.category?.name ?? "—", next));
      }
      push(dayChange("Bắt đầu", t.startDate, d.startDate));
      push(dayChange("Hạn", t.dueDate, d.dueDate));
      push(d.description !== undefined && (d.description ? `Mô tả mới: ${short(d.description)}` : "Xoá mô tả"));
      break;
    }
    case "create_contract": {
      const d = input as Input<"create_contract">;
      if (!hasPermission(ctx.me, "FINANCE_MANAGE")) throw new ToolError("Người dùng chưa có quyền “Hợp đồng & chi phí”.");
      title = "Tạo hợp đồng";
      target = quoted(d.name);
      push(d.code && `Số HĐ: ${d.code}`);
      push(d.partner && `Đối tác: ${d.partner}`);
      push(`Giá trị: ${formatVnd(d.value)} · Ngày thực hiện: ${showDay(d.performedAt)}`);
      push(`Trạng thái: ${CONTRACT_STATUS[d.status ?? "IN_PROGRESS"].label}`);
      const costs = [d.trainingCost && `đào tạo ${formatVnd(d.trainingCost)}`, d.examCost && `khảo thí ${formatVnd(d.examCost)}`, d.otherCost && `khác ${formatVnd(d.otherCost)}`].filter(Boolean);
      push(costs.length > 0 && `Chi phí: ${costs.join(", ")}`);
      push(!!d.collected && `Đã thu: ${formatVnd(d.collected)}`);
      if (d.projectId) {
        const project = await projectTarget(ctx, d.projectId, "view");
        push(`Dự án: ${project.label}`);
      }
      push(d.note && `Ghi chú: ${short(d.note)}`);
      break;
    }
    case "update_contract": {
      const d = input as Input<"update_contract">;
      if (!hasPermission(ctx.me, "FINANCE_MANAGE")) throw new ToolError("Người dùng chưa có quyền “Hợp đồng & chi phí”.");
      const c = await prisma.contract.findUnique({ where: { id: d.contractId }, include: { project: { select: { name: true } } } });
      if (!c) throw new ToolError("Không tìm thấy hợp đồng. Dùng find_contracts để lấy đúng id.");
      title = "Cập nhật hợp đồng";
      target = `${quoted(c.name)}${c.code ? ` (${c.code})` : ""}`;
      push(d.name !== undefined && change("Tên", c.name, d.name));
      push(d.code !== undefined && change("Số HĐ", c.code ?? "—", d.code || "—"));
      push(d.partner !== undefined && change("Đối tác", c.partner ?? "—", d.partner || "—"));
      push(d.status && change("Trạng thái", CONTRACT_STATUS[c.status as keyof typeof CONTRACT_STATUS]?.label ?? c.status, CONTRACT_STATUS[d.status].label));
      push(d.performedAt && change("Ngày thực hiện", showDate(c.performedAt), showDay(d.performedAt)));
      for (const [key, label] of [["value", "Giá trị"], ["trainingCost", "Chi phí đào tạo"], ["examCost", "Chi phí khảo thí"], ["otherCost", "Chi phí khác"], ["collected", "Đã thu"]] as const) {
        const next = d[key];
        if (next !== undefined) push(change(label, formatVnd(Number(c[key])), formatVnd(next)));
      }
      if (d.projectId !== undefined) {
        const next = d.projectId ? (await projectTarget(ctx, d.projectId, "view")).label : "—";
        push(change("Dự án", c.project ? `“${c.project.name}”` : "—", next));
      }
      push(d.note !== undefined && (d.note ? `Ghi chú mới: ${short(d.note)}` : "Xoá ghi chú"));
      break;
    }
    case "add_note": {
      const d = input as Input<"add_note">;
      const project = await projectTarget(ctx, d.projectId, "view");
      title = d.type === "FEEDBACK" ? "Thêm phản hồi" : "Thêm ghi chú";
      target = `vào dự án ${project.label}`;
      push(`${NOTE_TYPE[d.type ?? "NOTE"].label}: ${short(d.content, 300)}`);
      break;
    }
  }
  if (!tool.startsWith("create_") && tool !== "add_note" && !lines.length) throw new ToolError("Không có trường nào thay đổi so với hiện tại.");

  const ref = typeof input.ref === "string" ? input.ref : undefined;
  const kind = REF_KIND[tool];
  if (ref && kind) {
    if (ctx.refs.has(ref)) throw new ToolError(`ref "${ref}" đã được dùng trong câu trả lời này; hãy đặt tên khác.`);
    ctx.refs.set(ref, { ...refMeta, kind, label: target });
  }
  return { id: callId, tool, input, title, target, lines, ...(ref && kind ? { ref } : {}) };
}

// ----------------------------------------------------------------------------
// For the chat stream (lib/ai-run.ts)
// ----------------------------------------------------------------------------

export interface ToolOutcome {
  content: string;
  isError?: boolean;
  action?: AgentAction;
}

/** Runs one answer's tool calls: reads at once, writes as proposals. */
export function agentToolRunner(me: CurrentUser) {
  const ctx: ProposalContext = { me, refs: new Map(), count: 0 };
  return async (call: { id: string; name: string; input: unknown }): Promise<ToolOutcome> => {
    try {
      if (isWriteTool(call.name)) {
        if (ctx.count >= MAX_AGENT_ACTIONS) {
          return { isError: true, content: `Đã đủ ${MAX_AGENT_ACTIONS} đề xuất trong câu trả lời này. Dừng lại để người dùng áp dụng trước, rồi tiếp tục ở câu sau.` };
        }
        const action = await buildProposal(ctx, call.id, call.name, call.input);
        ctx.count++;
        return {
          action,
          content: `Đã ghi nhận đề xuất ${ctx.count}: ${action.title} ${action.target}. CHƯA thực hiện: người dùng sẽ xem và bấm “Áp dụng”.${action.ref ? ` Các đề xuất sau dùng "ref:${action.ref}" để chỉ mục này.` : ""}`,
        };
      }
      if (call.name in READ_INPUTS) return { content: JSON.stringify(await runRead(me, call.name as ReadTool, call.input)) };
      return { isError: true, content: `Không có công cụ ${call.name}.` };
    } catch (err) {
      if (err instanceof ToolError) return { isError: true, content: err.message };
      if (err instanceof z.ZodError) return { isError: true, content: `Dữ liệu chưa hợp lệ: ${err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` };
      console.error("[ai] tool failed", call.name, err);
      return { isError: true, content: "Công cụ gặp lỗi khi chạy. Hãy thử cách khác hoặc báo người dùng." };
    }
  };
}

// ----------------------------------------------------------------------------
// For applying (app/api/ai/actions)
// ----------------------------------------------------------------------------

export interface ActionRequest {
  method: "POST" | "PATCH";
  /** Route and its [id] param. */
  route: "projects" | "project" | "projectCategories" | "category" | "tasks" | "task" | "contracts" | "contract" | "projectNotes";
  id?: string;
  body: Record<string, unknown>;
}

/**
 * Re-validate a proposal's input and turn it into the request the normal API takes.
 * `resolve` maps "ref:<name>" to the id an earlier applied action created (or throws).
 */
export function actionRequest(tool: WriteTool, raw: unknown, resolve: (value: string) => string): ActionRequest {
  const parsed = INPUTS[tool].safeParse(raw);
  if (!parsed.success) throw new ToolError(`Dữ liệu chưa hợp lệ: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const ref = (v: string | null | undefined) => (v ? (REF.test(v) ? resolve(v) : v) : v);
  const omit = <T extends Record<string, unknown>>(o: T, ...keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k, v]) => !keys.includes(k) && v !== undefined));
  switch (tool) {
    case "create_project": {
      const d = parsed.data as Input<"create_project">;
      return {
        method: "POST",
        route: "projects",
        body: omit({ ...d, startDate: dayField(d.startDate, "start"), dueDate: dayField(d.dueDate, "end"), members: d.members?.map((m) => ({ userId: m.userId, role: m.role ?? "MEMBER" })) }, "ref"),
      };
    }
    case "update_project": {
      const d = parsed.data as Input<"update_project">;
      return { method: "PATCH", route: "project", id: d.projectId, body: omit({ ...d, startDate: dayField(d.startDate, "start"), dueDate: dayField(d.dueDate, "end") }, "projectId") };
    }
    case "create_category": {
      const d = parsed.data as Input<"create_category">;
      return { method: "POST", route: "projectCategories", id: ref(d.projectId)!, body: omit({ ...d, parentId: ref(d.parentId), startDate: dayField(d.startDate, "start"), dueDate: dayField(d.dueDate, "end") }, "ref", "projectId") };
    }
    case "update_category": {
      const d = parsed.data as Input<"update_category">;
      return { method: "PATCH", route: "category", id: d.categoryId, body: omit({ ...d, startDate: dayField(d.startDate, "start"), dueDate: dayField(d.dueDate, "end") }, "categoryId") };
    }
    case "create_task": {
      const d = parsed.data as Input<"create_task">;
      return {
        method: "POST",
        route: "tasks",
        body: omit({ ...d, projectId: ref(d.projectId), categoryId: ref(d.categoryId), parentId: ref(d.parentId), startDate: dayField(d.startDate, "start"), dueDate: dayField(d.dueDate, "end") }, "ref"),
      };
    }
    case "update_task": {
      const d = parsed.data as Input<"update_task">;
      return { method: "PATCH", route: "task", id: d.taskId, body: omit({ ...d, startDate: dayField(d.startDate, "start"), dueDate: dayField(d.dueDate, "end") }, "taskId") };
    }
    case "create_contract": {
      const d = parsed.data as Input<"create_contract">;
      return { method: "POST", route: "contracts", body: omit({ ...d, projectId: ref(d.projectId) }, "ref") };
    }
    case "update_contract": {
      const d = parsed.data as Input<"update_contract">;
      return { method: "PATCH", route: "contract", id: d.contractId, body: omit({ ...d }, "contractId") };
    }
    case "add_note": {
      const d = parsed.data as Input<"add_note">;
      return { method: "POST", route: "projectNotes", id: ref(d.projectId)!, body: omit({ content: d.content, type: d.type }) };
    }
  }
}
