import { beforeAll, describe, expect, it } from "vitest";
import { CLAN, UNLOCKS } from "@/lib/wiki/rules";

// The wiki follows the game by itself where it can (its tables import the game's rules). The few
// numbers it has to copy live in lib/wiki/rules.ts; this test loads the game's own modules and
// fails as soon as one of them changes, naming the number to update.

process.env.PETDEX_DB = ":memory:";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- plain JS modules, loosely typed
let economy: any, clans: any;

beforeAll(async () => {
  economy = await import("@/petdex/server/routes-economy.js");
  clans = await import("@/petdex/server/clans.js");
});

describe("Petfarm wiki stays in step with the game", () => {
  it("has the game's unlock levels (lib/wiki/rules.ts UNLOCKS)", () => {
    expect(UNLOCKS).toEqual(economy.UNLOCKS);
  });

  it("has the game's default clan rules (lib/wiki/rules.ts CLAN)", () => {
    const d = clans.DEFAULT_CLAN_CONFIG;
    const { land, ...rest } = CLAN;
    for (const [key, value] of Object.entries(rest)) expect(d[key], `CLAN.${key}`).toEqual(value);
    for (const [key, value] of Object.entries(land)) expect(d.land[key], `CLAN.land.${key}`).toEqual(value);
  });
});
