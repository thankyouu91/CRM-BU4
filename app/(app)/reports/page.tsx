import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { projectVisibilityWhere } from "@/lib/rbac";
import { resolvePeriod } from "@/lib/period";
import { getSummary } from "@/lib/stats";
import { asJson } from "@/lib/json";
import { ReportsView } from "./reports-view";
import { DepartmentReportView } from "@/components/reports/department-report-view";
import { ReportModeNav } from "@/components/reports/report-mode-nav";
import { departmentReport } from "@/lib/department-report-queries";
import { workPeriodFromKey, workPeriodOf } from "@/lib/work-report";
import { notFound } from "next/navigation";

export const metadata = { title: "Trung tâm báo cáo" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ projectId?: string; view?: string; week?: string }> }) {
  const { projectId, view, week } = await searchParams;
  const user = (await getCurrentUser())!;
  if (view !== "analytics") {
    const now = new Date();
    const period = week ? workPeriodFromKey("WEEK", week) : workPeriodOf("WEEK", now);
    if (!period) notFound();
    const projects = await prisma.project.findMany({ where: projectVisibilityWhere(user), orderBy: { name: "asc" }, select: { id: true, name: true } });
    if (projectId && !projects.some(p => p.id === projectId)) notFound();
    const initial = await departmentReport(user, period, projectId || null, now);
    return <DepartmentReportView key={`${period.key}:${projectId ?? ""}`} initial={initial} projects={projects} />;
  }
  // The default report (this month) is computed with the page.
  const [projects, summary] = await Promise.all([
    prisma.project.findMany({
      where: projectVisibilityWhere(user),
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    getSummary(user, resolvePeriod("month"), "month", projectId || null),
  ]);
  const initialProject = projects.some((p) => p.id === projectId) ? projectId! : "";
  // A projectId the user can't see falls back to the all-projects report, fetched by the view.
  const initial = !projectId || initialProject ? asJson<typeof summary>(summary) : undefined;
  return <><ReportModeNav analytics projectId={initialProject} /><ReportsView projects={projects} initialProjectId={initialProject} userName={user.name} initial={initial} /></>;
}
