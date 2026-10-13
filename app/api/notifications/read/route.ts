import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth, handle, ok, unauthorized } from "@/lib/api";
import { markRead } from "@/lib/notifications";

const schema = z.union([z.object({ all: z.literal(true) }), z.object({ ids: z.array(z.string().min(1).max(100)).min(1).max(100) })]);

/** POST /api/notifications/read { ids } | { all: true }: only the caller's own notices. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const body = schema.parse(await req.json());
    return ok({ unread: await markRead(me.id, "all" in body ? "all" : body.ids) });
  });
}
