import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isAdmin, isManagerOrAbove } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  // Unreviewed reports waiting for this manager (admins see all).
  const pendingReports = isManagerOrAbove(user)
    ? await prisma.taskReport.count({
        where: { reviewedAt: null, ...(isAdmin(user) ? {} : { task: { project: { ownerId: user.id } } }) },
      })
    : 0;

  return (
    <AppShell user={user} pendingReports={pendingReports}>
      {children}
    </AppShell>
  );
}
