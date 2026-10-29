import { redirect } from "next/navigation";
import { INVITE_PATH, inviteUrl } from "@/lib/petdex-public";

// Invite links shared before the game had its own domain: send them to the new address.
export default async function OldGuestPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const safe = /^[a-f0-9]{6,64}$/i.test(code) ? code : "";
  redirect(process.env.NODE_ENV === "production" ? inviteUrl(safe) : `${INVITE_PATH}/${safe}`);
}
