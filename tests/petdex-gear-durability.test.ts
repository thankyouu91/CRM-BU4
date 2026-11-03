import { beforeAll, describe, expect, it } from "vitest";

// Gear durability: after a clan arena battle every piece the participants wear breaks and gives no bonus
// until it is repaired at the Lò rèn. Runs the real game modules on an in-memory SQLite.

process.env.PETDEX_DB = ":memory:";

type Json = Record<string, unknown>;
let internalApi: unknown;
let api: unknown;
let handleFetch: (router: unknown, request: Request, opts: { prefix: string }) => Promise<Response>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- plain JS module, loosely typed
let gearMod: any;
let store: { getPet(id: number): Json; gearBonusOf(id: number, now?: number): Json; db: { prepare(sql: string): { get(...a: unknown[]): unknown } } };
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- plain JS modules, loosely typed
let forge: any, market: any, shared: any;
const HOUR = 3_600_000;
/** Replays fixed rolls: each call returns the next value. */
const rolls = (...values: number[]) => () => (values.length > 1 ? values.shift()! : values[0]);
const coinsOf = (userId: number) => (store.db.prepare("SELECT coins FROM users WHERE id = ?").get(userId) as { coins: number }).coins;

const call = async (router: unknown, prefix: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await handleFetch(router, new Request(`http://x${prefix}${path}`, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), { prefix });
  return { status: res.status, data: (await res.json()) as Json };
};
const internal = (method: string, path: string, body?: unknown) => call(internalApi, "/internal", method, path, body);
const game = (method: string, path: string, token: string, body?: unknown) => call(api, "/api", method, path, body, { authorization: `Bearer ${token}` });

async function player(name: string, coins = 5000) {
  const reg = await internal("POST", "/account/register", { username: name, password: "abcdef1" });
  const userId = reg.data.userId as number;
  if (coins) await internal("POST", `/admin/players/${userId}/coins`, { delta: coins, actor: "Admin" });
  const catalog = await call(api, "/api", "GET", "/catalog");
  const species = (catalog.data.species as Json[]).find((s) => s.adoptable && !s.mascot) as Json;
  const adopted = await game("POST", "/pets", reg.data.token as string, { name: `Bé ${name}`.slice(0, 16), species: species.id });
  const pet = (adopted.data.pets as Json[])[0] as Json;
  return { token: reg.data.token as string, userId, petId: pet.id as number };
}

/** A worn piece with known lines, made directly so the test does not depend on shop rolls. */
async function wornPiece(p: { token: string; userId: number; petId: number }, itemId = "bow", tier = "gold", affixes: Record<string, number> = { income: 10, stats: 8, trade: 6 }) {
  const g = gearMod.createGear(p.userId, itemId, { tier, affixes, source: "test" }) as Json;
  expect((await game("POST", `/pets/${p.petId}/equip`, p.token, { gearId: g.id })).status).toBe(200);
  return g;
}

beforeAll(async () => {
  ({ internalApi } = await import("@/petdex/server/internal.js"));
  ({ api } = await import("@/petdex/server/routes.js"));
  ({ handleFetch } = await import("@/petdex/server/router.js"));
  gearMod = await import("@/petdex/server/gear.js");
  forge = await import("@/petdex/server/forge.js");
  market = await import("@/petdex/server/market.js");
  shared = await import("@/public/ta-tua/game/js/shared/gear.js");
  store = (await import("@/petdex/server/db.js")) as unknown as typeof store;
  (await import("@/petdex/server/migrate.js")).migrate();
});

describe("Pet Town gear durability", () => {
  it("an arena battle breaks every worn piece of the participants: it stays on but gives no bonus", async () => {
    const a = await player("Dau_Si_A");
    const b = await player("Dau_Si_B");
    const bystander = await player("Dung_Xem");
    const ga = await wornPiece(a);
    const gb = await wornPiece(b, "bow", "blue", { income: 4 });
    const gc = await wornPiece(bystander, "bow", "blue", { income: 4 });
    const spare = gearMod.createGear(a.userId, "crown", { tier: "red", affixes: { income: 5, stats: 5, trade: 5, luck: 5 }, source: "test" }) as Json;
    expect(store.getPet(a.petId).bonus).toMatchObject({ income: 10, stats: 8, trade: 6 });

    expect(gearMod.breakWornGear([a.userId, b.userId, a.userId], Date.now())).toBe(2);
    expect(gearMod.breakWornGear([a.userId])).toBe(0); // already broken

    expect(store.getPet(a.petId).bonus).toEqual({ income: 0, stats: 0, trade: 0, luck: 0 });
    expect(store.getPet(b.petId).bonus).toEqual({ income: 0, stats: 0, trade: 0, luck: 0 });
    expect(store.getPet(bystander.petId).bonus).toMatchObject({ income: 4 });
    expect(gearMod.userBonus(a.userId)).toEqual({ income: 0, stats: 0, trade: 0, luck: 0 });

    const me = (await game("GET", "/me", a.token)).data;
    const pet = (me.pets as Json[]).find((x) => x.id === a.petId) as Json;
    expect(Object.values(pet.gear as Json)[0]).toMatchObject({ gearId: ga.id, broken: true, usable: false });
    const bag = me.gear as Json[];
    expect(bag.find((g) => g.id === ga.id)).toMatchObject({ broken: true, usable: false, wornBy: a.petId });
    expect(bag.find((g) => g.id === spare.id)).toMatchObject({ broken: false, usable: true }); // not worn, not broken
    expect(gb.id).not.toBe(gc.id);
  });

  it("repair costs coins and materials by tier, succeeds 70% of the time, then waits 24 hours at the forge", async () => {
    const p = await player("Tho_Ren", 20000);
    const g = await wornPiece(p);
    const config = gearMod.gearConfig().forge;
    expect(config.repairChance).toBe(70);
    expect(config.repairHours).toBe(24);
    expect(() => forge.repairGear(p.userId, g.id, Date.now(), rolls(0.1))).toThrow(/còn lành/);
    gearMod.breakWornGear([p.userId]);

    // no materials: refused, nothing taken
    const before = coinsOf(p.userId);
    expect(() => forge.repairGear(p.userId, g.id, Date.now(), rolls(0.1))).toThrow(/lô vật liệu/);
    expect(coinsOf(p.userId)).toBe(before);

    market.addGoods(p.userId, "cassava", 40 * 10);
    const cost = config.repair.gold;
    // a roll of 0.75 is above 70%: materials and coins are gone, the piece stays broken
    const t0 = Date.parse("2026-11-01T08:00:00Z");
    const fail = forge.repairGear(p.userId, g.id, t0, rolls(0.75));
    expect(fail.ok).toBe(false);
    expect(fail.message).toMatch(/thất bại/);
    expect(coinsOf(p.userId)).toBe(before - cost.coins);
    expect(forge.materialLots(p.userId, t0)).toBe(40 - cost.lots);
    expect(gearMod.getGear(g.id).broken).toBe(1);

    // a roll of 0.69 is inside 70%: repaired, but under repair for 24 hours
    const ok = forge.repairGear(p.userId, g.id, t0, rolls(0.69));
    expect(ok.ok).toBe(true);
    expect(ok.gear).toMatchObject({ broken: false, usable: false, repairUntil: t0 + 24 * HOUR });
    expect(store.gearBonusOf(p.petId, t0 + 23 * HOUR)).toEqual({ income: 0, stats: 0, trade: 0, luck: 0 });
    expect(store.gearBonusOf(p.petId, t0 + 24 * HOUR)).toMatchObject({ income: 10, stats: 8, trade: 6 });
    expect(() => forge.repairGear(p.userId, g.id, t0 + HOUR, rolls(0.1))).toThrow(/đang ở lò/);
    expect(() => forge.upgradeGear(p.userId, g.id, t0 + HOUR, rolls(0.1))).toThrow(/đang ở lò/);
    // broken or repairing pieces cannot be listed at the bazaar
    expect(() => gearMod.setGearListed(g.id, true)).toThrow(/hỏng hoặc đang sửa/);

    // over many seeded rolls the success rate is about 70%
    let seed = 42;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let wins = 0;
    for (let i = 0; i < 2000; i++) if (rand() * 100 < config.repairChance) wins++;
    expect(wins / 2000).toBeGreaterThan(0.66);
    expect(wins / 2000).toBeLessThan(0.74);
  });

  it("repair through the API uses the ledger kind gear_repair and costs more for higher tiers", async () => {
    const p = await player("Sua_Qua_API", 20000);
    const g = await wornPiece(p, "bow", "blue", { income: 4 });
    gearMod.breakWornGear([p.userId]);
    market.addGoods(p.userId, "cane", 10 * 10);
    const res = await game("POST", `/gear/${g.id}/repair`, p.token);
    expect(res.status).toBe(200);
    expect(String((res.data.result as Json).message)).toMatch(/Sửa (thành công|thất bại)/);
    const kinds = (store.db.prepare("SELECT GROUP_CONCAT(kind) AS k FROM ledger WHERE user_id = ?").get(p.userId) as { k: string }).k;
    expect(kinds).toContain("gear_repair");
    const r = gearMod.gearConfig().forge.repair;
    expect(r.blue.coins).toBeLessThan(r.green.coins);
    expect(r.green.coins).toBeLessThan(r.gold.coins);
    expect(r.gold.coins).toBeLessThan(r.red.coins);
    expect(r.blue.lots).toBeLessThan(r.red.lots);
    const view = (await game("GET", "/forge", p.token)).data;
    expect(view).toMatchObject({ rules: { repairChance: 70 } });
  });

  it("upgrade is at most 30%, lower for higher tiers; a failure costs everything and leaves the piece unchanged", async () => {
    const f = gearMod.gearConfig().forge;
    expect(f.upgradeChance.blue).toBeLessThanOrEqual(30);
    expect(f.upgradeChance.green).toBeLessThan(f.upgradeChance.blue);
    expect(f.upgradeChance.gold).toBeLessThan(f.upgradeChance.green);
    expect(() => shared.normalizeGearConfig({ forge: { upgradeChance: { blue: 31 } } })).toThrow(/0 đến 30%/);

    const p = await player("Nang_Cap", 100000);
    market.addGoods(p.userId, "cassava", 150 * 10);
    const g = gearMod.createGear(p.userId, "bow", { tier: "blue", affixes: { income: 5 }, source: "test" }) as Json;
    const now = Date.now();
    const coins0 = coinsOf(p.userId);
    const fail = forge.upgradeGear(p.userId, g.id, now, rolls(0.3)); // 30 is not < 30
    expect(fail.ok).toBe(false);
    expect(gearMod.getGear(g.id)).toMatchObject({ tier: "blue", affixes: { income: 5 } });
    expect(coinsOf(p.userId)).toBe(coins0 - f.upgrade.blue.coins);

    const ok = forge.upgradeGear(p.userId, g.id, now, rolls(0.29, 0.5, 0.5));
    expect(ok.ok).toBe(true);
    const up = gearMod.getGear(g.id);
    expect(up.tier).toBe("green");
    expect(Object.keys(up.affixes)).toHaveLength(2);
    expect(up.affixes.income).toBe(8); // top of blue stays top of green
    const kinds = (store.db.prepare("SELECT GROUP_CONCAT(kind) AS k FROM ledger WHERE user_id = ?").get(p.userId) as { k: string }).k;
    expect(kinds).toContain("gear_upgrade");

    const red = gearMod.createGear(p.userId, "bow", { tier: "red", affixes: { income: 10, stats: 10, trade: 10, luck: 10 }, source: "test" }) as Json;
    expect(() => forge.upgradeGear(p.userId, red.id, now, rolls(0))).toThrow(/cao nhất/);
    const worn = await wornPiece(p, "crown", "gold", { income: 7, stats: 7, trade: 7 });
    gearMod.breakWornGear([p.userId]);
    expect(() => forge.upgradeGear(p.userId, worn.id, now, rolls(0))).toThrow(/hỏng/);
  });

  it("the materials shop sells raw goods at a markup into the warehouse", async () => {
    const p = await player("Mua_Vat_Lieu", 20000);
    const view = forge.forgeView(p.userId);
    const cassava = view.materials.find((m: Json) => m.commodity === "cassava");
    const coins0 = coinsOf(p.userId);
    const res = await game("POST", "/forge/materials", p.token, { commodity: "cassava", lots: 2 });
    expect(res.status).toBe(200);
    expect(coinsOf(p.userId)).toBe(coins0 - cassava.price * 2);
    expect(forge.materialLots(p.userId)).toBe(2);
    expect((await game("POST", "/forge/materials", p.token, { commodity: "sugar", lots: 1 })).data.error).toMatch(/không bán/);
  });
});
