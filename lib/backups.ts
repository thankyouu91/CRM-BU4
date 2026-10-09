import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isWorkers } from "./prisma";

// Read access to the BACKUPS R2 bucket written by the daily maintenance job (lib/maintenance.ts).

interface BackupObject {
  key: string;
  size: number;
  uploaded: Date;
  customMetadata?: Record<string, string>;
}
interface BackupsBucket {
  list(options?: { prefix?: string; cursor?: string }): Promise<{ objects: BackupObject[]; truncated: boolean; cursor?: string }>;
  get(key: string): Promise<{ size: number; body: ReadableStream<Uint8Array> } | null>;
}

export interface BackupInfo {
  key: string;
  kind: "daily" | "monthly";
  size: number;
  createdAt: string;
  rows: number | null;
}

/** Backup keys look like daily/2026-10-09.json.gz or monthly/2026-10.json.gz. */
export const BACKUP_KEY = /^(daily|monthly)\/\d{4}-\d{2}(-\d{2})?\.json\.gz$/;

export function backupsBucket(): BackupsBucket | null {
  if (!isWorkers) return null;
  return (getCloudflareContext().env as unknown as { BACKUPS?: BackupsBucket }).BACKUPS ?? null;
}

/** All backups, newest first. */
export async function listBackups(bucket: BackupsBucket): Promise<BackupInfo[]> {
  const out: BackupInfo[] = [];
  for (const prefix of ["daily/", "monthly/"] as const) {
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ prefix, cursor });
      for (const o of page.objects) {
        out.push({
          key: o.key,
          kind: prefix === "daily/" ? "daily" : "monthly",
          size: o.size,
          createdAt: new Date(o.uploaded).toISOString(),
          rows: o.customMetadata?.rows ? Number(o.customMetadata.rows) : null,
        });
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
