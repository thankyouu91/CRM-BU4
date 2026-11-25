import { handle, ok } from "@/lib/api";
import { intakeSubmissions } from "@/lib/customer-intake-queries";
import { intakeManager } from "../guard";

/** GET /api/customer-intake/submissions: answers waiting for review, then the latest decided ones. */
export async function GET() {
  return handle(async () => {
    const { me, refusal } = await intakeManager();
    if (!me) return refusal;
    return ok({ submissions: await intakeSubmissions() }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
