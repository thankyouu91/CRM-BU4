import { beforeAll, describe, expect, it } from "vitest";
import { CLAN } from "@/lib/wiki/rules";
import { CLAN_XP, HEAVY, MACRO, antitrustTax, buyCapLeft, clanItemPrice, servicePlotRevenue } from "@/lib/wiki/rules-macro";
import { INDUSTRIES, INDUSTRY_ORDER, PHASES, PLOTS } from "@/public/ta-tua/game/js/shared/clan.js";

// The macro economy, Sở Công Thương and clan articles copy numbers and formulas that live in modules
// that open the game database. This test drives those modules on an in-memory database and fails as
// soon as the game stops matching lib/wiki/rules-macro.ts, naming the number to update.

process.env.PETDEX_DB = ":memory:";

const DAY = 86_400_000;
const T0 = Date.parse("2026-11-25T03:00:00Z"); // 10 giờ sáng thứ Tư 25/11, giờ Việt Nam

/* eslint-disable @typescript-eslint/no-explicit-any -- plain JS modules, loosely typed */
let store: any, ledger: any, clock: any, macro: any, clans: any, commerce: any, essentials: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

/** A random source that returns `values` in order, then `rest` forever. */
const seq = (values: number[], rest = 0.25) => {
  let i = 0;
  return () => (i < values.length ? values[i++] : rest);
};
/** Two draws that make the game's gaussian() return exactly 1 (u = e^-0.5, v = 0). */
const ONE_SIGMA = [Math.exp(-0.5), 0];
/** Two draws that make gaussian() return 0 (cos of a quarter turn). */
const ZERO = [0.5, 0.25];
/** Draws for every industry of one day with no noise and no shock. */
const calmIndustries = (n = INDUSTRY_ORDER.length) => Array.from({ length: n }, () => [...ZERO, 0.99]).flat();

const PHASE_IDS = Object.keys(PHASES);
const flat = (phase: string, extra: Record<string, unknown> = {}) => ({ phase, weather: "calm", landIndex: 1, demand: {}, ...extra });

function newPlayer(name: string, money: number) {
  const id = store.createUser(name, "x", T0 - 10 * DAY) as number;
  ledger.post({ userId: id, delta: money, kind: "opening", now: T0 });
  return id;
}

beforeAll(async () => {
  store = await import("@/petdex/server/db.js");
  ledger = await import("@/petdex/server/ledger.js");
  clock = await import("@/petdex/server/clock.js");
  macro = await import("@/petdex/server/macro.js");
  clans = await import("@/petdex/server/clans.js");
  commerce = await import("@/petdex/server/commerce.js");
  essentials = await import("@/petdex/server/essentials.js");
  (await import("@/petdex/server/migrate.js")).migrate(T0);
  (await import("@/petdex/server/scheduler.js")).runDue(T0);
});

describe("Petfarm wiki macro economy stays in step with the game (lib/wiki/rules-macro.ts MACRO)", () => {
  it("has the GDP of every phase (MACRO.gdp)", () => {
    for (const p of PHASE_IDS) {
      const next = macro.rollMacro(flat(p), { rand: seq([0.99, 0.25, ...calmIndustries(), ...ZERO, ...ZERO]), baseRate: 0.003 });
      expect(next.phase, `phase ${p} stays`).toBe(p);
      expect(next.gdp, `MACRO.gdp.${p}`).toBeCloseTo(MACRO.gdp[p], 6);
    }
  });

  it("adds the wiki's random steps to the land index and the GDP shown (MACRO.land.noise, MACRO.gdpNoise)", () => {
    const land = macro.rollMacro(flat("recovery"), { rand: seq([0.99, 0.25, ...calmIndustries(), ...ONE_SIGMA, ...ZERO]), baseRate: MACRO.land.neutralRate });
    expect(land.landIndex, "MACRO.land.noise").toBeCloseTo(1 + PHASES.recovery.land + MACRO.land.noise, 4);
    const gdp = macro.rollMacro(flat("recovery"), { rand: seq([0.99, 0.25, ...calmIndustries(), ...ZERO, ...ONE_SIGMA]), baseRate: MACRO.land.neutralRate });
    expect(gdp.gdp, "MACRO.gdpNoise").toBeCloseTo(MACRO.gdp.recovery + MACRO.gdpNoise, 4);
  });

  it("pulls demand back toward 100% with the wiki's keep share and noise (MACRO.demand)", () => {
    const id = INDUSTRY_ORDER[0];
    const back = macro.rollMacro(flat("recovery", { demand: { [id]: 1.2 } }), { rand: seq([0.99, 0.25, ...calmIndustries()]) });
    expect(back.demand[id], "MACRO.demand.keep").toBeCloseTo(1 + 0.2 * MACRO.demand.keep, 3);
    const noisy = macro.rollMacro(flat("recovery"), { rand: seq([0.99, 0.25, ...ONE_SIGMA, 0.99]) });
    expect(noisy.demand[id], "MACRO.demand.noise").toBeCloseTo(1 + MACRO.demand.noise, 3);
    const high = macro.rollMacro(flat("recovery", { demand: { [id]: 5 } }), { rand: seq([0.99, 0.25, ...calmIndustries()]) });
    expect(high.demand[id], "MACRO.demand.max").toBe(MACRO.demand.max);
    const low = macro.rollMacro(flat("recovery", { demand: { [id]: -5 } }), { rand: seq([0.99, 0.25, ...calmIndustries()]) });
    expect(low.demand[id], "MACRO.demand.min").toBe(MACRO.demand.min);
  });

  it("rolls demand shocks with the wiki's chance and size (MACRO.demand.shock*)", () => {
    const id = INDUSTRY_ORDER[0];
    const at = (check: number, sign: number, size: number) =>
      macro.rollMacro(flat("recovery"), { rand: seq([0.99, 0.25, ...ZERO, check, sign, size, ...calmIndustries(INDUSTRY_ORDER.length - 1)]) });
    const small = at(MACRO.demand.shockChance - 1e-6, 0.9, 0);
    expect(small.shocks, "MACRO.demand.shockChance / shockMin").toEqual([{ industry: id, shock: MACRO.demand.shockMin }]);
    const big = at(MACRO.demand.shockChance - 1e-6, 0.1, 1 - 1e-9);
    expect(big.shocks[0].shock, "MACRO.demand.shockMax").toBeCloseTo(-MACRO.demand.shockMax, 6);
    expect(at(MACRO.demand.shockChance, 0.9, 0).shocks, "no shock at the chance itself").toEqual([]);
  });

  it("moves the land index by phase and by the base rate (MACRO.land)", () => {
    for (const p of PHASE_IDS) {
      for (const baseRate of [0.003, 0.005, 0.0005]) {
        const next = macro.rollMacro(flat(p), { rand: seq([0.99, 0.25, ...calmIndustries(), ...ZERO, ...ZERO]), baseRate });
        const want = 1 + (PHASES as Record<string, { land: number }>)[p].land - (baseRate - MACRO.land.neutralRate) * MACRO.land.rateWeight;
        expect(next.landIndex, `MACRO.land, phase ${p}, rate ${baseRate}`).toBeCloseTo(want, 4);
      }
    }
    const rand = seq([0.99, 0.25, ...calmIndustries(), ...ZERO, ...ZERO]);
    expect(macro.rollMacro(flat("boom", { landIndex: 9 }), { rand }).landIndex, "MACRO.land.max").toBe(MACRO.land.max);
    const rand2 = seq([0.99, 0.25, ...calmIndustries(), ...ZERO, ...ZERO]);
    expect(macro.rollMacro(flat("recession", { landIndex: 0.1 }), { rand: rand2 }).landIndex, "MACRO.land.min").toBe(MACRO.land.min);
  });

  it("posts a shock's news on the Sàn at the wiki's share, and the phase's tea shop traffic", () => {
    const id = INDUSTRY_ORDER.find((i) => (INDUSTRIES as Record<string, { commodities: string[] }>)[i].commodities.length)!;
    const pos = INDUSTRY_ORDER.indexOf(id);
    const day = "2027-03-10";
    const rand = seq([...calmIndustries(pos), ...ZERO, 0, 0.9, 0.5]);
    macro.macroFor(day, { rand, force: { phase: "boom", weather: "calm" }, now: T0 });
    const from = clock.startOfDay(day);
    const news = store.db.prepare("SELECT * FROM news WHERE starts_at = ? AND commodity = ?").all(from, (INDUSTRIES as Record<string, { commodities: string[] }>)[id].commodities[0]);
    expect(news.length).toBe(1);
    expect(news[0].effect, "MACRO.demand.newsShare").toBeCloseTo(0.15 * MACRO.demand.newsShare, 6);
    const traffic = store.db.prepare("SELECT * FROM town_effects WHERE kind = 'traffic' AND starts_at = ?").all(from);
    expect(traffic.map((t: { value: number }) => t.value)).toEqual([PHASES.boom.traffic]);
  });
});

describe("Petfarm wiki clan formulas stay in step with the game (CLAN_XP, servicePlotRevenue)", () => {
  it("computes a service plot's nightly revenue like the game", () => {
    const design = [
      { piece: "base-3", x: 2, y: 19, color: "#8b5e3c" },
      { piece: "wall_brick-8", x: 2, y: 15, color: "#e85d5d" },
      { piece: "roof_gable-5", x: 2, y: 11, color: "#4b8ff2" },
    ];
    for (const plot of [PLOTS[0], PLOTS[118], PLOTS[95], PLOTS[199]]) {
      for (const [industry, phase, weather, demand, n, level] of [["fishery", "boom", "calm", 1.1, 1, 3], ["tea", "recession", "storm", 0.8, 3, 1], ["food", "peak", "monsoon", 1.3, 2, 7]] as const) {
        const game = clans.plotRevenue(plot, { industry, design, level, macro: { phase, weather, demand: { [industry]: demand } }, clansInIndustry: n });
        const wiki = servicePlotRevenue(plot, { industry, design, level, phase, weather, demand, clans: n });
        expect(wiki.gross, `servicePlotRevenue ${plot.code} ${industry}`).toBe(game.gross);
        expect(wiki.revenue).toBe(game.revenue);
      }
    }
  });

  it("gives and takes clan XP at the wiki's rates (CLAN_XP)", () => {
    const xp = (id: number) => store.db.prepare("SELECT xp FROM clans WHERE id = ?").get(id).xp as number;
    const a = newPlayer("wiki_toc_a", 200_000);
    clans.createClan(a, { name: "Wiki Gia Tộc A" }, T0);
    const clanA = clans.clanView(a, T0).clan.id;
    expect(() => clans.donateClan(a, CLAN_XP.minDonation - 1, T0), "CLAN_XP.minDonation").toThrow(new RegExp(`${CLAN_XP.minDonation} xu`));
    clans.donateClan(a, 25_000, T0);
    expect(xp(clanA), "CLAN_XP.perDonation").toBe(Math.floor(25_000 / CLAN_XP.perDonation));

    // Quỹ cạn: không trả được phí duy trì thì mất kinh nghiệm.
    const fund = clans.clanBalance(clanA);
    clans.payDividend(a, fund, T0);
    const before = xp(clanA);
    const level = clans.clanView(a, T0).clan.level;
    clans.settleClansDay(clock.dayKey(T0), seq([], 0.5));
    const upkeep = CLAN.upkeepPerLevel * level; // không có lô đất: chỉ phần theo cấp
    expect(before - xp(clanA), "CLAN_XP.perUpkeep").toBe(Math.ceil(upkeep / CLAN_XP.perUpkeep));
  });

  it("charges strategic industries their base compensation and caps clans at the wiki's industry count", () => {
    expect(clans.entryFee("irrigation", 2), "CLAN_XP.strategicMultiplied").toBe((INDUSTRIES as Record<string, { comp: number }>).irrigation.comp);
    expect(clans.entryFee("tea", 1)).toBe((INDUSTRIES as Record<string, { comp: number }>).tea.comp * CLAN.expandMultiplier);
    const b = newPlayer("wiki_toc_b", 3_000_000);
    clans.createClan(b, { name: "Wiki Gia Tộc B" }, T0);
    clans.donateClan(b, 2_000_000, T0);
    for (const id of ["tea", "sugar", "pearl"]) clans.enterIndustry(b, id, T0);
    expect(() => clans.enterIndustry(b, "dairy", T0), "CLAN_XP.maxIndustries").toThrow(new RegExp(`tối đa ${CLAN_XP.maxIndustries} ngành`));
  });

  it("earns XP from revenue after tax and loses it for a short weekly quota (CLAN_XP.perRevenue, perQuota)", () => {
    const xp = (id: number) => store.db.prepare("SELECT xp FROM clans WHERE id = ?").get(id).xp as number;
    const c = newPlayer("wiki_toc_c", 3_000_000);
    const m = newPlayer("wiki_tv_c", 0);
    clans.createClan(c, { name: "Wiki Gia Tộc C" }, T0);
    const id = clans.clanView(c, T0).clan.id;
    clans.joinClan(m, id, T0);
    clans.donateClan(c, 2_500_000, T0);
    clans.enterIndustry(c, "fishery", T0);
    const plot = PLOTS.find((p) => p.zone === "coast" && !store.db.prepare("SELECT clan_id FROM land_plots WHERE id = ?").get(p.id)?.clan_id)!;
    clans.buyPlot(c, plot.id, T0);
    clans.setPlotIndustry(c, plot.id, "fishery");
    clans.saveDesign(c, plot.id, [
      { piece: "base-3", x: 2, y: 19, color: "#8b5e3c" },
      { piece: "wall_brick-8", x: 2, y: 15, color: "#e85d5d" },
      { piece: "roof_gable-5", x: 2, y: 11, color: "#4b8ff2" },
    ], T0);
    const day = clock.dayKey(T0 + DAY); // thứ Năm: không phải Chủ nhật, không phải cuối tháng
    const before = xp(id);
    clans.settleClansDay(day, seq([], 0.5));
    const d = clans.clanView(c, T0 + 2 * DAY).clan.days.find((x: { day: string }) => x.day === day);
    expect(d.revenue).toBeGreaterThan(0);
    expect(xp(id) - before, "CLAN_XP.perRevenue").toBe(Math.floor((d.revenue - d.tax) / CLAN_XP.perRevenue));

    // Chủ nhật 29/11: thành viên chưa góp đồng nào trong tuần.
    const sunday = "2026-11-29";
    const level = clans.clanView(c, T0).clan.level;
    const quota = CLAN.donationQuotaPerLevel * level;
    const before2 = xp(id);
    clans.settleClansDay(sunday, seq([], 0.5));
    const d2 = clans.clanView(c, Date.parse("2026-11-30T03:00:00Z")).clan.days.find((x: { day: string }) => x.day === sunday);
    const fromRevenue = Math.floor((d2.revenue - d2.tax) / CLAN_XP.perRevenue);
    expect(xp(id) - before2, "CLAN_XP.perQuota").toBe(fromRevenue - Math.ceil(quota / CLAN_XP.perQuota));
  });
});

describe("Petfarm wiki Sở Công Thương formulas stay in step with the game (antitrustTax, buyCapLeft)", () => {
  const good = "steel";
  const now = T0 + 3 * DAY;
  const trade = (seller: number, buyer: number | null, qty: number) =>
    store.db.prepare("INSERT INTO clan_trades (seller_id, buyer_id, good, qty, price, income, day, created_at) VALUES (?, ?, ?, ?, 230, 0, ?, ?)")
      .run(seller, buyer, good, qty, clock.dayKey(now - DAY), now - DAY);

  it("taxes the share of a sale above the antitrust threshold like the game", () => {
    trade(901, 902, 70);
    trade(903, 902, 130);
    trade(901, null, 500); // bán cho NPC: không tính
    trade(901, 0, 500); // bán cho Siêu thị: không tính
    for (const [qty, price] of [[60, 250], [10, 230], [1, 230], [300, 200]]) {
      const game = commerce.antitrustTax(901, good, qty, price, now);
      const wiki = antitrustTax({ total: 200, mine: 70 }, qty, price);
      expect(wiki, `antitrustTax ${qty} × ${price}`).toEqual(game);
    }
    expect(commerce.antitrustTax(904, "chips", 49, 700, now)).toEqual(antitrustTax({ total: 0, mine: 0 }, 49, 700));
  });

  it("caps 24-hour buying like the game", () => {
    store.db.prepare("INSERT INTO goods_listings (clan_id, good, qty, price, created_at, expires_at) VALUES (?, ?, ?, 300, ?, ?)").run(905, "aluminium", 400, now - 1000, now + DAY);
    store.db.prepare("INSERT INTO goods_listings (clan_id, good, qty, price, created_at, expires_at) VALUES (?, ?, ?, 300, ?, ?)").run(906, "aluminium", 50, now - 1000, now + DAY);
    expect(commerce.buyCapLeft(906, "aluminium", now), "own listings do not count").toBe(buyCapLeft(400, 0));
    store.db.prepare("INSERT INTO clan_trades (seller_id, buyer_id, good, qty, price, income, day, created_at) VALUES (905, 907, 'aluminium', 40, 300, 0, ?, ?)").run(clock.dayKey(now), now - 3_600_000);
    expect(commerce.buyCapLeft(907, "aluminium", now)).toBe(buyCapLeft(450, 40));
    expect(commerce.buyCapLeft(908, "fuel", now), "nothing listed: the minimum").toBe(buyCapLeft(0, 0));
  });
});

describe("Petfarm wiki Siêu thị prices stay in step with the game (clanItemPrice)", () => {
  it("prices clan meals and care sets like the game", () => {
    for (const cat of ["food", "care"] as const) {
      for (const ref of [1, 97, 120, 450, 613]) {
        for (const quality of [0, 1, 2]) expect(clanItemPrice(cat, ref, quality), `${cat} ${ref} ${quality}`).toBe(essentials.clanItemPrice(cat, ref, quality));
      }
    }
  });
});

describe("Petfarm wiki heavy industry stays in step with the game (lib/wiki/rules-macro.ts HEAVY)", () => {
  it("is closed by default, and closing refunds the fee and keeps the building", async () => {
    const heavy = await import("@/petdex/server/heavy-industry.js");
    expect(heavy.industryClosed("metallurgy"), "HEAVY.closedByDefault").toBe(HEAVY.closedByDefault);
    const h = newPlayer("wiki_toc_h", 3_000_000);
    clans.createClan(h, { name: "Wiki Gia Tộc H" }, T0);
    const id = clans.clanView(h, T0).clan.id;
    clans.donateClan(h, 2_000_000, T0);
    expect(() => clans.enterIndustry(h, "metallurgy", T0)).toThrow(/tạm đóng/);
    heavy.setHeavyOpen(true, "wiki test", T0);
    try {
      clans.enterIndustry(h, "metallurgy", T0);
      const plot = PLOTS.filter((p) => !store.db.prepare("SELECT clan_id FROM land_plots WHERE id = ?").get(p.id)?.clan_id).sort((a, b) => a.basePrice - b.basePrice)[0];
      clans.buyPlot(h, plot.id, T0);
      clans.setPlotIndustry(h, plot.id, "metallurgy");
      const design = [
        { piece: "base-3", x: 2, y: 19, color: "#8b5e3c" },
        { piece: "wall_brick-8", x: 2, y: 15, color: "#e85d5d" },
        { piece: "roof_gable-5", x: 2, y: 11, color: "#4b8ff2" },
      ];
      clans.saveDesign(h, plot.id, design, T0);
      const before = clans.clanBalance(id);
      heavy.setHeavyOpen(false, "wiki test", T0);
      const fee = (INDUSTRIES as Record<string, { comp: number }>).metallurgy.comp;
      expect(clans.clanBalance(id) - before, "HEAVY.refundShare").toBe(Math.round(fee * HEAVY.refundShare));
      const row = store.db.prepare("SELECT industry, design FROM land_plots WHERE id = ?").get(plot.id);
      expect(row.industry).toBeNull();
      expect(JSON.parse(row.design).length === design.length, "HEAVY.keepsBuilding").toBe(HEAVY.keepsBuilding);
      expect(clans.clanView(h, T0).clan.industries.length).toBe(0);
    } finally {
      if (heavy.heavyOpen()) heavy.setHeavyOpen(false, "wiki test", T0);
    }
  });
});
