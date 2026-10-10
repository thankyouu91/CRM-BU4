import { auth, badRequest, forbidden, ok, unauthorized } from "@/lib/api";
import { isAdmin } from "@/lib/rbac";
import { storedApiKey, verifyAnthropicKey } from "@/lib/ai-settings";

/** POST /api/settings/ai/test: check the stored key against Anthropic (no tokens used). Admins only. */
export async function POST() {
  const me = await auth();
  if (!me) return unauthorized();
  if (!isAdmin(me)) return forbidden("Chỉ quản trị viên mới kiểm tra được kết nối AI");
  const { present, apiKey, model } = await storedApiKey();
  if (!present) return badRequest("Chưa có API key");
  if (!apiKey) return badRequest("Không đọc được API key đã lưu (khoá bí mật của máy chủ đã đổi). Hãy nhập lại key.");
  const check = await verifyAnthropicKey(apiKey, model);
  return check.ok ? ok({ ok: true }) : badRequest(check.message);
}
