import type { Metadata } from "next";

// Pet Town addresses that both the server and the browser use (no server-only imports here, so
// middleware, client components and pages can all share them).

/** The game's own domain: invite links and the full-screen play page live there. */
export const PLAY_ORIGIN = (process.env.NEXT_PUBLIC_PETDEX_PLAY_ORIGIN || "https://play.petfarm.online").replace(/\/+$/, "");
export const PLAY_HOST = new URL(PLAY_ORIGIN).host;

/** Full-screen play page (members signed in, or guests with a saved session). */
export const PLAY_PATH = "/server1";
/** Invite links: /invitation/<code>. */
export const INVITE_PATH = "/invitation";

/** One-time links an administrator makes for a player to set a password: /password/<code>. */
export const PASSWORD_PATH = "/password";

export const inviteUrl = (code: string) => `${PLAY_ORIGIN}${INVITE_PATH}/${code}`;
export const passwordUrl = (code: string) => `${PLAY_ORIGIN}${PASSWORD_PATH}/${code}`;
export const playUrl = () => `${PLAY_ORIGIN}${PLAY_PATH}`;

/** What a shared play or invite link shows in a chat preview: the game's own name, nothing of WorkHub. */
export const PLAY_SITE_NAME = "Petfarm Server";
export const PLAY_TITLE = "Pet Town · Petfarm Server 1";
export const PLAY_DESCRIPTION = "Petfarm, có làm mới có ăn.";
export const playMetadata: Metadata = {
  title: { absolute: PLAY_TITLE },
  description: PLAY_DESCRIPTION,
  applicationName: PLAY_SITE_NAME,
  openGraph: { type: "website", siteName: PLAY_SITE_NAME, title: PLAY_TITLE, description: PLAY_DESCRIPTION, locale: "vi_VN" },
  twitter: { card: "summary", title: PLAY_TITLE, description: PLAY_DESCRIPTION },
};

/**
 * The game document shown in an iframe. Cloudflare serves the folder's index.html at the folder
 * path directly; `next dev` does not, so it keeps the file name there.
 */
export const GAME_PAGE = process.env.NODE_ENV === "production" ? "/ta-tua/game/" : "/ta-tua/game/index.html";

/** Where the browser keeps a play session: an invite guest or a name + password account (per site). */
export const GUEST_SESSION_KEY = "tatua.guest";
export interface GuestSession {
  token: string;
  name: string;
  /** The invite the guest came in with, to pick a different name later ("" for a password account). */
  code: string;
  /** "guest" | "player" | "member", as the game last reported it. */
  kind?: string;
  /** Whether the account can sign in with a name and password (reported by the game, not stored). */
  hasPassword?: boolean;
}

/** Game pages and what they need; on the game domain everything else of WorkHub is out of reach. */
const PLAY_HOST_PATHS = [PLAY_PATH, INVITE_PATH, PASSWORD_PATH, "/ta-tua/game", "/ta-tua/api", "/ta-tua/ws", "/ta-tua/khach", "/api/ta-tua/guest", "/api/ta-tua/account", "/login", "/api/auth", "/change-password"];

/**
 * On the game domain: where to send a request for a WorkHub page instead (null = serve it).
 * "/" and every page outside the game go to the play page.
 */
export function playHostRedirect(pathname: string): string | null {
  if (PLAY_HOST_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return PLAY_PATH;
}
