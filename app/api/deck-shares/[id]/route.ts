import type { NextRequest } from "next/server";
import { auth, handle, notFound, ok, unauthorized } from "@/lib/api";
import { revokeShare } from "@/lib/report-share";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/deck-shares/[id]: revoke a public link (its creator, or an administrator). */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const share = await revokeShare(me, (await ctx.params).id);
    if (!share) return notFound("Không tìm thấy link");
    return ok({ share });
  });
}
