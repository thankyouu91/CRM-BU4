import { NextResponse, type NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { reviewSchema } from "@/lib/customer-intake";
import { decideSubmission } from "@/lib/customer-intake-queries";
import { customerFor } from "@/lib/customer-queries";
import { intakeManager } from "../../guard";

/** POST /api/customer-intake/submissions/:id {action: approve | merge (customerId) | reject}. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const { me, refusal } = await intakeManager();
    if (!me) return refusal;
    const result = await decideSubmission(me, id, reviewSchema.parse(await req.json()));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return ok({ customer: result.customerId ? await customerFor(result.customerId, me) : null });
  });
}
