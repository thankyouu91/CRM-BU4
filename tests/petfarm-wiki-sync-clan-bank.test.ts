import { beforeAll, describe, expect, it } from "vitest";
import { getArticle } from "@/lib/wiki";
import { CBANK, collateralOf, maxDepositRate, maxLoanOn, simpleInterest } from "@/public/ta-tua/game/js/shared/clan-bank.js";
import { financeTax } from "@/public/ta-tua/game/js/shared/clan-bonds.js";

// The clan bank and collateral loan articles read every number from shared/clan-bank.js. This test runs the
// game's own server code on an in-memory database and checks that the server enforces exactly those numbers,
// and that each new finance article keeps the four sections the owner asked for.

process.env.PETDEX_DB = ":memory:";

const DAY = 86_400_000;
const T0 = Date.parse("2026-12-02T03:00:00Z");

/* eslint-disable @typescript-eslint/no-explicit-any -- plain JS modules, loosely typed */
let store: any, ledger: any, clans: any, cb: any, bank: any, PLOTS: any[];
/* eslint-enable @typescript-eslint/no-explicit-any */

let n = 0;
function player() {
  n += 1;
  const id = store.createUser(`wcb${n}`, "x", T0 - 30 * DAY) as number;
  ledger.post({ userId: id, delta: 5_000_000, kind: "opening", now: T0 });
  const petId = store.insertPet(id, `Bé ${n}`, "test_pet", T0 - 20 * DAY);
  store.savePet({ ...store.getPet(petId), level: 8, updated_at: T0 });
  store.setActivePet(id, petId);
  return id;
}
function clan(name: string) {
  const leader = player();
  clans.createClan(leader, { name, emblem: "🏯", color: "#445566" }, T0);
  clans.donateClan(leader, 3_000_000, T0);
  return { leader, id: clans.clanView(leader, T0).clan.id as number };
}
function plotFor(c: { leader: number }) {
  const used = new Set(store.db.prepare("SELECT id FROM land_plots WHERE clan_id IS NOT NULL").all().map((r: { id: number }) => r.id));
  const p = PLOTS.find((x) => !used.has(x.id) && x.zone !== "sea");
  clans.buyPlot(c.leader, p.id, T0);
  return p.id as number;
}

let bankClan: { leader: number; id: number };
let base: number;

beforeAll(async () => {
  store = await import("@/petdex/server/db.js");
  ledger = await import("@/petdex/server/ledger.js");
  clans = await import("@/petdex/server/clans.js");
  cb = await import("@/petdex/server/clan-bank.js");
  bank = await import("@/petdex/server/bank.js");
  ({ PLOTS } = await import("@/public/ta-tua/game/js/shared/clan.js"));
  (await import("@/petdex/server/migrate.js")).migrate(T0);
  base = bank.economy().baseRate;
  bankClan = clan("Wiki Kho Bạc");
  store.db.prepare("INSERT INTO clan_industries (clan_id, industry, fee, entered_at) VALUES (?, 'state_bank', 0, ?)").run(bankClan.id, T0);
});

describe("Petfarm wiki stays in step with the clan bank", () => {
  it("has the four sections in order, with 2–4 hints and no em dash", () => {
    for (const slug of ["ngan-hang-gia-toc", "vay-the-chap"]) {
      const a = getArticle(slug)!;
      expect(a, slug).toBeDefined();
      expect(a.sections.map((s) => s.title), slug).toEqual(["Đây là gì", "Chức năng", "Rủi ro", "Mẹo"]);
      const tips = a.sections[3].blocks.flatMap((b) => ("list" in b ? b.list : []));
      expect(tips.length, slug).toBeGreaterThanOrEqual(2);
      expect(tips.length, slug).toBeLessThanOrEqual(4);
      expect(JSON.stringify(a), slug).not.toContain("—");
    }
  });

  it("states the Phố Ngân hàng licence: CBANK.license.slots private banks, CBANK.license.fee from the clan fund", () => {
    const text = JSON.stringify(getArticle("ngan-hang-gia-toc"));
    expect(text).toContain(`${CBANK.license.slots} suất ngân hàng tư`);
    expect(text).toContain(`Giấy phép ${CBANK.license.fee.toLocaleString("vi-VN")} xu`);
    expect(cb.freeLicenses()).toBe(CBANK.license.slots);
  });

  it("opens a bank at CBANK.minCapital and caps deposit rates at CBANK.maxRateMultiple × the NPC rate", () => {
    expect(() => cb.openBank(bankClan.leader, CBANK.minCapital - 1, T0), "minCapital").toThrow();
    cb.openBank(bankClan.leader, 400_000, T0);
    const cap = maxDepositRate(base);
    expect(cap).toBeCloseTo(base * CBANK.maxRateMultiple, 12);
    expect(() => cb.setBankTerms(bankClan.leader, { rates: { [CBANK.terms[0]]: cap * 1.001 } }, T0), "maxRateMultiple").toThrow();
    cb.setBankTerms(bankClan.leader, { rates: Object.fromEntries(CBANK.terms.map((t) => [t, cap])), loanRate: base * CBANK.loan.maxRateMultiple, lendingOpen: true }, T0);
    expect(() => cb.setBankTerms(bankClan.leader, { loanRate: base * CBANK.loan.maxRateMultiple * 1.001 }, T0), "loan.maxRateMultiple").toThrow();
    expect(() => cb.setBankTerms(bankClan.leader, { loanRate: base * CBANK.loan.minRateMultiple * 0.999 }, T0), "loan.minRateMultiple").toThrow();
  });

  it("takes deposits within CBANK.minDeposit and CBANK.maxPerDepositor, charging CBANK.insurancePremium to the bank", () => {
    const saver = player();
    const term = CBANK.terms[0];
    expect(() => cb.depositAtBank(saver, bankClan.id, CBANK.minDeposit - 1, term, T0), "minDeposit").toThrow();
    const fund = cb.insuranceFund();
    cb.depositAtBank(saver, bankClan.id, CBANK.maxPerDepositor, term, T0);
    expect(cb.insuranceFund() - fund, "insurancePremium").toBe(Math.ceil(CBANK.maxPerDepositor * CBANK.insurancePremium));
    expect(() => cb.depositAtBank(saver, bankClan.id, CBANK.minDeposit, term, T0), "maxPerDepositor").toThrow();
    const dep = store.db.prepare("SELECT * FROM cbank_deposits ORDER BY id DESC LIMIT 1").get();
    const coins = store.getUser(saver).coins;
    cb.settleClanBankDay(dep.matures_at);
    const interest = simpleInterest(CBANK.maxPerDepositor, dep.rate, term);
    expect(store.getUser(saver).coins - coins, "simpleInterest").toBe(CBANK.maxPerDepositor + interest - financeTax(interest));
  });

  it("values collateral with collateralOf and lends up to maxLoanOn of it, charging CBANK.loan.fee", () => {
    const borrower = clan("Wiki Người Vay");
    const plotId = plotFor(borrower);
    const c = clans.plotCollateral(plotId, T0 + 20 * DAY);
    expect(c.value, "buildingShare").toBe(collateralOf(c.land, c.row.design_spent));
    const now = T0 + 20 * DAY;
    const cap = maxLoanOn(c.value);
    expect(() => cb.borrowFromBank(borrower.leader, { bankId: bankClan.id, plotId, amount: cap + 1, term: CBANK.loan.terms[0] }, now), "loan.ltv").toThrow();
    expect(() => cb.borrowFromBank(borrower.leader, { bankId: bankClan.id, plotId, amount: CBANK.loan.minAmount - 1, term: CBANK.loan.terms[0] }, now), "loan.minAmount").toThrow();
    const fund = cb.insuranceFund();
    const amount = Math.max(CBANK.loan.minAmount, Math.min(cap, 50_000));
    cb.borrowFromBank(borrower.leader, { bankId: bankClan.id, plotId, amount, term: CBANK.loan.terms[0] }, now);
    expect(cb.insuranceFund() - fund, "loan.fee").toBe(Math.ceil(amount * CBANK.loan.fee));

    // Unpaid: CBANK.loan.lateFee each night, default after CBANK.loan.graceNights, auction at CBANK.auction.startShare.
    const loan = store.db.prepare("SELECT * FROM cbank_loans ORDER BY id DESC LIMIT 1").get();
    const drain = store.db.prepare("SELECT balance FROM accounts WHERE id = ?").get(`clan:${borrower.id}`).balance;
    ledger.post({ account: `clan:${borrower.id}`, delta: -drain, kind: "clan_upkeep", now });
    ledger.post({ account: "treasury", delta: drain, kind: "clan_upkeep", now });
    cb.settleClanBankDay(loan.due_at);
    const late = store.db.prepare("SELECT * FROM cbank_loans WHERE id = ?").get(loan.id);
    expect(late.owed - loan.owed, "loan.lateFee").toBe(Math.ceil(loan.owed * CBANK.loan.lateFee));
    for (let i = 1; i < CBANK.loan.graceNights; i++) cb.settleClanBankDay(loan.due_at + i * DAY);
    expect(store.db.prepare("SELECT status FROM cbank_loans WHERE id = ?").get(loan.id).status, "loan.graceNights").toBe("late");
    cb.settleClanBankDay(loan.due_at + CBANK.loan.graceNights * DAY);
    const a = store.db.prepare("SELECT * FROM cbank_auctions WHERE loan_id = ?").get(loan.id);
    expect(a.ends_at - a.created_at, "auction.hours").toBe(CBANK.auction.hours * 3_600_000);
    expect(a.start_price, "auction.startShare").toBe(Math.round(clans.plotCollateral(plotId, a.created_at).value * CBANK.auction.startShare));
  });

  it("fails a bank after CBANK.failNights with withdrawals queued", () => {
    const now = T0 + 60 * DAY;
    const s = cb.sheetOf(bankClan.id);
    // Drain the bank's cash so a withdrawal has to queue.
    const saver = player();
    cb.setClanBankFrozen(null, false);
    ledger.post({ account: `bank:${bankClan.id}`, delta: -s.cash, kind: "admin", now });
    ledger.post({ account: "treasury", delta: s.cash, kind: "admin", now });
    store.db.prepare("INSERT INTO cbank_deposits (bank_id, user_id, amount, rate, term_days, opened_at, matures_at) VALUES (?, ?, 1000, 0, 7, ?, ?)").run(bankClan.id, saver, now, now + 7 * DAY);
    const dep = store.db.prepare("SELECT * FROM cbank_deposits ORDER BY id DESC LIMIT 1").get();
    cb.withdrawFromBank(saver, dep.id, now);
    for (let i = 1; i < CBANK.failNights; i++) cb.settleClanBankDay(now + i * DAY);
    expect(store.db.prepare("SELECT status FROM cbank_banks WHERE clan_id = ?").get(bankClan.id).status, "failNights").toBe("open");
    cb.settleClanBankDay(now + CBANK.failNights * DAY);
    expect(store.db.prepare("SELECT status FROM cbank_banks WHERE clan_id = ?").get(bankClan.id).status, "failNights").toBe("failed");
  });
});
