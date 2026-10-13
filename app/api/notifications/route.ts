import { auth, ok, unauthorized } from "@/lib/api";
import { notificationFeed } from "@/lib/notifications";

/** GET /api/notifications: the bell's notices (newest first), unread count and live alerts. */
export async function GET() {
  const me = await auth();
  if (!me) return unauthorized();
  return ok(await notificationFeed(me), { headers: { "Cache-Control": "private, no-store" } });
}
