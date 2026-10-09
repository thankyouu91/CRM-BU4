import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { asJson } from "@/lib/json";
import { resolveWorkPeriod, workPeriodOf, type WorkReportData } from "@/lib/work-report";
import { workReportView } from "@/lib/work-report-queries";
import { MemberWorkReport } from "./member-report";

export const metadata = { title: "Báo cáo công việc" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** One person's weekly / monthly report, for the people above them (and the author). */
export default async function MemberWorkReportPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: SearchParams }) {
  const [{ userId }, sp, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const period = resolveWorkPeriod(one(sp.period), one(sp.key)) ?? workPeriodOf("WEEK");
  const view = await workReportView(user!, userId, period);
  // Outside the visibility rule the page does not exist, like an unknown person.
  if (!view || view === "forbidden") notFound();
  return <MemberWorkReport userId={userId} initial={asJson<WorkReportData>(view)} initialPeriod={{ type: period.type, key: period.key }} />;
}
