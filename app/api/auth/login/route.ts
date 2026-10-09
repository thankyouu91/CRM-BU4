import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { attachSession } from "@/lib/issue-session";
import { loginSchema } from "@/lib/validations";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { zodErrors } from "@/lib/api";

// Cost-12 bcrypt hash of a discarded random string: compared against when the
// email is unknown so response timing does not reveal which accounts exist.
const DUMMY_HASH = "$2b$12$UbZ8e75LXICwRQfH1QetrOZuwsuMzxhVHLqIkkmmF9Fn7ov6JXQCO";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ", fields: zodErrors(parsed.error) }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ip = clientIp(req.headers);

  const [perAccount, perIp] = await Promise.all([
    rateLimit(`login:${ip}:${email}`, "LOGIN_LIMITER", 5, 15 * 60_000),
    rateLimit(`login-ip:${ip}`, "LOGIN_IP_LIMITER", 30, 15 * 60_000),
  ]);
  if (!perAccount.allowed || !perIp.allowed) {
    const retry = Math.max(perAccount.retryAfterSec, perIp.retryAfterSec);
    return NextResponse.json(
      { error: `Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(retry / 60)} phút.` },
      { status: 429, headers: { "Retry-After": String(retry) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) {
    return NextResponse.json({ error: "Email hoặc mật khẩu không đúng" }, { status: 401 });
  }
  if (!user.active) {
    return NextResponse.json({ error: "Tài khoản đã bị vô hiệu hoá. Liên hệ quản trị viên." }, { status: 403 });
  }

  resetRateLimit(`login:${ip}:${email}`);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const res = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    mustChangePassword: user.mustChangePassword,
  });
  return attachSession(res, user);
}
