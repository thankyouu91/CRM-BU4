import { getCurrentUser } from "@/lib/session";
import { canViewAllProjects, managesAnyProject, projectVisibilityWhere } from "@/lib/rbac";
import { listTasks, parseTaskIssue } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { asJson } from "@/lib/json";
import { resolveWorkPeriod, workPeriodOf, type WorkReportData } from "@/lib/work-report";
import { workReportView } from "@/lib/work-report-queries";
import { MyWork } from "./my-work";

export const metadata = { title: "Công việc của tôi" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const user = (await getCurrentUser())!;
  const sp = await searchParams;
  const tab = one(sp.tab) === "report" ? "report" : "list";
  const period = resolveWorkPeriod(one(sp.period), one(sp.key)) ?? workPeriodOf("WEEK");
  // ?issue= opens a quick filter (links from notifications); unassigned work is never "mine".
  const issue = parseTaskIssue(one(sp.issue));
  const scope = issue === "unassigned" ? "all" : "mine";
  // The tab on screen is sent with the page; the other loads when opened.
  const [canSeeAll, tasks, report, projects] = await Promise.all([
    canViewAllProjects(user) || managesAnyProject(user),
    tab === "list" ? listTasks(user, { scope, issue }) : null,
    tab === "report" ? workReportView(user, user.id, period) : null,
    prisma.project.findMany({ where: { AND: [projectVisibilityWhere(user), { status: { not: "CANCELLED" } }] }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <MyWork
      tab={tab}
      canSeeAll={canSeeAll}
      initialTasks={tasks ? asJson(tasks) : undefined}
      initialFilter={{ scope, issue }}
      projects={projects}
      initialReport={report && report !== "forbidden" ? asJson<WorkReportData>(report) : undefined}
      initialPeriod={{ type: period.type, key: period.key }}
    />
  );
}
