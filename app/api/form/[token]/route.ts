import { NextResponse, type NextRequest } from "next/server";
import { badRequest, handle, ok } from "@/lib/api";
import { intakeSchema } from "@/lib/customer-intake";
import { submitIntake } from "@/lib/customer-intake-queries";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { keepAlive } from "@/lib/ai-run";

const MAX_BODY = 20_000;

/** POST /api/form/:token: a company's answer to a form link (no login; the token is the key). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return handle(async () => {
    const limit = await rateLimit(`intake:${clientIp(req.headers)}`, "INTAKE_LIMITER", 5, 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Bạn gửi quá nhanh, thử lại sau một phút." }, { status: 429 });
    const raw = await req.text();
    if (raw.length > MAX_BODY) return badRequest("Thông tin quá dài");
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return badRequest("Dữ liệu không hợp lệ");
    }
    const { website2, ...data } = intakeSchema.parse(body);
    // A bot filled the hidden field: answer as if it worked, keep nothing.
    if (website2) return ok({ ok: true });
    const sent = await submitIntake(token, data);
    if (!sent) return NextResponse.json({ error: "Link này đã hết hạn hoặc không còn nhận thông tin." }, { status: 410 });
    keepAlive(sent.followUp);
    return ok({ ok: true });
  });
}
