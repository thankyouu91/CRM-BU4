import { Lock } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { projectVisibilityWhere } from "@/lib/rbac";
import { contractList } from "@/lib/contract-queries";
import { asJson } from "@/lib/json";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ContractsView } from "./contracts-view";

export const metadata = { title: "Hợp đồng & chi phí" };

export default async function ContractsPage() {
  const user = (await getCurrentUser())!;
  if (!hasPermission(user, "FINANCE_MANAGE")) {
    return (
      <div>
        <PageHeader title="Hợp đồng & chi phí" />
        <div className="rounded-2xl border bg-card shadow-card">
          <EmptyState
            icon={Lock}
            title="Bạn chưa có quyền xem mục này"
            description="Số liệu hợp đồng, chi phí và công nợ chỉ dành cho người được cấp quyền “Hợp đồng & chi phí”. Hãy nhờ quản lý cấp quyền ở trang Nhân sự."
          />
        </div>
      </div>
    );
  }
  // The default list (this month) is sent with the page.
  const [projects, initial] = await Promise.all([
    prisma.project.findMany({
      where: projectVisibilityWhere(user),
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    contractList(new URLSearchParams({ period: "month" })),
  ]);
  return <ContractsView projects={projects} initial={asJson(initial)} />;
}
