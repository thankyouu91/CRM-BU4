// Business numbers the wiki cannot import, because they sit as literals inside modules that open the
// game database (petdex/server/business.js, factory.js, bazaar.js, clans.js, playground.js, routes-production.js).
// tests/petfarm-wiki-sync-business.test.ts drives those modules on an in-memory database and fails when
// a number here no longer matches the game: fix it here and the articles follow.

/** petdex/server/business.js simulate(): the tea stall's hourly customers. */
export const STALL = {
  /** A pet with the "Có duyên" trait on duty brings this many more customers. */
  charmingBonus: 0.1,
  /** Each hour's customers are multiplied by a random factor in this range. */
  noise: [0.85, 1.15] as const,
  /** setMenu(): a menu price goes from 1 xu up to this many times the reference price. */
  maxPriceRatio: 3,
  /** openBusiness(): length of the stall's name. */
  nameLength: [2, 24] as const,
};

/** petdex/server/factory.js and routes-production.js: personal factories. */
export const PLANT = {
  maxFactories: 2,
  /** Hired workers per factory job post. */
  workers: [1, 3] as const,
  /** Batches in one toll order. */
  tollBatches: [1, 100] as const,
  /** Toll orders open at this UNLOCKS key (the level of the Sàn), not at the factory's level. */
  tollUnlock: "market" as const,
};

/** petdex/server/bazaar.js and auction.js: the share of the sale fee paid into the town budget (the rest disappears). */
export const FAIR = { saleFeeToTreasury: 0.5 };

/** petdex/server/clans.js DEFAULT_CLAN_CONFIG.land: land prices (administrators can change them in the game). */
export const LAND_PRICE = {
  /** Price of a free lot = base × (1 + scarcityK × share of lots sold^2,5) × land index. */
  scarcityK: 2,
  /** A bought lot's value grows by its own monthly rate, at most this many times the price paid. */
  maxAppreciation: 3,
};

/** petdex/server/playground.js and game.js cuddle(): the park. */
export const PARK = {
  /** Online players per channel. */
  channelCap: 60,
  maxChannels: 40,
  /** Pets of absent players standing in each channel. */
  residentsPerChannel: 20,
  cuddleHappiness: 6,
  cuddleXp: 5,
  /** Coins for the player who cuddles. */
  cuddleCoins: 3,
  /** Seconds between two cuddles of the same pair. */
  cuddleCooldownSec: 30,
};
