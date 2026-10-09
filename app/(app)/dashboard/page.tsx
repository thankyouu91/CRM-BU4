import { getCurrentUser } from "@/lib/session";
import { resolvePeriod } from "@/lib/period";
import { getSummary } from "@/lib/stats";
import { DashboardView } from "./dashboard-view";

export const metadata = { title: "Tổng quan" };

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  const initial = await getSummary(user, resolvePeriod("month"), "month");
  return <DashboardView initial={initial} userName={user.name} />;
}
