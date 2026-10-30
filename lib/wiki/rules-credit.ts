// Credit, P2P and hụi numbers the wiki cannot import, because they sit as local constants inside
// modules that open the game database (petdex/server/credit.js, p2p.js, hui.js).
// tests/petfarm-wiki-sync-credit.test.ts runs those modules on an in-memory database and fails when
// a number here no longer matches the game: fix the number here and the articles follow.

/** Bank loans (petdex/server/credit.js MIN_LOAN, MAX_LOANS). */
export const BANK_LOAN = { min: 50, maxOpen: 2 } as const;

/**
 * Peer-to-peer loans (petdex/server/p2p.js): credit points for paying a loan off (Math.round(CREDIT.repaid / 3)).
 * A P2P default bans borrowing for LOANS.banDays, the same as a bank loan, so that number is imported, not copied.
 */
export const P2P_EXTRA = { repaidCredit: 10 } as const;

/** Hụi (petdex/server/hui.js MAX_GROUPS): groups a player, or a clan, may be in at once. */
export const HUI_EXTRA = { maxGroups: 3 } as const;
