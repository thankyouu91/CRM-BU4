import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { projectVisibilityWhere } from "@/lib/rbac";
import { resolvePeriod } from "@/lib/period";
import { getSummary } from "@/lib/stats";
import { asJson } from "@/lib/json";
import { ReportsView } from "./reports-view";

export const metadata = { title: "Trung tâm báo cáo" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  const user = (await getCurrentUser())!;
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
  return <ReportsView projects={projects} initialProjectId={initialProject} userName={user.name} initial={initial} />;
}
