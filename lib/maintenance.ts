// Daily maintenance, run by the Worker's cron trigger (worker.ts), outside Next.js:
//
//  1. Backup: every table of the public schema as JSON, gzipped, to the BACKUPS
//     R2 bucket: daily/YYYY-MM-DD.json.gz (kept 30 days) and, on the 1st of the
//     month, monthly/YYYY-MM.json.gz (kept 12 months). Contract PDF bytes are not
//     in it: they live in their own R2 bucket (only legacy Postgres copies are skipped).
//     Restore with scripts/restore-backup.mjs.
//  2. Retention: audit entries older than AUDIT_RETENTION_DAYS, notifications older than
//     NOTIFICATION_RETENTION_DAYS and AI day counters older than a week are deleted.
//
// Uses `pg` directly (no Prisma) so the cron path stays small and does not load the Next.js app.

import { Client } from "pg";
import { AUDIT_RETENTION_DAYS } from "./audit-actions";
import { SHARE_RETENTION_DAYS } from "./report-share-rules";

/** Days a notification is kept (lib/notifications.ts shows the latest in the bell). */
export const NOTIFICATION_RETENTION_DAYS = 90;

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

/**
 * A gzip writer: text goes in piece by piece and only the compressed bytes are held, so
 * the backup never needs the whole database as one string in the Worker's 128 MB.
 * (R2 needs the length up front, so the compressed result is still buffered.)
 */
function gzipWriter() {
  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  const done = new Response(stream.readable).arrayBuffer();
  let pending: Promise<void> = Promise.resolve();
  return {
    write(text: string) {
      pending = pending.then(() => writer.write(encoder.encode(text)));
      return pending;
    },
    async close(): Promise<Uint8Array> {
      await pending;
      await writer.close();
      return new Uint8Array(await done);
    },
  };
}

/**
 * Every table as JSON text, built as text so BIGINT money values keep full precision.
 * All tables are read from one snapshot (REPEATABLE READ), so a row written during the
 * backup cannot leave a child without its parent and the file always restores.
 */
export async function dumpDatabase(db: Client, createdAt: Date): Promise<{ json: string; counts: Record<string, number> }> {
  const parts: string[] = [];
  const counts = await writeDatabase(db, createdAt, (text) => void parts.push(text));
  return { json: parts.join(""), counts };
}

/** The same JSON as dumpDatabase, handed to `write` one table at a time. */
async function writeDatabase(db: Client, createdAt: Date, write: (text: string) => unknown): Promise<Record<string, number>> {
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const tables = await db.query<{ name: string }>(
      "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
    );
    const counts: Record<string, number> = {};
    const skipped: string[] = [];
    // meta comes last in the file (key order does not matter to JSON), once counts are known.
    await write(`{"tables":{`);
    let first = true;
    for (const { name } of tables.rows) {
      if (SKIP_TABLES.has(name)) continue;
      const ident = `"${name.replace(/"/g, '""')}"`;
      await db.query("SAVEPOINT t");
      try {
        const r = await db.query<{ rows: string; n: number }>(`SELECT coalesce(json_agg(t), '[]'::json)::text AS rows, count(*)::int AS n FROM ${ident} t`);
        counts[name] = r.rows[0].n;
        await write(`${first ? "" : ","}${JSON.stringify(name)}:${r.rows[0].rows}`);
        first = false;
        await db.query("RELEASE SAVEPOINT t");
      } catch (err) {
        // e.g. a table the app role may not read (_prisma_migrations on some setups)
        await db.query("ROLLBACK TO SAVEPOINT t");
        skipped.push(name);
        console.warn("[maintenance] backup skipped table", name, (err as Error).message);
      }
    }
    const meta = { format: "crm-backup", version: 1, createdAt: createdAt.toISOString(), counts, skipped };
    await write(`},"meta":${JSON.stringify(meta)}}`);
    return counts;
  } finally {
    await db.query("COMMIT").catch(() => undefined);
  }
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
  let backupError: unknown = null;
  try {
    // A failed backup must not stop the clean-up below (or every later backup grows), and it
    // must not go unnoticed: admins get a notice in the bell, and the cron run ends in error.
    if (!env.BACKUPS) console.warn("[maintenance] no BACKUPS bucket bound: backup skipped");
    else try {
      const started = Date.now();
      const gz = gzipWriter();
      const counts = await writeDatabase(db, now, (text) => gz.write(text));
      const body = await gz.close();
      const day = localDay(now, env.APP_TIMEZONE);
      const meta = {
        httpMetadata: { contentType: "application/json", contentEncoding: "gzip" },
        customMetadata: { rows: String(Object.values(counts).reduce((s, n) => s + n, 0)), tables: String(Object.keys(counts).length), createdAt: now.toISOString() },
      };
      await env.BACKUPS.put(`daily/${day}.json.gz`, body, meta);
      if (day.endsWith("-01")) await env.BACKUPS.put(`monthly/${day.slice(0, 7)}.json.gz`, body, meta);
      const pruned = (await prune(env.BACKUPS, "daily/", DAILY_KEEP)) + (await prune(env.BACKUPS, "monthly/", MONTHLY_KEEP));
      console.log(`[maintenance] backup daily/${day}.json.gz: ${body.byteLength} bytes, ${meta.customMetadata.rows} rows in ${Date.now() - started} ms; pruned ${pruned}`);
    } catch (err) {
      backupError = err;
      console.error("[maintenance] backup failed", err);
      await db.query("ROLLBACK").catch(() => undefined);
      await db
        .query(
          `INSERT INTO "Notification" (id, "userId", type, title, body, link, "createdAt")
           SELECT 'bk' || md5(random()::text || id), id, 'maintenance.backup_failed', $1, $2, '/settings', now() FROM "User" WHERE role = 'ADMIN' AND active`,
          [`Sao lưu tự động ngày ${localDay(now, env.APP_TIMEZONE)} không thành công`, String((err as Error)?.message ?? err).slice(0, 300)],
        )
        .catch((e) => console.error("[maintenance] could not notify admins", e));
    }

    const removed = await db.query(`DELETE FROM "AuditLog" WHERE "createdAt" < now() - make_interval(days => $1)`, [AUDIT_RETENTION_DAYS]);
    console.log(`[maintenance] audit log: removed ${removed.rowCount ?? 0} entries older than ${AUDIT_RETENTION_DAYS} days`);
    // The bell shows the latest notices; old ones and past days' AI counters are not needed.
    const notices = await db.query(`DELETE FROM "Notification" WHERE "createdAt" < now() - make_interval(days => $1)`, [NOTIFICATION_RETENTION_DAYS]);
    const quotas = await db.query(`DELETE FROM "AiQuota" WHERE "day" < $1`, [localDay(new Date(now.getTime() - 7 * 86_400_000), env.APP_TIMEZONE)]);
    // Public presentation links that stopped working long ago (lib/report-share-rules.ts).
    const shares = await db.query(
      `DELETE FROM "DeckShare" WHERE "expiresAt" < now() - make_interval(days => $1) OR "revokedAt" < now() - make_interval(days => $1)`,
      [SHARE_RETENTION_DAYS],
    );
    console.log(`[maintenance] removed ${notices.rowCount ?? 0} old notifications, ${quotas.rowCount ?? 0} old AI counters, ${shares.rowCount ?? 0} old share links`);
  } finally {
    ending = true;
    await db.end();
  }
  if (backupError) throw backupError;
}
