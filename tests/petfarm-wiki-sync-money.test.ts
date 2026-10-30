import { beforeAll, describe, expect, it } from "vitest";
import { KIND_LABELS, MONEY, upkeepCharge } from "@/lib/wiki/rules-money";
import { SPECIES, UPKEEP } from "@/public/ta-tua/game/js/shared/pets.js";
import { cbHeadline } from "@/lib/wiki/articles/money";

// The money articles (ngan-hang, thue-toa-thi-chinh, tai-chinh) copy a few rules that live in modules
// which open the game database. This test runs those modules on an in-memory database and fails as
// soon as the game stops doing what lib/wiki/rules-money.ts says.

process.env.PETDEX_DB = ":memory:";

const T0 = Date.parse("2026-11-02T03:00:00Z"); // 10 giờ sáng thứ Hai, giờ Việt Nam
const DAY = 86_400_000;
const HOUR = 3_600_000;

/* eslint-disable @typescript-eslint/no-explicit-any -- plain JS modules, loosely typed */
let store: any, ledger: any, town: any, bank: any, clock: any, townRules: any, bankRules: any, macro: any, lifecycle: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

let n = 0;
function player(money: number, at = T0) {
  n += 1;
  const id = store.createUser(`money${n}`, "x", at);
  ledger.post({ userId: id, delta: money, kind: "opening", now: at });
  return id as number;
}

beforeAll(async () => {
  store = await import("@/petdex/server/db.js");
  ledger = await import("@/petdex/server/ledger.js");
  town = await import("@/petdex/server/town.js");
  bank = await import("@/petdex/server/bank.js");
  clock = await import("@/petdex/server/clock.js");
  townRules = await import("@/petdex/server/rules/town.js");
  bankRules = await import("@/petdex/server/rules/bank.js");
  macro = await import("@/petdex/server/macro.js");
  lifecycle = await import("@/petdex/server/lifecycle.js");
  const { migrate } = await import("@/petdex/server/migrate.js");
  migrate(T0);
});

describe("Petfarm wiki money rules stay in step with the game", () => {
  it("sends the same share of taxes and fees to the town budget (MONEY.treasuryShare)", () => {
    const id = player(1_000);
    for (const charge of [ledger.chargeTax, ledger.chargeFee]) {
      const before = ledger.treasuryBalance();
      const wallet = store.getUser(id).coins;
      charge(id, 101, "kiểm thử", T0);
      expect(store.getUser(id).coins).toBe(wallet - 101);
      expect(ledger.treasuryBalance() - before).toBe(Math.floor(101 * MONEY.treasuryShare));
    }
  });

  it("taxes exactly the income kinds listed in MONEY.taxableKinds", () => {
    const day = clock.dayKey(T0);
    const end = clock.startOfDay(day) + DAY;
    const taxed = new Map<string, number>();
    const free = new Map<string, number>();
    for (const [kind, def] of Object.entries(ledger.KINDS as Record<string, { group: string }>)) {
      if (def.group !== "income") continue;
      const id = player(0);
      ledger.post({ userId: id, delta: 1_000, kind, now: T0 + HOUR });
      ((MONEY.taxableKinds as readonly string[]).includes(kind) ? taxed : free).set(kind, id);
    }
    town.settleTaxes(day, end);
    const row = (id: number) => store.db.prepare("SELECT * FROM tax_days WHERE user_id = ? AND day = ?").get(id, day);
    for (const kind of MONEY.taxableKinds) expect(taxed.has(kind), `${kind} is an income kind`).toBe(true);
    for (const [kind, id] of taxed) expect(row(id)?.tax, `${kind} is taxed`).toBe(townRules.incomeTax(1_000));
    for (const [kind, id] of free) expect(row(id)?.tax ?? 0, `${kind} is tax free`).toBe(0);
  });

  it("measures the growth of the total money supply, without the town budget or a per-player split", () => {
    const now1 = T0 + DAY;
    bank.centralBankWeek("2026-11-08", now1);
    const first = bank.economy();
    // First meeting: nothing to compare with, so growth is on target and policy stays neutral.
    expect(first.priceIndex).toBe(1);
    expect(first.baseRate).toBe(bankRules.BANK.defaultRate);
    const w1 = store.db.prepare("SELECT * FROM central_bank ORDER BY week DESC LIMIT 1").get();
    expect(w1.growth).toBe(bankRules.BANK.targetGrowth);
    const coins = store.db.prepare("SELECT SUM(coins) AS s FROM users").get().s;
    expect(w1.money_total).toBeCloseTo(coins, 6);

    // One player stays active, everyone else goes quiet for a week: only the 5.000 new coins count.
    const id = player(0, now1 + HOUR);
    ledger.post({ userId: id, delta: 5_000, kind: "admin", now: now1 + HOUR });
    const now2 = now1 + 7 * DAY;
    bank.centralBankWeek("2026-11-15", now2);
    const latest = store.db.prepare("SELECT * FROM central_bank ORDER BY week DESC LIMIT 1").get();
    expect(latest.players).toBe(1);
    expect(latest.money_total).toBeCloseTo(coins + 5_000, 6);
    const growth = 5_000 / coins;
    expect(latest.growth).toBeCloseTo(growth, 9);
    const next = bankRules.policy({ growth, priceIndex: 1 });
    expect(bank.economy().priceIndex).toBeCloseTo(next.priceIndex, 12);
    expect(bank.economy().baseRate).toBeCloseTo(next.baseRate, 12);
    const news = store.db.prepare("SELECT headline FROM news WHERE created_at = ? AND headline LIKE 'Ngân hàng Trung ương:%'").get(now2);
    expect(news?.headline).toBe(cbHeadline(latest.growth, latest.base_rate, latest.price_index));
  });

  it("lets the base rate pull the land price index by MONEY.landRateDrag × the rate gap", () => {
    const prev = { phase: "recovery", weather: "calm", landIndex: 1, demand: {} };
    const roll = (baseRate: number) => {
      let i = 0;
      const rand = () => ((i++ * 0.37) % 1) || 0.5; // same sequence for both rolls
      return macro.rollMacro(prev, { rand, baseRate, force: { phase: "recovery", weather: "calm" } }).landIndex;
    };
    const r = bankRules.BANK.defaultRate;
    expect(roll(r) - roll(r + 0.002)).toBeCloseTo(MONEY.landRateDrag * 0.002, 4);
  });

  it("charges pet upkeep the way upkeepCharge() says", () => {
    const day = clock.dayKey(T0 + 20 * DAY);
    const end = clock.startOfDay(day) + DAY;
    const { priceIndex } = bank.economy();
    const species = (SPECIES as { id: string }[])[0].id;
    const keeper = (opts: { levels: number[]; income: number; wallet: number; seenAgo: number }) => {
      const id = player(opts.wallet, end - 2 * HOUR);
      for (const lv of opts.levels) {
        const petId = store.insertPet(id, `be${n}`, species, end - 2 * HOUR);
        store.db.prepare("UPDATE pets SET level = ? WHERE id = ?").run(lv, petId);
      }
      if (opts.income) ledger.post({ userId: id, delta: opts.income, kind: "minigame", now: end - HOUR });
      store.db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").run(end - opts.seenAgo, id);
      return { id, ...opts, before: store.getUser(id).coins };
    };
    const cases = [
      keeper({ levels: [10, 20], income: 2_000, wallet: 5_000, seenAgo: HOUR }), // full fee
      keeper({ levels: [10, 20], income: 300, wallet: 5_000, seenAgo: HOUR }), // capped by income
      keeper({ levels: [30], income: 0, wallet: 5_000, seenAgo: HOUR }), // no income: base per pet
      keeper({ levels: [30, 30], income: 0, wallet: 7, seenAgo: HOUR }), // wallet runs dry, no debt
      keeper({ levels: [30], income: 2_000, wallet: 5_000, seenAgo: (UPKEEP.activeDays + 1) * DAY }), // away: nothing
    ];
    lifecycle.settleUpkeepDay(day);
    for (const c of cases) {
      const active = c.seenAgo <= UPKEEP.activeDays * DAY;
      const want = active ? upkeepCharge({ levels: c.levels, priceIndex, income: c.income, wallet: c.before }).paid : 0;
      expect(c.before - store.getUser(c.id).coins, JSON.stringify(c)).toBe(want);
      expect(store.getUser(c.id).coins).toBeGreaterThanOrEqual(0);
    }
    const [full, capped, idle, dry] = cases.map((c) => upkeepCharge({ levels: c.levels, priceIndex, income: c.income, wallet: c.before }));
    expect(full.paid).toBe(full.full);
    expect(capped.paid).toBeLessThan(capped.full);
    expect(idle.paid).toBe(UPKEEP.base);
    expect(dry.paid).toBe(7);
  });

  it("shows MONEY.bankHistoryWeeks Central Bank meetings on the bank screen", () => {
    const id = player(0);
    for (let w = 0; w < MONEY.bankHistoryWeeks + 3; w++) {
      const at = T0 + (30 + 7 * w) * DAY;
      bank.centralBankWeek(clock.dayKey(at), at);
    }
    expect(bank.bankView(id, T0 + 200 * DAY).history.length).toBe(MONEY.bankHistoryWeeks);
  });

  it("names ledger lines the way the game does (KIND_LABELS)", () => {
    for (const [kind, label] of Object.entries(KIND_LABELS)) expect(ledger.KINDS[kind]?.label, kind).toBe(label);
  });
});
