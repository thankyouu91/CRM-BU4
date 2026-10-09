import { getCurrentUser } from "@/lib/session";
import { isManagerOrAbove } from "@/lib/rbac";
import { MyTasksView } from "./tasks-view";

export const metadata = { title: "Công việc của tôi" };

export default async function TasksPage() {
  const user = (await getCurrentUser())!;
  return <MyTasksView canSeeAll={isManagerOrAbove(user)} />;
}
