import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { AuditAction } from "./audit-actions";

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  /** Short Vietnamese description shown in the log, e.g. `Sửa hợp đồng “HĐ-12 Đào tạo PCCC”`. */
  summary: string;
  /** What changed (JSON-serialisable). Never put passwords, hashes or tokens here. */
  details?: unknown;
}

/** Who did it: the signed-in user, or a name only (e.g. the email typed at a failed login). */
export type AuditActor = { id: string; name: string } | { id?: null; name: string };

async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  } catch {
    return null; // outside a request (scripts, cron)
  }
}

/**
 * Record one action in the audit log. Logging must never break the action
 * itself, so failures are reported to the Worker log and swallowed.
 * Call it after the change succeeded.
 */
export async function audit(actor: AuditActor, entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor.id ?? null,
        actorName: actor.name,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        summary: entry.summary.slice(0, 500),
        details: entry.details === undefined ? undefined : (JSON.parse(JSON.stringify(entry.details, (_k, v) => (typeof v === "bigint" ? Number(v) : v))) as Prisma.InputJsonValue),
        ip: await clientIp(),
      },
    });
  } catch (err) {
    console.error("[audit] could not record", entry.action, err);
  }
}

/**
 * Field-level differences between two plain records, for `details`.
 * Only the listed fields are compared; Dates are compared by time.
 */
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: readonly (keyof T & string)[],
): Record<string, { from: unknown; to: unknown }> {
  const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "bigint" ? Number(v) : v ?? null);
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const f of fields) {
    if (!(f in after)) continue;
    const from = norm(before[f]);
    const to = norm(after[f]);
    if (JSON.stringify(from) !== JSON.stringify(to)) out[f] = { from, to };
  }
  return out;
}
