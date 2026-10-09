import { getCurrentUser } from "@/lib/session";
import { TeamView } from "./team-view";

export const metadata = { title: "Nhân sự" };

export default async function TeamPage() {
  const user = (await getCurrentUser())!;
  return <TeamView actor={{ id: user.id, role: user.role, permissions: user.permissions }} />;
}
