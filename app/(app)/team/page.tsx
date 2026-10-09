import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/rbac";
import { TeamView } from "./team-view";

export const metadata = { title: "Nhân sự" };

export default async function TeamPage() {
  const user = (await getCurrentUser())!;
  return <TeamView meId={user.id} admin={isAdmin(user)} />;
}
