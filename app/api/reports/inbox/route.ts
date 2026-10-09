import type { NextRequest } from "next/server";
import { auth, ok, unauthorized } from "@/lib/api";
import { inboxReports } from "@/lib/queries";

/** ?box=received|sent&status=pending|reviewed|all (see inboxReports). */
export async function GET(req: NextRequest) {
  const me = await auth();
  if (!me) return unauthorized();
  const sp = req.nextUrl.searchParams;
  return ok(await inboxReports(me, sp.get("box"), sp.get("status")));
}
