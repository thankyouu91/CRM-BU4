import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, ok, unauthorized } from "@/lib/api";
import { managedProjectsWhere } from "@/lib/rbac";

/**
 * box=received: reports on projects the user manages (org-wide project managers: all) — the manager inbox.
 * box=sent:     reports the user has submitted, with their review status.
 * status=pending|reviewed|all filters by review state.
 */
export async function GET(req: NextRequest) {
  const me = await auth();
  if (!me) return unauthorized();

  const sp = req.nextUrl.searchParams;
  const box = sp.get("box") === "sent" ? "sent" : "received";
  const status = sp.get("status") ?? "all";

  const scope = box === "sent" ? { authorId: me.id } : { task: { project: managedProjectsWhere(me) } };

  const reviewFilter =
    status === "pending" ? { reviewedAt: null } : status === "reviewed" ? { reviewedAt: { not: null } } : {};

  const [reports, pendingCount] = await Promise.all([
    prisma.taskReport.findMany({
      where: { ...scope, ...reviewFilter },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        author: { select: { id: true, name: true, avatarColor: true, jobTitle: true } },
        reviewer: { select: { id: true, name: true } },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            progress: true,
            project: { select: { id: true, name: true, color: true } },
          },
        },
      },
    }),
    box === "received" ? prisma.taskReport.count({ where: { ...scope, reviewedAt: null } }) : Promise.resolve(0),
  ]);

  return ok({ reports, pendingCount });
}
