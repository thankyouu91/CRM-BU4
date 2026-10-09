import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { projectVisibilityWhere } from "@/lib/rbac";
import { ReportsView } from "./reports-view";

export const metadata = { title: "Trung tâm báo cáo" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  const user = (await getCurrentUser())!;
  const projects = await prisma.project.findMany({
    where: projectVisibilityWhere(user),
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });
  const initialProject = projects.some((p) => p.id === projectId) ? projectId! : "";
  return <ReportsView projects={projects} initialProjectId={initialProject} userName={user.name} />;
}
