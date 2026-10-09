import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLES,
  assignableRoles,
  canManageUser,
  canReviewWorkReport,
  canViewWorkReport,
  effectivePermissions,
  forbiddenGrantChange,
  grantablePermissions,
  hasPermission,
  normalizeGrants,
  roleLevel,
  seesTeamWorkReports,
  type Actor,
  type PermissionKey,
} from "@/lib/permissions";

/** An actor whose effective permissions come from their role plus grants, as the session builds them. */
const actor = (id: string, role: string, grants: string[] = []): Actor => ({
  id,
  role,
  permissions: effectivePermissions(role, grants),
});

describe("roleLevel", () => {
  it.each([
    ["ADMIN", 4],
    ["MANAGER", 3],
    ["LEAD", 2],
    ["MEMBER", 1],
    ["SUPERUSER", 1],
    ["admin", 1],
    ["", 1],
  ])("%s -> %d", (role, level) => {
    expect(roleLevel(role)).toBe(level);
  });
});

describe("effectivePermissions", () => {
  it("gives ADMIN and MANAGER every permission", () => {
    expect(effectivePermissions("ADMIN")).toEqual([...PERMISSIONS]);
    expect(effectivePermissions("MANAGER")).toEqual([...PERMISSIONS]);
  });

  it("gives LEAD only PROJECT_CREATE and MEMBER nothing by default", () => {
    expect(effectivePermissions("LEAD")).toEqual(["PROJECT_CREATE"]);
    expect(effectivePermissions("MEMBER")).toEqual([]);
  });

  it("adds grants in canonical order and dedupes", () => {
    expect(effectivePermissions("MEMBER", ["FINANCE_MANAGE", "PROJECT_CREATE", "FINANCE_MANAGE"])).toEqual([
      "PROJECT_CREATE",
      "FINANCE_MANAGE",
    ]);
    expect(effectivePermissions("LEAD", ["PROJECT_CREATE", "USER_MANAGE"])).toEqual(["PROJECT_CREATE", "USER_MANAGE"]);
  });

  it("drops unknown permission strings", () => {
    expect(effectivePermissions("MEMBER", ["ROOT", "PROJECT_VIEW_ALL"])).toEqual(["PROJECT_VIEW_ALL"]);
  });

  it("treats an unknown role as MEMBER", () => {
    expect(effectivePermissions("OWNER")).toEqual([]);
    expect(effectivePermissions("OWNER", ["USER_MANAGE"])).toEqual(["USER_MANAGE"]);
  });
});

describe("hasPermission", () => {
  it("is always true for ADMIN, even with an empty permission list", () => {
    for (const p of PERMISSIONS) expect(hasPermission({ role: "ADMIN", permissions: [] }, p)).toBe(true);
  });

  it("otherwise follows the permission list", () => {
    expect(hasPermission({ role: "MEMBER", permissions: ["FINANCE_MANAGE"] }, "FINANCE_MANAGE")).toBe(true);
    expect(hasPermission({ role: "MEMBER", permissions: ["FINANCE_MANAGE"] }, "USER_MANAGE")).toBe(false);
    expect(hasPermission({ role: "MANAGER", permissions: [] }, "USER_MANAGE")).toBe(false);
  });

  it("does not treat a lowercase 'admin' role as ADMIN", () => {
    expect(hasPermission({ role: "admin", permissions: [] }, "USER_MANAGE")).toBe(false);
  });
});

describe("canManageUser", () => {
  const admin = actor("admin", "ADMIN");
  const manager = actor("mgr", "MANAGER");
  const managerNoGrant: Actor = { id: "mgr2", role: "MANAGER", permissions: [] };
  const lead = actor("lead", "LEAD");
  const leadWithUserManage = actor("lead2", "LEAD", ["USER_MANAGE"]);
  const memberWithUserManage = actor("mem", "MEMBER", ["USER_MANAGE"]);
  const unknownWithUserManage = actor("unk", "BOSS", ["USER_MANAGE"]);

  const targets = {
    ADMIN: { id: "t-admin", role: "ADMIN" },
    MANAGER: { id: "t-mgr", role: "MANAGER" },
    LEAD: { id: "t-lead", role: "LEAD" },
    MEMBER: { id: "t-mem", role: "MEMBER" },
    UNKNOWN: { id: "t-unk", role: "INTERN" },
  };

  // [actor name, actor, target key, expected]
  const cases: [string, Actor, keyof typeof targets, boolean][] = [
    ["admin", admin, "ADMIN", true],
    ["admin", admin, "MANAGER", true],
    ["admin", admin, "LEAD", true],
    ["admin", admin, "MEMBER", true],
    ["admin", admin, "UNKNOWN", true],

    ["manager", manager, "ADMIN", false],
    ["manager", manager, "MANAGER", false],
    ["manager", manager, "LEAD", true],
    ["manager", manager, "MEMBER", true],
    ["manager", manager, "UNKNOWN", true],

    ["manager without USER_MANAGE", managerNoGrant, "LEAD", false],
    ["manager without USER_MANAGE", managerNoGrant, "MEMBER", false],

    ["lead", lead, "MEMBER", false],
    ["lead", lead, "LEAD", false],

    ["lead + USER_MANAGE", leadWithUserManage, "ADMIN", false],
    ["lead + USER_MANAGE", leadWithUserManage, "MANAGER", false],
    ["lead + USER_MANAGE", leadWithUserManage, "LEAD", false],
    ["lead + USER_MANAGE", leadWithUserManage, "MEMBER", true],
    ["lead + USER_MANAGE", leadWithUserManage, "UNKNOWN", true],

    ["member + USER_MANAGE", memberWithUserManage, "MEMBER", false],
    ["member + USER_MANAGE", memberWithUserManage, "UNKNOWN", false],
    ["member + USER_MANAGE", memberWithUserManage, "LEAD", false],

    ["unknown role + USER_MANAGE", unknownWithUserManage, "MEMBER", false],
    ["unknown role + USER_MANAGE", unknownWithUserManage, "UNKNOWN", false],
  ];

  it.each(cases)("%s -> %s target: %s", (_name, a, target, expected) => {
    expect(canManageUser(a, targets[target])).toBe(expected);
  });

  it("lets an admin manage their own account", () => {
    expect(canManageUser(admin, { id: "admin", role: "ADMIN" })).toBe(true);
  });

  it("never lets a non-admin manage their own account", () => {
    expect(canManageUser(manager, { id: "mgr", role: "MANAGER" })).toBe(false);
    // Even if the stored target role were lower than the actor's (stale data), self is refused.
    expect(canManageUser(manager, { id: "mgr", role: "MEMBER" })).toBe(false);
    expect(canManageUser(leadWithUserManage, { id: "lead2", role: "MEMBER" })).toBe(false);
  });
});

describe("assignableRoles", () => {
  it.each<[string, Actor, string[]]>([
    ["admin", actor("a", "ADMIN"), [...ROLES]],
    ["manager", actor("m", "MANAGER"), ["LEAD", "MEMBER"]],
    ["manager without USER_MANAGE", { id: "m", role: "MANAGER", permissions: [] }, []],
    ["lead", actor("l", "LEAD"), []],
    ["lead + USER_MANAGE", actor("l", "LEAD", ["USER_MANAGE"]), ["MEMBER"]],
    ["member + USER_MANAGE", actor("x", "MEMBER", ["USER_MANAGE"]), []],
    ["unknown + USER_MANAGE", actor("x", "BOSS", ["USER_MANAGE"]), []],
  ])("%s", (_name, a, expected) => {
    expect(assignableRoles(a)).toEqual(expected);
  });

  it("never offers a level at or above a non-admin actor's own", () => {
    for (const role of ["MANAGER", "LEAD", "MEMBER"]) {
      const a = actor("x", role, ["USER_MANAGE"]);
      for (const r of assignableRoles(a)) expect(roleLevel(r)).toBeLessThan(roleLevel(role));
    }
  });
});

describe("grantablePermissions", () => {
  it("is everything for ADMIN regardless of the list", () => {
    expect(grantablePermissions({ id: "a", role: "ADMIN", permissions: [] })).toEqual([...PERMISSIONS]);
  });

  it("is only what the actor holds", () => {
    expect(grantablePermissions(actor("m", "MANAGER"))).toEqual([...PERMISSIONS]);
    expect(grantablePermissions(actor("l", "LEAD"))).toEqual(["PROJECT_CREATE"]);
    expect(grantablePermissions(actor("l", "LEAD", ["USER_MANAGE", "FINANCE_MANAGE"]))).toEqual([
      "PROJECT_CREATE",
      "USER_MANAGE",
      "FINANCE_MANAGE",
    ]);
    expect(grantablePermissions(actor("x", "MEMBER"))).toEqual([]);
  });

  it("ignores unknown strings in the actor's list", () => {
    expect(grantablePermissions({ id: "x", role: "MEMBER", permissions: ["ROOT", "PROJECT_VIEW_ALL"] })).toEqual([
      "PROJECT_VIEW_ALL",
    ]);
  });
});

describe("normalizeGrants", () => {
  it("drops what the level already includes, dedupes and orders", () => {
    expect(normalizeGrants("LEAD", ["USER_MANAGE", "PROJECT_CREATE", "USER_MANAGE", "PROJECT_VIEW_ALL"])).toEqual([
      "PROJECT_VIEW_ALL",
      "USER_MANAGE",
    ]);
    expect(normalizeGrants("MANAGER", [...PERMISSIONS])).toEqual([]);
    expect(normalizeGrants("ADMIN", ["USER_MANAGE"])).toEqual([]);
    expect(normalizeGrants("MEMBER", ["FINANCE_MANAGE", "PROJECT_CREATE"])).toEqual(["PROJECT_CREATE", "FINANCE_MANAGE"]);
  });

  it("drops unknown strings", () => {
    expect(normalizeGrants("MEMBER", ["ROOT", "", "USER_MANAGE"])).toEqual(["USER_MANAGE"]);
  });

  it("treats an unknown role as MEMBER", () => {
    expect(normalizeGrants("GUEST", ["PROJECT_CREATE"])).toEqual(["PROJECT_CREATE"]);
  });
});

describe("forbiddenGrantChange", () => {
  const lead = actor("l", "LEAD", ["USER_MANAGE"]); // holds PROJECT_CREATE, USER_MANAGE

  it("allows changes limited to permissions the actor holds", () => {
    expect(forbiddenGrantChange(lead, [], ["PROJECT_CREATE"])).toBeNull();
    expect(forbiddenGrantChange(lead, ["USER_MANAGE"], [])).toBeNull();
    expect(forbiddenGrantChange(lead, ["PROJECT_CREATE"], ["USER_MANAGE"])).toBeNull();
  });

  it("allows leaving an unheld permission untouched", () => {
    expect(forbiddenGrantChange(lead, ["FINANCE_MANAGE"], ["FINANCE_MANAGE", "PROJECT_CREATE"])).toBeNull();
  });

  it("refuses adding a permission the actor does not hold", () => {
    expect(forbiddenGrantChange(lead, [], ["FINANCE_MANAGE"])).toBe("FINANCE_MANAGE");
  });

  it("refuses removing a permission the actor does not hold", () => {
    expect(forbiddenGrantChange(lead, ["PROJECT_VIEW_ALL"], [])).toBe("PROJECT_VIEW_ALL");
  });

  it("returns the first forbidden permission in canonical order", () => {
    expect(forbiddenGrantChange(lead, [], ["FINANCE_MANAGE", "PROJECT_MANAGE_ALL"])).toBe("PROJECT_MANAGE_ALL");
  });

  it("lets ADMIN change anything and MANAGER change any defined permission", () => {
    const all: PermissionKey[] = [...PERMISSIONS];
    expect(forbiddenGrantChange(actor("a", "ADMIN"), [], all)).toBeNull();
    expect(forbiddenGrantChange(actor("m", "MANAGER"), all, [])).toBeNull();
  });

  it("refuses every change for an actor holding nothing", () => {
    expect(forbiddenGrantChange(actor("x", "MEMBER"), [], ["PROJECT_CREATE"])).toBe("PROJECT_CREATE");
  });
});

describe("work report visibility", () => {
  const people = {
    admin: { id: "admin", role: "ADMIN" },
    admin2: { id: "admin2", role: "ADMIN" },
    manager: { id: "manager", role: "MANAGER" },
    manager2: { id: "manager2", role: "MANAGER" },
    lead: { id: "lead", role: "LEAD" },
    lead2: { id: "lead2", role: "LEAD" },
    member: { id: "member", role: "MEMBER" },
    member2: { id: "member2", role: "MEMBER" },
    unknown: { id: "unknown", role: "CONTRACTOR" },
  };
  type Who = keyof typeof people;

  // [viewer, author, canView]
  const cases: [Who, Who, boolean][] = [
    ["admin", "admin2", true],
    ["admin", "manager", true],
    ["admin", "lead", true],
    ["admin", "member", true],
    ["manager", "admin", false],
    ["manager", "manager2", false],
    ["manager", "lead", true],
    ["manager", "member", true],
    ["manager", "unknown", true],
    ["lead", "admin", false],
    ["lead", "manager", false],
    ["lead", "lead2", false],
    ["lead", "member", true],
    ["lead", "unknown", true],
    ["member", "admin", false],
    ["member", "manager", false],
    ["member", "lead", false],
    ["member", "member2", false],
    ["member", "unknown", false],
    ["unknown", "member", false],
    ["unknown", "lead", false],
  ];

  it.each(cases)("%s viewing %s's report: %s", (viewer, author, expected) => {
    expect(canViewWorkReport(people[viewer], people[author])).toBe(expected);
  });

  it.each(cases)("%s reviewing %s's report: %s", (viewer, author, expected) => {
    expect(canReviewWorkReport(people[viewer], people[author])).toBe(expected);
  });

  it.each(Object.keys(people) as Who[])("%s can view but not review their own report", (who) => {
    expect(canViewWorkReport(people[who], people[who])).toBe(true);
    expect(canReviewWorkReport(people[who], people[who])).toBe(false);
  });

  it.each([
    ["ADMIN", true],
    ["MANAGER", true],
    ["LEAD", true],
    ["MEMBER", false],
    ["CONTRACTOR", false],
  ])("seesTeamWorkReports(%s) = %s", (role, expected) => {
    expect(seesTeamWorkReports(role)).toBe(expected);
  });
});
