import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { attachSession } from "@/lib/issue-session";
import { loginSchema, looksLikeLoginId } from "@/lib/validations";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { zodErrors } from "@/lib/api";
import { audit } from "@/lib/audit";

// Cost-12 bcrypt hash of a discarded random string: compared against when the
// email is unknown so response timing does not reveal which accounts exist.
const DUMMY_HASH = "$2b$12$UbZ8e75LXICwRQfH1QetrOZuwsuMzxhVHLqIkkmmF9Fn7ov6JXQCO";

// Wrong passwords one sign-in name may collect before it is paused, across all addresses.
const ACCOUNT_MAX_FAILURES = 10;
const ACCOUNT_WINDOW_MS = 15 * 60_000;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ", fields: zodErrors(parsed.error) }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ip = clientIp(req.headers);
  // Never the password: only the name that was typed and why it failed. Text that is not
  // shaped like a sign-in name is not kept: it is often a password typed in the wrong box.
  const typed = looksLikeLoginId(email) ? parsed.data.email.trim().slice(0, 120) : "(không phải tên đăng nhập)";
  const failed = (reason: "wrong_password" | "unknown_user" | "inactive", userId?: string) =>
    audit(
      { name: typed },
      {
        action: "auth.login_failed",
        entityType: "session",
        entityId: userId,
        summary: `Đăng nhập thất bại: ${typed}`,
        details: { reason, login: email.slice(0, 120) },
      },
    );

  const [perAccount, perIp] = await Promise.all([
    rateLimit(`login:${ip}:${email}`, "LOGIN_LIMITER", 5, 15 * 60_000),
    rateLimit(`login-ip:${ip}`, "LOGIN_IP_LIMITER", 30, 15 * 60_000),
  ]);
  if (!perAccount.allowed || !perIp.allowed) {
    const retry = Math.max(perAccount.retryAfterSec, perIp.retryAfterSec);
    // Not logged: blocked attempts are unbounded and would let anyone flood the audit log.
    // The attempts that led to the block were logged as they happened.
    return NextResponse.json(
      { error: `Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(retry / 60)} phút.` },
      { status: 429, headers: { "Retry-After": String(retry) } },
    );
  }

  // Per account, whatever the address: the limits above are per IP, and addresses are cheap.
  // Counted by the name typed, so a blocked name says nothing about whether the account exists.
  const recentFailures = await prisma.auditLog.count({
    where: { action: "auth.login_failed", createdAt: { gte: new Date(Date.now() - ACCOUNT_WINDOW_MS) }, details: { path: ["login"], equals: email.slice(0, 120) } },
  });
  if (recentFailures >= ACCOUNT_MAX_FAILURES) {
    return NextResponse.json(
      { error: `Tài khoản này vừa bị nhập sai mật khẩu quá nhiều lần. Vui lòng thử lại sau ${ACCOUNT_WINDOW_MS / 60_000} phút.` },
      { status: 429, headers: { "Retry-After": String(ACCOUNT_WINDOW_MS / 1000) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) {
    await failed(user ? "wrong_password" : "unknown_user", user?.id);
    return NextResponse.json({ error: "Tên đăng nhập hoặc mật khẩu không đúng" }, { status: 401 });
  }
  if (!user.active) {
    await failed("inactive", user.id);
    return NextResponse.json({ error: "Tài khoản đã bị vô hiệu hoá. Liên hệ quản trị viên." }, { status: 403 });
  }

  resetRateLimit(`login:${ip}:${email}`);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(
    { id: user.id, name: user.name },
    { action: "auth.login", entityType: "session", entityId: user.id, summary: `${user.name} đăng nhập` },
  );

  const res = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    mustChangePassword: user.mustChangePassword,
  });
  return attachSession(res, user);
}
