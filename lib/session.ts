import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "./prisma";
import { SESSION_COOKIE, verifyToken } from "./jwt";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  jobTitle: string | null;
  avatarColor: string;
  mustChangePassword: boolean;
};

/**
 * Read the session cookie and resolve the current user from the database.
 * Cached per-request. Returns null when the token is missing/invalid, the user
 * is deactivated, or the token predates the user's last password change.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      jobTitle: true,
      avatarColor: true,
      mustChangePassword: true,
      active: true,
      tokenVersion: true,
    },
  });

  if (!user || !user.active) return null;
  if (user.tokenVersion !== payload.tv) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    jobTitle: user.jobTitle,
    avatarColor: user.avatarColor,
    mustChangePassword: user.mustChangePassword,
  };
});
