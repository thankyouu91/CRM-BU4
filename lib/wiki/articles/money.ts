// Shared numbers and wording for the money articles (ngan-hang, thue-toa-thi-chinh, tai-chinh).
// Everything here is computed from the game's pure rules, so the text follows a rule change.
import { BANK, policy } from "@/petdex/server/rules/bank.js";
import { BRACKETS, incomeTax } from "@/petdex/server/rules/town.js";
import { MONEY } from "../rules-money";

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
  [...new Set([0, 0.05, 0.08, CB.target, 0.12, 0.15, 0.2, 0.3, CB.indexUpAt])].sort((a, b) => a - b).map((g) => {
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

/** "a, b, c và d". */
export const andList = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} và ${items[items.length - 1]}`);

/** Player words for each ledger kind in MONEY.taxableKinds (a new taxable kind fails type-checking until it is named here). */
const TAXABLE_WORDS: Record<(typeof MONEY.taxableKinds)[number], string> = {
  salary: "lương",
  interest: "lãi ngân hàng",
  toll_income: "phí gia công",
  minigame: "tiền thưởng mini-game",
};
/** Every taxable income in player words: the taxable ledger kinds, then business profit and trading gains (town.js settleTaxes). */
export const TAXABLE = [...MONEY.taxableKinds.map((k) => TAXABLE_WORDS[k]), "lợi nhuận quầy", "lãi bán hàng (so với giá vốn)"];
export const isTaxed = (kind: string) => (MONEY.taxableKinds as readonly string[]).includes(kind);

/** The lowest bracket's cap: daily taxable income at or below it pays nothing. */
export const TAX_FREE = (BRACKETS as [number, number][])[0][0];
/** Lowest and highest bracket rates, "0% đến 18%". */
export const taxRange = () => `${pct((BRACKETS as [number, number][])[0][1], 0)} đến ${pct((BRACKETS as [number, number][])[BRACKETS.length - 1][1], 0)}`;

/** incomeTax(n) before it is rounded down to whole coins. */
export const bracketSum = (n: number) => {
  let sum = 0;
  let prev = 0;
  for (const [cap, rate] of BRACKETS as [number, number][]) {
    if (n > prev) sum += (Math.min(n, cap) - prev) * rate;
    prev = cap;
  }
  return Math.round(sum * 1e6) / 1e6;
};

/** The bracket-by-bracket sum behind incomeTax(n): "0 trên 150 xu đầu + 8% của 850 xu + 12% của 1.380 xu". */
export const taxSteps = (n: number) => {
  const parts: string[] = [];
  let prev = 0;
  for (const [cap, rate] of BRACKETS as [number, number][]) {
    if (n <= prev) break;
    const part = Math.min(n, cap) - prev;
    parts.push(rate ? `${pct(rate, 1)} của ${xu(part)}` : `0 trên ${xu(part)} đầu`);
    prev = cap;
  }
  return parts.join(" + ");
};
