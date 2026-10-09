import { auth, forbidden, ok, unauthorized } from "@/lib/api";
import { isAdmin } from "@/lib/rbac";
import { backupsBucket, listBackups } from "@/lib/backups";

/** GET /api/backups: the daily/monthly database backups in R2, admins only. */
export async function GET() {
  const me = await auth();
  if (!me) return unauthorized();
  if (!isAdmin(me)) return forbidden("Chỉ quản trị viên mới xem được bản sao lưu");
  const bucket = backupsBucket();
  if (!bucket) return ok({ enabled: false, backups: [] });
  return ok({ enabled: true, backups: await listBackups(bucket) });
}
