import { getCurrentUser } from "@/lib/session";
import { managesAnyProject } from "@/lib/rbac";
import { InboxView } from "./inbox-view";

export const metadata = { title: "Hộp báo cáo" };

export default async function InboxPage() {
  const user = (await getCurrentUser())!;
  return <InboxView isManager={await managesAnyProject(user)} />;
}
