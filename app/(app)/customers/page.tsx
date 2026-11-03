import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { customerList } from "@/lib/customer-queries";
import { CustomersView } from "./customers-view";

export const metadata = { title: "Khách hàng" };

// Khách hàng: companies A to Z; opening one shows its people by position, from the director down.
export default async function CustomersPage() {
  const user = (await getCurrentUser())!;
  const customers = await customerList();
  return <CustomersView initial={customers} canManage={hasPermission(user, "CUSTOMER_MANAGE")} />;
}
