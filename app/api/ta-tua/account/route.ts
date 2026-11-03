import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, handle, ok } from "@/lib/api";
import { GameError, gameJson } from "@/lib/petdex";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Pet Town accounts on the game domain: anyone can sign up with a name and a password and later
// sign straight in with them. Players who came in through WorkHub or an invite set theirs here too.
// An old account without a password gets one either from a browser that still holds its session
// ("claim") or from a one-time link an administrator made ("setup").

export interface GameAccount {
  token?: string;
  userId: number;
  username: string;
  displayName: string;
  kind: string;
  hasPassword: boolean;
}

const credentials = { username: z.string().trim().min(1).max(40), password: z.string().min(1).max(200) };
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("register"), ...credentials }),
  // An empty password is allowed here: it is how an old account without a password is found.
  z.object({ action: z.literal("login"), username: credentials.username, password: z.string().max(200) }),
  z.object({ action: z.literal("credentials"), token: z.string().min(16).max(128), currentPassword: z.string().max(200).optional(), ...credentials }),
  z.object({ action: z.literal("claim"), tokens: z.array(z.string().min(16).max(128)).max(5), ...credentials }),
  z.object({ action: z.literal("setup"), code: z.string().regex(/^[a-f0-9]{32}$/), ...credentials }),
]);

export async function POST(req: NextRequest) {
  return handle(async () => {
    const ip = clientIp(req.headers);
    const perIp = await rateLimit(`tatua-account:${ip}`, "LOGIN_IP_LIMITER", 20, 60_000);
    if (!perIp.allowed) return badRequest("Thử lại sau ít phút.");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Điền tên đăng nhập và mật khẩu.");
    const { action, ...body } = parsed.data;
    // Sign-ups and password guesses get a tighter budget than the per-IP one. A login is keyed on the
    // address and the name as the game compares it, so nobody can lock a player out from elsewhere.
    const name = body.username.normalize("NFC").toLowerCase();
    const tight = action === "login" ? `tatua-login:${ip}:${name}` : `tatua-${action}:${ip}`;
    if (!(await rateLimit(tight, "LOGIN_LIMITER", 5, 60_000)).allowed) return badRequest("Thử lại sau ít phút.");
    try {
      return ok(await gameJson<GameAccount>(`/internal/account/${action}`, { body }));
    } catch (err) {
      if (err instanceof GameError) return badRequest(err.message, err.reason ? { reason: err.reason } : undefined);
      throw err;
    }
  });
}
