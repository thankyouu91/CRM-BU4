// Rules of the clan arena, the forge and the essentials shop that the wiki has to copy, because they
// live inside modules that open the game database (arena.js, forge.js, essentials.js). The rest of
// those systems is read straight from the game's shared modules. tests/petfarm-wiki-sync-arena.test.ts
// runs the game's own code on an in-memory database and fails when one of these stops matching.

import { ESSENTIALS } from "@/public/ta-tua/game/js/shared/industry.js";

export const ARENA_SERVER = {
  /** Share of the loser's penalty paid to the winner; the rest goes to the town budget (arena.js payPenalty). */
  winnerShare: 0.5,
  /** A clan may hold only this many strategic seats; a seat challenge is refused above it (arena.js challenge). */
  strategicSeats: 1,
} as const;

export const FORGE_SHOP = {
  /** Lots per purchase at Tiệm vật liệu (forge.js buyMaterials). */
  minLots: 1,
  maxLots: 50,
} as const;

export const ESSENTIALS_SHOP = {
  /** Each night the shop wants this many days of the players' share of demand in stock (essentials.js openShopBuying). */
  daysCovered: 1.5,
} as const;

type Cat = "food" | "care";
const cats = ESSENTIALS.cats as Record<Cat, { perPetDay: number; perUnit: number }>;
const stages = ESSENTIALS.stages as { key: string; from: number; npcBoost: number; npcSpare: number }[];

/** NPC items a player may buy per day (essentials.js npcAllowance, before today's purchases; new accounts have no limit). */
export function npcQuota(pets: number, cat: Cat, d: number): number {
  const { npcBoost, npcSpare } = stages.findLast((s) => d >= s.from)!;
  return Math.ceil(Math.max(1, pets) * cats[cat].perPetDay * Math.max(ESSENTIALS.npcFloor, 1 - d) * npcBoost) + npcSpare;
}

/** Retail price of one clan meal or care kit of grade `quality` when the reference price is `ref` (essentials.js clanItemPrice). */
export function clanItemPrice(cat: Cat, ref: number, quality = 0): number {
  const mult = (ESSENTIALS.qualities as { mult: number }[])[quality].mult;
  return Math.max(1, Math.ceil((ref / cats[cat].perUnit) * ESSENTIALS.markup * mult));
}
