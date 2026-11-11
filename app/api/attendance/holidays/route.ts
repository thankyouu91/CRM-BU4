import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth, handle, notFound, ok, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { addHoliday, addStatutoryHolidays, removeHoliday } from "@/lib/attendance-queries";
import { isDay } from "@/lib/attendance";

const schema = z.union([
  z.object({ day: z.string().refine(isDay, "Ngày không hợp lệ"), name: z.string().trim().min(2, "Nhập tên ngày lễ").max(80) }),
  // Every holiday of the law for that year (Tết, Giỗ Tổ, 30/4, 1/5, Quốc khánh, nghỉ bù).
  z.object({ statutoryYear: z.number().int().min(2000).max(2100) }),
]);

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

/** POST /api/attendance/holidays { day, name } or { statutoryYear }: account managers. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const body = schema.parse(await req.json());
    if ("statutoryYear" in body) return ok({ ok: true, added: await addStatutoryHolidays(me, body.statutoryYear) });
    await addHoliday(me, body);
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
