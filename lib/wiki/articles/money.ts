// Shared numbers and wording for the money articles (ngan-hang, thue-toa-thi-chinh, tai-chinh).
// Everything here is computed from the game's pure rules, so the text follows a rule change.
import { BANK, policy } from "@/petdex/server/rules/bank.js";
import { BRACKETS, incomeTax } from "@/petdex/server/rules/town.js";

/** 3000 → "3.000". */
export const num = (n: number, digits = 0) => n.toLocaleString("vi-VN", { maximumFractionDigits: digits });
/** 3000 → "3.000 xu". */
export const xu = (n: number) => `${num(n)} xu`;
/** 0.003 → "0,3%". */
export const pct = (x: number, digits = 3) => `${num(x * 100, digits)}%`;
/** 0.0005 → "0,05 điểm %". */
export const pts = (x: number) => `${num(x * 100, 3)} điểm %`;
/** Whole coins of interest on `amount` at `rate` per day over `days` days (rounded down, without float noise). */
export const interest = (amount: number, rate: number, days = 1) => Math.floor(Math.round(amount * rate * days * 1e6) / 1e6);
/** A price index such as 1.0123 → "1,012" (the game's news shows three decimals). */
export const idx = (x: number) => x.toLocaleString("vi-VN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const at = (growth: number, priceIndex = 1) => policy({ growth, priceIndex });
const round = (x: number, d = 6) => Math.round(x * 10 ** d) / 10 ** d;

/** The Central Bank's weekly rule, read back from rules/bank.js policy(). */
export const CB = (() => {
  const target = BANK.targetGrowth;
  const neutral = at(target).baseRate;
  const ratePerPoint = round(neutral - at(target + 0.01).baseRate);
  const indexPerPoint = round(at(target + 0.01).priceIndex - 1);
  const rateMin = at(10).baseRate;
  const rateMax = at(-10).baseRate;
  const indexUpMax = round(at(10).priceIndex - 1);
  const indexDownMax = round(1 - at(-10).priceIndex);
  return {
    target, neutral, ratePerPoint, indexPerPoint, rateMin, rateMax, indexUpMax, indexDownMax,
    /** Growth at or below which the base rate sits at its ceiling, and at or above which it sits at its floor. */
    rateFloorAt: round(target + ((neutral - rateMin) / ratePerPoint) * 0.01, 4),
    rateCeilAt: round(target - ((rateMax - neutral) / ratePerPoint) * 0.01, 4),
    /** Growth at or above which the price index rises by its weekly maximum, and at or below which it falls by its maximum. */
    indexUpAt: round(target + (indexUpMax / indexPerPoint) * 0.01, 4),
    indexDownAt: round(target - (indexDownMax / indexPerPoint) * 0.01, 4),
  };
})();

/** Rows "growth this week → base rate next week, price index change" for a few growth figures. */
export const policyRows = () =>
  [0, 0.05, 0.08, CB.target, 0.12, 0.15, 0.2, 0.3].map((g) => {
    const p = at(g);
    const change = round(p.priceIndex - 1);
    return [
      `${pct(g, 1)}/tuần`,
      `${pct(p.baseRate)}/ngày (khoảng ${pct(p.baseRate * 7, 2)}/tuần)`,
      `${change > 0 ? "+" : ""}${pct(change, 2)}`,
    ];
  });

/** Two Central Bank meetings in a row, with real numbers from policy(). */
export const policyExample = (() => {
  const g1 = 0.14;
  const w1 = at(g1, 1);
  const g2 = 0.04;
  const w2 = at(g2, w1.priceIndex);
  return { g1, w1, g2, w2 };
})();

/** Rows of the income tax brackets: "từ … đến … xu", rate. */
export const bracketRows = () => {
  let prev = 0;
  return (BRACKETS as [number, number][]).map(([cap, rate]) => {
    const row = [cap === Infinity ? `Trên ${xu(prev)}` : `Từ ${num(prev)} đến ${xu(cap)}`, pct(rate)];
    prev = cap;
    return row;
  });
};

/** "x xu → thuế y xu (z%)" rows for a few incomes in one day. */
export const taxRows = (incomes: number[]) =>
  incomes.map((n) => {
    const t = incomeTax(n);
    return [xu(n), xu(t), n ? pct(t / n, 1) : "0%"];
  });
