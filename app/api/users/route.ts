import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, badRequest, created, forbidden, handle, ok, unauthorized } from "@/lib/api";
import { isAdmin } from "@/lib/rbac";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { createUserSchema } from "@/lib/validations";

const AVATAR_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#f97316"];

export async function GET() {
  const me = await auth();
  if (!me) return unauthorized();

  const admin = isAdmin(me);
  const users = await prisma.user.findMany({
    where: admin ? {} : { active: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      jobTitle: true,
      avatarColor: true,
      active: true,
      ...(admin ? { lastLoginAt: true, createdAt: true, mustChangePassword: true } : {}),
      _count: { select: { assignedTasks: true } },
    },
  });
  return ok({ users });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!isAdmin(me)) return forbidden("Chỉ quản trị viên mới được tạo tài khoản");

    const data = createUserSchema.parse(await req.json());
    const weak = validatePasswordStrength(data.password);
    if (weak) return badRequest(weak, { password: weak });

    const email = data.email.trim().toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) {
      return badRequest("Email đã được sử dụng", { email: "Email đã được sử dụng" });
    }

    const user = await prisma.user.create({
      data: {
        email,
        name: data.name.trim(),
        role: data.role,
        jobTitle: data.jobTitle?.trim() || null,
        passwordHash: await hashPassword(data.password),
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        // New accounts must set their own password on first sign-in.
        mustChangePassword: true,
      },
      select: { id: true, email: true, name: true, role: true, jobTitle: true, avatarColor: true, active: true },
    });
    return created({ user });
  });
}
