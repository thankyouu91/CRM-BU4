import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mock = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), report: vi.fn() }));
vi.mock("../lib/session", () => ({ getCurrentUser: mock.auth }));
vi.mock("../lib/rbac", () => ({ canAccessProject: mock.access }));
vi.mock("../lib/department-report-queries", () => ({ departmentReport: mock.report }));
import { GET } from "../app/api/reports/department/route";
const request = (query = "") => GET(new NextRequest(`http://localhost/api/reports/department${query}`));
beforeEach(() => { vi.clearAllMocks(); mock.auth.mockResolvedValue({ id: "me" }); mock.access.mockResolvedValue(true); mock.report.mockResolvedValue({ week: "2026-W42" }); });

it("requires authentication before querying report data", async () => {
  mock.auth.mockResolvedValue(null);
  expect((await request()).status).toBe(401);
  expect(mock.report).not.toHaveBeenCalled();
});
it("rejects invalid week keys and hidden projects without loading their data", async () => {
  expect((await request("?week=2026-W99")).status).toBe(400);
  mock.access.mockResolvedValue(false);
  expect((await request("?week=2026-W42&projectId=hidden")).status).toBe(404);
  expect(mock.report).not.toHaveBeenCalled();
});
it("passes the authenticated viewer into the scoped query and prevents shared caching", async () => {
  const response = await request("?week=2026-W42&projectId=p");
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mock.report.mock.calls[0][0]).toEqual({ id: "me" });
  expect(mock.report.mock.calls[0][1].key).toBe("2026-W42");
  expect(mock.report.mock.calls[0][2]).toBe("p");
});
