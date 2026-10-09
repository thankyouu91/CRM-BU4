import { getCurrentUser } from "@/lib/session";
import { canViewAllProjects, managesAnyProject } from "@/lib/rbac";
import { listTasks } from "@/lib/queries";
import { asJson } from "@/lib/json";
import { MyTasksView } from "./tasks-view";

export const metadata = { title: "Công việc của tôi" };

export default async function TasksPage() {
  const user = (await getCurrentUser())!;
  // The default view ("mine") is sent with the page.
  const [canSeeAll, tasks] = await Promise.all([canViewAllProjects(user) || managesAnyProject(user), listTasks(user, { scope: "mine" })]);
  return <MyTasksView canSeeAll={canSeeAll} initial={asJson({ tasks })} />;
}
