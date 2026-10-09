import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/jwt";

// Routes reachable without a session.
const PUBLIC_PATHS = ["/login", "/api/auth/login"];
// Routes a session flagged "must change password" may still reach.
const PASSWORD_CHANGE_PATHS = ["/change-password", "/api/auth/change-password", "/api/auth/logout", "/api/auth/me"];

const matches = (pathname: string, list: string[]) =>
  list.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // CSRF defense: state-changing API calls must come from our own origin.
  if (isApi && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host")) {
      return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ" }, { status: 403 });
    }
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
