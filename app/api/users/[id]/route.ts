import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, badRequest, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { assignableRoles, canManageUser, forbiddenGrantChange, normalizeGrants, PERMISSION_INFO, ROLE_INFO } from "@/lib/permissions";
import { updateUserSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Admins edit any account. Holders of USER_MANAGE edit accounts below their own
 * level: details, level (only to levels below theirs), the permissions they hold
 * themselves, password reset and activation.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();

    const target = await prisma.user.findUnique({ where: { id: params.id } });
    if (!target) return notFound("Không tìm thấy người dùng");
    if (!canManageUser(me, target)) {
      return forbidden("Bạn chỉ có thể quản lý tài khoản ở cấp thấp hơn mình");
    }

    const data = updateUserSchema.parse(await req.json());
    const isSelf = target.id === me.id;

    if (data.role !== undefined && data.role !== target.role && !assignableRoles(me).includes(data.role)) {
      return forbidden(`Bạn không thể đặt cấp "${ROLE_INFO[data.role].label}"`);
    }

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

    // Grants are re-normalised against the (possibly new) level. A non-admin may
    // only add or remove permissions they hold themselves.
    const nextRole = data.role ?? target.role;
    const permissions =
      data.permissions !== undefined || data.role !== undefined
        ? normalizeGrants(nextRole, data.permissions ?? target.permissions)
        : undefined;
    if (permissions) {
      const denied = forbiddenGrantChange(me, normalizeGrants(nextRole, target.permissions), permissions);
      if (denied) return forbidden(`Bạn không thể cấp hoặc thu hồi quyền "${PERMISSION_INFO[denied].label}"`);
    }

    const email = data.email?.trim().toLowerCase();
    if (email && email !== target.email && (await prisma.user.findUnique({ where: { email } }))) {
      return badRequest("Email đã được sử dụng", { email: "Email đã được sử dụng" });
    }
    const emailChanged = !!email && email !== target.email;

    let passwordHash: string | undefined;
    if (data.resetPassword) {
      const weak = validatePasswordStrength(data.resetPassword);
      if (weak) return badRequest(weak, { resetPassword: weak });
      passwordHash = await hashPassword(data.resetPassword);
    }

    // Revoke existing sessions when the password is reset, the login email
    // changes, the account is deactivated, or the level changes. Permission
    // changes apply on the next request without signing the user out.
    const revoke =
      !!passwordHash ||
      emailChanged ||
      data.active === false ||
      (data.role !== undefined && data.role !== target.role);

    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        email: emailChanged ? email : undefined,
        name: data.name?.trim(),
        role: data.role,
        permissions,
        jobTitle: data.jobTitle === undefined ? undefined : data.jobTitle?.trim() || null,
        active: data.active,
        ...(passwordHash ? { passwordHash, mustChangePassword: true } : {}),
        ...(revoke ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: { id: true, email: true, name: true, role: true, permissions: true, jobTitle: true, avatarColor: true, active: true },
    });
    return ok({ user });
  });
}
