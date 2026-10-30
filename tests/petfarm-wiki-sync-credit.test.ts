import { beforeAll, describe, expect, it } from "vitest";
import { BANK_LOAN, HUI_EXTRA, P2P_EXTRA } from "@/lib/wiki/rules-credit";
import { CREDIT, LOANS, ceilCoins } from "@/petdex/server/rules/production.js";
import { HUI, P2P, p2pLimit } from "@/petdex/server/rules/finance.js";

// The credit, P2P and hụi articles copy a few numbers that live as local constants in modules that
// open the game database. This test drives those modules on an in-memory database and fails as soon
// as the game stops matching lib/wiki/rules-credit.ts, naming the number to update.

process.env.PETDEX_DB = ":memory:";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const T0 = Date.parse("2026-12-02T03:00:00Z"); // 10 giờ sáng giờ Việt Nam

/* eslint-disable @typescript-eslint/no-explicit-any -- plain JS modules, loosely typed */
let store: any, ledger: any, clock: any, bank: any, credit: any, p2p: any, hui: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const user = (id: number) => store.getUser(id) as { coins: number; credit: number; loan_ban_until: number };
function newPlayer(name: string, money: number) {
  const id = store.createUser(name, "x", T0 - 10 * DAY) as number;
  ledger.post({ userId: id, delta: money, kind: "opening", now: T0 });
  return id;
}

beforeAll(async () => {
  store = await import("@/petdex/server/db.js");
  ledger = await import("@/petdex/server/ledger.js");
  clock = await import("@/petdex/server/clock.js");
  bank = await import("@/petdex/server/bank.js");
  credit = await import("@/petdex/server/credit.js");
  p2p = await import("@/petdex/server/p2p.js");
  hui = await import("@/petdex/server/hui.js");
  (await import("@/petdex/server/migrate.js")).migrate(T0);
  (await import("@/petdex/server/scheduler.js")).runDue(T0);
});

describe("Petfarm wiki credit articles stay in step with the game", () => {
  it("starts new players at CREDIT.start", () => {
    expect(user(newPlayer("wiki_moi", 0)).credit).toBe(CREDIT.start);
  });

  it("has the bank's loan minimum and loan count (lib/wiki/rules-credit.ts BANK_LOAN)", () => {
    const id = newPlayer("wiki_vay", 10_000);
    store.setAdvanced(id, true);
    bank.moveSavings(id, "deposit", 4_000, T0);
    const t = T0 + HOUR;
    expect(credit.creditView(id, t).minLoan, "BANK_LOAN.min").toBe(BANK_LOAN.min);
    expect(() => credit.borrow(id, BANK_LOAN.min - 1, 3, t)).toThrow(new RegExp(`tối thiểu ${BANK_LOAN.min} xu`));
    for (let i = 0; i < BANK_LOAN.maxOpen; i++) credit.borrow(id, BANK_LOAN.min, 3, t);
    expect(credit.creditView(id, t).blocked, "BANK_LOAN.maxOpen").toMatch(new RegExp(`tối đa ${BANK_LOAN.maxOpen} khoản`));
  });

  it("gives the P2P payoff bonus (P2P_EXTRA) and bans a P2P default for LOANS.banDays", () => {
    const borrower = newPlayer("wiki_p2p_vay", 500);
    const lender = newPlayer("wiki_p2p_cho", 5_000);
    const t = T0 + 2 * HOUR;
    p2p.requestP2P(borrower, { amount: 1_000, termDays: 3, rate: 0.01 }, t);
    p2p.fundP2P(lender, p2p.p2pView(lender, t).market.find((l: { borrower: string }) => l.borrower === "wiki_p2p_vay").id, t);
    const before = user(borrower).credit;
    p2p.settleP2PDay(clock.dayKey(t + 3 * DAY));
    expect(user(borrower).credit - before, "P2P_EXTRA.repaidCredit").toBe(P2P_EXTRA.repaidCredit);

    const bad = newPlayer("wiki_p2p_xu", 500);
    p2p.requestP2P(bad, { amount: 800, termDays: 3, rate: 0.01 }, t);
    p2p.fundP2P(lender, p2p.p2pView(lender, t).market.find((l: { borrower: string }) => l.borrower === "wiki_p2p_xu").id, t);
    ledger.post({ userId: bad, delta: -user(bad).coins, kind: "admin", now: t });
    let day = "";
    for (let d = 3; d <= 12 && p2p.p2pView(bad, t + d * DAY).borrowing[0].status !== "defaulted"; d++) {
      day = clock.dayKey(t + d * DAY);
      p2p.settleP2PDay(day);
    }
    const at = clock.startOfDay(day) + DAY - 1;
    expect((user(bad).loan_ban_until - at) / DAY, "LOANS.banDays").toBe(LOANS.banDays);
    expect(p2p.p2pView(bad, at).rules.banDays).toBe(LOANS.banDays);

    // After the default, each night takes P2P.garnish of that day's income: wallet first, then savings.
    const next = clock.dayKey(at + DAY);
    const t2 = clock.startOfDay(next) + HOUR;
    ledger.post({ userId: bad, delta: 1_000, kind: "salary", now: t2 });
    bank.moveSavings(bad, "deposit", 1_000, t2 + 1);
    const owedBefore = p2p.p2pView(bad, t2).borrowing[0].left;
    p2p.settleP2PDay(next);
    const loan = p2p.p2pView(bad, t2 + DAY).borrowing[0];
    expect(owedBefore - loan.left, "P2P garnish of income, taken from savings").toBe(Math.floor(1_000 * P2P.garnish));
  });

  it("uses p2pLimit(score) for the P2P request limit and the view", () => {
    const id = newPlayer("wiki_p2p_han", 0);
    const t = T0 + 3 * HOUR;
    const limit = p2pLimit(user(id).credit);
    expect(p2p.p2pView(id, t).me.limit).toBe(limit);
    expect(() => p2p.requestP2P(id, { amount: limit + 1, termDays: 3, rate: 0.01 }, t)).toThrow();
    expect(() => p2p.requestP2P(id, { amount: limit, termDays: 3, rate: 0.01 }, t)).not.toThrow();
  });

  it("keeps charging interest and late fees on a defaulted bank loan, and garnishes income from savings", () => {
    const id = newPlayer("wiki_vo_no", 5_000);
    store.setAdvanced(id, true);
    bank.moveSavings(id, "deposit", 4_000, T0);
    const t = T0 + 4 * HOUR;
    credit.borrow(id, 500, 3, t);
    ledger.post({ userId: id, delta: -user(id).coins, kind: "admin", now: t });
    bank.moveSavings(id, "withdraw", 4_000, t);
    ledger.post({ userId: id, delta: -user(id).coins, kind: "admin", now: t });
    const loanOf = () => store.db.prepare("SELECT * FROM loans WHERE user_id = ?").get(id);
    let d = 0;
    while (loanOf().status !== "defaulted" && d < 20) credit.settleLoansDay(clock.dayKey(t + d++ * DAY));
    expect(loanOf().status).toBe("defaulted");

    // A night with no income: interest and the late fee still grow the debt.
    const before = loanOf();
    credit.settleLoansDay(clock.dayKey(t + d++ * DAY));
    const quiet = loanOf();
    const interest = ceilCoins(before.remaining * before.rate);
    expect(quiet.remaining).toBe(before.remaining);
    expect(quiet.fees).toBe(before.fees + interest + ceilCoins((before.remaining + before.fees + interest) * LOANS.lateFee));

    // A night with income parked in savings: the bank still takes LOANS.garnish of it.
    const day = clock.dayKey(t + d * DAY);
    const at = clock.startOfDay(day) + HOUR;
    ledger.post({ userId: id, delta: 1_000, kind: "salary", now: at });
    bank.moveSavings(id, "deposit", 1_000, at + 1);
    const owed = quiet.remaining + quiet.fees;
    credit.settleLoansDay(day);
    const after = loanOf();
    const take = Math.floor(1_000 * LOANS.garnish);
    const cost = ceilCoins(quiet.remaining * quiet.rate);
    const left = owed + cost - take;
    expect(after.remaining + after.fees).toBe(left + ceilCoins(left * LOANS.lateFee));
  });

  it("starts a hụi group left open HUI.openDays at that settlement, runs round 1 the next night and mails members", () => {
    const owner = newPlayer("wiki_hui_chu", 0);
    const others = [newPlayer("wiki_hui_b", 0), newPlayer("wiki_hui_c", 0)];
    hui.createHui(owner, { scope: "player", name: "Dây wiki chờ", amount: 100, size: 5 }, T0);
    const id = store.db.prepare("SELECT id FROM hui_groups WHERE name = ?").get("Dây wiki chờ").id;
    for (const m of others) hui.joinHui(m, id, T0 + 1);
    const day = clock.dayKey(T0 + HUI.openDays * DAY);
    hui.settleHuiDay(day);
    const g = store.db.prepare("SELECT * FROM hui_groups WHERE id = ?").get(id);
    expect(g.status).toBe("running");
    expect(g.round).toBe(0);
    expect(g.next_round_at - (clock.startOfDay(day) + DAY - 1)).toBe(DAY);
    for (const m of [owner, ...others]) {
      expect(store.db.prepare("SELECT COUNT(*) AS n FROM mail WHERE to_user = ? AND subject LIKE '%Dây wiki chờ%'").get(m).n, `mail to ${m}`).toBe(1);
    }
  });

  it("caps hụi groups per player at HUI_EXTRA.maxGroups", () => {
    const id = newPlayer("wiki_hui", 10_000);
    for (let i = 0; i < HUI_EXTRA.maxGroups; i++) hui.createHui(id, { scope: "player", name: `Dây wiki ${i}`, amount: 100, size: 3 }, T0);
    expect(() => hui.createHui(id, { scope: "player", name: "Dây wiki thừa", amount: 100, size: 3 }, T0)).toThrow(new RegExp(`tối đa ${HUI_EXTRA.maxGroups} dây`));
  });

  it("accepts hụi names of HUI_EXTRA.name.min to HUI_EXTRA.name.max characters", () => {
    const id = newPlayer("wiki_hui_ten", 0);
    const make = (name: string) => () => hui.createHui(id, { scope: "player", name, amount: 100, size: 3 }, T0);
    expect(make("ạ".repeat(HUI_EXTRA.name.min - 1)), "HUI_EXTRA.name.min").toThrow();
    expect(make("ạ".repeat(HUI_EXTRA.name.max + 1)), "HUI_EXTRA.name.max").toThrow();
    expect(make("ạ".repeat(HUI_EXTRA.name.min))).not.toThrow();
    expect(make("ạ".repeat(HUI_EXTRA.name.max))).not.toThrow();
  });
});
