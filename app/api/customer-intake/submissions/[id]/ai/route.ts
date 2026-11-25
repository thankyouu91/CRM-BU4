import { NextResponse, type NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { aiReviewSubmission } from "@/lib/customer-intake-queries";
import { intakeManager } from "../../../guard";

/** POST /api/customer-intake/submissions/:id/ai: Claude checks the answer; the verdict is kept on it. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const { me, refusal } = await intakeManager();
    if (!me) return refusal;
    const result = await aiReviewSubmission(me, id);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return ok(result);
  });
}
