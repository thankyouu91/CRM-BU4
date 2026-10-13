import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

const mock = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn() }));
vi.mock("../lib/session", () => ({ getCurrentUser: mock.auth }));
vi.mock("../lib/prisma", () => ({ prisma: { $queryRaw: mock.query } }));
import { GET } from "../app/api/search/route";

const ROWS: Record<string, unknown[]> = {
  Task: [{ id: "t1", title: "Lập báo cáo quý", status: "TODO", dueDate: new Date("2026-10-20T00:00:00Z"), projectId: "p1", projectName: "Báo cáo", projectColor: "#2a78d6", assignee: "Lan" }],
  Contract: [{ id: "c1", code: "015/HĐ", name: "Đào tạo", partner: "Minh Phát", status: "IN_PROGRESS" }],
  User: [{ id: "u1", name: "Bùi Ngọc Lan", jobTitle: "Sales", email: "lan@example.test", avatarColor: "#f97316" }],
  Project: [{ id: "p1", name: "Báo cáo", status: "ACTIVE", color: "#2a78d6" }],
};
const table = (sql: Prisma.Sql) => Object.keys(ROWS).find((t) => sql.sql.includes(`FROM "${t}"`))!;
const sqlFor = (t: string) => mock.query.mock.calls.map(([sql]) => sql as Prisma.Sql).find((sql) => table(sql) === t);
const request = (q?: string) => GET(new NextRequest(`http://localhost/api/search${q === undefined ? "" : `?q=${encodeURIComponent(q)}`}`));
const member = { id: "me", role: "MEMBER", permissions: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue(member);
  mock.query.mockImplementation(async (sql: Prisma.Sql) => ROWS[table(sql)]);
});

it("requires a signed-in user before searching", async () => {
  mock.auth.mockResolvedValue(null);
  expect((await request("bao cao")).status).toBe(401);
  expect(mock.query).not.toHaveBeenCalled();
});

it("rejects terms shorter than 2 or longer than 100 characters", async () => {
  for (const q of [undefined, "", " a ", "x".repeat(101)]) expect((await request(q)).status).toBe(400);
  expect(mock.query).not.toHaveBeenCalled();
  expect((await request("ab")).status).toBe(200);
});

it("returns grouped results for what the user may see, never cached and without contracts", async () => {
  const response = await request("  bao cao ");
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  const body = await response.json();
  expect(Object.keys(body)).toEqual(["projects", "tasks", "people"]);
  expect(body.tasks).toEqual([{ id: "t1", title: "Lập báo cáo quý", status: "TODO", dueDate: "2026-10-20T00:00:00.000Z", assignee: "Lan", project: { id: "p1", name: "Báo cáo", color: "#2a78d6" } }]);
  expect(body.people[0]).toEqual(ROWS.User[0]);
  expect(sqlFor("Contract")).toBeUndefined();
  // Projects and tasks are limited to the user's projects (owner or member), people to active accounts.
  for (const t of ["Project", "Task"]) {
    expect(sqlFor(t)!.sql).toContain(`p."ownerId" = ? OR EXISTS`);
    expect(sqlFor(t)!.sql).toContain(`FROM "ProjectMember" m`);
    expect(sqlFor(t)!.values).toContain("me");
  }
  expect(sqlFor("User")!.sql).toContain("u.active");
});

it("adds contracts for FINANCE_MANAGE and drops the project filter for people who see every project", async () => {
  mock.auth.mockResolvedValue({ ...member, permissions: ["FINANCE_MANAGE", "PROJECT_VIEW_ALL"] });
  const body = await (await request("dao tao")).json();
  expect(body.contracts).toEqual(ROWS.Contract);
  expect(sqlFor("Project")!.sql).not.toContain("ownerId");
  expect(sqlFor("Task")!.sql).not.toContain("ownerId");
});

it("binds the folded, escaped term as a parameter instead of writing it into the SQL", async () => {
  await request("Tỷ lệ 50%_'; DROP TABLE");
  for (const sql of mock.query.mock.calls.map(([s]) => s as Prisma.Sql)) {
    expect(sql.sql).not.toMatch(/DROP|50/);
    expect(sql.sql).toContain(`ESCAPE '\\'`);
    expect(sql.values).toEqual(expect.arrayContaining(["%ty le 50\\%\\_'; drop table%", "ty le 50\\%\\_'; drop table%", "% ty le 50\\%\\_'; drop table%"]));
  }
});
