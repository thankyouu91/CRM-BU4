import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth, handle, ok, unauthorized } from "@/lib/api";
import { setLeaveBalance } from "@/lib/attendance-queries";

const days = z.number().min(0, "Không được âm").max(60, "Tối đa 60 ngày").refine((n) => Number.isInteger(n * 2), "Số ngày tính theo nửa ngày (VD: 12 hoặc 12,5)");
const schema = z.object({
  userId: z.string().min(1).max(100),
  year: z.number().int().min(2000).max(2100),
  entitlement: days,
  carriedOver: days,
  note: z.string().max(300).nullish(),
});

/** PUT /api/attendance/balance: annual leave entitlement and carry-over of one person and year. */
export async function PUT(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    await setLeaveBalance(me, schema.parse(await req.json()));
    return ok({ ok: true });
  });
}
