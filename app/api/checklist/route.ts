import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth, created, handle, ok, unauthorized } from "@/lib/api";
import { addChecklistItem, checklistOf, CHECKLIST_TEXT_MAX } from "@/lib/checklist";
import { isDay } from "@/lib/attendance";

const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

/** GET /api/checklist[?day=YYYY-MM-DD]: the signed-in person's own checklist for that day. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const day = req.nextUrl.searchParams.get("day");
    return ok(await checklistOf(me.id, isDay(day) ? day : null), NO_STORE);
  });
}

/** POST /api/checklist { text }: add an item for today. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const { text } = z.object({ text: z.string().max(CHECKLIST_TEXT_MAX * 2) }).parse(await req.json());
    return created({ item: await addChecklistItem(me.id, text) });
  });
}
