import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { managedProjectsWhere } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { SIDEBAR_COOKIE } from "@/lib/constants";
import { weeklyReportOwed } from "@/lib/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  // Unreviewed reports on projects this user manages.
  const [pendingReports, owed, cookieStore] = await Promise.all([
    prisma.taskReport.count({ where: { reviewedAt: null, task: { project: managedProjectsWhere(user) } } }),
    weeklyReportOwed(user),
    cookies(),
  ]);

  return (
    <AppShell
      user={user}
      pendingReports={pendingReports}
      reportOwed={owed ? owed.short.toLowerCase() : null}
      initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}
    >
      {children}
    </AppShell>
  );
}
