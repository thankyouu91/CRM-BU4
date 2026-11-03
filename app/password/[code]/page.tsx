import { GameError, gameJson } from "@/lib/petdex";
import { playMetadata } from "@/lib/petdex-public";
import { PasswordSetup, type PasswordLink } from "@/components/tatua/password-setup";

export const metadata = playMetadata;

// One-time link an administrator made for a player (play.petfarm.online/password/<code>): set a
// login name and a password, then play. Valid for 24 hours and once.
export default async function PasswordLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let link: PasswordLink = { valid: false };
  let error: string | null = null;
  if (/^[a-f0-9]{32}$/.test(code)) {
    try {
      link = await gameJson<PasswordLink>(`/internal/password-links/${code}`);
    } catch (err) {
      error = err instanceof GameError ? err.message : "Máy chủ game gặp sự cố, thử lại sau.";
    }
  }
  return <PasswordSetup code={code} link={link} error={error} />;
}
