import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { Pool } from "pg";
import type { CurrentUser } from "../lib/session";

// CI provisions an empty PostgreSQL database. Never use a production database here.
describe.skipIf(!process.env.TEST_DATABASE_URL)("PostgreSQL transactions", () => {
  let db: PrismaClient;
  const userId = `test-${randomUUID()}`;
  let projectId: string;
  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!["localhost", "127.0.0.1", "postgres"].includes(url.hostname) || !url.pathname.endsWith("_test")) {
      throw new Error("Integration tests require a local database whose name ends in _test");
    }
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    db = (await import("../lib/prisma")).prisma;
    await db.user.create({ data: { id: userId, email: `${userId}@example.test`, name: "Integration", passwordHash: "test-only" } });
    projectId = (await db.project.create({ data: { name: "Integration", ownerId: userId } })).id;
  });
  afterAll(async () => {
    if (!db) return;
    await db.contract.deleteMany({ where: { createdById: userId } });
    await db.project.deleteMany({ where: { ownerId: userId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
    await (globalThis as unknown as { fileStoragePool?: Pool }).fileStoragePool?.end();
  });

  it("rolls back a progress report when its task snapshot is stale", async () => {
    const { updateTaskSafely } = await import("../lib/task-service");
    const task = await db.task.create({ data: { title: "Concurrency", projectId, createdById: userId, status: "IN_PROGRESS", progress: 20 } });
    await db.task.update({ where: { id: task.id }, data: { progress: 80 } });
    await expect(db.$transaction(async (tx) => {
      await tx.taskReport.create({ data: { taskId: task.id, authorId: userId, content: "Stale", progress: 40 } });
      await updateTaskSafely(tx, task, { progress: 40 });
    })).rejects.toThrow("Công việc đã được cập nhật");
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).progress).toBe(80);
    expect(await db.taskReport.count({ where: { taskId: task.id } })).toBe(0);
  });

  it("aggregates filtered task statistics and exposes task rights on PostgreSQL", async () => {
    const { listTasks } = await import("../lib/queries");
    const title = `performance-${randomUUID()}`;
    await db.task.createMany({ data: [
      { title, projectId, createdById: userId, assigneeId: userId, status: "TODO", dueDate: new Date(Date.now() - 86400000) },
      { title, projectId, createdById: userId, assigneeId: userId, status: "IN_PROGRESS" },
      { title, projectId, createdById: userId, assigneeId: userId, status: "DONE", completedAt: new Date() },
    ] });
    const user = { id: userId, role: "MEMBER", permissions: [] } as unknown as CurrentUser;
    const result = await listTasks(user, { q: title });
    expect(result).toMatchObject({ total: 3, nextCursor: null, stats: { open: 2, active: 1, overdue: 1, doneWeek: 1 } });
    expect(result.tasks.every((task) => task.canReport)).toBe(true);
    expect(result.tasks[0].project).not.toHaveProperty("members");
    expect((await listTasks(user, { q: title, status: "DONE" })).stats).toEqual({ open: 0, active: 0, overdue: 0, doneWeek: 1 });
  });

  it("serializes two real uploads at the contract file limit", async () => {
    const { storeContractFiles } = await import("../lib/contract-file-service");
    const contract = await db.contract.create({ data: { name: "Upload race", value: 0, performedAt: new Date(), createdById: userId } });
    await db.contractFile.createMany({ data: Array.from({ length: 19 }, (_, i) => ({ contractId: contract.id, name: `existing-${i}.pdf`, size: 0, uploadedById: userId })) });
    const item = { name: "new.pdf", bytes: new TextEncoder().encode("%PDF-1.4\nhello") };
    const results = await Promise.allSettled([
      storeContractFiles(contract.id, userId, [item]), storeContractFiles(contract.id, userId, [item]),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.contractFile.count({ where: { contractId: contract.id } })).toBe(20);
    expect(await db.contractFileBlob.count({ where: { file: { contractId: contract.id } } })).toBe(1);
  });
});
