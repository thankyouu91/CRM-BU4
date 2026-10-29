import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/jwt";
import { INVITE_PATH, PASSWORD_PATH, PLAY_HOST, PLAY_PATH, playHostRedirect } from "@/lib/petdex-public";

// Edge middleware. Next.js 16 deprecates this file name for proxy.ts, but a proxy always runs
// on the Node.js runtime, which OpenNext does not support on Cloudflare Workers (only as an
// unmaintained experiment), so this stays middleware.ts until it does.

// Routes reachable without a session. /share/<token> is a public presentation link:
// the page checks the token itself (lib/report-share.ts).
// Pet Town: the game's static files and its API (which checks its own token), the guest page and its API.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/share", "/ta-tua/game", "/ta-tua/api", "/ta-tua/khach", "/api/ta-tua/guest", "/api/ta-tua/account", INVITE_PATH, PLAY_PATH, PASSWORD_PATH];
const SHARE_PATH = "/share";
// Routes a session flagged "must change password" may still reach.
const PASSWORD_CHANGE_PATHS = ["/change-password", "/api/auth/change-password", "/api/auth/logout", "/api/auth/me"];

const matches = (pathname: string, list: string[]) =>
  list.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // Pet Town's own domain (play.petfarm.online) shows the game only: "/" and WorkHub pages go to the play page.
  if (req.headers.get("host") === PLAY_HOST) {
    const to = playHostRedirect(pathname);
    if (to) return isApi ? NextResponse.json({ error: "Không tìm thấy" }, { status: 404 }) : NextResponse.redirect(new URL(to, req.url));
  }

  // CSRF defense: state-changing API calls must come from our own origin.
  if (isApi && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host")) {
      return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ" }, { status: 403 });
    }
  }

  if (matches(pathname, [SHARE_PATH])) {
    // Keep shared reports out of search engines and caches (no-referrer: next.config.mjs).
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }
  if (matches(pathname, PUBLIC_PATHS)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;

  if (!session) {
    if (isApi) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session.mcp && !matches(pathname, PASSWORD_CHANGE_PATHS)) {
    if (isApi) return NextResponse.json({ error: "Bạn cần đổi mật khẩu trước khi tiếp tục" }, { status: 403 });
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$).*)"],
};
