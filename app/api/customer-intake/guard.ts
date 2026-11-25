import { auth, forbidden, unauthorized } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";

/** The signed-in person if they may run the form (Quản lý khách hàng), else the refusal to send. */
export async function intakeManager() {
  const me = await auth();
  if (!me) return { refusal: unauthorized() };
  if (!hasPermission(me, "CUSTOMER_MANAGE")) return { refusal: forbidden("Bạn chưa được cấp quyền “Quản lý khách hàng”") };
  return { me };
}
