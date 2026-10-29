// Pet Town addresses that both the server and the browser use (no server-only imports here, so
// middleware, client components and pages can all share them).

/** The game's own domain: invite links and the full-screen play page live there. */
export const PLAY_ORIGIN = (process.env.NEXT_PUBLIC_PETDEX_PLAY_ORIGIN || "https://play.petfarm.online").replace(/\/+$/, "");
export const PLAY_HOST = new URL(PLAY_ORIGIN).host;

/** Full-screen play page (members signed in, or guests with a saved session). */
export const PLAY_PATH = "/server1";
/** Invite links: /invitation/<code>. */
export const INVITE_PATH = "/invitation";

export const inviteUrl = (code: string) => `${PLAY_ORIGIN}${INVITE_PATH}/${code}`;
export const playUrl = () => `${PLAY_ORIGIN}${PLAY_PATH}`;

/**
 * The game document shown in an iframe. Cloudflare serves the folder's index.html at the folder
 * path directly; `next dev` does not, so it keeps the file name there.
 */
export const GAME_PAGE = process.env.NODE_ENV === "production" ? "/ta-tua/game/" : "/ta-tua/game/index.html";

/** Where the browser keeps a guest's play session (per site: the game domain has its own). */
export const GUEST_SESSION_KEY = "tatua.guest";
export interface GuestSession {
  token: string;
  name: string;
  /** The invite the guest came in with, to pick a different name later. */
  code: string;
}

/** Game pages and what they need; on the game domain everything else of WorkHub is out of reach. */
const PLAY_HOST_PATHS = [PLAY_PATH, INVITE_PATH, "/ta-tua/game", "/ta-tua/api", "/ta-tua/ws", "/ta-tua/khach", "/api/ta-tua/guest", "/login", "/api/auth", "/change-password"];

/**
 * On the game domain: where to send a request for a WorkHub page instead (null = serve it).
 * "/" and every page outside the game go to the play page.
 */
export function playHostRedirect(pathname: string): string | null {
  if (PLAY_HOST_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return PLAY_PATH;
}
