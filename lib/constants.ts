// Shared display constants (Vietnamese labels + colors) for enums.

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý",
  MEMBER: "Nhân viên",
};

export const PROJECT_STATUS = {
  PLANNING: { label: "Lên kế hoạch", color: "#8b5cf6", bg: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  ACTIVE: { label: "Đang thực hiện", color: "#3b82f6", bg: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  ON_HOLD: { label: "Tạm dừng", color: "#f59e0b", bg: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  COMPLETED: { label: "Hoàn thành", color: "#22c55e", bg: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300" },
  CANCELLED: { label: "Đã huỷ", color: "#ef4444", bg: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
} as const;

// Status hues match lib/chart-theme.ts (validated for color-vision deficiency).
export const TASK_STATUS = {
  TODO: { label: "Cần làm", color: "#94a3b8", bg: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300" },
  IN_PROGRESS: { label: "Đang làm", color: "#2a78d6", bg: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  REVIEW: { label: "Chờ duyệt", color: "#eb6834", bg: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  DONE: { label: "Hoàn thành", color: "#1baf7a", bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  BLOCKED: { label: "Bị chặn", color: "#d03b3b", bg: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
} as const;

export const PRIORITY = {
  LOW: { label: "Thấp", color: "#64748b", bg: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300" },
  MEDIUM: { label: "Trung bình", color: "#3b82f6", bg: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  HIGH: { label: "Cao", color: "#f59e0b", bg: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  URGENT: { label: "Khẩn cấp", color: "#ef4444", bg: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
} as const;

export const NOTE_TYPE = {
  NOTE: { label: "Ghi chú", color: "#64748b" },
  FEEDBACK: { label: "Phản hồi", color: "#8b5cf6" },
} as const;

/** Preset colors offered when creating projects/categories (identity swatches). */
export const SWATCHES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

export type ProjectStatusKey = keyof typeof PROJECT_STATUS;
export type TaskStatusKey = keyof typeof TASK_STATUS;
export type PriorityKey = keyof typeof PRIORITY;
