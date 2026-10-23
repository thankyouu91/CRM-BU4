import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth, handle, notFound, ok, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { addHoliday, removeHoliday } from "@/lib/attendance-queries";
import { isDay } from "@/lib/attendance";

const schema = z.object({ day: z.string().refine(isDay, "Ngày không hợp lệ"), name: z.string().trim().min(2, "Nhập tên ngày lễ").max(80) });

/** GET /api/attendance/holidays?year=2026 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const year = Number(req.nextUrl.searchParams.get("year")) || new Date().getFullYear();
    const holidays = await prisma.holiday.findMany({ where: { day: { gte: `${year}-01-01`, lte: `${year}-12-31` } }, orderBy: { day: "asc" }, select: { day: true, name: true } });
    return ok({ year, holidays });
  });
}

/** POST /api/attendance/holidays { day, name }: account managers. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    await addHoliday(me, schema.parse(await req.json()));
    return ok({ ok: true });
  });
}

/** DELETE /api/attendance/holidays?day=YYYY-MM-DD */
export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const day = req.nextUrl.searchParams.get("day");
    if (!isDay(day) || !(await removeHoliday(me, day))) return notFound("Không tìm thấy ngày lễ");
    return ok({ ok: true });
  });
}
