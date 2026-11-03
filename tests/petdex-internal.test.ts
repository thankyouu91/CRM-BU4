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

describe("Pet Town internal API", () => {
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

  it("a bath keeps the pet at home: it is 'đang tắm', not at work, and does not tire it like a shift", async () => {
    const { data } = await internal("POST", "/sso", { crmUserId: "crm-bath", name: "Phạm Tắm" });
    const token = data.token as string;
    const catalog = await call(api, "/api", "GET", "/catalog");
    const species = (catalog.data.species as Json[]).find((s) => s.adoptable && !s.mascot) as Json;
    const pet = ((await game("POST", "/pets", token, { name: "Bé Sạch", species: species.id })).data.pets as Json[])[0] as Json;
    expect((await game("POST", `/pets/${pet.id}/bath`, token)).status).toBe(200);
    const mine = ((await game("GET", "/me", token)).data.pets as Json[]).find((p) => p.id === pet.id) as Json;
    expect(mine).toMatchObject({ busyKind: "bath" });
    expect(mine.busyUntil).toBeGreaterThan(Date.now());
    const jobs = await game("GET", "/jobs", token);
    expect((jobs.data.pets as Json[]).find((p) => p.id === pet.id)).toMatchObject({ busyKind: "bath" });
    const career = Object.keys(catalog.data.careers as Json)[0];
    const shift = await game("POST", "/jobs/start", token, { petId: pet.id, career, hours: 1 });
    expect(shift.data.error).toMatch(/đang tắm/);
    expect((await game("POST", `/pets/${pet.id}/play`, token, {})).data.error).toMatch(/đang tắm/);

    // over the same hour a bath leaves the pet resting, a shift tires it
    const { tick } = await import("@/petdex/server/game.js");
    const t0 = Date.now();
    const base = { ...mine, species: species.id, born_at: t0 - 30 * 86_400_000, updated_at: t0, energy: 50, fullness: 80, happiness: 80, hygiene: 80, health: 90, traits: [], busy_from: t0, busy_until: t0 + 3_600_000 };
    const afterBath = tick({ ...base, busy_kind: "bath" }, t0 + 3_600_000);
    const afterWork = tick({ ...base, busy_kind: "work" }, t0 + 3_600_000);
    expect(afterBath.energy).toBeGreaterThan(50);
    expect(afterWork.energy).toBeLessThan(50);
  });

  it("a work shift is reported as work", async () => {
    const { data } = await internal("POST", "/sso", { crmUserId: "crm-shift", name: "Lê Làm" });
    const token = data.token as string;
    const catalog = await call(api, "/api", "GET", "/catalog");
    const species = (catalog.data.species as Json[]).find((s) => s.adoptable && !s.mascot) as Json;
    const pet = ((await game("POST", "/pets", token, { name: "Bé Chăm", species: species.id })).data.pets as Json[])[0] as Json;
    const career = Object.keys(catalog.data.careers as Json)[0];
    expect((await game("POST", "/jobs/start", token, { petId: pet.id, career, hours: 1 })).status).toBe(200);
    const mine = ((await game("GET", "/me", token)).data.pets as Json[]).find((p) => p.id === pet.id) as Json;
    expect(mine).toMatchObject({ busyKind: "work" });
    expect((await game("POST", `/pets/${pet.id}/bath`, token)).data.error).toMatch(/đang bận/);
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

describe("Pet Town name + password accounts", () => {
  it("signs up with a name and a password, then signs in with them", async () => {
    const reg = await internal("POST", "/account/register", { username: "Mèo_Mun", password: "meomun1" });
    expect(reg.status).toBe(200);
    expect(reg.data).toMatchObject({ username: "Mèo_Mun", displayName: "Mèo_Mun", kind: "player", hasPassword: true });
    const me = await game("GET", "/me", reg.data.token as string);
    expect((me.data.user as Json).coins).toBe(150); // same welcome coins as everyone

    expect((await internal("POST", "/account/register", { username: "mèo_mun", password: "khac123" })).data.error).toMatch(/đã có người dùng/);
    expect((await internal("POST", "/account/register", { username: "có dấu cách", password: "abcdef" })).status).toBe(400);
    expect((await internal("POST", "/account/register", { username: "NganNgan", password: "12345" })).data.error).toMatch(/6 ký tự/);

    const login = await internal("POST", "/account/login", { username: "Mèo_Mun", password: "meomun1" });
    expect(login.status).toBe(200);
    expect(login.data.userId).toBe(reg.data.userId);
    expect((await game("GET", "/me", login.data.token as string)).status).toBe(200);
    expect((await internal("POST", "/account/login", { username: "Mèo_Mun", password: "sai-roi" })).data.error).toBe("Sai tên đăng nhập hoặc mật khẩu.");
    expect((await internal("POST", "/account/login", { username: "KhongCo", password: "abcdef" })).data.error).toBe("Sai tên đăng nhập hoặc mật khẩu.");
  });

  it("lets an existing member or guest add a password and keep their account", async () => {
    const sso = await internal("POST", "/sso", { crmUserId: "crm-pass", name: "Lý Thường Kiệt" });
    const before = await internal("POST", "/guest/resume", { token: sso.data.token });
    expect(before.data).toMatchObject({ ok: true, kind: "member", hasPassword: false, username: "Lý_Thường_Kiệt" });
    // signing in by the old name without a password says how to add one
    expect((await internal("POST", "/account/login", { username: "Lý_Thường_Kiệt", password: "" })).data.error).toMatch(/chưa có mật khẩu/);

    const taken = await internal("POST", "/account/credentials", { token: sso.data.token, username: "Mèo_Mun", password: "binh123" });
    expect(taken.data.error).toMatch(/đã có người dùng/);
    const set = await internal("POST", "/account/credentials", { token: sso.data.token, username: "BinhTran", password: "binh123" });
    expect(set.data).toMatchObject({ userId: sso.data.userId, username: "BinhTran", displayName: "Lý Thường Kiệt", hasPassword: true });
    const login = await internal("POST", "/account/login", { username: "binhtran", password: "binh123" });
    expect(login.data.userId).toBe(sso.data.userId);
    expect((await internal("POST", "/guest/resume", { token: login.data.token })).data).toMatchObject({ hasPassword: true });
    // WorkHub sign-in still finds the same account after the rename
    expect((await internal("POST", "/sso", { crmUserId: "crm-pass", name: "Lý Thường Kiệt" })).data.userId).toBe(sso.data.userId);
    expect((await internal("POST", "/account/credentials", { token: "khong-hop-le", username: "Ai_Do", password: "abcdef" })).status).toBe(400);
  });

  it("compares login names without case, accented letters included", async () => {
    const reg = await internal("POST", "/account/register", { username: "Đức_Anh", password: "ducanh1" });
    expect(reg.status).toBe(200);
    expect((await internal("POST", "/account/login", { username: "đức_anh", password: "ducanh1" })).data.userId).toBe(reg.data.userId);
    expect((await internal("POST", "/account/login", { username: "ĐỨC_ANH", password: "ducanh1" })).data.userId).toBe(reg.data.userId);
    // decomposed (NFD) spelling of the same name
    expect((await internal("POST", "/account/login", { username: "Đức_Anh".normalize("NFD"), password: "ducanh1" })).data.userId).toBe(reg.data.userId);
    expect((await internal("POST", "/account/register", { username: "ĐỨC_anh", password: "khac123" })).data.error).toMatch(/đã có người dùng/);
  });

  it("changing a password needs the current one and signs every other session out", async () => {
    const reg = await internal("POST", "/account/register", { username: "Thay_Mat_Khau", password: "cu12345" });
    const other = await internal("POST", "/account/login", { username: "Thay_Mat_Khau", password: "cu12345" });
    const token = reg.data.token as string;
    const noCurrent = await internal("POST", "/account/credentials", { token, username: "Thay_Mat_Khau", password: "moi12345" });
    expect(noCurrent.data.error).toBe("Mật khẩu hiện tại chưa đúng.");
    const wrong = await internal("POST", "/account/credentials", { token, currentPassword: "sai", username: "Thay_Mat_Khau", password: "moi12345" });
    expect(wrong.status).toBe(400);
    const ok = await internal("POST", "/account/credentials", { token, currentPassword: "cu12345", username: "Thay_Mat_Khau", password: "moi12345" });
    expect(ok.data).toMatchObject({ hasPassword: true });
    expect((await game("GET", "/me", token)).status).toBe(200); // this session stays
    expect((await game("GET", "/me", other.data.token as string)).status).toBe(401); // the other one is gone
    expect((await internal("POST", "/account/login", { username: "Thay_Mat_Khau", password: "cu12345" })).status).toBe(400);
    expect((await internal("POST", "/account/login", { username: "Thay_Mat_Khau", password: "moi12345" })).status).toBe(200);
  });

  it("an old account without a password: the name alone gets only 'chưa có mật khẩu', and a password needs proof", async () => {
    const sso = await internal("POST", "/sso", { crmUserId: "crm-claim", name: "Hồ Xuân Hương" });
    const name = sso.data.username as string;
    const login = await internal("POST", "/account/login", { username: name, password: "" });
    expect(login.status).toBe(409);
    expect(login.data).toEqual({ error: "Tài khoản này chưa có mật khẩu.", reason: "no_password" });

    // knowing the name is not enough, nor is another player's session
    const stranger = await internal("POST", "/account/register", { username: "Nguoi_La", password: "abcdef" });
    for (const tokens of [[], ["x".repeat(48)], [stranger.data.token]]) {
      const res = await internal("POST", "/account/claim", { username: name, password: "chiem123", tokens });
      expect(res.status).toBe(409);
      expect(res.data.reason).toBe("no_proof");
    }
    // the browser that still holds this account's session can set it
    const claimed = await internal("POST", "/account/claim", { username: name.toUpperCase(), password: "xuanhuong1", tokens: [stranger.data.token, sso.data.token] });
    expect(claimed.status).toBe(200);
    expect(claimed.data).toMatchObject({ userId: sso.data.userId, username: name, hasPassword: true });
    expect((await internal("POST", "/account/login", { username: name, password: "xuanhuong1" })).data.userId).toBe(sso.data.userId);
    // once it has a password, claiming again does nothing
    const again = await internal("POST", "/account/claim", { username: name, password: "doilai123", tokens: [sso.data.token] });
    expect(again.data.reason).toBe("no_proof");
  });

  it("an administrator's password link works once, for 24 hours, and the newest one wins", async () => {
    const guest = await internal("POST", "/sso", { crmUserId: "crm-link", name: "Trưng Trắc" });
    const userId = guest.data.userId as number;
    const first = await internal("POST", `/admin/players/${userId}/password-link`, { actor: "Admin" });
    const second = await internal("POST", `/admin/players/${userId}/password-link`, { actor: "Admin" });
    expect(second.data.code).toMatch(/^[a-f0-9]{32}$/);
    expect((second.data.expiresAt as number) - Date.now()).toBeGreaterThan(23.9 * 3_600_000);
    expect((await internal("GET", `/password-links/${first.data.code}`)).data).toEqual({ valid: false }); // replaced
    expect((await internal("GET", `/password-links/${second.data.code}`)).data).toMatchObject({ valid: true, displayName: "Trưng Trắc", hasPassword: false });

    const used = await internal("POST", "/account/setup", { code: second.data.code, username: "Trung_Trac", password: "trungtrac1" });
    expect(used.status).toBe(200);
    expect(used.data).toMatchObject({ userId, username: "Trung_Trac", hasPassword: true });
    expect((await game("GET", "/me", guest.data.token as string)).status).toBe(401); // old sessions signed out
    expect((await game("GET", "/me", used.data.token as string)).status).toBe(200);
    expect((await internal("POST", "/account/login", { username: "trung_trac", password: "trungtrac1" })).data.userId).toBe(userId);
    // single use
    expect((await internal("POST", "/account/setup", { code: second.data.code, username: "Trung_Trac", password: "khac1234" })).data.error).toMatch(/không còn hiệu lực/);
    expect((await internal("GET", `/password-links/${second.data.code}`)).data).toEqual({ valid: false });
    // the admin log records the link and its use, never the code
    const log = await internal("GET", "/admin/log");
    const entries = (log.data.entries ?? log.data.log ?? log.data) as Json[];
    const mine = (Array.isArray(entries) ? entries : []).filter((e) => e.user_id === userId);
    expect(mine.map((e) => e.action)).toEqual(expect.arrayContaining(["password_link", "password_set"]));
    expect(JSON.stringify(log.data)).not.toContain(second.data.code as string);
    // expired
    const third = await internal("POST", `/admin/players/${userId}/password-link`, { actor: "Admin" });
    store.db.prepare("UPDATE password_links SET expires_at = 1 WHERE used_at IS NULL").run();
    expect((await internal("POST", "/account/setup", { code: third.data.code, username: "Trung_Trac", password: "khac1234" })).data.error).toMatch(/không còn hiệu lực/);
  });

  it("a banned player cannot sign in", async () => {
    const reg = await internal("POST", "/account/register", { username: "BiKhoa", password: "abcdef" });
    await internal("POST", `/admin/players/${reg.data.userId}/status`, { banned: true, actor: "Admin" });
    expect((await internal("POST", "/account/login", { username: "BiKhoa", password: "abcdef" })).data.error).toMatch(/khóa/);
  });
});
