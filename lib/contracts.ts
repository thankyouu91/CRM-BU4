import type { Contract } from "@prisma/client";
import { contractMetrics, contractTotals } from "./finance";

/** The linked project, with its current completion when loaded through lib/contract-queries.ts. */
export interface ContractProject {
  id: string;
  name: string;
  color: string;
  progress?: number;
  scheduleStatus?: string;
}

/** API shape: amounts as numbers (VNĐ fits well within 2^53) plus derived metrics. */
export function contractDto(c: Contract & { project?: ContractProject | null }) {
  const amounts = {
    value: Number(c.value),
    trainingCost: Number(c.trainingCost),
    examCost: Number(c.examCost),
    otherCost: Number(c.otherCost),
    expectedMargin: c.expectedMargin,
    collected: Number(c.collected),
  };
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    partner: c.partner,
    performedAt: c.performedAt.toISOString(),
    status: c.status,
    note: c.note,
    projectId: c.projectId,
    project: c.project ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    ...amounts,
    metrics: contractMetrics(amounts),
  };
}

export type ContractDto = ReturnType<typeof contractDto>;

export function summarizeContracts(rows: ContractDto[]) {
  return contractTotals(rows);
}

/** Amount fields from validated input -> BigInt columns. */
export function toDbAmounts<T extends Partial<Record<"value" | "trainingCost" | "examCost" | "otherCost" | "collected", number>>>(d: T) {
  const big = (n: number | undefined) => (n === undefined ? undefined : BigInt(n));
  return {
    value: big(d.value),
    trainingCost: big(d.trainingCost),
    examCost: big(d.examCost),
    otherCost: big(d.otherCost),
    collected: big(d.collected),
  };
}
