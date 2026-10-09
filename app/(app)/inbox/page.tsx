import { getCurrentUser } from "@/lib/session";
import { isManagerOrAbove } from "@/lib/rbac";
import { InboxView } from "./inbox-view";

export const metadata = { title: "Hộp báo cáo" };

export default async function InboxPage() {
  const user = (await getCurrentUser())!;
  return <InboxView isManager={isManagerOrAbove(user)} />;
}
