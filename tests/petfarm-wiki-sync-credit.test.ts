import { beforeAll, describe, expect, it } from "vitest";
import { BANK_LOAN, HUI_EXTRA, P2P_EXTRA } from "@/lib/wiki/rules-credit";
import { CREDIT } from "@/petdex/server/rules/production.js";

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

  it("gives the P2P payoff bonus and default ban the wiki states (P2P_EXTRA)", () => {
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
    expect((user(bad).loan_ban_until - at) / DAY, "P2P_EXTRA.banDays").toBe(P2P_EXTRA.banDays);
  });

  it("caps hụi groups per player at HUI_EXTRA.maxGroups", () => {
    const id = newPlayer("wiki_hui", 10_000);
    for (let i = 0; i < HUI_EXTRA.maxGroups; i++) hui.createHui(id, { scope: "player", name: `Dây wiki ${i}`, amount: 100, size: 3 }, T0);
    expect(() => hui.createHui(id, { scope: "player", name: "Dây wiki thừa", amount: 100, size: 3 }, T0)).toThrow(new RegExp(`tối đa ${HUI_EXTRA.maxGroups} dây`));
  });
});
