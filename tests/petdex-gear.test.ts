import { beforeAll, describe, expect, it } from "vitest";

// Tiered wearables (Xanh lam → Xanh lục → Vàng → Đỏ with 1–4 growth lines), their effects, the
// management board's controls, and gift codes. Runs the real game modules on an in-memory SQLite.

process.env.PETDEX_DB = ":memory:";

type Json = Record<string, unknown>;
let internalApi: unknown;
let api: unknown;
let handleFetch: (router: unknown, request: Request, opts: { prefix: string }) => Promise<Response>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- plain JS module, loosely typed
let shared: any;
let gearMod: Record<string, (...args: never[]) => unknown>;
let minigames: { rollDrops: (userId: number, pet: Json, now?: number, rand?: () => number) => Json };
let store: { db: { prepare(sql: string): { run(...args: unknown[]): unknown; get(...args: unknown[]): unknown } }; getPet(id: number): Json; adminLogs(limit?: number): Json[] };

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

beforeAll(async () => {
  ({ internalApi } = await import("@/petdex/server/internal.js"));
  ({ api } = await import("@/petdex/server/routes.js"));
  ({ handleFetch } = await import("@/petdex/server/router.js"));
  shared = await import("@/public/ta-tua/game/js/shared/gear.js");
  gearMod = (await import("@/petdex/server/gear.js")) as unknown as typeof gearMod;
  minigames = (await import("@/petdex/server/minigames.js")) as unknown as typeof minigames;
  store = (await import("@/petdex/server/db.js")) as unknown as typeof store;
  (await import("@/petdex/server/migrate.js")).migrate();
  (await import("@/petdex/server/scheduler.js")).runDue();
});

describe("Pet Town tiered gear rules", () => {
  it("rolls 1–4 lines by tier, within the configured ranges, each type at most once", () => {
    const config = shared.normalizeGearConfig(shared.DEFAULT_GEAR_CONFIG);
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const tier of shared.TIER_ORDER) {
      for (let i = 0; i < 50; i++) {
        const g = shared.rollGear(config, rand, { tier });
        expect(Object.keys(g.affixes)).toHaveLength(shared.TIERS[tier as keyof typeof shared.TIERS].lines);
        for (const [a, v] of Object.entries(g.affixes)) {
          const [lo, hi] = config.ranges[tier][a];
          expect(v).toBeGreaterThanOrEqual(lo);
          expect(v).toBeLessThanOrEqual(hi);
        }
      }
    }
  });

  it("luck makes high tiers more likely; odds of 0 never roll", () => {
    const odds = { blue: 60, green: 28, gold: 10, red: 2 };
    const count = (luck: number) => {
      let seed = 11;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      let red = 0;
      for (let i = 0; i < 20000; i++) if (shared.rollTier(odds, rand, luck) === "red") red++;
      return red / 20000;
    };
    expect(count(0)).toBeGreaterThan(0.012);
    expect(count(0)).toBeLessThan(0.03);
    expect(count(100)).toBeGreaterThan(count(0) * 3);
    expect(shared.rollTier({ blue: 0, green: 0, gold: 0, red: 100 }, () => 0.5)).toBe("red");
    expect(shared.rollTier({ blue: 100, green: 0, gold: 0, red: 0 }, () => 0.999, 500)).toBe("blue");
  });

  it("stacks with diminishing returns above the soft cap, up to the total cap, and validates admin input", () => {
    // 25 counts in full, the 35 above it counts half: 25 + 17.5
    expect(shared.sumBonus([{ income: 20, luck: 5 }, { income: 20 }, { income: 20 }])).toEqual({ income: 42.5, stats: 0, trade: 0, luck: 5 });
    expect(shared.sumBonus([{ income: 80 }, { income: 70 }])).toMatchObject({ income: shared.STACKING.totalCap });
    expect(shared.effectiveBonus(25)).toBe(25);
    // a fifth red piece still helps, but less than the third
    expect(shared.effectiveBonus(75) - shared.effectiveBonus(60)).toBeLessThan(shared.effectiveBonus(45) - shared.effectiveBonus(30) + 1e-9);
    expect(shared.gradeLuck(1)).toBe(0);
    expect(shared.gradeLuck(40)).toBe(40);
    expect(() => shared.normalizeGearConfig({ odds: { blue: 0, green: 0, gold: 0, red: 0 } })).toThrow(/ít nhất một cấp/);
    expect(() => shared.normalizeGearConfig({ ranges: { red: { income: [30, 10] } } })).toThrow(/Biên độ/);
    expect(() => shared.cleanAffixes({ speed: 5 })).toThrow(/Không có loại/);
  });
});

describe("Pet Town gear in play", () => {
  it("the shop sells a sealed box each time; opened, it shows 1–2 lines, is worn by id and its lines add up on the pet", async () => {
    const p = await player("Mua_Do");
    store.db.prepare("UPDATE pets SET level = 20 WHERE id = ?").run(p.petId); // the crown needs a level 20 pet
    const first = await game("POST", "/shop/buy", p.token, { itemId: "crown" });
    expect(first.status).toBe(200);
    expect((first.data.result as Json).message).toMatch(/hộp .*Mở hộp/);
    const second = await game("POST", "/shop/buy", p.token, { itemId: "crown" });
    expect(second.status).toBe(200); // no longer "already owned"
    const me = (await game("GET", "/me", p.token)).data;
    const boxes = me.gear as Json[];
    expect(boxes).toHaveLength(2);
    // still sealed: the player sees neither the tier nor the lines
    for (const box of boxes) expect(box).toMatchObject({ sealed: true, tier: null, affixes: {}, lines: [] });
    expect((await game("POST", "/shop/buy", p.token, { itemId: "crown", qty: 2 })).status).toBe(400);
    // a sealed box can be neither worn nor sold
    expect((await game("POST", `/pets/${p.petId}/equip`, p.token, { gearId: boxes[0].id })).data.error).toMatch(/Mở hộp/);
    // the admin board sees inside
    const board = await internal("GET", `/admin/players/${p.userId}`);
    expect(((board.data.gear as Json[]) ?? []).every((g) => g.sealed && g.tier)).toBe(true);

    const opened = await game("POST", `/gear/${boxes[0].id}/open`, p.token);
    expect(opened.status).toBe(200);
    const piece = (opened.data.result as Json).opened as Json;
    expect(["blue", "green"]).toContain(piece.tier);
    expect((piece.lines as string[]).length).toBeGreaterThanOrEqual(1);
    expect((piece.lines as string[]).length).toBeLessThanOrEqual(2);
    expect((await game("POST", `/gear/${boxes[0].id}/open`, p.token)).data.error).toMatch(/đã mở/);
    const other0 = await player("Mo_Ho_Hop");
    expect((await game("POST", `/gear/${boxes[1].id}/open`, other0.token)).data.error).toMatch(/không có món/);

    const worn = await game("POST", `/pets/${p.petId}/equip`, p.token, { gearId: piece.id });
    expect(worn.status).toBe(200);
    const pet = ((worn.data.pets as Json[]) ?? (await game("GET", "/me", p.token)).data.pets as Json[]).find((x) => x.id === p.petId) as Json;
    expect((pet.gear as Json).head).toMatchObject({ gearId: piece.id, tier: piece.tier });
    const bonus = pet.bonus as Record<string, number>;
    for (const [a, v] of Object.entries(piece.affixes as Record<string, number>)) expect(bonus[a]).toBe(v);
    // someone else's piece cannot be worn
    const other = await player("Nguoi_Khac");
    expect((await game("POST", `/pets/${other.petId}/equip`, other.token, { gearId: piece.id })).data.error).toMatch(/không có món/);
    // take it off
    await game("POST", `/pets/${p.petId}/equip`, p.token, { slot: "head" });
    expect(store.getPet(p.petId).bonus).toEqual({ income: 0, stats: 0, trade: 0, luck: 0 });
  });

  it("income raises shift pay, stats strengthens care, luck raises mini-game drops", async () => {
    const plain = await player("Thuong_Thuong");
    const geared = await player("Co_Do_Xin");
    const give = await internal("POST", `/admin/players/${geared.userId}/gear`, { itemId: "cape", tier: "red", affixes: { income: 50, stats: 50, trade: 40, luck: 100 }, actor: "Admin" });
    expect(give.data.gear).toMatchObject({ tier: "red", affixes: { income: 50, stats: 50, trade: 40, luck: 100 } });
    await game("POST", `/pets/${geared.petId}/equip`, geared.token, { gearId: (give.data.gear as Json).id });

    const catalog = await call(api, "/api", "GET", "/catalog");
    const career = Object.keys(catalog.data.careers as Json)[0];
    const pay = async (who: { token: string; petId: number }) => {
      await game("POST", "/jobs/start", who.token, { petId: who.petId, career, hours: 1 });
      const jobs = await game("GET", "/jobs", who.token);
      return ((jobs.data.shifts as Json[])[0] as Json).pay as number;
    };
    expect(await pay(geared)).toBeGreaterThan(0);
    await pay(plain);
    // the pay multiplier: a raw +50% income counts 25 + 25 / 2 = 37.5% after diminishing returns
    const { elementPay } = await import("@/petdex/server/elements.js");
    const pet = store.getPet(geared.petId);
    expect(elementPay(pet, 0) - elementPay({ ...pet, bonus: { income: 0, stats: 0, trade: 0, luck: 0 } }, 0)).toBeCloseTo(shared.effectiveBonus(50) / 100);
    expect(shared.effectiveBonus(50)).toBe(37.5);

    // stats: positive care effects are 50% stronger, costs unchanged
    const { boostEffect } = await import("@/petdex/server/game.js");
    expect(boostEffect({ bonus: { stats: 50 } }, { fullness: 20, energy: -10 })).toEqual({ fullness: 30, energy: -10 });

    // luck: a raw 100% luck counts 60% (the total cap), so a 50% material chance becomes 80%
    await internal("POST", "/admin/gear-config", { config: { materialChance: 50, gearDropChance: 50 }, actor: "Admin" });
    const lucky = store.getPet(geared.petId);
    const drops = minigames.rollDrops(geared.userId, lucky, Date.now(), () => 0.6);
    expect(drops.material).toBeTruthy();
    expect(drops.gear).toBeTruthy(); // 0.6 * 100 < 50 * 1.6
    const unlucky = minigames.rollDrops(plain.userId, store.getPet(plain.petId), Date.now(), () => 0.6);
    expect(unlucky.material).toBeNull();
    expect(unlucky.gear).toBeNull();
    await internal("POST", "/admin/gear-config", { config: shared.DEFAULT_GEAR_CONFIG, actor: "Admin" });

    // trade: a sale pays the active pet's % on top, as its own ledger line (raw 40% counts 32.5%)
    expect(gearMod.tradeBonus(geared.userId as never, 1000 as never, "Bán thử" as never)).toBe(325);
    expect(gearMod.tradeBonus(plain.userId as never, 1000 as never, "Bán thử" as never)).toBe(0);
    const ledger = (await internal("GET", `/admin/players/${geared.userId}`)).data.ledger as Json;
    expect(JSON.stringify(ledger)).toContain("+32.5% trang phục");
  });

  it("a piece sold at the bazaar moves to the buyer with its tier and lines", async () => {
    const seller = await player("Ban_Do");
    const buyer = await player("Mua_Lai");
    store.db.prepare("UPDATE users SET created_at = ? WHERE id IN (?, ?)").run(Date.now() - 30 * 86_400_000, seller.userId, buyer.userId);
    store.db.prepare("UPDATE pets SET level = 10 WHERE owner_id IN (?, ?)").run(seller.userId, buyer.userId);
    const g = (await internal("POST", `/admin/players/${seller.userId}/gear`, { itemId: "bow", tier: "gold", affixes: { trade: 9, luck: 8, stats: 7 }, actor: "Admin" })).data.gear as Json;
    await game("POST", `/pets/${seller.petId}/equip`, seller.token, { gearId: g.id });
    const view = (await game("GET", "/bazaar", seller.token)).data;
    const sellable = (view.sellable as Json).gear as Json[];
    const mine = sellable.find((x) => x.id === g.id) as Json;
    expect(mine.refPrice).toBeGreaterThan(0);
    expect((await game("POST", "/bazaar/list", seller.token, { kind: "item", ref: "bow", price: 50 })).data.error).toMatch(/từng món/);
    const listed = await game("POST", "/bazaar/list", seller.token, { kind: "gear", ref: String(g.id), price: mine.refPrice });
    expect(listed.status).toBe(200);
    expect(store.getPet(seller.petId).bonus).toEqual({ income: 0, stats: 0, trade: 0, luck: 0 }); // taken off when listed
    expect(((await game("GET", "/me", seller.token)).data.gear as Json[]).some((x) => x.id === g.id)).toBe(false);
    const listing = (((await game("GET", "/bazaar", buyer.token)).data.listings as Json[]).find((l) => l.kind === "gear")) as Json;
    expect(listing).toMatchObject({ tier: "gold" });
    expect((await game("POST", `/bazaar/${listing.id}/buy`, buyer.token)).status).toBe(200);
    const got = ((await game("GET", "/me", buyer.token)).data.gear as Json[]).find((x) => x.id === g.id) as Json;
    expect(got).toMatchObject({ tier: "gold", affixes: { trade: 9, luck: 8, stats: 7 } });
  });

  it("the board edits and removes a player's piece, and keeps a log", async () => {
    const p = await player("Sua_Do");
    const g = (await internal("POST", `/admin/players/${p.userId}/gear`, { itemId: "glasses", tier: "random", actor: "Admin" })).data.gear as Json;
    expect(Object.keys(g.affixes as Json).length).toBe(shared.TIERS[g.tier as keyof typeof shared.TIERS].lines);
    const edited = await internal("POST", `/admin/gear/${g.id}`, { tier: "red", affixes: { income: 20, stats: 20, trade: 20, luck: 20 }, actor: "Admin" });
    expect(edited.data.gear).toMatchObject({ tier: "red", affixes: { income: 20, stats: 20, trade: 20, luck: 20 } });
    expect((await internal("POST", `/admin/gear/${g.id}`, { tier: "red", affixes: { income: 500 }, actor: "Admin" })).status).toBe(400);
    await game("POST", `/pets/${p.petId}/equip`, p.token, { gearId: g.id });
    expect((await internal("POST", `/admin/gear/${g.id}/delete`, { actor: "Admin" })).status).toBe(200);
    expect(store.getPet(p.petId).wear).toEqual({});
    const detail = await internal("GET", `/admin/players/${p.userId}`);
    expect(detail.data.gear).toEqual([]);
    const log = ((await internal("GET", "/admin/log")).data.log as Json[]).filter((e) => e.user_id === p.userId).map((e) => e.action);
    expect(log).toEqual(expect.arrayContaining(["gear_grant", "gear_edit", "gear_delete"]));
  });

  it("game config changes are validated and logged", async () => {
    const bad = await internal("POST", "/admin/gear-config", { config: { odds: { blue: 0, green: 0, gold: 0, red: 0 } }, actor: "Admin" });
    expect(bad.status).toBe(400);
    const ok = await internal("POST", "/admin/gear-config", { config: { ...shared.DEFAULT_GEAR_CONFIG, odds: { blue: 40, green: 30, gold: 20, red: 10 } }, actor: "Admin" });
    expect((ok.data.config as Json).odds).toEqual({ blue: 40, green: 30, gold: 20, red: 10 });
    expect(((await internal("GET", "/admin/gear-config")).data.config as Json).odds).toEqual({ blue: 40, green: 30, gold: 20, red: 10 });
    await internal("POST", "/admin/gear-config", { config: shared.DEFAULT_GEAR_CONFIG, actor: "Admin" });
  });
});

describe("Pet Town wear limits and shop boxes", () => {
  it("shop boxes only roll 1 or 2 lines", () => {
    const config = shared.normalizeGearConfig(shared.DEFAULT_GEAR_CONFIG);
    let seed = 5;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const tiers = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const g = shared.rollShopGear(config, rand, { luck: 100 });
      tiers.add(g.tier);
      expect(Object.keys(g.affixes).length).toBe(g.tier === "blue" ? 1 : 2);
    }
    expect([...tiers].sort()).toEqual(["blue", "green"]);
  });

  it("under level 30 a pet wears 3 pieces, from 30 it wears 4, and a legendary pet one more", async () => {
    const pets = await import("@/public/ta-tua/game/js/shared/pets.js");
    expect(pets.wearLimit(1, "thuong")).toBe(3);
    expect(pets.wearLimit(29, "quy")).toBe(3);
    expect(pets.wearLimit(30, "hiem")).toBe(4);
    expect(pets.wearLimit(29, "huyenthoai")).toBe(4);
    expect(pets.wearLimit(30, "huyenthoai")).toBe(5);

    const p = await player("Deo_Nhieu");
    const give = async (itemId: string) => ((await internal("POST", `/admin/players/${p.userId}/gear`, { itemId, tier: "blue", actor: "Admin" })).data.gear as Json).id as number;
    const ids = await Promise.all(["crown", "glasses", "bell", "angel", "luckycoin"].map(give));
    const equip = (gearId: number) => game("POST", `/pets/${p.petId}/equip`, p.token, { gearId });
    for (const id of ids.slice(0, 3)) expect((await equip(id)).status).toBe(200);
    expect((await equip(ids[3])).data.error).toMatch(/chỉ đeo được 3 món/);
    // swapping inside an occupied slot is still fine
    const crown2 = await give("tophat");
    expect((await equip(crown2)).status).toBe(200);

    store.db.prepare("UPDATE pets SET level = 30 WHERE id = ?").run(p.petId);
    expect((await equip(ids[3])).status).toBe(200);
    expect((await equip(ids[4])).data.error).toMatch(/chỉ đeo được 4 món/);
    const me = (await game("GET", "/me", p.token)).data;
    expect(((me.pets as Json[]).find((x) => x.id === p.petId) as Json).wearLimit).toBe(4);

    const legend = pets.SPECIES.find((s: { rarity: string }) => s.rarity === "huyenthoai") as { id: string };
    store.db.prepare("UPDATE pets SET species = ? WHERE id = ?").run(legend.id, p.petId);
    expect((await equip(ids[4])).status).toBe(200); // the 5th slot: charm
    expect(Object.keys(store.getPet(p.petId).wear as Json).sort()).toEqual(["back", "charm", "face", "head", "neck"]);
  });

  it("every wearable has pixel art, a shop entry and a known slot", async () => {
    const pets = await import("@/public/ta-tua/game/js/shared/pets.js");
    const catalog = await call(api, "/api", "GET", "/catalog");
    const items = catalog.data.items as Record<string, Json>;
    const wearables = pets.WEARABLES as Record<string, { slot: string }>;
    const slots = pets.SLOTS as Record<string, unknown>;
    const ids = Object.keys(wearables);
    expect(ids.length).toBeGreaterThanOrEqual(40);
    for (const id of ids) {
      expect(items[id], id).toMatchObject({ type: "accessory", slot: wearables[id].slot });
      expect(slots[wearables[id].slot], id).toBeTruthy();
    }
    for (const slot of pets.SLOT_IDS) expect(ids.some((id) => wearables[id].slot === slot), slot).toBe(true);
  });
});

describe("Pet Town gift codes", () => {
  it("an admin makes a code; each player redeems it once, within its uses and dates", async () => {
    const created = await internal("POST", "/admin/gift-codes", {
      label: "Quà khai trương",
      maxUses: 2,
      rewards: { coins: 500, items: { bath: 2 }, gear: [{ itemId: "crown", tier: "gold" }, { itemId: "random", tier: "random" }] },
      actor: "Admin",
    });
    expect(created.status).toBe(200);
    const code = (created.data.code as Json).code as string;
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const a = await player("Nhan_Qua_A", 0);
    const before = ((await game("GET", "/me", a.token)).data.user as Json).coins as number;
    // Pin the roll so the random piece is also a crown, in another tier: the fixed gold crown must still be there.
    // The pin is the middle of the crown's share of the wearables list, so adding more wearables keeps it a crown.
    const catalog = await call(api, "/api", "GET", "/catalog");
    const wearables = Object.values(catalog.data.items as Record<string, Json>).filter((i) => i.type === "accessory");
    const pin = (wearables.findIndex((i) => i.id === "crown") + 0.5) / wearables.length;
    const pinnedTier = shared.rollTier(shared.DEFAULT_GEAR_CONFIG.odds, () => pin);
    expect(pinnedTier).not.toBe("gold");
    const realRandom = Math.random;
    Math.random = () => pin;
    let got;
    try {
      got = await game("POST", "/gifts/redeem", a.token, { code: code.toLowerCase() });
    } finally {
      Math.random = realRandom;
    }
    expect(got.status).toBe(200);
    expect((got.data.result as Json).message).toMatch(/Quà khai trương/);
    const given = (got.data.result as Json).gear as Json[];
    expect(given.map((g) => [g.itemId, g.tier])).toEqual([["crown", "gold"], ["crown", pinnedTier]]);
    expect(given.every((g) => !g.sealed)).toBe(true); // only shop boxes come sealed
    const me = (await game("GET", "/me", a.token)).data;
    expect((me.user as Json).coins).toBe(before + 500);
    expect((me.inventory as Json).bath).toBe(2);
    const gear = me.gear as Json[];
    expect(gear).toHaveLength(2);
    expect(gear.some((g) => g.itemId === "crown" && g.tier === "gold")).toBe(true);
    expect((await game("POST", "/gifts/redeem", a.token, { code })).data.error).toMatch(/nhận quà của mã này rồi/);

    const b = await player("Nhan_Qua_B", 0);
    expect((await game("POST", "/gifts/redeem", b.token, { code })).status).toBe(200);
    const c = await player("Nhan_Qua_C", 0);
    expect((await game("POST", "/gifts/redeem", c.token, { code })).data.error).toMatch(/hết lượt/);
    expect((await game("POST", "/gifts/redeem", c.token, { code: "KHONG-CO" })).data.error).toMatch(/không đúng/);

    const detail = await internal("GET", `/admin/gift-codes/${(created.data.code as Json).id}`);
    expect((detail.data.redemptions as Json[]).map((r) => r.userId).sort()).toEqual([a.userId, b.userId].sort());
  });

  it("custom codes, revocation and expiry; bad rewards are refused", async () => {
    expect((await internal("POST", "/admin/gift-codes", { code: "TET2027", label: "Tết", rewards: {}, actor: "Admin" })).data.error).toMatch(/ít nhất một phần quà/);
    expect((await internal("POST", "/admin/gift-codes", { code: "x", rewards: { coins: 10 }, actor: "Admin" })).data.error).toMatch(/4–32/);
    expect((await internal("POST", "/admin/gift-codes", { code: "TET2027", rewards: { items: { crown: 1 } }, actor: "Admin" })).data.error).toMatch(/Trang phục/);
    const made = await internal("POST", "/admin/gift-codes", { code: "tet2027", label: "Tết", rewards: { coins: 100 }, actor: "Admin" });
    expect((made.data.code as Json).code).toBe("TET2027");
    expect((await internal("POST", "/admin/gift-codes", { code: "TET2027", rewards: { coins: 1 }, actor: "Admin" })).data.error).toMatch(/đã có/);
    await internal("POST", `/admin/gift-codes/${(made.data.code as Json).id}/revoke`, { actor: "Admin" });
    const p = await player("Ma_Tet", 0);
    expect((await game("POST", "/gifts/redeem", p.token, { code: "TET2027" })).data.error).toMatch(/thu hồi/);

    const soon = await internal("POST", "/admin/gift-codes", { code: "HETHAN1", rewards: { coins: 5 }, expiresAt: Date.now() + 60_000, actor: "Admin" });
    store.db.prepare("UPDATE gift_codes SET expires_at = 1 WHERE id = ?").run((soon.data.code as Json).id);
    expect((await game("POST", "/gifts/redeem", p.token, { code: "HETHAN1" })).data.error).toMatch(/hết hạn/);
  });

  it("generates a batch of random codes with the same rewards, logged once", async () => {
    const res = await internal("POST", "/admin/gift-codes", { label: "Sự kiện", count: 5, maxUses: 1, rewards: { coins: 20, gear: [{ itemId: "random", tier: "green" }] }, actor: "Admin" });
    expect(res.status).toBe(200);
    const codes = res.data.codes as Json[];
    expect(codes).toHaveLength(5);
    expect(new Set(codes.map((c) => c.code)).size).toBe(5);
    for (const c of codes) expect(c.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    const logs = store.adminLogs(20).filter((l: Json) => l.action === "gift_code" && (l.details as Json).label === "Sự kiện");
    expect(logs).toHaveLength(1);
    expect((logs[0].details as Json).codes).toEqual(codes.map((c) => c.code));

    const p = await player("Lo_Ma", 0);
    const got = await game("POST", "/gifts/redeem", p.token, { code: codes[2].code });
    expect(got.status).toBe(200);
    expect(((got.data.result as Json).gear as Json[])[0].tier).toBe("green");
    // single-use: a second player cannot take the same code
    const q = await player("Lo_Mb", 0);
    expect((await game("POST", "/gifts/redeem", q.token, { code: codes[2].code })).data.error).toMatch(/hết lượt/);

    expect((await internal("POST", "/admin/gift-codes", { code: "BATCH01", count: 3, rewards: { coins: 1 }, actor: "Admin" })).data.error).toMatch(/để trống ô mã/);
    expect((await internal("POST", "/admin/gift-codes", { count: 201, rewards: { coins: 1 }, actor: "Admin" })).data.error).toMatch(/1 đến 200/);
    const listing = await internal("GET", "/admin/gift-codes");
    expect((listing.data.items as Json[]).some((i) => i.id === "crown")).toBe(false);
    expect((listing.data.wearables as Json[]).some((i) => i.id === "crown")).toBe(true);
  });

  it("gives random or pet-matched rewards, so a gift fits each player's element", async () => {
    const { elementOfSpecies, relation } = await import("@/public/ta-tua/game/js/shared/pets.js");
    const ITEMS = (await import("@/petdex/server/game.js")).ITEMS as Record<string, { type: string; element?: string }>;
    const created = await internal("POST", "/admin/gift-codes", {
      label: "Quà hợp mệnh",
      rewards: {
        entries: [
          { kind: "item", pick: "match", category: "egg", qty: 1 },
          { kind: "gear", pick: "match", tier: "gold" },
          { kind: "item", pick: "random", category: "food", qty: 2 },
        ],
      },
      actor: "Admin",
    });
    expect(created.status).toBe(200);
    expect((created.data.code as Json).rewardsText).toBe("1 × Trứng ngũ hành hợp mệnh bé chính, Trang phục hợp mệnh bé chính (cấp Vàng), 2 × Đồ ăn ngẫu nhiên");
    const code = (created.data.code as Json).code as string;
    const p = await player("Hop_Menh", 0);
    const element = elementOfSpecies(store.getPet(p.petId).species as string);
    const fits = (itemElement: string) => ["same", "feeds"].includes(relation(itemElement, element));
    const got = await game("POST", "/gifts/redeem", p.token, { code });
    expect(got.status).toBe(200);
    const me = (await game("GET", "/me", p.token)).data;
    const inventory = me.inventory as Record<string, number>;
    const eggs = Object.keys(inventory).filter((id) => id.startsWith("egg_"));
    expect(eggs).toHaveLength(1);
    expect(fits(ITEMS[eggs[0]].element as string)).toBe(true);
    const gear = (me.gear as Json[])[0];
    expect(gear.tier).toBe("gold");
    expect(fits(gear.element as string)).toBe(true);
    const foods = Object.entries(inventory).filter(([id]) => ITEMS[id]?.type === "food");
    expect(foods.reduce((n, [, qty]) => n + qty, 0)).toBe(2);
    expect((got.data.result as Json).received as string[]).toHaveLength(3);
  });

  it("lets the player choose one of several rewards, consuming nothing until they pick", async () => {
    const created = await internal("POST", "/admin/gift-codes", {
      label: "Chọn quà",
      maxUses: 1,
      rewards: {
        coins: 50,
        choice: [
          { kind: "coins", amount: 300 },
          { kind: "item", pick: "fixed", itemId: "cake", qty: 1 },
          { kind: "gear", pick: "random", tier: "red" },
        ],
      },
      actor: "Admin",
    });
    expect(created.status).toBe(200);
    const { code, id } = created.data.code as { code: string; id: number };
    expect((created.data.code as Json).rewardsText).toBe("50 🪙, tự chọn 1 trong: 300 🪙 / 1 × 🍰 Bánh kem dâu / Trang phục ngẫu nhiên (cấp Đỏ)");
    const p = await player("Chon_Qua", 0);
    const before = ((await game("GET", "/me", p.token)).data.user as Json).coins as number;

    const ask = await game("POST", "/gifts/redeem", p.token, { code });
    expect(ask.status).toBe(200);
    expect(ask.data.result).toMatchObject({ needsChoice: true, always: "50 🪙", options: [{ index: 0, text: "300 🪙" }, { index: 1, text: "1 × 🍰 Bánh kem dâu" }, { index: 2, text: "Trang phục ngẫu nhiên (cấp Đỏ)" }] });
    expect(((await internal("GET", `/admin/gift-codes/${id}`)).data.code as Json).uses).toBe(0);
    expect((await game("POST", "/gifts/redeem", p.token, { code, choice: 7 })).data.error).toMatch(/không hợp lệ/);
    expect(((await internal("GET", `/admin/gift-codes/${id}`)).data.code as Json).uses).toBe(0);

    const got = await game("POST", "/gifts/redeem", p.token, { code, choice: 1 });
    expect(got.status).toBe(200);
    expect((got.data.result as Json).message).toBe("🎁 Chọn quà: đã nhận 50 🪙, 1 × 🍰 Bánh kem dâu.");
    const me = (await game("GET", "/me", p.token)).data;
    expect((me.user as Json).coins).toBe(before + 50);
    expect((me.inventory as Json).cake).toBe(1);
    expect(me.gear).toEqual([]);
    expect((await game("POST", "/gifts/redeem", p.token, { code, choice: 0 })).data.error).toMatch(/nhận quà của mã này rồi/);
    const q = await player("Chon_Qua_B", 0);
    expect((await game("POST", "/gifts/redeem", q.token, { code })).data.error).toMatch(/hết lượt/);
  });

  it("checks the reward setup", async () => {
    const make = (rewards: Json) => internal("POST", "/admin/gift-codes", { rewards, actor: "Admin" });
    expect((await make({ choice: [{ kind: "coins", amount: 10 }] })).data.error).toMatch(/từ 2 đến 6/);
    expect((await make({ entries: [{ kind: "item", pick: "match", category: "toy" }] })).data.error).toMatch(/không có hành/);
    expect((await make({ entries: [{ kind: "item", pick: "random" }] })).data.error).toMatch(/nhóm vật phẩm/);
    expect((await make({ entries: [{ kind: "coins", amount: 10 }] })).data.error).toMatch(/ô Xu/);
    expect((await make({ entries: [{ kind: "gear", pick: "fixed", itemId: "cake", tier: "red" }] })).data.error).toMatch(/Trang phục không hợp lệ/);
  });

  it("limits guessing: at most 10 tries a minute per player", async () => {
    const p = await player("Do_Ma", 0);
    for (let i = 0; i < 10; i++) await game("POST", "/gifts/redeem", p.token, { code: `SAI-${1000 + i}` });
    expect((await game("POST", "/gifts/redeem", p.token, { code: "SAI-9999" })).data.error).toMatch(/nhiều quá/);
  });
});
