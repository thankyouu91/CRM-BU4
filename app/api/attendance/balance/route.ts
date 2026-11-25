import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth, handle, ok, unauthorized } from "@/lib/api";
import { setLeaveBalance } from "@/lib/attendance-queries";

const schema = z.object({
  userId: z.string().min(1).max(100),
  year: z.number().int().min(2000).max(2100),
  /** Days added (or, negative, taken off) in the year's first month of the leave ledger. */
  adjustment: z.number().min(-60, "Tối đa 60 ngày").max(60, "Tối đa 60 ngày").refine((n) => Number.isInteger(n * 2), "Số ngày tính theo nửa ngày (VD: 3 hoặc 2,5)"),
  note: z.string().max(300).nullish(),
});

/** PUT /api/attendance/balance: HR's adjustment to one person's leave ledger for a year. */
export async function PUT(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    await setLeaveBalance(me, schema.parse(await req.json()));
    return ok({ ok: true });
  });
}
