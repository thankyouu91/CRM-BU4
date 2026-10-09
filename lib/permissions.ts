// Permission levels: shared by server checks and the UI (no server-only imports).
//
// Effective permissions = what the user's level (role) includes + what someone
// above them granted individually (User.permissions). Managers delegate: they can
// manage accounts below their own level and grant only permissions they hold.

export const ROLES = ["ADMIN", "MANAGER", "LEAD", "MEMBER"] as const;
export type RoleKey = (typeof ROLES)[number];

export const PERMISSIONS = ["PROJECT_CREATE", "PROJECT_VIEW_ALL", "PROJECT_MANAGE_ALL", "USER_MANAGE", "FINANCE_MANAGE"] as const;
export type PermissionKey = (typeof PERMISSIONS)[number];

export const PROJECT_ROLES = ["MANAGER", "MEMBER", "VIEWER"] as const;
export type ProjectRoleKey = (typeof PROJECT_ROLES)[number];

/** Higher number = higher level. Accounts are managed only from a higher level. */
export const ROLE_LEVEL: Record<RoleKey, number> = { ADMIN: 4, MANAGER: 3, LEAD: 2, MEMBER: 1 };

export const ROLE_INFO: Record<RoleKey, { label: string; summary: string }> = {
  ADMIN: { label: "Quản trị viên", summary: "Toàn quyền hệ thống, quản lý mọi tài khoản kể cả quản lý." },
  MANAGER: { label: "Quản lý", summary: "Tạo và quản lý mọi dự án, duyệt báo cáo, quản lý và phân quyền nhân viên cấp dưới." },
  LEAD: { label: "Trưởng nhóm", summary: "Tạo dự án, quản lý dự án của mình và duyệt báo cáo trong đó." },
  MEMBER: { label: "Nhân viên", summary: "Thực hiện công việc được giao và gửi báo cáo. Có thể được cấp thêm quyền." },
};

export const PERMISSION_INFO: Record<PermissionKey, { label: string; description: string }> = {
  PROJECT_CREATE: { label: "Tạo dự án", description: "Tạo dự án mới và trở thành quản lý của dự án đó." },
  PROJECT_VIEW_ALL: { label: "Xem mọi dự án", description: "Xem tất cả dự án và số liệu tổng hợp, kể cả dự án mình không tham gia." },
  PROJECT_MANAGE_ALL: { label: "Quản lý mọi dự án", description: "Sửa mọi dự án, hạng mục, công việc và duyệt mọi báo cáo." },
  USER_MANAGE: { label: "Quản lý nhân viên", description: "Thêm tài khoản, phân quyền, đặt lại mật khẩu cho người ở cấp thấp hơn." },
  FINANCE_MANAGE: { label: "Hợp đồng & chi phí", description: "Xem và cập nhật hợp đồng, chi phí, lợi nhuận và công nợ." },
};

export const PROJECT_ROLE_INFO: Record<ProjectRoleKey, { label: string; description: string }> = {
  MANAGER: { label: "Quản lý dự án", description: "Sửa dự án, hạng mục, thành viên và mọi công việc; duyệt báo cáo." },
  MEMBER: { label: "Thành viên", description: "Tạo công việc, cập nhật và báo cáo việc mình phụ trách." },
  VIEWER: { label: "Chỉ xem", description: "Xem dự án và gửi ghi chú, phản hồi." },
};

/** Permissions each level includes without being granted. */
export const ROLE_DEFAULTS: Record<RoleKey, readonly PermissionKey[]> = {
  ADMIN: PERMISSIONS,
  MANAGER: PERMISSIONS,
  LEAD: ["PROJECT_CREATE"],
  MEMBER: [],
};

function asRole(role: string): RoleKey {
  return (ROLES as readonly string[]).includes(role) ? (role as RoleKey) : "MEMBER";
}

export function roleLevel(role: string): number {
  return ROLE_LEVEL[asRole(role)];
}

/** Role defaults plus individual grants, in canonical order. */
export function effectivePermissions(role: string, granted: readonly string[] = []): PermissionKey[] {
  const set = new Set<string>([...ROLE_DEFAULTS[asRole(role)], ...granted]);
  return PERMISSIONS.filter((p) => set.has(p));
}

export interface Actor {
  id: string;
  role: string;
  permissions: readonly string[]; // effective
}

export function hasPermission(user: Pick<Actor, "role" | "permissions">, permission: PermissionKey): boolean {
  return user.role === "ADMIN" || user.permissions.includes(permission);
}

/** Admins manage everyone; USER_MANAGE holders manage accounts strictly below their level. */
export function canManageUser(actor: Actor, target: { id: string; role: string }): boolean {
  if (actor.role === "ADMIN") return true;
  if (actor.id === target.id) return false;
  return hasPermission(actor, "USER_MANAGE") && roleLevel(target.role) < roleLevel(actor.role);
}

/** Levels the actor may give to accounts they manage. */
export function assignableRoles(actor: Actor): RoleKey[] {
  if (actor.role === "ADMIN") return [...ROLES];
  if (!hasPermission(actor, "USER_MANAGE")) return [];
  return ROLES.filter((r) => ROLE_LEVEL[r] < roleLevel(actor.role));
}

/** Permissions the actor may grant: only ones they hold themselves. */
export function grantablePermissions(actor: Actor): PermissionKey[] {
  if (actor.role === "ADMIN") return [...PERMISSIONS];
  return PERMISSIONS.filter((p) => actor.permissions.includes(p));
}

/** Stored grants: drop what the level already includes, dedupe, canonical order. */
export function normalizeGrants(role: string, granted: readonly string[]): PermissionKey[] {
  const defaults = new Set<string>(ROLE_DEFAULTS[asRole(role)]);
  const set = new Set(granted);
  return PERMISSIONS.filter((p) => set.has(p) && !defaults.has(p));
}

/**
 * The first permission whose grant would change although the actor may not
 * grant it, or null when the change is allowed.
 */
export function forbiddenGrantChange(actor: Actor, before: readonly string[], after: readonly string[]): PermissionKey | null {
  const grantable = new Set(grantablePermissions(actor));
  return PERMISSIONS.find((p) => !grantable.has(p) && before.includes(p) !== after.includes(p)) ?? null;
}
