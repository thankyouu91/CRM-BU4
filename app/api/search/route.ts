import type { NextRequest } from "next/server";
import { auth, badRequest, handle, ok, unauthorized } from "@/lib/api";
import { parseSearchQuery, SEARCH_MAX, SEARCH_MIN } from "@/lib/search";
import { quickSearch } from "@/lib/search-queries";

/** GET /api/search?q=: quick search (Ctrl+K) over what the user may see, at most 6 results per group. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const q = parseSearchQuery(req.nextUrl.searchParams.get("q"));
    if (!q) return badRequest(`Nhập từ ${SEARCH_MIN} đến ${SEARCH_MAX} ký tự để tìm kiếm`);
    return ok(await quickSearch(me, q), { headers: { "Cache-Control": "private, no-store" } });
  });
}
