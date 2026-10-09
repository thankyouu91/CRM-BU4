import { getCurrentUser } from "@/lib/session";
import { listProjects } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { isManagerOrAbove } from "@/lib/rbac";
import { ProjectsView } from "./projects-view";

export const metadata = { title: "Dự án" };

export default async function ProjectsPage() {
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
      canCreate={isManagerOrAbove(user)}
    />
  );
}
