import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/misc";
import { AUDIT_RETENTION_DAYS } from "@/lib/audit-actions";
import { AuditLogView } from "./audit-log-view";

export const metadata = { title: "Nhật ký thao tác" };

export default async function AuditLogPage() {
  const me = (await getCurrentUser())!;
  if (!isAdmin(me)) notFound();
  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Nhật ký thao tác"
        description={`Ai đã làm gì, lúc nào, từ địa chỉ IP nào. Chỉ quản trị viên xem được; lưu ${AUDIT_RETENTION_DAYS} ngày.`}
      />
      <AuditLogView />
    </div>
  );
}
