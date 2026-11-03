import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, handle, ok } from "@/lib/api";
import { GameError, gameJson, type GameSession } from "@/lib/petdex";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Pet Town guest entry: no WorkHub account. A guest opens an invite link, types a name and gets a
// play session; a returning guest resumes the session the browser kept.

const enterSchema = z.object({ code: z.string().min(6).max(64), name: z.string().trim().min(2).max(40) });
const resumeSchema = z.object({ resume: z.string().min(16).max(128) });

const unavailable = (err: unknown) => (err instanceof GameError ? badRequest(err.message) : null);

export async function GET(req: NextRequest) {
  return handle(async () => {
    const code = req.nextUrl.searchParams.get("code") ?? "";
    if (!/^[a-f0-9]{6,64}$/i.test(code)) return ok({ valid: false, label: null });
    try {
      return ok(await gameJson<{ valid: boolean; label: string | null }>(`/internal/invites/${code}`));
    } catch (err) {
      return unavailable(err) ?? Promise.reject(err);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const limit = await rateLimit(`tatua-guest:${clientIp(req.headers)}`, "LOGIN_IP_LIMITER", 20, 60_000);
    if (!limit.allowed) return badRequest("Thử lại sau ít phút.");
    const json = await req.json();
    const resume = resumeSchema.safeParse(json);
    try {
      if (resume.success) {
        const data = await gameJson<{ ok: boolean; username?: string; displayName?: string }>(`/internal/guest/resume`, { body: { token: resume.data.resume } });
        return ok(data);
      }
      const parsed = enterSchema.safeParse(json);
      if (!parsed.success) return badRequest("Tên dài 2–40 ký tự.");
      const session = await gameJson<GameSession>(`/internal/guest`, { body: parsed.data });
      return ok({ ok: true, token: session.token, username: session.username });
    } catch (err) {
      return unavailable(err) ?? Promise.reject(err);
    }
  });
}
