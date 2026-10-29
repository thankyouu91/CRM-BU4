import { beforeAll, describe, expect, it } from "vitest";

// The park keeps every player whose pet is alive on the lawn, online or not ("residents"),
// so it never looks empty. Runs the real game modules on an in-memory SQLite database.

process.env.PETDEX_DB = ":memory:";

type Json = Record<string, unknown>;
type Frame = [string, Json];
type Hub = {
  connect(t: { send(text: string): void; close(): void }, auth: Json): { id: string } | null;
  message(socket: unknown, text: string): void;
  closed(socket: unknown): void;
};

let hub: Hub;
let store: Record<string, (...args: unknown[]) => unknown>;
let bus: { emit(event: string, ...args: unknown[]): void };
let internal: (method: string, path: string, body?: unknown) => Promise<Json>;
let game: (method: string, path: string, token: string, body?: unknown) => Promise<Json>;

async function player(crmUserId: string, name: string, adopt = true) {
  const sso = await internal("POST", "/sso", { crmUserId, name });
  if (adopt) {
    const catalog = await game("GET", "/catalog", "");
    const species = (catalog.species as Json[]).find((s) => s.adoptable && !s.mascot) as Json;
    await game("POST", "/pets", sso.token as string, { name: `Bé ${name}`, species: species.id });
  }
  return { token: sso.token as string, userId: sso.userId as number };
}

function connect(token: string) {
  const sent: Frame[] = [];
  const socket = hub.connect({ send: (text) => sent.push(JSON.parse(text)), close: () => {} }, { token })!;
  const emit = (event: string, payload: Json = {}) => hub.message(socket, JSON.stringify([event, payload]));
  const last = (event: string) => [...sent].reverse().find(([e]) => e === event)?.[1];
  return { socket, sent, emit, last, leave: () => hub.closed(socket) };
}

beforeAll(async () => {
  const { handleFetch } = await import("@/petdex/server/router.js");
  const { internalApi } = await import("@/petdex/server/internal.js");
  const { api } = await import("@/petdex/server/routes.js");
  const { createHub } = await import("@/petdex/server/hub.js");
  const { attachPlayground } = await import("@/petdex/server/playground.js");
  store = (await import("@/petdex/server/db.js")) as unknown as typeof store;
  ({ bus } = await import("@/petdex/server/events.js"));
  (await import("@/petdex/server/migrate.js")).migrate();
  (await import("@/petdex/server/scheduler.js")).runDue();
  const call = async (router: unknown, prefix: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await handleFetch(router, new Request(`http://x${prefix}${path}`, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), { prefix });
    return (await res.json()) as Json;
  };
  internal = (method, path, body) => call(internalApi, "/internal", method, path, body);
  game = (method, path, token, body) => call(api, "/api", method, path, body, token ? { authorization: `Bearer ${token}` } : {});
  hub = createHub() as Hub;
  attachPlayground(hub);
});

describe("Tà tưa park residents", () => {
  it("shows every player with a living pet, online or not, and swaps them as they come and go", async () => {
    const an = await player("p-an", "An");
    const binh = await player("p-binh", "Bình");
    await player("p-chi", "Chi");
    await player("p-dung", "Dũng", false); // no pet: not in the park
    const banned = await player("p-em", "Em");
    await internal("POST", `/admin/players/${banned.userId}/status`, { banned: true, actor: "Admin" });

    const a = connect(an.token);
    a.emit("pg:join");
    const state = a.last("pg:state")!;
    const everyone = state.players as Json[];
    const names = everyone.map((p) => `${p.username}${p.offline ? ":away" : ""}`).sort();
    expect(names).toEqual(["An", "Bình:away", "Chi:away"]); // display names; no pet and banned left out
    const binhResident = everyone.find((p) => p.userId === binh.userId)!;
    expect(binhResident.id).toBe(`r${binh.userId}`);

    // Bình comes online: everyone else is told, and their client drops the resident card.
    const b = connect(binh.token);
    b.emit("pg:join");
    const joined = a.last("pg:joined")!;
    expect(joined).toMatchObject({ userId: binh.userId, username: "Bình", offline: false });
    expect((b.last("pg:state")!.players as Json[]).filter((p) => p.userId === binh.userId)).toHaveLength(1);

    // Bình leaves: the pet stays as a resident.
    b.leave();
    expect(a.last("pg:left")).toMatchObject({ id: joined.id });
    expect(a.last("pg:player")).toMatchObject({ id: `r${binh.userId}`, offline: true, quiet: true });
    a.leave();
  });

  it("can cuddle and gift a resident whose owner is away", async () => {
    const giang = await player("p-giang", "Giang");
    const hoa = await player("p-hoa", "Hoa");
    const g = connect(giang.token);
    g.emit("pg:join");
    g.emit("pg:cuddle", { targetId: `r${hoa.userId}` });
    expect(g.last("pg:fx")).toMatchObject({ to: `r${hoa.userId}`, kind: "cuddle" });
    expect(g.last("pg:error")).toBeUndefined();
    g.emit("pg:cuddle", { targetId: "r999999" });
    expect(g.last("pg:error")).toMatchObject({ message: "Bé này vừa rời công viên." });
    g.leave();
  });

  it("drops a resident whose pet died", async () => {
    const khoa = await player("p-khoa", "Khoa");
    const lan = await player("p-lan", "Lan");
    const l = connect(lan.token);
    l.emit("pg:join");
    expect((l.last("pg:state")!.players as Json[]).some((p) => p.userId === khoa.userId)).toBe(true);
    // what the midnight life settlement does when the last pet passes away
    store.setActivePet(khoa.userId, null);
    bus.emit("pet:changed", khoa.userId);
    expect(l.last("pg:left")).toMatchObject({ id: `r${khoa.userId}`, quiet: true });
    l.leave();
    const m = connect(lan.token);
    m.emit("pg:join");
    expect((m.last("pg:state")!.players as Json[]).some((p) => p.userId === khoa.userId)).toBe(false);
    m.leave();
  });
});
