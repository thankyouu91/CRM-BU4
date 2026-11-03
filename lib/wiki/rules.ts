// Game numbers the wiki cannot import directly, because the modules that hold them also open the
// game database (routes-economy.js, clans.js). tests/petfarm-wiki-sync.test.ts loads those modules
// on an in-memory database and fails when a number here no longer matches the game, so a rule
// change cannot ship with a stale wiki: fix the number here and the articles follow.

/** Level of the best pet needed to open each place (petdex/server/routes-economy.js UNLOCKS). */
export const UNLOCKS = {
  market: 2, school: 1, garden: 2, bank: 3, townhall: 3, guild: 3, kitchen: 3, business: 4, bazaar: 4, factory: 6, contracts: 6, advanced: 8,
} as const;

/** Clan defaults (petdex/server/clans.js DEFAULT_CLAN_CONFIG); administrators can change them in the game. */
export const CLAN = {
  createCost: 3_000,
  unlockLevel: 4,
  industryLevels: [1, 3, 5],
  expandMultiplier: 4,
  exitShare: 0.8,
  baseTax: 0.35,
  extraTaxPerIndustry: 0.025,
  refundRate: 0.15,
  donationQuotaPerLevel: 300,
  upkeepPerLevel: 80,
  upkeepPerPlot: 200,
  land: { resaleRate: 0.85, treasuryShare: 0.2, yieldRate: 0.006 },
} as const;
