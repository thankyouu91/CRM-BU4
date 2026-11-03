import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isWorkers } from "./prisma";
import { GAME_PAGE } from "./petdex-public";

// Pet Town: the Petdex game server (petdex/server). On Cloudflare it is the "park" Durable Object,
// reached through its binding, so its internal API is never on the network. In local development
// it is the Node server from `npm run petdex:dev` (port 3200), which asks for the dev key.

export const GAME_BASE = "/ta-tua";

/** The game answered with an error (its messages are Vietnamese and safe to show). */
export class GameError extends Error {
  constructor(
    message: string,
    public status: number,
    /** A machine-readable cause the game adds to some refusals (e.g. "no_password"). */
    public reason?: string,
  ) {
    super(message);
  }
}

interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

const devOrigin = () => process.env.PETDEX_URL ?? "http://127.0.0.1:3200";

/** Raw call to the game's internal API, e.g. gameFetch("/internal/admin/overview"). */
export async function gameFetch(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<Response> {
  const method = init.method ?? (init.body === undefined ? "GET" : "POST");
  const body = init.body === undefined ? undefined : JSON.stringify(init.body);
  if (isWorkers) {
    const env = getCloudflareContext().env as unknown as { PETDEX?: DurableObjectNamespaceLike };
    if (!env.PETDEX) throw new GameError("Pet Town chưa được bật trên máy chủ này.", 503);
    const stub = env.PETDEX.get(env.PETDEX.idFromName("park"));
    return stub.fetch(new Request(`https://petdex.internal${path}`, { method, headers: { "content-type": "application/json" }, body }));
  }
  try {
    return await fetch(`${devOrigin()}${path}`, {
      method,
      headers: { "content-type": "application/json", "x-petdex-internal": process.env.PETDEX_INTERNAL_KEY ?? "dev" },
      body,
      cache: "no-store",
    });
  } catch {
    throw new GameError("Máy chủ game chưa chạy (npm run petdex:dev).", 503);
  }
}

/** JSON call that throws GameError with the game's message when it refuses. */
export async function gameJson<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const res = await gameFetch(path, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; reason?: string };
  if (!res.ok) throw new GameError(data.error ?? "Máy chủ game gặp sự cố.", res.status, data.reason);
  return data;
}

export interface GameSession {
  token: string;
  userId: number;
  username: string;
}

/** A play session for a signed-in WorkHub member (the game account is created on first visit). */
export function memberSession(user: { id: string; name: string }): Promise<GameSession & { created: boolean }> {
  return gameJson(`/internal/sso`, { body: { crmUserId: user.id, name: user.name } });
}

/** Where the iframe points: the token travels in the fragment, which never reaches a server log. */
/** The game page for a WorkHub member's session (signs out in WorkHub, so the game hides its own sign-out). */
export function gameFrameUrl(token: string): string {
  const params = new URLSearchParams({ token, who: "member" });
  // `next dev` cannot proxy WebSockets, so the park connects to the game server directly.
  if (!isWorkers && process.env.NODE_ENV !== "production") params.set("ws", `${devOrigin().replace(/^http/, "ws")}${GAME_BASE}/ws`);
  return `${GAME_PAGE}#${params.toString()}`;
}
