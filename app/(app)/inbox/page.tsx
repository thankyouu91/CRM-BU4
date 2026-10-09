import { getCurrentUser } from "@/lib/session";
import { managesAnyProject } from "@/lib/rbac";
import { inboxReports } from "@/lib/queries";
import { asJson } from "@/lib/json";
import { InboxView } from "./inbox-view";

export const metadata = { title: "Hộp báo cáo" };

export default async function InboxPage() {
  const user = (await getCurrentUser())!;
  const isManager = await managesAnyProject(user);
  // The default box (managers: pending received reports; others: sent) is sent with the page.
  const initial = await inboxReports(user, isManager ? "received" : "sent", isManager ? "pending" : "all");
  return <InboxView isManager={isManager} initial={asJson(initial)} />;
}
