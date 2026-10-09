import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, badRequest, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { isAdmin } from "@/lib/rbac";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { updateUserSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!isAdmin(me)) return forbidden("Chỉ quản trị viên mới được chỉnh sửa tài khoản");

    const target = await prisma.user.findUnique({ where: { id: params.id } });
    if (!target) return notFound("Không tìm thấy người dùng");

    const data = updateUserSchema.parse(await req.json());
    const isSelf = target.id === me.id;

    // Lockout protection: an admin cannot demote or deactivate themselves, and
    // the system must always keep at least one active admin.
    if (isSelf && (data.active === false || (data.role && data.role !== "ADMIN"))) {
      return badRequest("Bạn không thể tự hạ quyền hoặc vô hiệu hoá tài khoản của chính mình");
    }
    const losingAdmin =
      target.role === "ADMIN" && (data.active === false || (data.role !== undefined && data.role !== "ADMIN"));
    if (losingAdmin) {
      const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
      if (activeAdmins <= 1) return badRequest("Hệ thống phải còn ít nhất một quản trị viên đang hoạt động");
    }

    let passwordHash: string | undefined;
    if (data.resetPassword) {
      const weak = validatePasswordStrength(data.resetPassword);
      if (weak) return badRequest(weak, { resetPassword: weak });
      passwordHash = await hashPassword(data.resetPassword);
    }

    // Revoke existing sessions when the password is reset, the account is
    // deactivated, or the role changes (so new permissions take effect).
    const revoke =
      !!passwordHash || data.active === false || (data.role !== undefined && data.role !== target.role);

    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        name: data.name?.trim(),
        role: data.role,
        jobTitle: data.jobTitle === undefined ? undefined : data.jobTitle?.trim() || null,
        active: data.active,
        ...(passwordHash ? { passwordHash, mustChangePassword: true } : {}),
        ...(revoke ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: { id: true, email: true, name: true, role: true, jobTitle: true, avatarColor: true, active: true },
    });
    return ok({ user });
  });
}
