import { beforeAll, describe, expect, it } from "vitest";

// WorkHub's internal API inside the game server (petdex/server/internal.js): SSO for members,
// invite links for guests, and the management endpoints. Runs the real game modules on an
// in-memory SQLite database.

process.env.PETDEX_DB = ":memory:";

type Json = Record<string, unknown>;
let internalApi: unknown;
let api: unknown;
let store: { db: { prepare(sql: string): { run(...args: unknown[]): unknown } } };
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
  store = (await import("@/petdex/server/db.js")) as unknown as typeof store;
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
    expect((await internal("POST", `/admin/players/${id}/coins`, { delta: 350, memo: "Thưởng", actor: "Admin" })).data).toMatchObject({ ok: true, coins: 500, delta: 350 });
    expect((await internal("POST", `/admin/players/${id}/coins`, { delta: -501, actor: "Admin" })).data).toEqual({ error: "Không đủ xu: ví có 500 xu, tối đa trừ được 500 xu." });
    const detail = await internal("GET", `/admin/players/${id}`);
    expect((detail.data.player as Json).coins).toBe(500);
    expect((detail.data.ledger as Json[])[0]).toMatchObject({ delta: 350, kind: "admin" });
    const players = await internal("GET", "/admin/players?q=Bình");
    expect((players.data.players as Json[]).map((p) => p.displayName)).toEqual(["Trần Bình"]);
  });

  it("subtracts from the wallet, then savings, and can take everything available", async () => {
    const { data } = await internal("POST", "/sso", { crmUserId: "crm-coins2", name: "Võ Trần Long" });
    const id = data.userId as number;
    const token = data.token as string;
    await internal("POST", `/admin/players/${id}/coins`, { delta: 850, actor: "Admin" }); // wallet 1000
    store.db.prepare("INSERT OR REPLACE INTO bank_accounts (user_id, savings, accrued, updated_at) VALUES (?, 300, 0, ?)").run(id, Date.now());
    const detail = await internal("GET", `/admin/players/${id}`);
    expect(detail.data.spendable).toEqual({ wallet: 1000, savings: 300 });
    // wallet first, then savings
    expect((await internal("POST", `/admin/players/${id}/coins`, { delta: -1100, actor: "Admin" })).data).toMatchObject({ ok: true, coins: 0, savings: 200, delta: -1100, fromWallet: 1000, fromSavings: 100 });
    // more than there is: refused with the limit, or everything with clamp
    expect((await internal("POST", `/admin/players/${id}/coins`, { delta: -5000, actor: "Admin" })).data).toEqual({ error: "Không đủ xu: ví có 0, tiết kiệm 200 xu, tối đa trừ được 200 xu." });
    expect((await internal("POST", `/admin/players/${id}/coins`, { delta: -5000, clamp: true, actor: "Admin" })).data).toMatchObject({ ok: true, coins: 0, savings: 0, delta: -200, fromSavings: 200 });
    expect((await internal("POST", `/admin/players/${id}/coins`, { delta: -1, clamp: true, actor: "Admin" })).status).toBe(400);
    expect((await game("GET", "/me", token)).data.user).toMatchObject({ coins: 0 });
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

  it("grants a pet of any species, rare ones included, within the pet slots", async () => {
    const { data } = await internal("POST", "/sso", { crmUserId: "crm-grant", name: "Võ Trần Long" });
    const id = data.userId as number;
    const detail = await internal("GET", `/admin/players/${id}`);
    expect((detail.data.species as Json[]).some((s) => s.id === "hoang_long" && s.rarity === "huyenthoai")).toBe(true);
    expect(detail.data.slots).toMatchObject({ used: 0, free: 4 });
    expect((await internal("POST", `/admin/players/${id}/pets`, { species: "no_such", actor: "Admin" })).status).toBe(400);
    const granted = await internal("POST", `/admin/players/${id}/pets`, { species: "hoang_long", actor: "Admin" });
    expect(granted.data).toMatchObject({ ok: true, pet: { name: "Hoàng Long", species: "hoang_long" } });
    const me = await game("GET", "/me", data.token as string);
    const pets = me.data.pets as Json[];
    expect(pets.map((p) => p.species)).toEqual(["hoang_long"]);
    expect((me.data.user as Json).activePetId).toBe(pets[0].id); // first pet becomes the main one
    expect((me.data.user as Json).coins).toBe(150); // a grant costs nothing
    for (let i = 0; i < 3; i++) expect((await internal("POST", `/admin/players/${id}/pets`, { species: "thanh_long", name: `Rồng ${i}`, actor: "Admin" })).status).toBe(200);
    expect((await internal("POST", `/admin/players/${id}/pets`, { species: "bach_ho", actor: "Admin" })).data.error).toMatch(/hết ô nuôi/);
    const log = await internal("GET", "/admin/log?limit=1");
    expect((log.data.log as Json[])[0]).toMatchObject({ action: "pet_grant" });
  });

  it("lets a level 1 newborn work light shifts: up to 2 hours a day at 50% pay", async () => {
    const { data } = await internal("POST", "/sso", { crmUserId: "crm-work", name: "Đinh Công" });
    const token = data.token as string;
    const catalog = await call(api, "/api", "GET", "/catalog");
    const species = (catalog.data.species as Json[]).find((s) => s.adoptable && !s.mascot) as Json;
    const adopted = await game("POST", "/pets", token, { name: "Bé Mới", species: species.id });
    const pet = (adopted.data.pets as Json[])[0] as Json;
    expect(pet.level).toBe(1);
    expect((pet.age as Json).stage).toBe("baby");
    const career = Object.keys(catalog.data.careers as Json)[0];
    const shift = await game("POST", "/jobs/start", token, { petId: pet.id, career, hours: 1 });
    expect(shift.status).toBe(200);
    const jobs = await game("GET", "/jobs", token);
    const view = (jobs.data.pets as Json[]).find((p) => p.id === pet.id) as Json;
    expect(view).toMatchObject({ maxHours: 2, workFactor: 0.5 });
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
    expect((log.data.log as Json[]).map((l) => l.action)).toEqual(["unban", "ban", "pet_grant"]);
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
