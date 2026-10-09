import { describe, expect, it } from "vitest";
import { contractMetrics, contractTotals, formatVnd, formatVndShort, parseVnd, type ContractAmounts } from "@/lib/finance";

const amounts = (over: Partial<ContractAmounts>): ContractAmounts => ({
  value: 0,
  trainingCost: 0,
  examCost: 0,
  otherCost: 0,
  expectedMargin: null,
  collected: 0,
  ...over,
});

describe("contractMetrics", () => {
  it("uses entered costs when there are any", () => {
    const m = contractMetrics(
      amounts({ value: 1_000_000, trainingCost: 300_000, examCost: 100_000, otherCost: 100_000, expectedMargin: 10 }),
    );
    expect(m).toEqual({
      totalCost: 500_000,
      profit: 500_000,
      margin: 50,
      basis: "cost",
      costRatio: 50,
      receivable: 1_000_000,
      paymentStatus: "UNPAID",
      rating: "Tốt",
    });
  });

  it("estimates from the expected margin while no cost is entered", () => {
    const m = contractMetrics(amounts({ value: 1_000_000, expectedMargin: 20 }));
    expect(m.profit).toBe(200_000);
    expect(m.basis).toBe("estimate");
    expect(m.margin).toBe(20);
    expect(m.costRatio).toBe(0);
    expect(m.rating).toBe("Khá");
  });

  it("rounds an estimated profit to whole đồng", () => {
    expect(contractMetrics(amounts({ value: 1_001, expectedMargin: 15 })).profit).toBe(150);
  });

  it("leaves profit, margin and rating unknown without costs or an expected margin", () => {
    const m = contractMetrics(amounts({ value: 5_000_000 }));
    expect(m).toMatchObject({ totalCost: 0, profit: null, margin: null, basis: null, rating: null, costRatio: 0 });
  });

  it("has no margin or cost ratio for a zero value", () => {
    const m = contractMetrics(amounts({ value: 0, otherCost: 100 }));
    expect(m.profit).toBe(-100);
    expect(m.margin).toBeNull();
    expect(m.rating).toBeNull();
    expect(m.costRatio).toBe(0);
  });

  it("rates a loss", () => {
    const m = contractMetrics(amounts({ value: 100, trainingCost: 150 }));
    expect(m.profit).toBe(-50);
    expect(m.margin).toBe(-50);
    expect(m.rating).toBe("Lỗ");
  });

  it("rounds margin and cost ratio to one decimal", () => {
    const m = contractMetrics(amounts({ value: 3_000, otherCost: 1_000 }));
    expect(m.margin).toBe(66.7);
    expect(m.costRatio).toBe(33.3);
  });

  it.each([
    [30, "Tốt"],
    [29.9, "Khá"],
    [15, "Khá"],
    [14.9, "Thấp"],
    [0, "Thấp"],
    [-0.1, "Lỗ"],
  ])("margin %d%% is rated %s", (margin, label) => {
    // value 1000 and a cost giving exactly that margin
    const m = contractMetrics(amounts({ value: 1000, otherCost: 1000 - margin * 10 }));
    expect(m.margin).toBe(margin);
    expect(m.rating).toBe(label);
  });

  it.each([
    [0, "UNPAID", 1_000],
    [400, "PARTIAL", 600],
    [1_000, "PAID", 0],
    [1_200, "PAID", 0],
  ])("collected %d -> %s, receivable %d", (collected, status, receivable) => {
    const m = contractMetrics(amounts({ value: 1_000, collected }));
    expect(m.paymentStatus).toBe(status);
    expect(m.receivable).toBe(receivable);
  });
});

describe("contractTotals", () => {
  it("is all zeros for no rows", () => {
    expect(contractTotals([])).toEqual({
      count: 0,
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
    });
  });

  it("sums amounts and computes ratios over the relevant contracts only", () => {
    const rows = [
      amounts({ value: 1_000, trainingCost: 400, collected: 1_000 }), // costed, profit 600
      amounts({ value: 2_000, expectedMargin: 10, collected: 500 }), // estimate, profit 200
      amounts({ value: 7_000 }), // unknown profit
    ].map((a) => ({ ...a, metrics: contractMetrics(a) }));
    const t = contractTotals(rows);
    expect(t).toEqual({
      count: 3,
      value: 10_000,
      trainingCost: 400,
      examCost: 0,
      otherCost: 0,
      totalCost: 400,
      costRatio: 40, // 400 / 1000 (only the costed contract)
      profit: 800,
      margin: 26.7, // 800 / 3000 (contracts with a known profit)
      estimated: 1,
      collected: 1_500,
      receivable: 8_500,
    });
  });
});

describe("formatVnd", () => {
  it("groups with dots and appends the unit", () => {
    expect(formatVnd(1_234_567)).toBe("1.234.567 đ");
    expect(formatVnd(0)).toBe("0 đ");
    expect(formatVnd(1_234_567, false)).toBe("1.234.567");
  });

  it("rounds to whole đồng", () => {
    expect(formatVnd(999.6)).toBe("1.000 đ");
  });

  it("shows a dash for missing values", () => {
    expect(formatVnd(null)).toBe("—");
    expect(formatVnd(undefined)).toBe("—");
  });
});

describe("formatVndShort", () => {
  it.each([
    [1_930_000_000, "1,93 tỷ"],
    [1_000_000_000, "1 tỷ"],
    [468_000_000, "468 tr"],
    [12_500_000, "12,5 tr"],
    [1_000_000, "1 tr"],
    [950_000, "950.000 đ"],
    [0, "0 đ"],
    [-2_500_000_000, "−2,5 tỷ"],
    [-950_000, "−950.000 đ"],
  ])("%d -> %s", (n, text) => {
    expect(formatVndShort(n)).toBe(text);
  });
});

describe("parseVnd", () => {
  it.each([
    ["62,601,000 đ", 62_601_000],
    ["62.601.000", 62_601_000],
    ["62601000", 62_601_000],
    ["  1 500 000 VNĐ ", 1_500_000],
    ["0", 0],
    ["-1.000", -1_000],
    ["−2.000", -2_000],
    ["(500)", -500],
  ])("%s -> %d", (input, n) => {
    expect(parseVnd(input)).toBe(n);
  });

  it.each(["", "   ", "đ", "abc"])("returns null for %j", (input) => {
    expect(parseVnd(input)).toBeNull();
  });
});
