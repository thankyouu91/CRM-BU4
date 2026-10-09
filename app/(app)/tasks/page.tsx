import { getCurrentUser } from "@/lib/session";
import { canViewAllProjects, managesAnyProject } from "@/lib/rbac";
import { listTasks } from "@/lib/queries";
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
  // The tab on screen is sent with the page ("mine" for the list); the other loads when opened.
  const [canSeeAll, tasks, report] = await Promise.all([
    canViewAllProjects(user) || managesAnyProject(user),
    tab === "list" ? listTasks(user, { scope: "mine" }) : null,
    tab === "report" ? workReportView(user, user.id, period) : null,
  ]);
  return (
    <MyWork
      tab={tab}
      canSeeAll={canSeeAll}
      initialTasks={tasks ? asJson(tasks) : undefined}
      initialReport={report && report !== "forbidden" ? asJson<WorkReportData>(report) : undefined}
      initialPeriod={{ type: period.type, key: period.key }}
    />
  );
}
