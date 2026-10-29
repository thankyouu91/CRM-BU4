import { PlayScreen } from "@/components/tatua/play-screen";
import { playMetadata } from "@/lib/petdex-public";

export const metadata = playMetadata;

// /invitation without a code: the guest's saved session if there is one, otherwise a box to paste the invite.
export default function InvitationIndexPage() {
  return <PlayScreen member={null} />;
}
