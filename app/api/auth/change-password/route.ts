import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, badRequest, unauthorized, zodErrors } from "@/lib/api";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/password";
import { attachSession } from "@/lib/issue-session";
import { changePasswordSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const me = await auth();
  if (!me) return unauthorized();

  const limit = await rateLimit(`chpw:${me.id}`, "LOGIN_LIMITER", 5, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Thử quá nhiều lần, vui lòng đợi ít phút." }, { status: 429 });
  }

  const parsed = changePasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ", fields: zodErrors(parsed.error) }, { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user) return unauthorized();

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json(
      { error: "Mật khẩu hiện tại không đúng", fields: { currentPassword: "Mật khẩu hiện tại không đúng" } },
      { status: 400 },
    );
  }
  const weak = validatePasswordStrength(newPassword);
  if (weak) return NextResponse.json({ error: weak, fields: { newPassword: weak } }, { status: 400 });
  if (await verifyPassword(newPassword, user.passwordHash)) {
    return badRequest("Mật khẩu mới phải khác mật khẩu hiện tại");
  }

  // Bump tokenVersion: every other session for this account is revoked, and
  // this response re-issues a fresh token so the current device stays signed in.
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      tokenVersion: { increment: 1 },
    },
  });

  return attachSession(NextResponse.json({ ok: true }), updated);
}
