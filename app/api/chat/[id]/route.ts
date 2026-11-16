import type { NextRequest } from "next/server";
import { auth, handle, ok, unauthorized } from "@/lib/api";
import { deleteChatMessage } from "@/lib/chat-queries";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/chat/<id>: withdraw a message (its author, or an administrator). */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    await deleteChatMessage(me, id);
    return ok({ ok: true });
  });
}
