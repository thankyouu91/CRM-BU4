#!/usr/bin/env node
// Restore a backup written by the daily maintenance job (lib/maintenance.ts) into
// an EMPTY database that already has the schema.
//
//   1. Create the target database and its schema:
//        DATABASE_URL=postgres://...target... npx prisma migrate deploy
//   2. Restore (as the table owner, e.g. the Supabase `postgres` user):
//        DATABASE_URL=postgres://...target... node scripts/restore-backup.mjs daily-2026-10-09.json.gz
//   3. On Supabase, run prisma/supabase-hardening.sql again.
//
// Rows are inserted table by table in foreign-key order, inside one transaction:
// either everything is restored or nothing is. The script refuses to write into
// tables that already hold rows (apart from _prisma_migrations, filled by step 1).
// Note: amounts are read with JavaScript numbers, exact up to 9e15 (far above any VND amount).

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import pg from "pg";

const file = process.argv[2];
const url = process.env.DATABASE_URL;
if (!file || !url) {
  console.error("Usage: DATABASE_URL=postgres://... node scripts/restore-backup.mjs <backup.json.gz | backup.json>");
  process.exit(1);
}

const raw = readFileSync(file);
const text = file.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
const backup = JSON.parse(text);
if (backup?.meta?.format !== "crm-backup" || typeof backup.tables !== "object") {
  console.error("Not a CRM backup file (missing meta.format = crm-backup).");
  process.exit(1);
}
console.log(`Backup from ${backup.meta.createdAt}: ${Object.keys(backup.tables).length} tables`);

const SKIP = new Set(["_prisma_migrations"]);
const ident = (name) => `"${name.replace(/"/g, '""')}"`;

const db = new pg.Client({ connectionString: url });
await db.connect();
try {
  const existing = (
    await db.query("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")
  ).rows.map((r) => r.name);

  const tables = Object.keys(backup.tables).filter((t) => !SKIP.has(t));
  const missing = tables.filter((t) => !existing.includes(t));
  if (missing.length) {
    console.error(`The target has no table ${missing.join(", ")}: run \`prisma migrate deploy\` against it first.`);
    process.exit(1);
  }
  for (const t of tables) {
    const n = (await db.query(`SELECT count(*)::int AS n FROM ${ident(t)}`)).rows[0].n;
    if (n > 0) {
      console.error(`Table ${t} already has ${n} rows. Restore only into an empty database.`);
      process.exit(1);
    }
  }

  // Parents before children (self-references are checked at the end of each INSERT).
  const fks = (
    await db.query(`
      SELECT child.relname AS child, parent.relname AS parent
      FROM pg_constraint c
      JOIN pg_class child ON child.oid = c.conrelid
      JOIN pg_class parent ON parent.oid = c.confrelid
      JOIN pg_namespace n ON n.oid = child.relnamespace
      WHERE c.contype = 'f' AND n.nspname = 'public' AND child.oid <> parent.oid`)
  ).rows;
  const order = [];
  const pending = new Set(tables);
  while (pending.size) {
    const ready = [...pending].filter((t) => !fks.some((f) => f.child === t && pending.has(f.parent) && f.parent !== t));
    if (!ready.length) throw new Error(`Circular foreign keys between: ${[...pending].join(", ")}`);
    for (const t of ready.sort()) {
      order.push(t);
      pending.delete(t);
    }
  }

  await db.query("BEGIN");
  for (const t of order) {
    const rows = backup.tables[t];
    if (!rows.length) continue;
    await db.query(`INSERT INTO ${ident(t)} SELECT * FROM json_populate_recordset(NULL::${ident(t)}, $1::json)`, [JSON.stringify(rows)]);
    console.log(`  ${t}: ${rows.length}`);
  }
  await db.query("COMMIT");
  console.log("Restore complete.");
} catch (err) {
  await db.query("ROLLBACK").catch(() => undefined);
  console.error("Restore failed, nothing was written:", err.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
