import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth, created, handle, ok, unauthorized } from "@/lib/api";
import { chatPage, postChatMessage } from "@/lib/chat-queries";
import { CHAT_MAX } from "@/lib/chat";

const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };
const cursor = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).nullable();

/** GET /api/chat[?before=<id>|?after=<id>&since=<iso>]: the company channel, oldest first (since: also what was withdrawn). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const sp = req.nextUrl.searchParams;
    const since = z.iso.datetime().nullable().parse(sp.get("since"));
    return ok(await chatPage(me, { before: cursor.parse(sp.get("before")), after: cursor.parse(sp.get("after")), since: since ? new Date(since) : null }), NO_STORE);
  });
}

/** POST /api/chat { content }: post a message; @mentioned people are notified. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    // Generous on the raw text: each @name / #task token is longer than what people read.
    const { content } = z.object({ content: z.string().max(CHAT_MAX * 4) }).parse(await req.json());
    return created({ message: await postChatMessage(me, content) });
  });
}
