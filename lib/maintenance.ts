// Daily maintenance, run by the Worker's cron trigger (worker.ts), outside Next.js:
//
//  1. Backup: every table of the public schema as JSON, gzipped, to the BACKUPS
//     R2 bucket: daily/YYYY-MM-DD.json.gz (kept 30 days) and, on the 1st of the
//     month, monthly/YYYY-MM.json.gz (kept 12 months). Contract PDF bytes are not
//     in it: they live in their own R2 bucket (only legacy Postgres copies are skipped).
//     Restore with scripts/restore-backup.mjs.
//  2. Audit log retention: entries older than AUDIT_RETENTION_DAYS are deleted.
//
// Uses `pg` directly (no Prisma) so the cron path stays small and does not load the Next.js app.

import { Client } from "pg";
import { AUDIT_RETENTION_DAYS } from "./audit-actions";

/** The subset of the R2 binding used here. */
export interface BackupBucket {
  put(key: string, value: ReadableStream | ArrayBuffer | Uint8Array | string, options?: { httpMetadata?: { contentType?: string; contentEncoding?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ objects: { key: string; size: number; uploaded: Date; customMetadata?: Record<string, string> }[]; truncated: boolean; cursor?: string }>;
  delete(keys: string | string[]): Promise<void>;
}

export interface MaintenanceEnv {
  HYPERDRIVE?: { connectionString: string };
  DATABASE_URL?: string;
  BACKUPS?: BackupBucket;
  APP_TIMEZONE?: string;
}

export const DAILY_KEEP = 30;
export const MONTHLY_KEEP = 12;
/** Bytes of legacy contract PDFs; the files themselves are in R2. */
const SKIP_TABLES = new Set(["ContractFileBlob"]);

/** "YYYY-MM-DD" of `at` in the app's time zone. */
export function localDay(at: Date, timeZone = "Asia/Ho_Chi_Minh"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Keys to delete so that only the newest `keep` remain (keys sort by date). */
export function expiredKeys(keys: string[], keep: number): string[] {
  return [...keys].sort().reverse().slice(keep);
}

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Every table as JSON text, built as text so BIGINT money values keep full precision. */
async function dumpDatabase(db: Client, createdAt: Date): Promise<{ json: string; counts: Record<string, number> }> {
  const tables = await db.query<{ name: string }>(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
  );
  const parts: string[] = [];
  const counts: Record<string, number> = {};
  const skipped: string[] = [];
  for (const { name } of tables.rows) {
    if (SKIP_TABLES.has(name)) continue;
    const ident = `"${name.replace(/"/g, '""')}"`;
    try {
      const r = await db.query<{ rows: string; n: number }>(`SELECT coalesce(json_agg(t), '[]'::json)::text AS rows, count(*)::int AS n FROM ${ident} t`);
      counts[name] = r.rows[0].n;
      parts.push(`${JSON.stringify(name)}:${r.rows[0].rows}`);
    } catch (err) {
      // e.g. a table the app role may not read (_prisma_migrations on some setups)
      skipped.push(name);
      console.warn("[maintenance] backup skipped table", name, (err as Error).message);
    }
  }
  const meta = { format: "crm-backup", version: 1, createdAt: createdAt.toISOString(), counts, skipped };
  return { json: `{"meta":${JSON.stringify(meta)},"tables":{${parts.join(",")}}}`, counts };
}

async function prune(bucket: BackupBucket, prefix: string, keep: number): Promise<number> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor });
    keys.push(...page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  const old = expiredKeys(keys, keep);
  if (old.length) await bucket.delete(old);
  return old.length;
}

export async function runMaintenance(env: MaintenanceEnv, now = new Date()): Promise<void> {
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!connectionString) throw new Error("[maintenance] no database binding");
  const db = new Client({ connectionString });
  let ending = false;
  db.on("error", (err) => {
    if (!ending) console.error("[maintenance]", err);
  });
  await db.connect();
  try {
    if (env.BACKUPS) {
      const started = Date.now();
      const { json, counts } = await dumpDatabase(db, now);
      const body = await gzip(json);
      const day = localDay(now, env.APP_TIMEZONE);
      const meta = {
        httpMetadata: { contentType: "application/json", contentEncoding: "gzip" },
        customMetadata: { rows: String(Object.values(counts).reduce((s, n) => s + n, 0)), tables: String(Object.keys(counts).length), createdAt: now.toISOString() },
      };
      await env.BACKUPS.put(`daily/${day}.json.gz`, body, meta);
      if (day.endsWith("-01")) await env.BACKUPS.put(`monthly/${day.slice(0, 7)}.json.gz`, body, meta);
      const pruned = (await prune(env.BACKUPS, "daily/", DAILY_KEEP)) + (await prune(env.BACKUPS, "monthly/", MONTHLY_KEEP));
      console.log(`[maintenance] backup daily/${day}.json.gz: ${body.byteLength} bytes, ${meta.customMetadata.rows} rows in ${Date.now() - started} ms; pruned ${pruned}`);
    } else {
      console.warn("[maintenance] no BACKUPS bucket bound: backup skipped");
    }

    const removed = await db.query(`DELETE FROM "AuditLog" WHERE "createdAt" < now() - make_interval(days => $1)`, [AUDIT_RETENTION_DAYS]);
    console.log(`[maintenance] audit log: removed ${removed.rowCount ?? 0} entries older than ${AUDIT_RETENTION_DAYS} days`);
  } finally {
    ending = true;
    await db.end();
  }
}
