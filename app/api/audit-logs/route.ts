import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth, forbidden, ok, unauthorized } from "@/lib/api";
import { isAdmin } from "@/lib/rbac";
import { AUDIT_ACTIONS, AUDIT_GROUPS, auditActionsIn, type AuditAction, type AuditGroup } from "@/lib/audit-actions";
import { zonedDayEdge } from "@/lib/work-report";

const PAGE = 50;

/**
 * GET /api/audit-logs: the audit log, newest first, admins only.
 * ?group=&action=&actor=<userId>&q=<text>&from=YYYY-MM-DD&to=YYYY-MM-DD&cursor=<id>
 */
export async function GET(req: NextRequest) {
  const me = await auth();
  if (!me) return unauthorized();
  if (!isAdmin(me)) return forbidden("Chỉ quản trị viên mới xem được nhật ký thao tác");

  const sp = req.nextUrl.searchParams;
  const group = sp.get("group");
  const action = sp.get("action");
  const actor = sp.get("actor");
  const q = sp.get("q")?.trim();
  const from = sp.get("from") ? zonedDayEdge(sp.get("from")!, "start") : null;
  const to = sp.get("to") ? zonedDayEdge(sp.get("to")!, "end") : null;
  const cursor = sp.get("cursor");

  const where: Prisma.AuditLogWhereInput = {
    ...(action && action in AUDIT_ACTIONS
      ? { action }
      : group && group in AUDIT_GROUPS
        ? { action: { in: auditActionsIn(group as AuditGroup) as AuditAction[] } }
        : {}),
    ...(actor ? { actorId: actor } : {}),
    ...(q ? { OR: [{ summary: { contains: q, mode: "insensitive" } }, { actorName: { contains: q, mode: "insensitive" } }] } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
  };

  const [rows, actors] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, createdAt: true, actorId: true, actorName: true, action: true, entityType: true, entityId: true, summary: true, details: true, ip: true },
    }),
    // Everyone who could appear as an actor, for the filter.
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const hasMore = rows.length > PAGE;
  const entries = hasMore ? rows.slice(0, PAGE) : rows;
  return ok({
    entries: entries.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    nextCursor: hasMore ? entries[entries.length - 1].id : null,
    actors,
  });
}
