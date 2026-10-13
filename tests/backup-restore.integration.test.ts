import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import pg from "pg";
import { dumpDatabase } from "../lib/maintenance";

// A real round trip: back up the test database the way the daily job does, restore the
// file with scripts/restore-backup.mjs into a fresh database, and compare. Proves the
// backups can be restored, not only written. Never point this at a production database.
describe.skipIf(!process.env.TEST_DATABASE_URL)("backup and restore", () => {
  const source = new URL(process.env.TEST_DATABASE_URL ?? "postgres://localhost/x_test");
  const target = new URL(source.href);
  target.pathname = source.pathname.replace(/_test$/, "_restore_test");
  target.search = "";
  const targetName = target.pathname.slice(1);
  const dir = mkdtempSync(join(tmpdir(), "crm-restore-"));
  const id = `restore-${randomUUID()}`;
  let db: pg.Client;

  beforeAll(async () => {
    if (!["localhost", "127.0.0.1", "postgres"].includes(source.hostname) || !source.pathname.endsWith("_test")) {
      throw new Error("The restore test requires a local database whose name ends in _test");
    }
    const url = new URL(source.href);
    url.search = "";
    db = new pg.Client({ connectionString: url.href });
    await db.connect();
    await db.query(`DROP DATABASE IF EXISTS "${targetName}"`);
    await db.query(`CREATE DATABASE "${targetName}"`);
    execFileSync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: target.href }, stdio: "pipe", timeout: 120_000 });

    // Rows that are easy to get wrong: a self-reference, a large BIGINT amount, JSON, a null.
    await db.query(`INSERT INTO "User" (id, email, name, "passwordHash", "updatedAt") VALUES ($1, $2, 'Khôi phục', 'test-only', now())`, [id, `${id}@example.test`]);
    await db.query(`INSERT INTO "Project" (id, name, "ownerId", "updatedAt") VALUES ($1, 'Dự án sao lưu', $1, now())`, [id]);
    await db.query(`INSERT INTO "Task" (id, title, "projectId", "createdById", "updatedAt") VALUES ($1, 'Cha', $2, $2, now())`, [`${id}-parent`, id]);
    await db.query(`INSERT INTO "Task" (id, title, "projectId", "parentId", "createdById", "updatedAt") VALUES ($1, 'Con', $2, $3, $2, now())`, [`${id}-child`, id, `${id}-parent`]);
    await db.query(`INSERT INTO "Contract" (id, name, value, "performedAt", "createdById", "projectId", "updatedAt") VALUES ($1, 'HĐ sao lưu', 1234567890123, now(), $1, $1, now())`, [id]);
    await db.query(`INSERT INTO "Notification" (id, "userId", type, title, link) VALUES ($1, $1, 'task.assigned', 'Bạn được giao “Con”', NULL)`, [id]);
    await db.query(`INSERT INTO "AuditLog" (id, "actorId", "actorName", action, "entityType", summary, details) VALUES ($1, $1, 'Khôi phục', 'task.update', 'task', 'Sửa', $2)`, [id, JSON.stringify({ a: [1, "hai"], b: null })]);
  }, 180_000);

  afterAll(async () => {
    if (!db) return;
    await db.query(`DELETE FROM "AuditLog" WHERE id = $1`, [id]).catch(() => undefined);
    await db.query(`DELETE FROM "Contract" WHERE id = $1`, [id]).catch(() => undefined);
    await db.query(`DELETE FROM "Project" WHERE id = $1`, [id]).catch(() => undefined);
    await db.query(`DELETE FROM "User" WHERE id = $1`, [id]).catch(() => undefined);
    await db.query(`DROP DATABASE IF EXISTS "${targetName}" WITH (FORCE)`).catch(() => undefined);
    await db.end();
    rmSync(dir, { recursive: true, force: true });
  });

  it("restores every row of a backup into an empty database, and refuses a second time", async () => {
    const { json, counts } = await dumpDatabase(db, new Date());
    const file = join(dir, "backup.json.gz");
    writeFileSync(file, gzipSync(json));

    const restore = () => spawnSync("node", ["scripts/restore-backup.mjs", file], { env: { ...process.env, DATABASE_URL: target.href }, encoding: "utf8", timeout: 120_000 });
    const first = restore();
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain("Restore complete.");

    const restored = new pg.Client({ connectionString: target.href });
    await restored.connect();
    try {
      for (const [table, n] of Object.entries(counts)) {
        if (table === "_prisma_migrations") continue;
        const { rows } = await restored.query(`SELECT count(*)::int AS n FROM "${table}"`);
        expect({ table, n: rows[0].n }).toEqual({ table, n });
      }
      const child = await restored.query(`SELECT "parentId" FROM "Task" WHERE id = $1`, [`${id}-child`]);
      expect(child.rows[0].parentId).toBe(`${id}-parent`);
      const contract = await restored.query(`SELECT value::text AS value FROM "Contract" WHERE id = $1`, [id]);
      expect(contract.rows[0].value).toBe("1234567890123");
      const log = await restored.query(`SELECT details FROM "AuditLog" WHERE id = $1`, [id]);
      expect(log.rows[0].details).toEqual({ a: [1, "hai"], b: null });
      const notice = await restored.query(`SELECT title, link FROM "Notification" WHERE id = $1`, [id]);
      expect(notice.rows[0]).toEqual({ title: "Bạn được giao “Con”", link: null });
    } finally {
      await restored.end();
    }

    const second = restore();
    expect(second.status).toBe(1);
    expect(second.stderr).toMatch(/already has \d+ rows/);
  }, 180_000);
});
