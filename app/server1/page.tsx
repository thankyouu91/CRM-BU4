import { getCurrentUser } from "@/lib/session";
import { GameError, memberSession } from "@/lib/petdex";
import { PlayScreen } from "@/components/tatua/play-screen";

export const metadata = { title: "Pet Town · Server 1" };

// Full-screen play page (play.petfarm.online/server1). A WorkHub member signed in on this site
// plays with their account; anyone else plays with the guest session this browser keeps.
export default async function PlayPage() {
  const me = await getCurrentUser();
  let member: { name: string; token: string } | null = null;
  if (me && !me.mustChangePassword) {
    try {
      member = { name: me.name, token: (await memberSession(me)).token };
    } catch (err) {
      if (!(err instanceof GameError)) throw err;
    }
  }
  return <PlayScreen member={member} />;
}
