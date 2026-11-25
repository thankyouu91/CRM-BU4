import type { NextRequest } from "next/server";
import { handle, notFound, ok } from "@/lib/api";
import { revokeIntakeLink } from "@/lib/customer-intake-queries";
import { intakeManager } from "../../guard";

/** DELETE /api/customer-intake/links/:id: the link stops taking answers (answers already sent stay). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const { me, refusal } = await intakeManager();
    if (!me) return refusal;
    return (await revokeIntakeLink(me, id)) ? ok({ ok: true }) : notFound("Không tìm thấy link");
  });
}
