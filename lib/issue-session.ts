import type { NextResponse } from "next/server";
import { SESSION_COOKIE, createToken, sessionCookieOptions } from "./jwt";

/** Sign a session JWT for the given user state and attach it to the response. */
export async function attachSession(
  res: NextResponse,
  user: { id: string; role: string; tokenVersion: number; mustChangePassword: boolean },
) {
  const token = await createToken({
    userId: user.id,
    role: user.role,
    tv: user.tokenVersion,
    mcp: user.mustChangePassword,
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}

export function clearSession(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
