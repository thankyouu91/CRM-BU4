import type { NextRequest } from "next/server";
import { auth, badRequest, forbidden, handle, ok, unauthorized } from "@/lib/api";
import { isAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { aiModelInfo } from "@/lib/ai-models";
import { aiUsage, getAiSettings, saveAiSettings, verifyAnthropicKey } from "@/lib/ai-settings";
import { aiSettingsSchema } from "@/lib/validations";

/** GET /api/settings/ai: the built-in AI settings (never the key itself) and the last 30 days of use. Admins only. */
export async function GET() {
  const me = await auth();
  if (!me) return unauthorized();
  if (!isAdmin(me)) return forbidden("Chỉ quản trị viên mới xem được cài đặt AI");
  const [settings, usage] = await Promise.all([getAiSettings(), aiUsage(30)]);
  return ok({ settings, usage });
}

/**
 * PUT /api/settings/ai { apiKey?, model?, enabled?, dailyLimit? }. Admins only.
 * A new key is checked with Anthropic before it is saved, so a typo never replaces a working key.
 */
export async function PUT(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!isAdmin(me)) return forbidden("Chỉ quản trị viên mới đổi được cài đặt AI");
    const patch = aiSettingsSchema.parse(await req.json());

    if (patch.apiKey) {
      const model = patch.model ?? (await getAiSettings()).model;
      const check = await verifyAnthropicKey(patch.apiKey, model);
      if (!check.ok) return badRequest(check.message, { apiKey: check.message });
    }

    const { view, changes } = await saveAiSettings({ id: me.id, name: me.name }, patch);
    if (Object.keys(changes).length) {
      const parts = [
        changes.apiKey && (changes.apiKey.to ? `cập nhật API key (${changes.apiKey.to})` : "xoá API key"),
        changes.enabled && (view.enabled ? "bật AI" : "tắt AI"),
        changes.model && `model ${aiModelInfo(view.model).label}`,
        changes.dailyLimit && `giới hạn ${view.dailyLimit} lượt/người/ngày`,
      ].filter(Boolean);
      await audit({ id: me.id, name: me.name }, { action: "settings.ai_update", entityType: "setting", entityId: "ai", summary: `Cài đặt AI: ${parts.join(", ")}`, details: changes });
    }
    return ok({ settings: view });
  });
}
