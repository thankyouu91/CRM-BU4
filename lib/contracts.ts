import type { Contract } from "@prisma/client";
import { contractMetrics, contractTotals } from "./finance";

/** The linked project, with its current completion when loaded through lib/contract-queries.ts. */
export interface ContractProject {
  id: string;
  name: string;
  color: string;
  /** ProjectStatus (contracts of completed projects should have their PDFs archived) */
  status?: string;
  progress?: number;
  scheduleStatus?: string;
}

/** Count of attached PDFs, from `_count` (never by loading the files). */
export const fileCountSelect = { _count: { select: { files: true } } } as const;

/** API shape: amounts as numbers (VNĐ fits well within 2^53) plus derived metrics. */
export function contractDto(c: Contract & { project?: ContractProject | null; _count?: { files: number } }) {
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
    fileCount: c._count?.files ?? 0,
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
