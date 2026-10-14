import { expect, it } from "vitest";
import { waterfallSteps } from "../components/contracts/profit-waterfall";
import { contractMetrics, contractTotals, type ContractAmounts } from "../lib/finance";

const totals = (list: ContractAmounts[]) => contractTotals(list.map((c) => ({ ...c, metrics: contractMetrics(c) })));
const c = (patch: Partial<ContractAmounts>): ContractAmounts => ({ value: 0, trainingCost: 0, examCost: 0, otherCost: 0, expectedMargin: null, collected: 0, ...patch });

it("steps from contract value through each cost to gross profit", () => {
  const { steps, complete } = waterfallSteps(totals([c({ value: 100_000_000, trainingCost: 30_000_000, examCost: 10_000_000 })]));
  expect(complete).toBe(true);
  expect(steps.map((s) => [s.label, s.from, s.to])).toEqual([
    ["Giá trị HĐ", 0, 100_000_000],
    ["Chi phí đào tạo", 100_000_000, 70_000_000],
    ["Chi phí khảo thí", 70_000_000, 60_000_000],
    ["Lợi nhuận gộp", 0, 60_000_000], // no "Chi phí khác" bar when there is none
  ]);
});

it("does not call it gross profit while some contracts have no costs entered", () => {
  const { steps, complete } = waterfallSteps(totals([
    c({ value: 100_000_000, trainingCost: 30_000_000 }),
    c({ value: 50_000_000, expectedMargin: 20 }), // profit estimated, no cost
  ]));
  expect(complete).toBe(false);
  expect(steps.at(-1)).toMatchObject({ label: "Còn lại sau chi phí", to: 120_000_000 });
});

it("shows a loss below zero", () => {
  const { steps } = waterfallSteps(totals([c({ value: 10_000_000, trainingCost: 8_000_000, otherCost: 5_000_000 })]));
  expect(steps.at(-1)).toMatchObject({ label: "Lợi nhuận gộp", amount: -3_000_000, to: -3_000_000 });
});
