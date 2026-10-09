import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/rbac";
import { ProjectWorkspace } from "./workspace";

export const metadata = { title: "Dự án" };

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const user = (await getCurrentUser())!;
  if (!(await canAccessProject(user, params.id))) notFound();

  const directory = await prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, avatarColor: true, jobTitle: true, role: true },
  });

  return <ProjectWorkspace projectId={params.id} meId={user.id} directory={directory} />;
}
