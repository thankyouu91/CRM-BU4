import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/rbac";
import { Board } from "./board";

export const metadata = { title: "Quản lý Tà tưa" };

// Administrators only: players, their coins and pets, guest invite links and the action log.
export default async function TaTuaAdminPage() {
  const me = (await getCurrentUser())!;
  if (!isAdmin(me)) redirect("/ta-tua");
  return <Board />;
}
