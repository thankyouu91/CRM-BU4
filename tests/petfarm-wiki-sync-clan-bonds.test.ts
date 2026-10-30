import { beforeAll, describe, expect, it } from "vitest";
import { getArticle } from "@/lib/wiki";
import { BONDS, FINANCE_TAX, RATE_POWER, couponOf, couponRange, financeTax, rateBand } from "@/public/ta-tua/game/js/shared/clan-bonds.js";

// The bonds and base-rate articles read every number from shared/clan-bonds.js. This test runs the game's server
// code on an in-memory database and checks that the server enforces exactly those numbers.

process.env.PETDEX_DB = ":memory:";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const T0 = Date.parse("2026-12-02T03:00:00Z");

/* eslint-disable @typescript-eslint/no-explicit-any -- plain JS modules, loosely typed */
let store: any, ledger: any, clans: any, bonds: any, bank: any, sh: any, clock: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

let n = 0;
function player() {
  n += 1;
  const id = store.createUser(`wtp${n}`, "x", T0 - 30 * DAY) as number;
  ledger.post({ userId: id, delta: 5_000_000, kind: "opening", now: T0 });
  const petId = store.insertPet(id, `Bé ${n}`, "test_pet", T0 - 20 * DAY);
  store.savePet({ ...store.getPet(petId), level: 8, updated_at: T0 });
  store.setActivePet(id, petId);
  return id;
}
function clan(name: string, money = 300_000) {
  const leader = player();
  clans.createClan(leader, { name, emblem: "🏯", color: "#445566" }, T0);
  clans.donateClan(leader, money, T0);
  return { leader, id: clans.clanView(leader, T0).clan.id as number };
}
const bal = (a: string) => store.db.prepare("SELECT balance FROM accounts WHERE id = ?").get(a)?.balance ?? 0;
const last = () => store.db.prepare("SELECT * FROM bond_issues ORDER BY id DESC LIMIT 1").get();

let issuer: { leader: number; id: number };
let holder: { leader: number; id: number };

beforeAll(async () => {
  store = await import("@/petdex/server/db.js");
  ledger = await import("@/petdex/server/ledger.js");
  clans = await import("@/petdex/server/clans.js");
  bonds = await import("@/petdex/server/clan-bonds.js");
  bank = await import("@/petdex/server/bank.js");
  sh = await import("@/petdex/server/clan-shares.js");
  clock = await import("@/petdex/server/clock.js");
  (await import("@/petdex/server/migrate.js")).migrate(T0);
  holder = clan("Wiki Ngân Khố");
  store.db.prepare("INSERT INTO clan_industries (clan_id, industry, fee, entered_at) VALUES (?, 'state_bank', 0, ?)").run(holder.id, T0);
  issuer = clan("Wiki Phát Hành");
});

describe("Petfarm wiki stays in step with bonds and the base rate", () => {
  it("has the four sections in order, with 2–4 hints and no em dash", () => {
    for (const slug of ["trai-phieu", "lai-suat-co-ban"]) {
      const a = getArticle(slug)!;
      expect(a, slug).toBeDefined();
      expect(a.sections.map((s) => s.title), slug).toEqual(["Đây là gì", "Chức năng", "Rủi ro", "Mẹo"]);
      const tips = a.sections[3].blocks.flatMap((b) => ("list" in b ? b.list : []));
      expect(tips.length, slug).toBeGreaterThanOrEqual(2);
      expect(tips.length, slug).toBeLessThanOrEqual(4);
      expect(JSON.stringify(a), slug).not.toContain("—");
    }
  });

  it("issues within couponRange, BONDS.terms, BONDS.minQty..maxQty and BONDS.clanBookShare", () => {
    const [lo, hi] = couponRange(bank.economy().baseRate);
    expect(() => bonds.issueClanBonds(issuer.leader, { qty: BONDS.minQty, coupon: hi * 1.001, term: BONDS.terms[0] }, T0), "maxCouponMultiple").toThrow();
    expect(() => bonds.issueClanBonds(issuer.leader, { qty: BONDS.minQty, coupon: lo * 0.999, term: BONDS.terms[0] }, T0), "minCouponMultiple").toThrow();
    expect(() => bonds.issueClanBonds(issuer.leader, { qty: BONDS.minQty - 1, coupon: lo, term: BONDS.terms[0] }, T0), "minQty").toThrow();
    const room = Math.floor((sh.bookValue(issuer.id, T0) * 1000 * BONDS.clanBookShare) / BONDS.face);
    expect(() => bonds.issueClanBonds(issuer.leader, { qty: room + 1, coupon: lo, term: BONDS.terms[0] }, T0), "clanBookShare").toThrow(/sổ sách/);
    bonds.issueClanBonds(issuer.leader, { qty: 1000, coupon: lo * 2, term: BONDS.terms[0] }, T0);
    expect(last().closes_at - T0, "subscribeHours").toBe(BONDS.subscribeHours * HOUR);
  });

  it("charges BONDS.issueFee, caps holders at BONDS.holderCap, pays couponOf nightly less FINANCE_TAX", () => {
    const i = last();
    const p = player();
    const fund = bal(`clan:${issuer.id}`);
    expect(() => bonds.subscribeBonds(p, i.id, Math.floor(i.qty * BONDS.holderCap) + 1, {}, T0 + HOUR), "holderCap").toThrow();
    const qty = Math.floor(i.qty * BONDS.holderCap);
    bonds.subscribeBonds(p, i.id, qty, {}, T0 + HOUR);
    expect(bal(`clan:${issuer.id}`) - fund, "issueFee").toBe(qty * BONDS.face - Math.ceil(qty * BONDS.face * BONDS.issueFee));
    bonds.closeBondSubs(T0 + BONDS.subscribeHours * HOUR);
    const coins = store.getUser(p).coins;
    bonds.settleBondsDay(clock.startOfDay(clock.nextDay(clock.dayKey(T0 + 2 * DAY))));
    const got = couponOf(qty, i.coupon);
    expect(store.getUser(p).coins - coins, "FINANCE_TAX").toBe(got - financeTax(got));
    expect(financeTax(1000)).toBe(1000 * FINANCE_TAX.rate);
  });

  it("lets the state_bank holder set the base rate within rateBand, and penalises with RATE_POWER", () => {
    const { policyRate } = bank.economy();
    const [lo, hi] = rateBand(policyRate);
    expect(hi - policyRate, "band").toBeCloseTo(Math.min(RATE_POWER.band, RATE_POWER.max - policyRate), 9);
    expect(() => bonds.setBaseRate(holder.leader, hi + 1e-5, T0), "band").toThrow();
    bonds.setBaseRate(holder.leader, lo, T0);
    expect(bank.economy().baseRate).toBe(lo);
    store.db.prepare("INSERT INTO central_bank (week, money_per_player, growth, price_index, base_rate, players, at, money_total) VALUES ('2026-12-06', 1, ?, 1, ?, 1, ?, 1)").run(RATE_POWER.growthCap + 0.01, policyRate, T0);
    const t0 = bal("treasury");
    bonds.rateWeek({ rate: lo, clanId: holder.id, week: null, at: T0 }, policyRate, T0 + DAY);
    expect(bal("treasury") - t0, "penalty").toBe(RATE_POWER.penalty);
    bonds.rateWeek({ rate: lo, clanId: holder.id, week: null, at: T0 }, policyRate, T0 + (RATE_POWER.strikeDays - 1) * DAY);
    expect(store.db.prepare("SELECT 1 FROM clan_industries WHERE clan_id = ? AND industry = 'state_bank'").get(holder.id), "strikeDays").toBeUndefined();
  });
});
