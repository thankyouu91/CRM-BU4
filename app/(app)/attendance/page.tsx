import { getCurrentUser } from "@/lib/session";
import { attendanceView, type AttendanceView as View } from "@/lib/attendance-queries";
import { isMonth } from "@/lib/attendance";
import { zonedDay } from "@/lib/work-report";
import { asJson } from "@/lib/json";
import { AttendanceView } from "./attendance-view";

export const metadata = { title: "Chấm công" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** /attendance?month=YYYY-MM&user=<id>&tab=team */
export default async function AttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const user = (await getCurrentUser())!;
  const sp = await searchParams;
  const month = isMonth(one(sp.month)) ? one(sp.month)! : zonedDay(new Date()).slice(0, 7);
  // An unknown person (a stale link) falls back to the viewer's own month.
  const asked = one(sp.user);
  const view = asked && asked !== user.id ? await attendanceView(user, asked, month) : null;
  const shown = view ?? ((await attendanceView(user, user.id, month)) as View);
  return <AttendanceView initial={asJson<View>(shown)} initialTab={one(sp.tab) === "team" ? "team" : "calendar"} />;
}
