import { AsyncLocalStorage } from "node:async_hooks";
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
 * Set while the AI chat's approved changes run (app/api/ai/actions), so the log entries
 * the normal routes write say the change came through the AI assistant.
 */
export const auditVia = new AsyncLocalStorage<{ via: "ai" }>();

function auditRow(actor: AuditActor, entry: AuditEntry, ip: string | null): Prisma.AuditLogCreateManyInput {
  const via = auditVia.getStore()?.via;
  const details = via ? { ...(entry.details && typeof entry.details === "object" && !Array.isArray(entry.details) ? entry.details : entry.details === undefined ? {} : { value: entry.details }), via } : entry.details;
  return {
    actorId: actor.id ?? null,
    actorName: actor.name,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    summary: (via ? `${entry.summary} · qua Trợ lý AI` : entry.summary).slice(0, 500),
    details: details === undefined ? undefined : (JSON.parse(JSON.stringify(details, (_k, v) => (typeof v === "bigint" ? Number(v) : v))) as Prisma.InputJsonValue),
    ip,
  };
}

/**
 * Record one action in the audit log. Logging must never break the action
 * itself, so failures are reported to the Worker log and swallowed.
 * Call it after the change succeeded.
 */
export async function audit(actor: AuditActor, entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({ data: auditRow(actor, entry, await clientIp()) });
  } catch (err) {
    console.error("[audit] could not record", entry.action, err);
  }
}

/** Several entries in one insert (bulk changes), with the same guarantees as audit(). */
export async function auditMany(actor: AuditActor, entries: AuditEntry[]): Promise<void> {
  if (!entries.length) return;
  try {
    const ip = await clientIp();
    await prisma.auditLog.createMany({ data: entries.map((e) => auditRow(actor, e, ip)) });
  } catch (err) {
    console.error("[audit] could not record", entries[0].action, entries.length, err);
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
