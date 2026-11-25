import { auth, forbidden, handle, ok, unauthorized } from "@/lib/api";
import { seesTeamOverview, teamOverview } from "@/lib/team-overview";

/** GET /api/dashboard/team: this week's work and deadlines of the people the viewer manages (Quản lý and above). */
export async function GET() {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!seesTeamOverview(me)) return forbidden("Chỉ cấp quản lý trở lên xem được công việc của đội");
    return ok(await teamOverview(me), { headers: { "Cache-Control": "private, no-store" } });
  });
}
