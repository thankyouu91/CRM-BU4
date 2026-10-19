// Public links to the report presentation: create, list, revoke, and resolve a link
// into the data of its deck. The data is computed when the link is opened, with the
// rights its creator has at that moment, so a link never shows more than they can see.

import { prisma } from "./prisma";
import { audit } from "./audit";
import { canAccessProject } from "./rbac";
import { effectivePermissions } from "./permissions";
import { parseDate, parsePeriodType, resolvePeriod, type DateRange, type PeriodType } from "./period";
import { getSummary, type Summary } from "./stats";
import { departmentReport } from "./department-report-queries";
import type { DepartmentReport } from "./department-report";
import { workPeriodOf } from "./work-report";
import { deckWeekAnchor } from "./deck-model";
import type { CurrentUser } from "./session";
import { canSeeAllShares, hashShareToken, isShareToken, newShareToken, shareExpiry, shareStatus, SHARE_RETENTION_DAYS, type ShareDays, type ShareStatus } from "./report-share-rules";

export interface SharePeriod {
  period: string;
  date?: string | null;
  from?: string | null;
  to?: string | null;
}

/** The report period a link (or a request) asks for, as the report center reads it. */
export function sharePeriodRange(p: SharePeriod): { type: PeriodType; range: DateRange } {
  const type = parsePeriodType(p.period);
  const range = resolvePeriod(type, parseDate(p.date), {
    from: p.from ? parseDate(p.from) : null,
    to: p.to ? parseDate(p.to) : null,
  });
  return { type, range };
}

export interface ShareListItem {
  id: string;
  label: string | null;
  periodLabel: string;
  projectName: string | null;
  includeFinance: boolean;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  status: ShareStatus;
  viewCount: number;
  lastViewedAt: string | null;
}

export async function createShare(
  user: CurrentUser,
  input: SharePeriod & { projectId?: string | null; label?: string | null; days: ShareDays; includeFinance: boolean },
  now = new Date(),
): Promise<{ token: string; share: ShareListItem }> {
  const projectId = input.projectId || null;
  const project = projectId ? await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }) : null;
  const token = newShareToken();
  const row = await prisma.deckShare.create({
    data: {
      tokenHash: await hashShareToken(token),
      createdById: user.id,
      period: parsePeriodType(input.period),
      date: input.date || null,
      from: input.from || null,
      to: input.to || null,
      projectId,
      label: input.label?.trim() || null,
      includeFinance: input.includeFinance,
      expiresAt: shareExpiry(input.days, now),
    },
  });
  const { range } = sharePeriodRange(row);
  await audit(
    { id: user.id, name: user.name },
    {
      action: "deck_share.create",
      entityType: "deck_share",
      entityId: row.id,
      summary: `Tạo link công khai cho bản trình chiếu “${row.label ?? range.label}”${project ? ` · ${project.name}` : ""}`,
      details: { period: range.label, projectId, includeFinance: row.includeFinance, expiresAt: row.expiresAt.toISOString() },
    },
  );
  return { token, share: toItem({ ...row, project, createdBy: { name: user.name } }, now) };
}

type Row = Awaited<ReturnType<typeof prisma.deckShare.findFirstOrThrow>> & { project: { name: string } | null; createdBy: { name: string } };

function toItem(row: Row, now: Date): ShareListItem {
  return {
    id: row.id,
    label: row.label,
    periodLabel: sharePeriodRange(row).range.label,
    projectName: row.project?.name ?? null,
    includeFinance: row.includeFinance,
    createdBy: row.createdBy.name,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    status: shareStatus(row, now),
    viewCount: row.viewCount,
    lastViewedAt: row.lastViewedAt?.toISOString() ?? null,
  };
}

/** The person's links (every link for administrators), newest first. */
export async function listShares(user: CurrentUser, now = new Date()): Promise<ShareListItem[]> {
  const rows = await prisma.deckShare.findMany({
    where: {
      ...(canSeeAllShares(user) ? {} : { createdById: user.id }),
      createdAt: { gte: new Date(now.getTime() - SHARE_RETENTION_DAYS * 86_400_000) },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { project: { select: { name: true } }, createdBy: { select: { name: true } } },
  });
  return rows.map((r) => toItem(r, now));
}

/** Stop a link at once. Returns false when the person may not (or there is no such link). */
export async function revokeShare(user: CurrentUser, id: string, now = new Date()): Promise<ShareListItem | null> {
  const row = await prisma.deckShare.findUnique({ where: { id }, include: { project: { select: { name: true } }, createdBy: { select: { name: true } } } });
  if (!row || (row.createdById !== user.id && !canSeeAllShares(user))) return null;
  if (row.revokedAt) return toItem(row, now);
  const updated = await prisma.deckShare.update({
    where: { id },
    data: { revokedAt: now },
    include: { project: { select: { name: true } }, createdBy: { select: { name: true } } },
  });
  await audit(
    { id: user.id, name: user.name },
    {
      action: "deck_share.revoke",
      entityType: "deck_share",
      entityId: id,
      summary: `Thu hồi link công khai “${row.label ?? sharePeriodRange(row).range.label}”${row.project ? ` · ${row.project.name}` : ""}`,
      details: { createdBy: row.createdBy.name, viewCount: row.viewCount },
    },
  );
  return toItem(updated, now);
}

export interface SharedDeck {
  summary: Summary;
  week: DepartmentReport;
  projectName: string | null;
  creatorName: string;
  label: string | null;
  expiresAt: string;
}

/**
 * The deck behind a public link, or null when the link does not work: unknown token,
 * expired, revoked, creator deactivated, or the creator can no longer see the project.
 * Every reason looks the same from outside.
 */
export async function loadSharedDeck(token: string, now = new Date()): Promise<SharedDeck | null> {
  if (!isShareToken(token)) return null;
  const share = await prisma.deckShare.findUnique({
    where: { tokenHash: await hashShareToken(token) },
    include: {
      project: { select: { name: true } },
      createdBy: { select: { id: true, email: true, name: true, role: true, permissions: true, jobTitle: true, avatarColor: true, active: true } },
    },
  });
  if (!share || shareStatus(share, now) !== "active" || !share.createdBy.active) return null;

  const c = share.createdBy;
  const viewer: CurrentUser = {
    id: c.id, email: c.email, name: c.name, role: c.role, permissions: effectivePermissions(c.role, c.permissions),
    jobTitle: c.jobTitle, avatarColor: c.avatarColor, mustChangePassword: false,
  };
  if (share.projectId && !(await canAccessProject(viewer, share.projectId))) return null;

  const { type, range } = sharePeriodRange(share);
  const [summary, week] = await Promise.all([
    getSummary(viewer, range, type, share.projectId),
    departmentReport(viewer, workPeriodOf("WEEK", deckWeekAnchor(range.from, range.to, now)), share.projectId, now),
  ]);
  // Contract values and profit stay inside unless the creator chose to include them.
  if (!share.includeFinance) delete summary.finance;

  // Counting views must never stop the page.
  await prisma.deckShare.update({ where: { id: share.id }, data: { viewCount: { increment: 1 }, lastViewedAt: now } }).catch((err) => console.error("[share] could not count view", err));

  return { summary, week, projectName: share.project?.name ?? null, creatorName: c.name, label: share.label, expiresAt: share.expiresAt.toISOString() };
}
