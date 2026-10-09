import { expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { updateTaskSafely } from "../lib/task-service";
import { ConflictError } from "../lib/errors";

it("rejects a stale task snapshot rather than reporting a successful update", async () => {
  const tx = { task: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), findUniqueOrThrow: vi.fn() } };
  const before = { id: "t", updatedAt: new Date("2026-10-01"), status: "IN_PROGRESS" as const, progress: 20, completedAt: null };
  await expect(updateTaskSafely(tx as unknown as Prisma.TransactionClient, before, { progress: 40 })).rejects.toBeInstanceOf(ConflictError);
  expect(tx.task.updateMany).toHaveBeenCalledWith({ where: before, data: { progress: 40 } });
  expect(tx.task.findUniqueOrThrow).not.toHaveBeenCalled();
});
