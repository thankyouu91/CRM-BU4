import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth, handle, ok, unauthorized } from "@/lib/api";
import { CHECKLIST_TEXT_MAX, deleteChecklistItem, updateChecklistItem } from "@/lib/checklist";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/checklist/<id> { done?, text? }: one's own item only. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const patch = z.object({ done: z.boolean().optional(), text: z.string().max(CHECKLIST_TEXT_MAX * 2).optional() }).parse(await req.json());
    return ok({ item: await updateChecklistItem(me.id, id, patch) });
  });
}

/** DELETE /api/checklist/<id> */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    await deleteChecklistItem(me.id, id);
    return ok({ ok: true });
  });
}
