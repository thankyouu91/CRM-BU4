import type { NextRequest } from "next/server";
import { auth, badRequest, forbidden, notFound, unauthorized } from "@/lib/api";
import { isAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { BACKUP_KEY, backupsBucket } from "@/lib/backups";

/** GET /api/backups/download?key=daily/2026-10-09.json.gz: one backup file, admins only. */
export async function GET(req: NextRequest) {
  const me = await auth();
  if (!me) return unauthorized();
  if (!isAdmin(me)) return forbidden("Chỉ quản trị viên mới tải được bản sao lưu");
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!BACKUP_KEY.test(key)) return badRequest("Tên bản sao lưu không hợp lệ");
  const bucket = backupsBucket();
  const object = bucket ? await bucket.get(key) : null;
  if (!object) return notFound("Không tìm thấy bản sao lưu");
  await audit({ id: me.id, name: me.name }, { action: "backup.download", entityType: "backup", entityId: key, summary: `Tải bản sao lưu ${key}` });
  return new Response(object.body, {
    headers: {
      // Served as the gzip file itself (not decoded by the browser).
      "Content-Type": "application/gzip",
      "Content-Length": String(object.size),
      "Content-Disposition": `attachment; filename="crm-backup-${key.replace("/", "-")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
