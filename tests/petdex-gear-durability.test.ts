import { beforeAll, describe, expect, it } from "vitest";

// Gear durability: after a clan arena battle every piece the participants wear breaks and gives no bonus
// until it is repaired at the Lò rèn. Runs the real game modules on an in-memory SQLite.

process.env.PETDEX_DB = ":memory:";

type Json = Record<string, unknown>;
let internalApi: unknown;
let api: unknown;
let handleFetch: (router: unknown, request: Request, opts: { prefix: string }) => Promise<Response>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- plain JS module, loosely typed
let gearMod: any;
let store: { getPet(id: number): Json; gearBonusOf(id: number, now?: number): Json };

const call = async (router: unknown, prefix: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await handleFetch(router, new Request(`http://x${prefix}${path}`, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), { prefix });
  return { status: res.status, data: (await res.json()) as Json };
};
const internal = (method: string, path: string, body?: unknown) => call(internalApi, "/internal", method, path, body);
const game = (method: string, path: string, token: string, body?: unknown) => call(api, "/api", method, path, body, { authorization: `Bearer ${token}` });

async function player(name: string, coins = 5000) {
  const reg = await internal("POST", "/account/register", { username: name, password: "abcdef1" });
  const userId = reg.data.userId as number;
  if (coins) await internal("POST", `/admin/players/${userId}/coins`, { delta: coins, actor: "Admin" });
  const catalog = await call(api, "/api", "GET", "/catalog");
  const species = (catalog.data.species as Json[]).find((s) => s.adoptable && !s.mascot) as Json;
  const adopted = await game("POST", "/pets", reg.data.token as string, { name: `Bé ${name}`.slice(0, 16), species: species.id });
  const pet = (adopted.data.pets as Json[])[0] as Json;
  return { token: reg.data.token as string, userId, petId: pet.id as number };
}

/** A worn piece with known lines, made directly so the test does not depend on shop rolls. */
async function wornPiece(p: { token: string; userId: number; petId: number }, itemId = "bow", tier = "gold", affixes: Record<string, number> = { income: 10, stats: 8, trade: 6 }) {
  const g = gearMod.createGear(p.userId, itemId, { tier, affixes, source: "test" }) as Json;
  expect((await game("POST", `/pets/${p.petId}/equip`, p.token, { gearId: g.id })).status).toBe(200);
  return g;
}

beforeAll(async () => {
  ({ internalApi } = await import("@/petdex/server/internal.js"));
  ({ api } = await import("@/petdex/server/routes.js"));
  ({ handleFetch } = await import("@/petdex/server/router.js"));
  gearMod = await import("@/petdex/server/gear.js");
  store = (await import("@/petdex/server/db.js")) as unknown as typeof store;
  (await import("@/petdex/server/migrate.js")).migrate();
});

describe("Pet Town gear durability", () => {
  it("an arena battle breaks every worn piece of the participants: it stays on but gives no bonus", async () => {
    const a = await player("Dau_Si_A");
    const b = await player("Dau_Si_B");
    const bystander = await player("Dung_Xem");
    const ga = await wornPiece(a);
    const gb = await wornPiece(b, "bow", "blue", { income: 4 });
    const gc = await wornPiece(bystander, "bow", "blue", { income: 4 });
    const spare = gearMod.createGear(a.userId, "crown", { tier: "red", affixes: { income: 5, stats: 5, trade: 5, luck: 5 }, source: "test" }) as Json;
    expect(store.getPet(a.petId).bonus).toMatchObject({ income: 10, stats: 8, trade: 6 });

    expect(gearMod.breakWornGear([a.userId, b.userId, a.userId], Date.now())).toBe(2);
    expect(gearMod.breakWornGear([a.userId])).toBe(0); // already broken

    expect(store.getPet(a.petId).bonus).toEqual({ income: 0, stats: 0, trade: 0, luck: 0 });
    expect(store.getPet(b.petId).bonus).toEqual({ income: 0, stats: 0, trade: 0, luck: 0 });
    expect(store.getPet(bystander.petId).bonus).toMatchObject({ income: 4 });
    expect(gearMod.userBonus(a.userId)).toEqual({ income: 0, stats: 0, trade: 0, luck: 0 });

    const me = (await game("GET", "/me", a.token)).data;
    const pet = (me.pets as Json[]).find((x) => x.id === a.petId) as Json;
    expect(Object.values(pet.gear as Json)[0]).toMatchObject({ gearId: ga.id, broken: true, usable: false });
    const bag = me.gear as Json[];
    expect(bag.find((g) => g.id === ga.id)).toMatchObject({ broken: true, usable: false, wornBy: a.petId });
    expect(bag.find((g) => g.id === spare.id)).toMatchObject({ broken: false, usable: true }); // not worn, not broken
    expect(gb.id).not.toBe(gc.id);
  });
});
