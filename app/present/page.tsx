import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canAccessProject } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { parseDate, parsePeriodType, resolvePeriod } from "@/lib/period";
import { getSummary } from "@/lib/stats";
import { departmentReport } from "@/lib/department-report-queries";
import { workPeriodOf } from "@/lib/work-report";
import { deckWeekAnchor } from "@/lib/deck-model";
import { PresentClient } from "./present-client";

export const metadata = { title: "Trình chiếu báo cáo" };

type SP = { period?: string; date?: string; from?: string; to?: string; projectId?: string };

/** Shareable online presentation: /present?period=quarter&date=…&projectId=… */
export default async function PresentPage(props: { searchParams: Promise<SP> }) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  const type = parsePeriodType(searchParams.period);
  const range = resolvePeriod(type, parseDate(searchParams.date), {
    from: searchParams.from ? parseDate(searchParams.from) : null,
    to: searchParams.to ? parseDate(searchParams.to) : null,
  });

  const projectId = searchParams.projectId || null;
  let projectName: string | null = null;
  if (projectId) {
    if (!(await canAccessProject(user, projectId))) notFound();
    projectName = (await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }))?.name ?? null;
  }

  // Weekly report slides: this week, or the last week of a past period.
  const now = new Date();
  const [summary, week] = await Promise.all([
    getSummary(user, range, type, projectId),
    departmentReport(user, workPeriodOf("WEEK", deckWeekAnchor(range.from, range.to, now)), projectId, now),
  ]);
  return <PresentClient summary={JSON.parse(JSON.stringify(summary))} week={JSON.parse(JSON.stringify(week))} projectName={projectName} userName={user.name} />;
}
