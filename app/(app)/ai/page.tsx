import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { projectVisibilityWhere } from "@/lib/rbac";
import { AiView } from "./ai-view";

export const metadata = { title: "Trợ lý AI" };

type SP = { period?: string; date?: string; from?: string; to?: string; projectId?: string };

export default async function AiPage({ searchParams }: { searchParams: SP }) {
  const user = (await getCurrentUser())!;
  const projects = await prisma.project.findMany({
    where: projectVisibilityWhere(user),
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });
  const type = ["day", "month", "quarter", "year", "custom"].includes(searchParams.period ?? "") ? searchParams.period! : "month";
  return (
    <AiView
      projects={projects}
      userName={user.name}
      initial={{
        type: type as "day" | "month" | "quarter" | "year" | "custom",
        anchor: searchParams.date && !Number.isNaN(Date.parse(searchParams.date)) ? searchParams.date : "",
        from: searchParams.from ?? "",
        to: searchParams.to ?? "",
        projectId: projects.some((p) => p.id === searchParams.projectId) ? searchParams.projectId! : "",
      }}
    />
  );
}
