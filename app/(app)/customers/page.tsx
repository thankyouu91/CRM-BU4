import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { customerList } from "@/lib/customer-queries";
import { prisma } from "@/lib/prisma";
import { CustomersView } from "./customers-view";

export const metadata = { title: "Khách hàng" };

// Khách hàng: companies A to Z; opening one shows its people by position, from the director down.
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ open?: string | string[] }> }) {
  const user = (await getCurrentUser())!;
  const canManage = hasPermission(user, "CUSTOMER_MANAGE");
  const [customers, { open }, pendingIntake] = await Promise.all([
    customerList(user),
    searchParams,
    canManage ? prisma.customerSubmission.count({ where: { status: "PENDING" } }) : 0,
  ]);
  // ?open=<id> (from a project's header) opens that company and scrolls to it.
  return <CustomersView initial={customers} canManage={canManage} focus={typeof open === "string" ? open : null} pendingIntake={pendingIntake} />;
}
