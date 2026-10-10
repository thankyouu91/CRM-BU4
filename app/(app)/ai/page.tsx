import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isAdmin, projectVisibilityWhere } from "@/lib/rbac";
import { aiUsedToday, getAiRuntime } from "@/lib/ai-settings";
import { aiModelInfo } from "@/lib/ai-models";
import { AiView, type BuiltInAi } from "./ai-view";

export const metadata = { title: "Trợ lý AI" };

type SP = { period?: string; date?: string; from?: string; to?: string; projectId?: string };

export default async function AiPage(props: { searchParams: Promise<SP> }) {
  const searchParams = await props.searchParams;
  const user = (await getCurrentUser())!;
  const [projects, runtime, used] = await Promise.all([
    prisma.project.findMany({
      where: projectVisibilityWhere(user),
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    getAiRuntime(),
    aiUsedToday(user.id),
  ]);
  // Built-in AI (Claude API key set by an admin in Settings); the copy-to-Claude flow works either way.
  const builtIn: BuiltInAi = runtime
    ? { ready: true, modelLabel: aiModelInfo(runtime.model).label, limit: runtime.dailyLimit, remaining: Math.max(0, runtime.dailyLimit - used) }
    : { ready: false, canEnable: isAdmin(user) };
  const type = ["day", "month", "quarter", "year", "custom"].includes(searchParams.period ?? "") ? searchParams.period! : "month";
  return (
    <AiView
      projects={projects}
      userName={user.name}
      builtIn={builtIn}
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
