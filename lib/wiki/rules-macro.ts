// Macro economy, Sở Công Thương and clan numbers the wiki cannot import, because they sit as literals
// inside modules that open the game database (petdex/server/macro.js, clans.js, commerce.js).
// tests/petfarm-wiki-sync-macro.test.ts runs those modules on an in-memory database and fails when a
// number or formula here no longer matches the game: fix it here and the articles follow.
import { PHASES, WEATHER, clanPerks, competitionFactor, designBonus, designComplete, envFactor, weatherFactor } from "@/public/ta-tua/game/js/shared/clan.js";
import { ESSENTIALS, MARKET_RULES } from "@/public/ta-tua/game/js/shared/industry.js";
import { CLAN } from "./rules";

/** petdex/server/macro.js rollMacro and write. */
export const MACRO = {
  /** GDP growth shown on the Vĩ mô tab, by phase (display only). */
  gdp: { recovery: 0.025, boom: 0.07, peak: 0.04, recession: -0.03 } as Record<string, number>,
  demand: {
    /** Each day the gap to 100% shrinks to this share... */
    keep: 0.85,
    /** ...plus a random step with this standard deviation. */
    noise: 0.03,
    /** Daily chance of a demand shock, per industry. */
    shockChance: 0.04,
    shockMin: 0.1,
    shockMax: 0.2,
    min: 0.7,
    max: 1.35,
    /** A shock moves the Sàn price of the industry's goods by this share of the shock. */
    newsShare: 0.5,
  },
  land: {
    /** The land index drifts by phase minus (base rate − neutralRate) × rateWeight each day. */
    neutralRate: 0.003,
    rateWeight: 2,
    min: 0.6,
    max: 1.8,
  },
};

/** petdex/server/clans.js: clan XP and the industry cap. */
export const CLAN_XP = {
  minDonation: 10,
  /** 1 XP for every `perDonation` xu donated. */
  perDonation: 10,
  /** 1 XP for every `perRevenue` xu of nightly revenue after tax. */
  perRevenue: 100,
  /** An unpaid upkeep costs 1 XP for every `perUpkeep` xu. */
  perUpkeep: 10,
  /** On Sunday night, 1 XP lost for every `perQuota` xu members are short of the weekly quota. */
  perQuota: 10,
  maxIndustries: 3,
  /** Strategic industries always cost their base compensation (no ×expandMultiplier). */
  strategicMultiplied: false,
} as const;

type Plot = { zone: string; climate?: string; basePrice: number; prod: number };
type Piece = { piece: string };

/**
 * Nightly revenue of a service plot with the default clan settings (petdex/server/clans.js plotRevenue):
 * plot price × yield × speed × land fit × weather × phase × demand × competition × clan level × building.
 */
export function servicePlotRevenue(plot: Plot, o: { industry: string; design: Piece[]; level: number; phase: string; weather: string; demand: number; clans: number }) {
  const f = {
    base: Math.round(plot.basePrice * CLAN.land.yieldRate),
    prod: 1 + plot.prod,
    env: envFactor(o.industry, plot.zone, plot.climate) as number,
    weather: weatherFactor(o.weather, plot.zone, plot.climate) as number,
    phase: (PHASES as Record<string, { factor: number }>)[o.phase].factor,
    demand: o.demand,
    competition: competitionFactor(o.clans) as number,
    level: 1 + (clanPerks(o.level) as { prodBonus: number }).prodBonus,
    building: 1 + (designBonus(o.design) as number),
  };
  const gross = Math.round(f.base * f.prod * f.env * f.weather * f.phase * f.demand * f.competition * f.level * f.building);
  return { factors: f, gross, revenue: designComplete(o.design) ? gross : 0 };
}

/**
 * Antitrust tax on one sale on the industrial market (petdex/server/commerce.js antitrustTax): `before` is what
 * the seller and everyone sold of that good to other clans in the last 7 days, before this sale.
 */
export function antitrustTax(before: { total: number; mine: number }, qty: number, price: number) {
  const total = before.total + qty;
  const mine = before.mine + qty;
  const share = total ? mine / total : 0;
  if (total < MARKET_RULES.antitrustMinVolume || share <= MARKET_RULES.antitrustShare) return { tax: 0, taxedQty: 0, share };
  const taxedQty = Math.min(qty, Math.ceil(mine - MARKET_RULES.antitrustShare * total));
  return { tax: Math.round(taxedQty * price * MARKET_RULES.antitrustRate), taxedQty, share };
}

/** Units a clan may still buy of one good in 24 hours (petdex/server/commerce.js buyCapLeft). */
export function buyCapLeft(listedByOthers: number, boughtIn24h: number) {
  const cap = Math.max(MARKET_RULES.buyCapMin, Math.floor((listedByOthers + boughtIn24h) * MARKET_RULES.buyCapShare));
  return Math.max(0, cap - boughtIn24h);
}

/** Chance of each weather, from its weight (petdex/server/macro.js pickWeighted). */
export function weatherChance(id: string) {
  const all = Object.values(WEATHER as Record<string, { weight: number }>);
  return (WEATHER as Record<string, { weight: number }>)[id].weight / all.reduce((s, w) => s + w.weight, 0);
}

/** Siêu thị's price of one clan meal or care set (petdex/server/essentials.js clanItemPrice). */
export function clanItemPrice(cat: "food" | "care", ref: number, quality = 0) {
  return Math.max(1, Math.ceil((ref / ESSENTIALS.cats[cat].perUnit) * ESSENTIALS.markup * ESSENTIALS.qualities[quality].mult));
}
