import { z } from "zod";
import { AI_MODELS, MAX_AI_DAILY_LIMIT, looksLikeAnthropicKey, type AiModelId } from "./ai-models";
import { PERMISSIONS, PROJECT_ROLES, ROLES } from "./permissions";
import { CONTRACT_STATUSES } from "./finance";
import { parseDate } from "./period";

const roleEnum = z.enum(ROLES);
const permissionList = z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length);
const projectRoleEnum = z.enum(PROJECT_ROLES);
const projectStatusEnum = z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]);
const taskStatusEnum = z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"]);
const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const noteTypeEnum = z.enum(["NOTE", "FEEDBACK"]);

// Accounts sign in with an email address or a short username (e.g. "admin").
const USERNAME = /^[a-z0-9._-]{3,32}$/;
const loginId = z
  .string()
  .trim()
  .toLowerCase()
  .refine(
    (v) => USERNAME.test(v) || z.string().email().safeParse(v).success,
    "Nhập email hợp lệ hoặc tên đăng nhập (3–32 ký tự: chữ thường, số, . _ -)",
  );

export const loginSchema = z.object({
  // Kept as `email` in the API body for compatibility; holds an email or username.
  email: z.string().trim().min(1, "Vui lòng nhập email hoặc tên đăng nhập"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
  newPassword: z.string().min(8, "Mật khẩu mới phải có ít nhất 8 ký tự"),
});

export const createUserSchema = z.object({
  email: loginId,
  name: z.string().min(2, "Tên quá ngắn"),
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự"),
  role: roleEnum.default("MEMBER"),
  /** Extra permissions beyond the level's defaults. */
  permissions: permissionList.optional(),
  jobTitle: z.string().optional().nullable(),
});

export const updateUserSchema = z.object({
  email: loginId.optional(),
  name: z.string().min(2).optional(),
  role: roleEnum.optional(),
  permissions: permissionList.optional(),
  jobTitle: z.string().optional().nullable(),
  active: z.boolean().optional(),
  resetPassword: z.string().min(8).optional(),
});

// undefined -> leave unchanged; null or "" -> clear; ISO string -> Date.
const dateish = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v ? new Date(v) : null))
  .refine((v) => v == null || !Number.isNaN(v.getTime()), "Ngày không hợp lệ");

/** Project members with their role in the project (the owner is always a manager). */
const projectMembers = z
  .array(z.object({ userId: z.string().min(1), role: projectRoleEnum.default("MEMBER") }))
  .max(500);

export const createProjectSchema = z.object({
  name: z.string().min(2, "Tên dự án quá ngắn"),
  description: z.string().optional().nullable(),
  status: projectStatusEnum.default("PLANNING"),
  color: z.string().optional(),
  startDate: dateish,
  dueDate: dateish,
  memberIds: z.array(z.string()).optional(),
  members: projectMembers.optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  status: projectStatusEnum.optional(),
  color: z.string().optional(),
  startDate: dateish,
  dueDate: dateish,
  /** Replace the member list; existing members keep their role. Prefer `members`. */
  memberIds: z.array(z.string()).optional(),
  /** Replace the member list with explicit project roles. */
  members: projectMembers.optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1, "Tên hạng mục không được trống"),
  color: z.string().optional(),
  order: z.number().int().optional(),
  /** Set to a main category's id to make this a sub-category; null = main category. */
  parentId: z.string().optional().nullable(),
  startDate: dateish,
  dueDate: dateish,
});

export const createTaskSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được trống"),
  description: z.string().optional().nullable(),
  projectId: z.string().min(1),
  categoryId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  status: taskStatusEnum.default("TODO"),
  priority: priorityEnum.default("MEDIUM"),
  progress: z.number().int().min(0).max(100).default(0),
  startDate: dateish,
  dueDate: dateish,
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  status: taskStatusEnum.optional(),
  priority: priorityEnum.optional(),
  progress: z.number().int().min(0).max(100).optional(),
  startDate: dateish,
  dueDate: dateish,
});

export const createReportSchema = z.object({
  content: z.string().min(1, "Nội dung báo cáo không được trống"),
  progress: z.number().int().min(0).max(100).default(0),
  hoursSpent: z.number().min(0).default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

export const reviewReportSchema = z.object({
  reviewNote: z.string().max(2000).optional().nullable(),
  /** When true, the manager also approves the task as DONE. */
  approveTask: z.boolean().optional(),
});

export const createNoteSchema = z.object({
  content: z.string().min(1, "Nội dung không được trống"),
  type: noteTypeEnum.default("NOTE"),
});

// ----------------------------------------------------------------------------
// Contracts & costs (whole VNĐ)
// ----------------------------------------------------------------------------

const MAX_VND = 999_999_999_999_999;
const vnd = z.number({ error: "Số tiền không hợp lệ" }).int("Số tiền phải là số nguyên").min(0, "Số tiền không được âm").max(MAX_VND);
const performedDate = z
  .string()
  .min(1, "Chọn ngày thực hiện")
  // yyyy-mm-dd is a calendar day in the business time zone (APP_TIMEZONE).
  .transform((v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? parseDate(v) : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), "Ngày không hợp lệ");

const contractFields = {
  code: z.string().trim().max(120).optional().nullable(),
  name: z.string().trim().min(1, "Nhập tên hợp đồng").max(300),
  partner: z.string().trim().max(200).optional().nullable(),
  value: vnd,
  performedAt: performedDate,
  status: z.enum(CONTRACT_STATUSES),
  trainingCost: vnd,
  examCost: vnd,
  otherCost: vnd,
  expectedMargin: z.number().min(-100).max(100).optional().nullable(),
  collected: vnd,
  note: z.string().max(2000).optional().nullable(),
  projectId: z.string().optional().nullable(),
};

export const createContractSchema = z.object({
  ...contractFields,
  status: contractFields.status.default("IN_PROGRESS"),
  trainingCost: vnd.default(0),
  examCost: vnd.default(0),
  otherCost: vnd.default(0),
  collected: vnd.default(0),
});
export const updateContractSchema = z.object(contractFields).partial();
export const importContractsSchema = z.object({ rows: z.array(createContractSchema).min(1).max(500) });

// ----------------------------------------------------------------------------
// Weekly / monthly work reports
// ----------------------------------------------------------------------------

// undefined -> leave unchanged; blank -> clear.
const workNote = z
  .string()
  .max(5000, "Tối đa 5000 ký tự")
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v?.trim() ? v.trim() : null));

/** The period is `period` (week|month) + `key` (2026-W41 | 2026-10); no key = the current one. */
export const workReportNotesSchema = z.object({
  period: z.string().min(1),
  key: z.string().optional().nullable(),
  doneNote: workNote,
  doingNote: workNote,
  planNote: workNote,
  issues: workNote,
});

export const reviewWorkReportSchema = z.object({
  reviewNote: z.string().max(2000).optional().nullable(),
});

// ----------------------------------------------------------------------------
// Built-in AI (Claude API)
// ----------------------------------------------------------------------------

export const aiSettingsSchema = z.object({
  /** A new key; null removes the stored one; omitted keeps it. */
  apiKey: z
    .string()
    .trim()
    .refine(looksLikeAnthropicKey, "API key phải bắt đầu bằng “sk-ant-” và không có khoảng trắng")
    .nullable()
    .optional(),
  model: z.enum(AI_MODELS.map((m) => m.id) as [AiModelId, ...AiModelId[]]).optional(),
  enabled: z.boolean().optional(),
  dailyLimit: z.number().int().min(1, "Tối thiểu 1 lượt").max(MAX_AI_DAILY_LIMIT, `Tối đa ${MAX_AI_DAILY_LIMIT} lượt`).optional(),
});

export const aiReportSchema = z.object({
  kind: z.enum(["executive-summary", "status-report", "slide-deck", "risk-analysis"]),
  period: z.string().optional(),
  date: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  projectId: z.string().optional().nullable(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
