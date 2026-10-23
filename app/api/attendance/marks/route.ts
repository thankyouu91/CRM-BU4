import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth, badRequest, handle, ok, unauthorized } from "@/lib/api";
import { attendanceView, setAttendance } from "@/lib/attendance-queries";
import { isDay, LEAVE_KIND_KEYS, SESSIONS, type LeaveKind } from "@/lib/attendance";

const day = z.string().refine(isDay, "Ngày không hợp lệ");
const schema = z.object({
  userId: z.string().min(1).max(100),
  from: day,
  to: day.nullish(),
  sessions: z.array(z.enum(SESSIONS)).min(1).max(2).nullish(),
  kind: z.enum(LEAVE_KIND_KEYS as [LeaveKind, ...LeaveKind[]]).nullable(),
  note: z.string().max(500, "Ghi chú tối đa 500 ký tự").nullish(),
});

/** POST /api/attendance/marks: mark sessions as leave / business trip, or back to worked (kind null). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const data = schema.parse(await req.json());
    if (data.to && data.to < data.from) return badRequest("Ngày kết thúc phải sau ngày bắt đầu");
    if (data.to && (Date.parse(data.to) - Date.parse(data.from)) / 86_400_000 > 62) return badRequest("Mỗi lần ghi tối đa 2 tháng");
    const { changed } = await setAttendance(me, data);
    const view = await attendanceView(me, data.userId, data.from.slice(0, 7));
    return ok({ changed, view: typeof view === "object" ? view : null });
  });
}
