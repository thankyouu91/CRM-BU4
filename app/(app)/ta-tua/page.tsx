import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/rbac";
import { GameError, gameFrameUrl, memberSession } from "@/lib/petdex";
import { GameFrame } from "./game-frame";

export const metadata = { title: "Pet Town" };

// Pet Town: the Petdex Park game, signed in as the WorkHub member (the game account is created on
// the first visit). The game itself is a separate document in an iframe (public/ta-tua/game).
export default async function TaTuaPage() {
  const me = (await getCurrentUser())!;
  let src: string | null = null;
  let error: string | null = null;
  try {
    const session = await memberSession(me);
    src = gameFrameUrl(session.token);
  } catch (err) {
    error = err instanceof GameError ? err.message : "Máy chủ game gặp sự cố, thử lại sau.";
  }
  return <GameFrame src={src} error={error} admin={isAdmin(me)} />;
}
