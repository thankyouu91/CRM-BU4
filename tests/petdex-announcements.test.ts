import { beforeAll, describe, expect, it } from "vitest";

// Announcements: the management board posts them through the internal API, players read the live ones,
// removed or expired ones disappear, every change is logged, and the shared formatter only emits safe HTML.

process.env.PETDEX_DB = ":memory:";

type Json = Record<string, unknown>;
let internalApi: unknown;
let api: unknown;
let handleFetch: (router: unknown, request: Request, opts: { prefix: string }) => Promise<Response>;
let announce: { renderAnnouncement: (body: string) => string };
let mod: { createAnnouncement: (input: Json, now?: number) => Json; activeAnnouncements: (now?: number) => Json[] };
let store: { adminLogs(limit?: number): Json[] };

const call = async (router: unknown, prefix: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await handleFetch(router, new Request(`http://x${prefix}${path}`, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), { prefix });
  return { status: res.status, data: (await res.json()) as Json };
};
const internal = (method: string, path: string, body?: unknown) => call(internalApi, "/internal", method, path, body);

beforeAll(async () => {
  ({ internalApi } = await import("@/petdex/server/internal.js"));
  ({ api } = await import("@/petdex/server/routes.js"));
  ({ handleFetch } = await import("@/petdex/server/router.js"));
  announce = (await import("@/public/ta-tua/game/js/shared/announce.js")) as unknown as typeof announce;
  mod = (await import("@/petdex/server/announcements.js")) as unknown as typeof mod;
  store = (await import("@/petdex/server/db.js")) as unknown as typeof store;
  (await import("@/petdex/server/migrate.js")).migrate();
});

describe("Pet Town announcements", () => {
  it("the board posts an announcement, players see it, removing it hides it, and both are logged", async () => {
    const reg = await internal("POST", "/account/register", { username: "Doc_Bao", password: "abcdef1" });
    const token = reg.data.token as string;
    const read = async () => (await call(api, "/api", "GET", "/announcements", undefined, { authorization: `Bearer ${token}` })).data as unknown as Json[];

    expect((await internal("POST", "/admin/announcements", { title: "", body: "x", actor: "Admin" })).data.error).toMatch(/tiêu đề/);
    expect((await internal("POST", "/admin/announcements", { title: "Tin", body: "  ", actor: "Admin" })).data.error).toMatch(/nội dung/);
    expect((await internal("POST", "/admin/announcements", { title: "Tin", body: "x", days: 31, actor: "Admin" })).data.error).toMatch(/1 đến 30 ngày/);

    const posted = await internal("POST", "/admin/announcements", { title: "Pet Town cập nhật", body: "## Mới\n- Đấu giá", days: 7, popup: true, actor: "Admin" });
    expect(posted.status).toBe(200);
    const a = posted.data.announcement as Json;
    expect(a).toMatchObject({ title: "Pet Town cập nhật", popup: true, createdBy: "Admin" });
    expect((a.endsAt as number) - (a.startsAt as number)).toBe(7 * 86_400_000);

    const seen = await read();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ id: a.id, title: "Pet Town cập nhật", body: "## Mới\n- Đấu giá", popup: true });
    expect(seen[0]).not.toHaveProperty("createdBy"); // players do not see who posted it

    const list = (await internal("GET", "/admin/announcements")).data;
    expect((list.announcements as Json[])[0]).toMatchObject({ id: a.id, removedAt: null });

    expect((await internal("POST", `/admin/announcements/${a.id}/delete`, { actor: "Admin" })).status).toBe(200);
    expect(await read()).toHaveLength(0);
    expect((await internal("POST", "/admin/announcements/99999/delete", { actor: "Admin" })).data.error).toMatch(/Không có/);

    const actions = store.adminLogs(10).map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(["announcement", "announcement_delete"]));
  });

  it("an announcement shows only between its start and end", () => {
    const t0 = Date.parse("2026-12-01T00:00:00Z");
    const made = mod.createAnnouncement({ title: "Giới hạn giờ", body: "Hết hạn sau 1 ngày", days: 1 }, t0);
    const ids = (now: number) => mod.activeAnnouncements(now).map((x) => x.id);
    expect(ids(t0 + 1000)).toContain(made.id);
    expect(ids(t0 + 86_400_000 + 1)).not.toContain(made.id);
    expect(ids(t0 - 1)).not.toContain(made.id);
  });

  it("the formatter escapes everything and only adds its own tags", () => {
    const html = announce.renderAnnouncement("## Tiêu đề <img src=x onerror=alert(1)>\n**Đậm** <script>alert(1)</script>\n- một\n- hai\n\n| A | B |\n|---|---|\n| 1 | **2** |\n---\nđoạn\ndòng hai");
    expect(html).not.toMatch(/<script|<img/);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<h4>Tiêu đề &lt;img src=x onerror=alert(1)&gt;</h4>");
    expect(html).toContain("<p><b>Đậm</b> &lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(html).toContain("<ul><li>một</li><li>hai</li></ul>");
    expect(html).toContain("<thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td><b>2</b></td></tr></tbody>");
    expect(html).toContain("<hr><p>đoạn<br>dòng hai</p>");
  });
});
