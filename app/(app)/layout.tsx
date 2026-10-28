import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AppShell } from "@/components/layout/app-shell";
import { SIDEBAR_COOKIE } from "@/lib/constants";
import { notificationFeed } from "@/lib/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  // The live feed (bell, inbox count, weekly report dot) comes with the page; the
  // browser keeps it fresh afterwards (components/layout/live-feed.tsx).
  const [feed, cookieStore] = await Promise.all([notificationFeed(user), cookies()]);

  return (
    <AppShell user={user} feed={feed} initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}>
      {children}
    </AppShell>
  );
}
