import { getCurrentUser } from "@/lib/session";
import { managesAnyProject } from "@/lib/rbac";
import { inboxReports } from "@/lib/queries";
import { asJson } from "@/lib/json";
import { seesTeamWorkReports } from "@/lib/permissions";
import { resolveWorkPeriod, workPeriodOf, type TeamWorkReports } from "@/lib/work-report";
import { teamWorkReports } from "@/lib/work-report-queries";
import { InboxScreen } from "./inbox-screen";

export const metadata = { title: "Hộp báo cáo" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function InboxPage({ searchParams }: { searchParams: SearchParams }) {
  const user = (await getCurrentUser())!;
  const sp = await searchParams;
  const seesTeam = seesTeamWorkReports(user.role);
  const tab = seesTeam && one(sp.tab) === "weekly" ? "weekly" : "progress";
  const period = resolveWorkPeriod(one(sp.period), one(sp.key)) ?? workPeriodOf("WEEK");
  // The tab on screen is sent with the page (progress: managers' pending received reports, others' sent ones).
  const [isManager, team] = await Promise.all([managesAnyProject(user), tab === "weekly" ? teamWorkReports(user, period) : null]);
  const initial = tab === "progress" ? await inboxReports(user, isManager ? "received" : "sent", isManager ? "pending" : "all") : undefined;
  return (
    <InboxScreen
      isManager={isManager}
      seesTeam={seesTeam}
      tab={tab}
      initial={initial ? asJson(initial) : undefined}
      initialTeam={team ? asJson<TeamWorkReports>(team) : undefined}
      initialPeriod={{ type: period.type, key: period.key }}
    />
  );
}
