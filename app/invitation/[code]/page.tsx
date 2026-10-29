import { GameError, gameJson } from "@/lib/petdex";
import { GuestEntry } from "@/components/tatua/guest-entry";

export const metadata = { title: "Tà tưa · Lời mời" };

// Public invite page (play.petfarm.online/invitation/<code>): a guest types a name and plays,
// no WorkHub account needed.
export default async function InvitationPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let valid = false;
  let label: string | null = null;
  let error: string | null = null;
  if (/^[a-f0-9]{6,64}$/i.test(code)) {
    try {
      ({ valid, label } = await gameJson<{ valid: boolean; label: string | null }>(`/internal/invites/${code}`));
    } catch (err) {
      error = err instanceof GameError ? err.message : "Máy chủ game gặp sự cố, thử lại sau.";
    }
  }
  return <GuestEntry code={code} valid={valid} label={label} error={error} />;
}
