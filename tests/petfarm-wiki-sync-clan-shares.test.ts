import { beforeAll, describe, expect, it } from "vitest";
import { getArticle } from "@/lib/wiki";
import { PLAYER_CAP, SHARES, SHARE_IPO_MAX, SHARE_POOL, buyCost, tradeFee } from "@/public/ta-tua/game/js/shared/clan-shares.js";

// The clan shares and takeover articles read every number from shared/clan-shares.js. This test runs the game's
// server code on an in-memory database and checks that the server enforces exactly those numbers.

process.env.PETDEX_DB = ":memory:";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const T0 = Date.parse("2026-12-02T03:00:00Z");

/* eslint-disable @typescript-eslint/no-explicit-any -- plain JS modules, loosely typed */
let store: any, ledger: any, clans: any, cb: any, sh: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

let n = 0;
function player() {
  n += 1;
  const id = store.createUser(`wsh${n}`, "x", T0 - 30 * DAY) as number;
  ledger.post({ userId: id, delta: 5_000_000, kind: "opening", now: T0 });
  const petId = store.insertPet(id, `Bé ${n}`, "test_pet", T0 - 20 * DAY);
  store.savePet({ ...store.getPet(petId), level: 8, updated_at: T0 });
  store.setActivePet(id, petId);
  return id;
}
function clan(name: string) {
  const leader = player();
  clans.createClan(leader, { name, emblem: "🏯", color: "#445566" }, T0);
  clans.donateClan(leader, 2_000_000, T0);
  return { leader, id: clans.clanView(leader, T0).clan.id as number };
}
const bal = (a: string) => store.db.prepare("SELECT balance FROM accounts WHERE id = ?").get(a)?.balance ?? 0;
const listing = (id: number) => store.db.prepare("SELECT * FROM clan_listings WHERE clan_id = ?").get(id);

let target: { leader: number; id: number };
let bank: { leader: number; id: number };
let price = 0;

beforeAll(async () => {
  store = await import("@/petdex/server/db.js");
  ledger = await import("@/petdex/server/ledger.js");
  clans = await import("@/petdex/server/clans.js");
  cb = await import("@/petdex/server/clan-bank.js");
  sh = await import("@/petdex/server/clan-shares.js");
  (await import("@/petdex/server/migrate.js")).migrate(T0);
  bank = clan("Wiki Môi Giới");
  store.db.prepare("INSERT INTO clan_industries (clan_id, industry, fee, entered_at) VALUES (?, 'state_bank', 0, ?)").run(bank.id, T0);
  cb.openBank(bank.leader, 1_000_000, T0);
  target = clan("Wiki Lên Sàn");
});

describe("Petfarm wiki stays in step with clan shares", () => {
  it("has the four sections in order, with 2–4 hints and no em dash", () => {
    for (const slug of ["co-phan-gia-toc", "thau-tom-gia-toc"]) {
      const a = getArticle(slug)!;
      expect(a, slug).toBeDefined();
      expect(a.sections.map((s) => s.title), slug).toEqual(["Đây là gì", "Chức năng", "Rủi ro", "Mẹo"]);
      const tips = a.sections[3].blocks.flatMap((b) => ("list" in b ? b.list : []));
      expect(tips.length, slug).toBeGreaterThanOrEqual(2);
      expect(tips.length, slug).toBeLessThanOrEqual(4);
      expect(JSON.stringify(a), slug).not.toContain("—");
    }
  });

  it("lists up to SHARES.ipoMax at SHARES.ipoBand × book, seeding SHARE_POOL shares", () => {
    const book = sh.bookValue(target.id, T0);
    expect(() => sh.startIpo(target.leader, { shares: SHARE_IPO_MAX + 1, price: Math.round(book) }, T0), "ipoMax").toThrow();
    expect(() => sh.startIpo(target.leader, { shares: SHARE_IPO_MAX, price: Math.round(book * SHARES.ipoBand[1]) + 1 }, T0), "ipoBand").toThrow();
    expect(() => sh.startIpo(target.leader, { shares: SHARE_IPO_MAX, price: Math.max(1, Math.round(book * SHARES.ipoBand[0])) - 1 }, T0), "ipoBand").toThrow();
    price = Math.round(book);
    sh.startIpo(target.leader, { shares: SHARE_IPO_MAX, price }, T0);
    expect(listing(target.id).pool_shares, "poolShare").toBe(SHARE_POOL);
    expect(listing(target.id).closes_at - T0, "subscribeHours").toBe(SHARES.subscribeHours * HOUR);
  });

  it("caps a player at PLAYER_CAP, charges SHARES.underwriteFee, underwrites at SHARES.underwritePrice", () => {
    const p = player();
    const broker = bal(`bank:${bank.id}`);
    sh.subscribeIpo(p, target.id, PLAYER_CAP, T0 + HOUR);
    expect(bal(`bank:${bank.id}`) - broker, "underwriteFee").toBe(Math.ceil(PLAYER_CAP * price * SHARES.underwriteFee));
    expect(() => sh.subscribeIpo(p, target.id, 1, T0 + HOUR), "playerCap").toThrow();
    const fund = bal(`clan:${target.id}`);
    sh.closeIpos(T0 + SHARES.subscribeHours * HOUR);
    const unsold = SHARE_IPO_MAX - PLAYER_CAP;
    expect(bal(`clan:${target.id}`) - fund, "underwritePrice").toBe(Math.ceil(unsold * price * SHARES.underwritePrice));
  });

  it("charges SHARES.fee per trade and refuses trades past SHARES.band", () => {
    const now = T0 + 2 * DAY;
    const p = player();
    const coins = store.getUser(p).coins;
    const cost = buyCost(bal(`shares_pool:${target.id}`), listing(target.id).pool_shares, 1);
    sh.buyShares(p, target.id, 1, {}, now);
    expect(coins - store.getUser(p).coins, "fee").toBe(cost + tradeFee(cost));
    // The largest buy within the band succeeds, one more share does not.
    const ref = listing(target.id).ref_price;
    let ok = 0;
    for (let q = 1; q < SHARE_POOL; q++) {
      const c = bal(`shares_pool:${target.id}`);
      const s = listing(target.id).pool_shares;
      if ((c + buyCost(c, s, q)) / (s - q) > ref * (1 + SHARES.band)) break;
      ok = q;
    }
    expect(() => sh.buyShares(p, target.id, ok + 1, {}, now), "band").toThrow(/biên/);
  });

  it("uses SHARES.margin.maxLtv for margin loans", () => {
    const now = T0 + 3 * DAY;
    const p = player();
    const cost = buyCost(bal(`shares_pool:${target.id}`), listing(target.id).pool_shares, 2);
    sh.buyShares(p, target.id, 2, { margin: true }, now);
    const m = store.db.prepare("SELECT * FROM clan_margin_loans ORDER BY id DESC LIMIT 1").get();
    expect(m.owed, "margin.maxLtv").toBe(Math.floor(cost * SHARES.margin.maxLtv));
  });
});
