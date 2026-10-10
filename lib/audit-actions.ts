// Audit log actions: shared by the server (lib/audit.ts) and the admin log view
// (no server-only imports). Keys are stored in AuditLog.action, so never rename one;
// add a new key instead.

export const AUDIT_GROUPS = {
  auth: "Đăng nhập & mật khẩu",
  user: "Tài khoản & phân quyền",
  project: "Dự án & hạng mục",
  task: "Công việc & báo cáo",
  contract: "Hợp đồng & hồ sơ",
  workReport: "Báo cáo tuần/tháng",
  ai: "Trợ lý AI",
  system: "Hệ thống & sao lưu",
} as const;
export type AuditGroup = keyof typeof AUDIT_GROUPS;

export const AUDIT_ACTIONS = {
  "auth.login": { label: "Đăng nhập", group: "auth" },
  "auth.login_failed": { label: "Đăng nhập thất bại", group: "auth" },
  "auth.logout": { label: "Đăng xuất", group: "auth" },
  "auth.password_change": { label: "Đổi mật khẩu", group: "auth" },

  "user.create": { label: "Tạo tài khoản", group: "user" },
  "user.update": { label: "Sửa tài khoản", group: "user" },
  "user.role_change": { label: "Đổi cấp bậc", group: "user" },
  "user.permissions_change": { label: "Đổi quyền", group: "user" },
  "user.password_reset": { label: "Đặt lại mật khẩu", group: "user" },
  "user.deactivate": { label: "Khoá tài khoản", group: "user" },
  "user.activate": { label: "Mở khoá tài khoản", group: "user" },

  "project.create": { label: "Tạo dự án", group: "project" },
  "project.update": { label: "Sửa dự án", group: "project" },
  "project.delete": { label: "Xoá dự án", group: "project" },
  "project.members_change": { label: "Đổi thành viên dự án", group: "project" },
  "category.create": { label: "Tạo hạng mục", group: "project" },
  "category.update": { label: "Sửa hạng mục", group: "project" },
  "category.delete": { label: "Xoá hạng mục", group: "project" },
  "note.delete": { label: "Xoá ghi chú", group: "project" },

  "task.create": { label: "Tạo công việc", group: "task" },
  "task.update": { label: "Sửa công việc", group: "task" },
  "task.delete": { label: "Xoá công việc", group: "task" },
  "task_report.create": { label: "Gửi báo cáo công việc", group: "task" },
  "task_report.review": { label: "Duyệt báo cáo công việc", group: "task" },

  "contract.create": { label: "Tạo hợp đồng", group: "contract" },
  "contract.update": { label: "Sửa hợp đồng", group: "contract" },
  "contract.delete": { label: "Xoá hợp đồng", group: "contract" },
  "contract.import": { label: "Nhập hợp đồng từ Excel", group: "contract" },
  "contract_file.upload": { label: "Tải lên file hợp đồng", group: "contract" },
  "contract_file.delete": { label: "Xoá file hợp đồng", group: "contract" },

  "work_report.submit": { label: "Nộp báo cáo tuần/tháng", group: "workReport" },
  "work_report.review": { label: "Đánh dấu đã xem báo cáo", group: "workReport" },

  "ai.generate": { label: "Viết báo cáo bằng AI", group: "ai" },
  "ai.chat": { label: "Trò chuyện với AI", group: "ai" },
  "settings.ai_update": { label: "Đổi cài đặt AI / API key", group: "ai" },

  "backup.download": { label: "Tải bản sao lưu", group: "system" },
} as const satisfies Record<string, { label: string; group: AuditGroup }>;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export function auditActionLabel(action: string): string {
  return (AUDIT_ACTIONS as Record<string, { label: string }>)[action]?.label ?? action;
}

/** Actions of one group, for the log filter. */
export function auditActionsIn(group: AuditGroup): AuditAction[] {
  return (Object.keys(AUDIT_ACTIONS) as AuditAction[]).filter((a) => AUDIT_ACTIONS[a].group === group);
}

/** How long entries are kept; the daily maintenance job deletes older ones. */
export const AUDIT_RETENTION_DAYS = 365;
