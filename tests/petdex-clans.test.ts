import { beforeAll, describe, expect, it } from "vitest";

// Clans and the land office through the game's public API and the internal admin API
// (petdex/server/routes-clans.js, internal.js), on an in-memory SQLite database.

process.env.PETDEX_DB = ":memory:";

type Json = Record<string, unknown>;
let internalApi: unknown;
let api: unknown;
let handleFetch: (router: unknown, request: Request, opts: { prefix: string }) => Promise<Response>;
let store: { db: { prepare(sql: string): { run(...args: unknown[]): unknown } } };

const call = async (router: unknown, prefix: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await handleFetch(router, new Request(`http://x${prefix}${path}`, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), { prefix });
  return { status: res.status, data: (await res.json()) as Json };
};
const internal = (method: string, path: string, body?: unknown) => call(internalApi, "/internal", method, path, body);
const game = (method: string, path: string, token: string, body?: unknown) => call(api, "/api", method, path, body, { authorization: `Bearer ${token}` });

beforeAll(async () => {
  ({ internalApi } = await import("@/petdex/server/internal.js"));
  ({ api } = await import("@/petdex/server/routes.js"));
  ({ handleFetch } = await import("@/petdex/server/router.js"));
  store = (await import("@/petdex/server/db.js")) as unknown as typeof store;
  (await import("@/petdex/server/migrate.js")).migrate();
  (await import("@/petdex/server/scheduler.js")).runDue();
});

describe("Pet Town clans and land", () => {
  it("lets a levelled player found a clan, enter an industry and buy a plot", async () => {
    const sso = await internal("POST", "/sso", { crmUserId: "crm-clan", name: "Tộc Trưởng" });
    const token = sso.data.token as string;
    const userId = sso.data.userId as number;
    await game("POST", "/pets", token, { species: "boba", name: "Bo" });
    store.db.prepare("UPDATE pets SET level = 6 WHERE owner_id = ?").run(userId);
    await internal("POST", `/admin/players/${userId}/coins`, { delta: 2_000_000, actor: "test" });

    const created = await game("POST", "/clans/create", token, { name: "Nhà Họ Lê", emblem: "🐉", color: "#aa3322" });
    expect(created.status).toBe(200);
    expect((await game("POST", "/clans/donate", token, { amount: 1_000_000 })).status).toBe(200);
    expect((await game("POST", "/clans/industries", token, { industry: "sugar" })).status).toBe(200);

    const land = await game("GET", "/land", token);
    const plots = land.data.plots as { id: number; price: number }[];
    expect(plots).toHaveLength(200);
    const preview = await game("GET", `/land/${plots[150].id}/preview?industry=sugar`, token);
    expect(preview.status).toBe(200);
    expect(preview.data.revenue).toBeGreaterThan(0);
    expect((await game("POST", `/land/${plots[150].id}/buy`, token)).status).toBe(200);
    const view = await game("GET", "/clans", token);
    expect(((view.data.clan as Json).plots as unknown[]).length).toBe(1);
  });

  it("serves the admin view and lets the board tune land prices and the macro economy", async () => {
    const admin = await internal("GET", "/admin/clans");
    expect(admin.status).toBe(200);
    expect((admin.data.plots as unknown[]).length).toBe(200);
    const saved = await internal("POST", "/admin/clans/config", { config: { land: { mode: "manual", multiplier: 1.5 }, baseTax: 0.3 }, actor: "Admin" });
    expect((saved.data.config as { land: { mode: string }; baseTax: number }).land.mode).toBe("manual");
    expect((saved.data.config as { baseTax: number }).baseTax).toBe(0.3);
    const free = (saved.data.plots as { id: number; price: number | null }[]).find((p) => p.price != null)!;
    const priced = await internal("POST", `/admin/clans/plots/${free.id}`, { price: 777_000, actor: "Admin" });
    expect((priced.data.plots as { id: number; price: number }[]).find((p) => p.id === free.id)!.price).toBe(777_000);
    const macro = await internal("POST", "/admin/clans/macro", { phase: "recession", weather: "storm", today: true, actor: "Admin" });
    expect((macro.data.macro as { phase: string; weather: string })).toMatchObject({ phase: "recession", weather: "storm" });
    expect((await internal("POST", "/admin/clans/evasion/999/collect", { actor: "Admin" })).status).toBe(400);
  });
});
