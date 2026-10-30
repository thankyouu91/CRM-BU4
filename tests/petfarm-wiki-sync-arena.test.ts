import { beforeAll, describe, expect, it } from "vitest";
import { ARENA_SERVER, ESSENTIALS_SHOP, FORGE_SHOP, clanItemPrice, npcQuota } from "@/lib/wiki/rules-arena";
import { ESSENTIALS } from "@/public/ta-tua/game/js/shared/industry.js";

// The arena, forge and essentials articles read most numbers from the game's shared modules. The few
// they copy live in lib/wiki/rules-arena.ts; this test runs the game's own code on an in-memory
// database and fails as soon as one of them changes, naming the number to update.

process.env.PETDEX_DB = ":memory:";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- plain JS modules, loosely typed
let store: any, ledger: any, migrate: any, clans: any, arena: any, forge: any, essentials: any, clock: any, clanRules: any, arenaRules: any;

const T0 = Date.parse("2026-11-25T03:00:00Z");
let n = 0;
function player(level: number, created = T0 - 30 * 86_400_000) {
  n += 1;
  const id = store.createUser(`wiki${n}`, "x", created);
  ledger.post({ userId: id, delta: 5_000_000, kind: "opening", now: T0 });
  const petId = store.insertPet(id, `Bé ${n}`, "test_pet", T0 - 20 * 86_400_000);
  store.savePet({ ...store.getPet(petId), level, updated_at: T0 });
  store.setActivePet(id, petId);
  return id;
}

beforeAll(async () => {
  store = await import("@/petdex/server/db.js");
  ledger = await import("@/petdex/server/ledger.js");
  ({ migrate } = await import("@/petdex/server/migrate.js"));
  clans = await import("@/petdex/server/clans.js");
  arena = await import("@/petdex/server/arena.js");
  forge = await import("@/petdex/server/forge.js");
  essentials = await import("@/petdex/server/essentials.js");
  clock = await import("@/petdex/server/clock.js");
  clanRules = await import("@/public/ta-tua/game/js/shared/clan.js");
  arenaRules = await import("@/public/ta-tua/game/js/shared/arena.js");
  migrate(T0);
});

describe("Petfarm wiki stays in step with the arena, forge and essentials", () => {
  it("has the materials shop's lots per purchase (lib/wiki/rules-arena.ts FORGE_SHOP)", () => {
    const material = forge.FORGE_MATERIALS[0];
    const lotsError = /Mỗi lần mua/;
    expect(() => forge.buyMaterials(1, material, FORGE_SHOP.maxLots + 1, T0), "FORGE_SHOP.maxLots").toThrow(lotsError);
    expect(() => forge.buyMaterials(1, material, FORGE_SHOP.minLots - 1, T0), "FORGE_SHOP.minLots").toThrow(lotsError);
    const buyer = player(1);
    expect(() => forge.buyMaterials(buyer, material, FORGE_SHOP.maxLots, T0), "FORGE_SHOP.maxLots").not.toThrow();
    expect(forge.materialLots(buyer, T0)).toBe(FORGE_SHOP.maxLots);
  });

  it("has the NPC quota and clan item price formulas (lib/wiki/rules-arena.ts npcQuota, clanItemPrice)", () => {
    const now = T0 + 12 * 3_600_000;
    const day = clock.dayKey(now);
    const user = player(5);
    store.insertPet(user, "Bé hai", "test_pet", T0 - 20 * 86_400_000);
    for (const d of [0, 0.1, 0.19, 0.2, 0.45, 0.79, 0.8, 0.9]) {
      for (const cat of ["food", "care"] as const) {
        const table = cat === "food" ? "essentials_days" : "essentials_care_days";
        store.db.prepare(`INSERT INTO ${table} (day, d, demand, supplied, npc_sold, meal_sold) VALUES (?, ?, 0, 0, 0, 0)
          ON CONFLICT (day) DO UPDATE SET d = excluded.d`).run(day, d);
        expect(essentials.npcAllowance(user, cat, now), `npcQuota(2, ${cat}, ${d})`).toBe(npcQuota(2, cat, d));
      }
    }
    for (const cat of ["food", "care"] as const) {
      for (const ref of [97, 120, 450, 611]) {
        for (const q of [0, 1, 2]) expect(essentials.clanItemPrice(cat, ref, q), `clanItemPrice(${cat}, ${ref}, ${q})`).toBe(clanItemPrice(cat, ref, q));
      }
    }
  });

  it("has the shop's nightly buying target (lib/wiki/rules-arena.ts ESSENTIALS_SHOP)", () => {
    const pets = store.db.prepare("SELECT COUNT(*) AS n FROM pets").get().n;
    // A day with no history: demand is the pets' daily need.
    const want = essentials.openShopBuying("2031-01-01");
    for (const cat of ["food", "care"] as const) {
      const need = pets * ESSENTIALS.cats[cat].perPetDay;
      const stock = essentials.stockOf(cat).reduce((s: number, x: number) => s + x, 0);
      expect(want[cat], "ESSENTIALS_SHOP.daysCovered").toBe(Math.max(0, Math.round(need * (1 - ESSENTIALS.npcFloor) * ESSENTIALS_SHOP.daysCovered) - stock));
    }
  });

  it("has the arena's penalty split and strategic seat limit (lib/wiki/rules-arena.ts ARENA_SERVER)", () => {
    const tomorrow = clock.dayKey(T0 + 86_400_000);
    const aLeader = player(30);
    clans.createClan(aLeader, { name: "Sói Xám", emblem: "🐺", color: "#555555" }, T0);
    clans.donateClan(aLeader, 3_000_000, T0);
    const bLeader = player(30);
    clans.createClan(bLeader, { name: "Cáo Đỏ", emblem: "🦊", color: "#cc3300" }, T0);
    clans.donateClan(bLeader, 3_000_000, T0);
    const clanOf = (id: number) => clans.clanView(id, T0).clan;
    const A = clanOf(aLeader).id;
    const B = clanOf(bLeader).id;
    const plot = clanRules.PLOTS.find((p: { zone: string }) => p.zone === "plain") ?? clanRules.PLOTS[0];
    clans.buyPlot(bLeader, plot.id, T0);
    clans.enterIndustry(bLeader, "irrigation", T0);
    clans.enterIndustry(aLeader, "wind_farm", T0);

    // A already holds one strategic seat: it may not challenge for a second.
    expect(ARENA_SERVER.strategicSeats).toBe(1);
    expect(() => arena.challenge(aLeader, { defenderId: B, kind: "seat", ref: "irrigation", slots: [{ day: tomorrow, hour: 19 }] }, T0), "ARENA_SERVER.strategicSeats")
      .toThrow(/1 ghế/);

    // B never picks a time: it forfeits, and the winner gets its share of the penalty.
    const { id } = arena.challenge(aLeader, { defenderId: B, kind: "plot", ref: plot.id, slots: [{ day: tomorrow, hour: 19 }] }, T0);
    const bFund = clanOf(bLeader).treasury;
    const aFund = clanOf(aLeader).treasury;
    const treasury = ledger.treasuryBalance();
    arena.settleArena(arenaRules.slotTime(tomorrow, 19) + 1);
    const war = arena.warReplay(id);
    expect(war.status).toBe("forfeit");
    const penalty = Math.floor(bFund * arenaRules.ARENA.forfeitPenalty);
    expect(war.penalty).toBe(penalty);
    expect(clanOf(aLeader).treasury - aFund, "ARENA_SERVER.winnerShare").toBe(Math.floor(penalty * ARENA_SERVER.winnerShare));
    expect(ledger.treasuryBalance() - treasury, "ARENA_SERVER.winnerShare").toBe(penalty - Math.floor(penalty * ARENA_SERVER.winnerShare));
    expect(store.db.prepare("SELECT clan_id FROM land_plots WHERE id = ?").get(plot.id).clan_id).toBe(A);
  });
});
