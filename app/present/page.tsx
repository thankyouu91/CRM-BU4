import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canAccessProject } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { parseDate, parsePeriodType, resolvePeriod } from "@/lib/period";
import { getSummary } from "@/lib/stats";
import { PresentClient } from "./present-client";

export const metadata = { title: "Trình chiếu báo cáo" };

type SP = { period?: string; date?: string; from?: string; to?: string; projectId?: string };

/** Shareable online presentation: /present?period=quarter&date=…&projectId=… */
export default async function PresentPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  const type = parsePeriodType(searchParams.period);
  const range = resolvePeriod(type, parseDate(searchParams.date), {
    from: searchParams.from ? parseDate(searchParams.from) : null,
    to: searchParams.to ? parseDate(searchParams.to) : null,
  });

  const projectId = searchParams.projectId || null;
  let projectName: string | null = null;
  if (projectId) {
    if (!(await canAccessProject(user, projectId))) notFound();
    projectName = (await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }))?.name ?? null;
  }

  const summary = await getSummary(user, range, type, projectId);
  return <PresentClient summary={JSON.parse(JSON.stringify(summary))} projectName={projectName} userName={user.name} />;
}
