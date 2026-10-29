import { beforeAll, describe, expect, it } from "vitest";

// WorkHub's internal API inside the game server (petdex/server/internal.js): SSO for members,
// invite links for guests, and the management endpoints. Runs the real game modules on an
// in-memory SQLite database.

process.env.PETDEX_DB = ":memory:";

type Json = Record<string, unknown>;
let internalApi: unknown;
let api: unknown;
let handleFetch: (router: unknown, request: Request, opts: { prefix: string }) => Promise<Response>;

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
  (await import("@/petdex/server/migrate.js")).migrate();
  (await import("@/petdex/server/scheduler.js")).runDue();
});

describe("Tà tưa internal API", () => {
  it("signs a member in once and keeps the same game account", async () => {
    const first = await internal("POST", "/sso", { crmUserId: "crm-1", name: "Nguyễn Văn An" });
    expect(first.status).toBe(200);
    expect(first.data.username).toBe("Nguyễn_Văn_An");
    expect(first.data.created).toBe(true);
    const again = await internal("POST", "/sso", { crmUserId: "crm-1", name: "Nguyễn Văn An" });
    expect(again.data.userId).toBe(first.data.userId);
    expect(again.data.token).toBe(first.data.token); // recent session reused
    const me = await game("GET", "/me", first.data.token as string);
    expect(me.status).toBe(200);
    expect((me.data.user as Json).coins).toBe(150); // welcome coins
    const twin = await internal("POST", "/sso", { crmUserId: "crm-2", name: "Nguyễn Văn An" });
    expect(twin.data.username).toBe("Nguyễn_Văn_An_2");
    const long = await internal("POST", "/sso", { crmUserId: "crm-long", name: "x".repeat(60) });
    expect(long.status).toBe(200); // WorkHub names are clipped, not refused
    expect((long.data.username as string).length).toBeLessThanOrEqual(20);
  });

  it("native sign-up is closed", async () => {
    const res = await call(api, "/api", "POST", "/auth/register", { username: "abc", password: "xxxx" });
    expect(res.status).toBe(400);
  });

  it("lets guests in through a usable invite only", async () => {
    const created = await internal("POST", "/admin/invites", { label: "Bạn bè", maxUses: 1, actor: "Admin" });
    expect(created.status).toBe(200);
    const code = (created.data.invite as Json).code as string;
    expect(await internal("GET", `/invites/${code}`)).toMatchObject({ data: { valid: true, label: "Bạn bè" } });
    expect((await internal("POST", "/guest", { code, name: "A" })).status).toBe(400); // name too short
    const guest = await internal("POST", "/guest", { code, name: "Khách Lạ" });
    expect(guest.status).toBe(200);
    expect(guest.data.username).toBe("Khách_Lạ");
    expect((await internal("POST", "/guest/resume", { token: guest.data.token })).data).toMatchObject({ ok: true, displayName: "Khách Lạ" });
    expect((await internal("POST", "/guest", { code, name: "Khách Hai" })).status).toBe(400); // max uses reached
    expect((await internal("GET", `/invites/${code}`)).data.valid).toBe(false);
    expect((await internal("POST", "/guest", { code: "nope", name: "Khách Ba" })).status).toBe(400);
    const revoked = await internal("POST", "/admin/invites", { label: "Thu hồi", actor: "Admin" });
    const id = (revoked.data.invite as Json).id as number;
    expect((await internal("POST", `/admin/invites/${id}/revoke`, { actor: "Admin" })).status).toBe(200);
    expect((await internal("POST", `/admin/invites/${id}/revoke`, { actor: "Admin" })).status).toBe(400);
    expect((await internal("POST", "/guest", { code: (revoked.data.invite as Json).code, name: "Khách Tư" })).status).toBe(400);
  });

  it("adjusts coins through the ledger and never below zero", async () => {
    const { data } = await internal("POST", "/sso", { crmUserId: "crm-coins", name: "Trần Bình" });
    const id = data.userId as number;
    expect((await internal("POST", `/admin/players/${id}/coins`, { delta: 0, actor: "Admin" })).status).toBe(400);
    expect((await internal("POST", `/admin/players/${id}/coins`, { delta: 350, memo: "Thưởng", actor: "Admin" })).data).toEqual({ ok: true, coins: 500 });
    expect((await internal("POST", `/admin/players/${id}/coins`, { delta: -501, actor: "Admin" })).data).toEqual({ error: "Không đủ xu." });
    const detail = await internal("GET", `/admin/players/${id}`);
    expect((detail.data.player as Json).coins).toBe(500);
    expect((detail.data.ledger as Json[])[0]).toMatchObject({ delta: 350, kind: "admin" });
    const players = await internal("GET", "/admin/players?q=Bình");
    expect((players.data.players as Json[]).map((p) => p.displayName)).toEqual(["Trần Bình"]);
  });

  it("edits a pet's stats and skills with clamping", async () => {
    const { data } = await internal("POST", "/sso", { crmUserId: "crm-pet", name: "Lê Cường" });
    const token = data.token as string;
    const catalog = await call(api, "/api", "GET", "/catalog");
    const species = (catalog.data.species as Json[]).find((s) => s.adoptable) as Json;
    const adopted = await game("POST", "/pets", token, { name: "Mochi", species: species.id });
    expect(adopted.status).toBe(200);
    const petId = ((adopted.data.pets as Json[])[0] as Json).id as number;
    const id = data.userId as number;
    expect((await internal("POST", `/admin/players/${id}/pets/${petId}`, { fullness: 250, level: 3, skills: { strength: 90 }, actor: "Admin" })).data).toEqual({ ok: true });
    const detail = await internal("GET", `/admin/players/${id}`);
    const pet = (detail.data.pets as Json[])[0] as Json;
    expect(pet.fullness).toBe(100);
    expect(pet.level).toBe(3);
    expect((pet.skills as Json).strength).toBe(90);
    expect((await internal("POST", `/admin/players/${id}/pets/${petId}`, { skills: { flying: 1 }, actor: "Admin" })).status).toBe(400);
    expect((await internal("POST", `/admin/players/${id}/pets/999`, { fullness: 1, actor: "Admin" })).status).toBe(400);
  });

  it("bans and unbans: a banned player is signed out of the game", async () => {
    const { data } = await internal("POST", "/sso", { crmUserId: "crm-ban", name: "Phạm Dung" });
    const id = data.userId as number;
    const token = data.token as string;
    expect((await game("GET", "/me", token)).status).toBe(200);
    expect((await internal("POST", `/admin/players/${id}/status`, { banned: true, actor: "Admin" })).data).toEqual({ ok: true, banned: true });
    expect((await game("GET", "/me", token)).status).toBe(401);
    expect((await internal("POST", "/sso", { crmUserId: "crm-ban", name: "Phạm Dung" })).status).toBe(400);
    expect((await internal("POST", `/admin/players/${id}/status`, { banned: false, actor: "Admin" })).data).toEqual({ ok: true, banned: false });
    expect((await internal("POST", "/sso", { crmUserId: "crm-ban", name: "Phạm Dung" })).status).toBe(200);
    const log = await internal("GET", "/admin/log?limit=3");
    expect((log.data.log as Json[]).map((l) => l.action)).toEqual(["unban", "ban", "pet"]);
  });

  it("overview counts players by kind", async () => {
    const overview = await internal("GET", "/admin/overview");
    expect(overview.status).toBe(200);
    const kinds = Object.fromEntries((overview.data.byKind as Json[]).map((k) => [k.kind, k.n]));
    expect(kinds.member).toBeGreaterThanOrEqual(4);
    expect(kinds.guest).toBe(1);
    expect(typeof overview.data.treasury).toBe("number");
  });
});
