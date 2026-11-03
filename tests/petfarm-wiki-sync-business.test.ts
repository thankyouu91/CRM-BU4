import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { FAIR, LAND_PRICE, PARK, PLANT, STALL } from "@/lib/wiki/rules-business";
import { customersPerHour, refPrice } from "@/petdex/server/rules/business.js";

// The tea stall, Khu công nghiệp, Chợ Phiên, Sở Nhà Đất and park articles copy a few numbers that live as
// literals in modules that open the game database. This test drives those modules on an in-memory database
// and fails as soon as the game stops matching lib/wiki/rules-business.ts, naming the number to update.

process.env.PETDEX_DB = ":memory:";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const T0 = Date.parse("2026-11-25T03:00:00Z"); // 10 giờ sáng thứ Tư, giờ Việt Nam (giờ thường, không cao điểm)

/* eslint-disable @typescript-eslint/no-explicit-any -- plain JS modules, loosely typed */
let store: any, ledger: any, game: any, business: any, jobs: any, market: any, factory: any, bazaar: any, clans: any, playground: any, hub: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

let seq = 0;
function newPlayer(money: number) {
  const name = `wiki_biz_${++seq}`;
  const id = store.createUser(name, "x", T0 - 10 * DAY) as number;
  ledger.post({ userId: id, delta: money, kind: "opening", now: T0 });
  const petId = store.insertPet(id, `Bé ${name}`, "test_pet", T0 - 45 * DAY) as number;
  store.savePet({ ...store.getPet(petId), level: 6, fullness: 95, energy: 100, updated_at: T0 });
  for (const skill of ["strength", "agility", "intellect", "charm", "craft"]) store.setSkill(petId, skill, 20);
  store.setActivePet(id, petId);
  const token = `tok-${name}`;
  store.createSession(token, id);
  return { id, petId, token };
}

beforeAll(async () => {
  store = await import("@/petdex/server/db.js");
  ledger = await import("@/petdex/server/ledger.js");
  game = await import("@/petdex/server/game.js");
  business = await import("@/petdex/server/business.js");
  jobs = await import("@/petdex/server/jobs.js");
  market = await import("@/petdex/server/market.js");
  factory = await import("@/petdex/server/factory.js");
  bazaar = await import("@/petdex/server/bazaar.js");
  clans = await import("@/petdex/server/clans.js");
  playground = await import("@/petdex/server/playground.js");
  hub = await import("@/petdex/server/hub.js");
  (await import("@/petdex/server/migrate.js")).migrate(T0);
});

describe("Petfarm wiki tea stall stays in step with the game (STALL)", () => {
  /** One hour of a stall at the Trung tâm with one pet on duty; returns the customers the game recorded. */
  function hourOfCustomers(charming: boolean, r: number) {
    const p = newPlayer(50_000);
    if (charming) store.db.prepare("UPDATE pets SET traits = ? WHERE id = ?").run(JSON.stringify(["charming"]), p.petId);
    business.openBusiness(p.id, { name: `Quầy ${p.id}`, location: "center" }, T0);
    for (const c of ["dried_tea", "milk", "pearl", "sugar"]) market.addGoods(p.id, c, 500, T0);
    const biz = business.businessOf(p.id);
    jobs.startShift(p.id, { petId: p.petId, hours: 1, businessId: biz.id }, T0);
    business.simulate(business.businessOf(p.id), T0 + HOUR, () => r);
    return store.db.prepare("SELECT customers FROM business_days WHERE business_id = ?").get(biz.id).customers as number;
  }
  const base = (bonus: number) => customersPerHour({ location: "center", hourVN: 10, reputation: 1, bonus, menuAppeal: 1 });

  it("multiplies each hour by the wiki's random range (STALL.noise)", () => {
    // Thực đơn khởi đầu bán đúng giá tham chiếu nên độ hấp dẫn là 1.
    expect(refPrice("boba_milk_tea")).toBeGreaterThan(0);
    expect(hourOfCustomers(false, 0), "STALL.noise[0]").toBe(Math.round(base(0) * STALL.noise[0]));
    expect(hourOfCustomers(false, 1 - 1e-12), "STALL.noise[1]").toBe(Math.round(base(0) * STALL.noise[1]));
  });

  it("caps menu prices and stall names like the game (STALL.maxPriceRatio, nameLength)", () => {
    const p = newPlayer(50_000);
    const open = (name: string) => () => business.openBusiness(p.id, { name, location: "alley" }, T0);
    expect(open("x".repeat(STALL.nameLength[0] - 1)), "STALL.nameLength[0]").toThrow(new RegExp(`${STALL.nameLength[0]}–${STALL.nameLength[1]} ký tự`));
    expect(open("x".repeat(STALL.nameLength[1] + 1)), "STALL.nameLength[1]").toThrow(new RegExp(`${STALL.nameLength[0]}–${STALL.nameLength[1]} ký tự`));
    open("x".repeat(STALL.nameLength[1]))();
    const max = business.businessView(p.id, T0).recipes.boba_milk_tea.ref * STALL.maxPriceRatio;
    expect(() => business.setMenu(p.id, [{ recipe: "boba_milk_tea", price: max }], T0)).not.toThrow();
    expect(() => business.setMenu(p.id, [{ recipe: "boba_milk_tea", price: max + 1 }], T0), "STALL.maxPriceRatio").toThrow(new RegExp(`từ 1 đến ${max} xu`));
  });

  it("adds the wiki's bonus for a charming pet on duty (STALL.charmingBonus)", () => {
    expect(hourOfCustomers(true, 0), "STALL.charmingBonus").toBe(Math.round(base(STALL.charmingBonus) * STALL.noise[0]));
  });
});

describe("Petfarm wiki factories stay in step with the game (PLANT)", () => {
  it("caps factories, workers and toll orders like the game", () => {
    const p = newPlayer(100_000);
    for (let i = 0; i < PLANT.maxFactories; i++) factory.buildFactory(p.id, "pearl_mill", T0);
    expect(() => factory.buildFactory(p.id, "pearl_mill", T0), "PLANT.maxFactories").toThrow(new RegExp(`tối đa ${PLANT.maxFactories} xưởng`));
    const f = factory.factoryView(p.id, T0).factories[0];
    const jobsAt = (slots: number) => () => factory.setFactoryJobs(p.id, f.id, { wage: 10, slots, open: true });
    expect(jobsAt(PLANT.workers[0] - 1), "PLANT.workers[0]").toThrow();
    expect(jobsAt(PLANT.workers[1] + 1), "PLANT.workers[1]").toThrow();
    expect(jobsAt(PLANT.workers[1])).not.toThrow();
    factory.setToll(p.id, f.id, { fee: 5, open: true }, T0);
    const other = newPlayer(10_000);
    const order = (n: number) => () => factory.orderToll(other.id, f.id, n, T0);
    expect(order(PLANT.tollBatches[0] - 1), "PLANT.tollBatches[0]").toThrow(new RegExp(`từ ${PLANT.tollBatches[0]} đến ${PLANT.tollBatches[1]}`));
    expect(order(PLANT.tollBatches[1] + 1), "PLANT.tollBatches[1]").toThrow(new RegExp(`từ ${PLANT.tollBatches[0]} đến ${PLANT.tollBatches[1]}`));
  });

  it("opens toll orders at the wiki's unlock (PLANT.tollUnlock)", () => {
    const src = readFileSync("petdex/server/routes-production.js", "utf8");
    expect(src, "PLANT.tollUnlock").toContain(`requireLevel(uid(req), UNLOCKS.${PLANT.tollUnlock}, 'Gia công')`);
  });
});

describe("Petfarm wiki Chợ Phiên stays in step with the game (FAIR)", () => {
  it("pays the wiki's share of the sale fee into the town budget (tea stall drinks can be listed too)", () => {
    const seller = newPlayer(1_000);
    const buyer = newPlayer(5_000);
    store.addItem(seller.id, "tea_boba_milk_tea", 1);
    bazaar.listForSale(seller.id, { kind: "item", ref: "tea_boba_milk_tea", price: 70 }, T0);
    const id = store.db.prepare("SELECT id FROM listings WHERE seller_id = ?").get(seller.id).id;
    const before = ledger.treasuryBalance();
    bazaar.buyListing(buyer.id, id, T0 + 1000);
    const fee = Math.round(70 * 0.05);
    expect(ledger.treasuryBalance() - before, "FAIR.saleFeeToTreasury").toBe(Math.floor(fee * FAIR.saleFeeToTreasury));
  });
});

describe("Petfarm wiki land prices stay in step with the game (LAND_PRICE)", () => {
  it("has the default scarcity and appreciation cap", () => {
    expect(clans.DEFAULT_CLAN_CONFIG.land.scarcityK, "LAND_PRICE.scarcityK").toBe(LAND_PRICE.scarcityK);
    expect(clans.DEFAULT_CLAN_CONFIG.land.maxAppreciation, "LAND_PRICE.maxAppreciation").toBe(LAND_PRICE.maxAppreciation);
  });
});

describe("Petfarm wiki park stays in step with the game (PARK)", () => {
  it("has the game's channel sizes", () => {
    expect(playground.ROOM_CAP, "PARK.channelCap").toBe(PARK.channelCap);
    expect(playground.MAX_ROOMS, "PARK.maxChannels").toBe(PARK.maxChannels);
    expect(playground.RESIDENTS_PER_ROOM, "PARK.residentsPerChannel").toBe(PARK.residentsPerChannel);
  });

  it("cuddles like the game", () => {
    const pet = { ...store.getPet(newPlayer(0).petId), happiness: 50 };
    const out = game.cuddle(pet);
    expect(out.xp, "PARK.cuddleXp").toBe(PARK.cuddleXp);
    expect(out.pet.happiness - 50, "PARK.cuddleHappiness").toBe(PARK.cuddleHappiness);

    const h = hub.createHub();
    playground.attachPlayground(h);
    const join = (who: { token: string }) => {
      const inbox: [string, { message?: string; notice?: string; selfId?: string; players?: { id: string; userId: number }[] }][] = [];
      const socket = h.connect({ send: (text: string) => inbox.push(JSON.parse(text)), close() {} }, { token: who.token });
      const send = (event: string, payload: unknown) => h.message(socket, JSON.stringify([event, payload ?? null]));
      send("pg:join", {});
      return { inbox, send, close: () => h.closed(socket) };
    };
    const a = newPlayer(0);
    const b = newPlayer(0);
    const ca = join(a);
    const cb = join(b);
    const bId = cb.inbox.find(([e]) => e === "pg:state")![1].selfId;
    ca.send("pg:cuddle", { targetId: bId });
    const notice = ca.inbox.filter(([e]) => e === "me:changed").map(([, p]) => p.notice).find((n) => n?.includes("thân nhau"));
    expect(notice, "PARK.cuddleCoins").toContain(`+${PARK.cuddleCoins} `);
    ca.send("pg:cuddle", { targetId: bId });
    const err = ca.inbox.filter(([e]) => e === "pg:error").at(-1)?.[1].message;
    expect(err, "PARK.cuddleCooldownSec").toContain(`${PARK.cuddleCooldownSec} giây`);
    ca.close();
    cb.close();
  });
});
