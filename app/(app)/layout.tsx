import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { managedProjectsWhere } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  // Unreviewed reports on projects this user manages.
  const pendingReports = await prisma.taskReport.count({
    where: { reviewedAt: null, task: { project: managedProjectsWhere(user) } },
  });

  return (
    <AppShell user={user} pendingReports={pendingReports}>
      {children}
    </AppShell>
  );
}
