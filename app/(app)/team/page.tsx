import { getCurrentUser } from "@/lib/session";
import { TeamView } from "./team-view";

export const metadata = { title: "Nhân sự" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const user = (await getCurrentUser())!;
  // ?q= (links from quick search) opens the list filtered by that name.
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
  return <TeamView key={query} actor={{ id: user.id, role: user.role, permissions: user.permissions }} initialQuery={query} />;
}
