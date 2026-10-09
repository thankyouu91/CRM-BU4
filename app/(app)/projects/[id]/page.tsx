import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getProjectDetail, workspaceFor } from "@/lib/queries";
import { loadContracts } from "@/lib/contract-queries";
import { summarizeContracts } from "@/lib/contracts";
import { asJson } from "@/lib/json";
import type { WorkspaceData } from "@/components/projects/use-workspace";
import type { ProjectContracts } from "@/components/projects/finance-panel";
import { ProjectWorkspace } from "./workspace";

export const metadata = { title: "Dự án" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getCurrentUser())!;
  const canFinance = hasPermission(user, "FINANCE_MANAGE");

  // Everything the workspace shows first, loaded together and sent with the page.
  const [project, directory, contracts] = await Promise.all([
    getProjectDetail(id),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, avatarColor: true, jobTitle: true, role: true },
    }),
    canFinance ? loadContracts({ projectId: id }) : null,
  ]);
  const workspace = workspaceFor(user, project);
  if (!workspace) notFound();

  return (
    <ProjectWorkspace
      projectId={id}
      meId={user.id}
      directory={directory}
      canFinance={canFinance}
      initial={asJson<WorkspaceData>(workspace)}
      initialFinance={contracts ? asJson<ProjectContracts>({ period: null, contracts, totals: summarizeContracts(contracts) }) : undefined}
    />
  );
}
