import type { NextRequest } from "next/server";
import { created, handle, ok } from "@/lib/api";
import { createIntakeLinkSchema, intakePath, type IntakeDays } from "@/lib/customer-intake";
import { createIntakeLink, intakeLinks } from "@/lib/customer-intake-queries";
import { intakeManager } from "../guard";

const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

/** GET /api/customer-intake/links: form links, newest first. */
export async function GET() {
  return handle(async () => {
    const { me, refusal } = await intakeManager();
    if (!me) return refusal;
    return ok({ links: await intakeLinks() }, NO_STORE);
  });
}

/** POST /api/customer-intake/links {label, days}: a new public form link; its address is shown once. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const { me, refusal } = await intakeManager();
    if (!me) return refusal;
    const d = createIntakeLinkSchema.parse(await req.json());
    const { token, id } = await createIntakeLink(me, { label: d.label, days: d.days as IntakeDays });
    return created({ id, path: intakePath(token) });
  });
}
