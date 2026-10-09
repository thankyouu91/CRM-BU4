import type { Prisma, Task } from "@prisma/client";
import { ConflictError } from "./errors";

/** Compare-and-swap inside the caller's transaction; dependent writes roll back on conflict. */
export async function updateTaskSafely(
  tx: Prisma.TransactionClient,
  before: Pick<Task, "id" | "updatedAt" | "status" | "progress" | "completedAt">,
  data: Prisma.TaskUncheckedUpdateManyInput,
) {
  const result = await tx.task.updateMany({
    where: {
      id: before.id, updatedAt: before.updatedAt, status: before.status,
      progress: before.progress, completedAt: before.completedAt,
    },
    data,
  });
  if (result.count !== 1) throw new ConflictError();
  return tx.task.findUniqueOrThrow({ where: { id: before.id } });
}
