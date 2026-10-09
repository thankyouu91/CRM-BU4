// Contract & cost math (shared by server and UI; no server-only imports).
// Amounts are whole VNĐ. Profit, margin, receivable and payment status are
// derived here, never stored.

export const CONTRACT_STATUS = {
  PLANNED: { label: "Chưa triển khai", bg: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300" },
  IN_PROGRESS: { label: "Đang triển khai", bg: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  TESTING: { label: "Khảo thí", bg: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  COMPLETED: { label: "Hoàn thành", bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
} as const;
export type ContractStatusKey = keyof typeof CONTRACT_STATUS;
export const CONTRACT_STATUSES = Object.keys(CONTRACT_STATUS) as ContractStatusKey[];

export const PAYMENT_STATUS = {
  UNPAID: { label: "Chưa thanh toán", bg: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  PARTIAL: { label: "Đã tạm ứng", bg: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  PAID: { label: "Đã hoàn tất", bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
} as const;
export type PaymentStatusKey = keyof typeof PAYMENT_STATUS;

/** Rating by gross margin. */
export const RATINGS = [
  { min: 30, label: "Tốt", bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  { min: 15, label: "Khá", bg: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  { min: 0, label: "Thấp", bg: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  { min: -Infinity, label: "Lỗ", bg: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
] as const;

export interface ContractAmounts {
  value: number;
  trainingCost: number;
  examCost: number;
  otherCost: number;
  /** Expected gross margin in %, used only while no cost has been entered. */
  expectedMargin: number | null;
  collected: number;
}

export interface ContractMetrics {
  totalCost: number;
  /** null when neither costs nor an expected margin are known. */
  profit: number | null;
  /** Gross margin in %, one decimal; null like profit. */
  margin: number | null;
  /** "cost": value minus entered costs; "estimate": from the expected margin. */
  basis: "cost" | "estimate" | null;
  /** Cost / value in %, one decimal (0 when no cost entered). */
  costRatio: number;
  receivable: number;
  paymentStatus: PaymentStatusKey;
  rating: string | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function contractMetrics(c: ContractAmounts): ContractMetrics {
  const totalCost = c.trainingCost + c.examCost + c.otherCost;
  let profit: number | null = null;
  let basis: ContractMetrics["basis"] = null;
  if (totalCost > 0) {
    profit = c.value - totalCost;
    basis = "cost";
  } else if (c.expectedMargin !== null) {
    profit = Math.round((c.value * c.expectedMargin) / 100);
    basis = "estimate";
  }
  const margin = profit === null || c.value <= 0 ? null : round1((profit / c.value) * 100);
  const receivable = Math.max(0, c.value - c.collected);
  const paymentStatus: PaymentStatusKey = c.collected <= 0 ? "UNPAID" : receivable > 0 ? "PARTIAL" : "PAID";
  return {
    totalCost,
    profit,
    margin,
    basis,
    costRatio: c.value > 0 ? round1((totalCost / c.value) * 100) : 0,
    receivable,
    paymentStatus,
    rating: margin === null ? null : RATINGS.find((r) => margin >= r.min)!.label,
  };
}

export interface ContractTotals {
  count: number;
  value: number;
  trainingCost: number;
  examCost: number;
  otherCost: number;
  totalCost: number;
  /** Cost / value over contracts with entered costs, in %. */
  costRatio: number;
  /** Profit of contracts with a known profit (entered costs or estimate). */
  profit: number;
  /** Profit / value over those contracts, in %. */
  margin: number;
  /** How many profits are estimates (no cost entered yet). */
  estimated: number;
  collected: number;
  receivable: number;
}

export function contractTotals(rows: (ContractAmounts & { metrics: ContractMetrics })[]): ContractTotals {
  const t: ContractTotals = {
    count: rows.length,
    value: 0,
    trainingCost: 0,
    examCost: 0,
    otherCost: 0,
    totalCost: 0,
    costRatio: 0,
    profit: 0,
    margin: 0,
    estimated: 0,
    collected: 0,
    receivable: 0,
  };
  let costedValue = 0;
  let profitValue = 0;
  for (const r of rows) {
    t.value += r.value;
    t.trainingCost += r.trainingCost;
    t.examCost += r.examCost;
    t.otherCost += r.otherCost;
    t.totalCost += r.metrics.totalCost;
    t.collected += r.collected;
    t.receivable += r.metrics.receivable;
    if (r.metrics.totalCost > 0) costedValue += r.value;
    if (r.metrics.profit !== null) {
      t.profit += r.metrics.profit;
      profitValue += r.value;
      if (r.metrics.basis === "estimate") t.estimated += 1;
    }
  }
  t.costRatio = costedValue > 0 ? round1((t.totalCost / costedValue) * 100) : 0;
  t.margin = profitValue > 0 ? round1((t.profit / profitValue) * 100) : 0;
  return t;
}

/** Compact amount for slides and tiles: "1,93 tỷ", "468 tr", "950.000 đ". */
export function formatVndShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const fmt = (v: number, digits: number) => v.toLocaleString("vi-VN", { maximumFractionDigits: digits });
  if (abs >= 1e9) return `${sign}${fmt(abs / 1e9, 2)} tỷ`;
  if (abs >= 1e6) return `${sign}${fmt(abs / 1e6, abs >= 1e8 ? 0 : 1)} tr`;
  return `${sign}${fmt(abs, 0)} đ`;
}

/** 1.234.567 đ (Vietnamese grouping). */
export function formatVnd(n: number | null | undefined, unit = true): string {
  if (n === null || n === undefined) return "—";
  return `${Math.round(n).toLocaleString("vi-VN")}${unit ? " đ" : ""}`;
}

/** Parse "62,601,000 đ", "62.601.000" or "62601000" to whole đồng; null when empty. */
export function parseVnd(input: string): number | null {
  const negative = /^\s*[-−(]/.test(input);
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return negative ? -n : n;
}
