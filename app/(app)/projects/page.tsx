import { getCurrentUser } from "@/lib/session";
import { listProjects } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { canCreateProject } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { ProjectsView } from "./projects-view";
import { calendarSelection } from "@/lib/project-calendar";

export const metadata = { title: "Dự án" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const now = new Date().toISOString();
  const selection = calendarSelection(one(params.calendar), one(params.month), now);
  const user = (await getCurrentUser())!;
  const [projects, directory] = await Promise.all([
    listProjects(user),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, avatarColor: true, jobTitle: true, role: true },
    }),
  ]);
  return (
    <ProjectsView
      // JSON round-trip: hand the client plain ISO strings instead of Date objects.
      initial={JSON.parse(JSON.stringify(projects))}
      directory={directory}
      canCreate={canCreateProject(user)}
      canFinance={hasPermission(user, "FINANCE_MANAGE")}
      initialView={selection.view}
      initialAnchor={selection.anchor}
      now={now}
    />
  );
}
