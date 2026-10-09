import { describe, expect, it, vi } from "vitest";

// lib/rbac.ts imports the Prisma client (pg adapter, Cloudflare context); the
// functions tested here never touch it.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { effectivePermissions, type ProjectRoleKey } from "@/lib/permissions";
import {
  accessFrom,
  canCreateProject,
  canManageAllProjects,
  canViewAllProjects,
  isAdmin,
  managedProjectsWhere,
  projectVisibilityWhere,
  taskRights,
  type ProjectAccess,
} from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";

const user = (id: string, role: string, grants: string[] = []): CurrentUser => ({
  id,
  email: `${id}@example.com`,
  name: id,
  role,
  permissions: effectivePermissions(role, grants),
  jobTitle: null,
  avatarColor: "#000000",
  mustChangePassword: false,
});

describe("org-wide project checks", () => {
  it.each<[string, CurrentUser, boolean, boolean, boolean, boolean]>([
    // name, user, isAdmin, create, manageAll, viewAll
    ["admin", user("a", "ADMIN"), true, true, true, true],
    ["admin with empty list", { ...user("a", "ADMIN"), permissions: [] }, true, true, true, true],
    ["manager", user("m", "MANAGER"), false, true, true, true],
    ["lead", user("l", "LEAD"), false, true, false, false],
    ["member", user("x", "MEMBER"), false, false, false, false],
    ["member + VIEW_ALL", user("x", "MEMBER", ["PROJECT_VIEW_ALL"]), false, false, false, true],
    ["member + MANAGE_ALL", user("x", "MEMBER", ["PROJECT_MANAGE_ALL"]), false, false, true, true],
    ["unknown role", user("x", "GUEST"), false, false, false, false],
  ])("%s", (_name, u, admin, create, manageAll, viewAll) => {
    expect(isAdmin(u)).toBe(admin);
    expect(canCreateProject(u)).toBe(create);
    expect(canManageAllProjects(u)).toBe(manageAll);
    expect(canViewAllProjects(u)).toBe(viewAll);
  });
});

describe("accessFrom", () => {
  const member = user("u1", "MEMBER");

  it.each<[string, CurrentUser, string, ProjectRoleKey | null, ProjectAccess]>([
    ["owner", member, "u1", null, { view: true, contribute: true, manage: true, role: "MANAGER" }],
    ["owner listed as viewer still manages", member, "u1", "VIEWER", { view: true, contribute: true, manage: true, role: "MANAGER" }],
    ["project manager", member, "other", "MANAGER", { view: true, contribute: true, manage: true, role: "MANAGER" }],
    ["project member", member, "other", "MEMBER", { view: true, contribute: true, manage: false, role: "MEMBER" }],
    ["project viewer", member, "other", "VIEWER", { view: true, contribute: false, manage: false, role: "VIEWER" }],
    ["outsider", member, "other", null, { view: false, contribute: false, manage: false, role: null }],
    [
      "outsider with VIEW_ALL",
      user("u1", "MEMBER", ["PROJECT_VIEW_ALL"]),
      "other",
      null,
      { view: true, contribute: false, manage: false, role: null },
    ],
    [
      "outsider with MANAGE_ALL",
      user("u1", "MEMBER", ["PROJECT_MANAGE_ALL"]),
      "other",
      null,
      { view: true, contribute: true, manage: true, role: null },
    ],
    ["outsider admin", user("u1", "ADMIN"), "other", null, { view: true, contribute: true, manage: true, role: null }],
    ["viewer who is a manager org-wide", user("u1", "MANAGER"), "other", "VIEWER", { view: true, contribute: true, manage: true, role: "VIEWER" }],
    ["lead outsider", user("u1", "LEAD"), "other", null, { view: false, contribute: false, manage: false, role: null }],
  ])("%s", (_name, u, ownerId, memberRole, expected) => {
    expect(accessFrom(u, ownerId, memberRole)).toEqual(expected);
  });
});

describe("taskRights", () => {
  const me = { id: "me" };
  const access = (manage: boolean, contribute: boolean): ProjectAccess => ({
    view: true,
    contribute,
    manage,
    role: null,
  });
  const mine = { assigneeId: "me", createdById: "me" };
  const assignedToMe = { assigneeId: "me", createdById: "boss" };
  const createdByMe = { assigneeId: "someone", createdById: "me" };
  const other = { assigneeId: "someone", createdById: "boss" };
  const unassigned = { assigneeId: null, createdById: "boss" };

  it.each<[string, ProjectAccess, typeof mine | typeof unassigned, { manage: boolean; report: boolean }]>([
    ["manager on someone else's task", access(true, true), other, { manage: true, report: true }],
    ["manager on unassigned task", access(true, true), unassigned, { manage: true, report: true }],
    ["contributor on own task", access(false, true), mine, { manage: true, report: true }],
    ["contributor on task they created", access(false, true), createdByMe, { manage: true, report: true }],
    ["contributor assigned the task", access(false, true), assignedToMe, { manage: false, report: true }],
    ["contributor on someone else's task", access(false, true), other, { manage: false, report: false }],
    ["contributor on unassigned task", access(false, true), unassigned, { manage: false, report: false }],
    ["viewer on own (stale) task", access(false, false), mine, { manage: false, report: false }],
    ["viewer assigned the task", access(false, false), assignedToMe, { manage: false, report: false }],
  ])("%s", (_name, a, task, expected) => {
    expect(taskRights(me, a, task)).toEqual({ ...expected, isProjectManager: a.manage });
  });
});

describe("Prisma where shapes", () => {
  it("projectVisibilityWhere is unrestricted for view-all holders", () => {
    expect(projectVisibilityWhere(user("a", "ADMIN"))).toEqual({});
    expect(projectVisibilityWhere(user("m", "MANAGER"))).toEqual({});
    expect(projectVisibilityWhere(user("x", "MEMBER", ["PROJECT_VIEW_ALL"]))).toEqual({});
    expect(projectVisibilityWhere(user("x", "MEMBER", ["PROJECT_MANAGE_ALL"]))).toEqual({});
  });

  it("projectVisibilityWhere limits others to owned or member projects", () => {
    expect(projectVisibilityWhere(user("u1", "LEAD"))).toEqual({
      OR: [{ ownerId: "u1" }, { members: { some: { userId: "u1" } } }],
    });
  });

  it("managedProjectsWhere is unrestricted only for manage-all holders", () => {
    expect(managedProjectsWhere(user("a", "ADMIN"))).toEqual({});
    expect(managedProjectsWhere(user("m", "MANAGER"))).toEqual({});
    expect(managedProjectsWhere(user("x", "MEMBER", ["PROJECT_VIEW_ALL"]))).toEqual({
      OR: [{ ownerId: "x" }, { members: { some: { userId: "x", role: "MANAGER" } } }],
    });
  });
});
