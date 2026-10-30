import { ITEMS } from "@/petdex/server/game.js";
import { CAREERS, RANK_TITLES, PROMOTION, SKILLS } from "@/petdex/server/rules/careers.js";
import { COMMODITIES } from "@/petdex/server/rules/market.js";
import { LOCATIONS, RECIPES, refPrice } from "@/petdex/server/rules/business.js";
import { CLASSES, CROPS, DISHES, FACTORIES, TIERS as CREDIT_TIERS } from "@/petdex/server/rules/production.js";
import { PROPOSALS, QUESTS, GUILD_PROJECTS } from "@/petdex/server/rules/town.js";
import { ELEMENTS, LEVEL_FORMS, LIFE_STAGES, RARITIES, SLOTS, SPECIES, MASCOTS, WEARABLES } from "@/public/ta-tua/game/js/shared/pets.js";
import { DEFAULT_GEAR_CONFIG, TIERS, TIER_ORDER, TIER_VALUE } from "@/public/ta-tua/game/js/shared/gear.js";
import { FISH } from "@/public/ta-tua/game/js/shared/minigames.js";
import { CLAN_LEVELS, CLIMATES, INDUSTRIES, PHASES, WEATHER, ZONES, clanPerks, DESIGN, LAND } from "@/public/ta-tua/game/js/shared/clan.js";
import { GOODS, MARKET_RULES, SECTORS } from "@/public/ta-tua/game/js/shared/industry.js";
import { FRESHNESS } from "@/petdex/server/rules/market.js";
import { UNLOCKS } from "./rules";

// Tables of the wiki read straight from the game's own rules (petdex/server/rules, the game's
// shared modules), so prices, odds and names stay in step with the game. Prices are base prices:
// the Central Bank's price index multiplies shop, clinic, school and licence prices every week.

type Row = (string | number)[];
type Named = { name: string; icon?: string };
const el = (id: string | null | undefined) => (id ? `${(ELEMENTS as Record<string, Named>)[id].icon} ${(ELEMENTS as Record<string, Named>)[id].name}` : "");
const goods = COMMODITIES as Record<string, Named & { kind: string; base: number; shelfDays?: number; inputs?: Record<string, number> }>;
const good = (id: string) => `${goods[id].icon} ${goods[id].name}`;
const inputs = (m: Record<string, number>, unit = "") => Object.entries(m).map(([id, n]) => `${good(id)} ×${n}${unit}`).join(", ");
const EFFECT: Record<string, string> = { fullness: "No bụng", happiness: "Vui vẻ", energy: "Năng lượng", hygiene: "Sạch sẽ", health: "Sức khỏe" };
const effects = (e: Record<string, number> = {}) => Object.entries(e).map(([k, v]) => `${EFFECT[k]} +${v}`).join(", ");

type Item = { id: string; name: string; icon: string; type: string; element?: string; price: number; minLevel?: number; xp?: number; slot?: string; effect?: Record<string, number>; play?: { happiness: number; xp: number } };
const items = Object.values(ITEMS as Record<string, Item>);

export const foodRows = (): Row[] =>
  items.filter((i) => i.type === "food" || i.type === "care").map((i) => [`${i.icon} ${i.name}`, i.type === "food" ? "Đồ ăn" : "Chăm sóc", el(i.element), i.price, effects(i.effect), i.xp ?? 0, i.minLevel ?? 1]);

export const toyRows = (): Row[] => items.filter((i) => i.type === "toy").map((i) => [`${i.icon} ${i.name}`, i.price, `Vui vẻ +${i.play!.happiness}, +${i.play!.xp} XP mỗi lần chơi`, i.minLevel ?? 1]);

const slots = SLOTS as Record<string, Named>;
export const SLOT_ORDER = Object.keys(slots);
export const slotName = (id: string) => `${slots[id].icon} ${slots[id].name}`;
export const wearRows = (slot: string): Row[] =>
  items.filter((i) => i.type === "accessory" && i.slot === slot).sort((a, b) => (a.minLevel ?? 1) - (b.minLevel ?? 1) || a.price - b.price).map((i) => [`${i.icon} ${i.name}`, el(i.element), i.price, i.minLevel ?? 1]);
export const WEARABLE_COUNT = Object.keys(WEARABLES).length;

/** For each element, the slots it has a piece for (a full set needs head, face, neck and back). */
export const setRows = (): Row[] =>
  Object.keys(ELEMENTS).map((e) => [el(e), ...["head", "face", "neck", "back", "charm"].map((s) => items.filter((i) => i.type === "accessory" && i.slot === s && i.element === e).map((i) => i.name).join(", "))]);

const tiers = TIERS as Record<string, { name: string; lines: number }>;
const config = DEFAULT_GEAR_CONFIG as { odds: Record<string, number>; ranges: Record<string, { income: number[] }>; materialChance: number; materialQty: number[]; gearDropChance: number };
export const GEAR = config;
export const tierRows = (): Row[] =>
  (TIER_ORDER as string[]).map((t) => [tiers[t].name, tiers[t].lines, `${config.odds[t]}%`, `${config.ranges[t].income[0]}–${config.ranges[t].income[1]}%`, `×${(TIER_VALUE as Record<string, number>)[t]}`]);

export const formRows = (): Row[] => (LEVEL_FORMS as { from: number; name: string; note: string }[]).map((f) => [f.from, f.name, f.note]);

type Species = { id: string; name: string; element: string; rarity: string };
const rarities = RARITIES as Record<string, { name: string; stars: number; skillSum: number; lifespan: number }>;
export const rarityRows = (): Row[] =>
  Object.values(rarities).map((r) => [`${"★".repeat(r.stars)} ${r.name}`, r.skillSum, r.lifespan ? `+${r.lifespan} tuần` : "—"]);
export const speciesRows = (): Row[] =>
  Object.keys(ELEMENTS).map((e) => [el(e), ...Object.keys(rarities).map((r) => (SPECIES as Species[]).filter((s) => s.element === e && s.rarity === r).map((s) => s.name).join(", "))]);
export const SPECIES_COUNT = (SPECIES as Species[]).length;
export const MASCOT = (MASCOTS as Species[])[0];

type ElementInfo = Named & { skills: Record<string, number>; perk: string; temper: string; feeds: string; beats: string };
const elements = ELEMENTS as Record<string, ElementInfo>;
const skills = SKILLS as Record<string, Named>;
export const elementRows = (): Row[] =>
  Object.keys(elements).map((e) => [el(e), Object.entries(elements[e].skills).map(([s, x]) => `${skills[s].name} ×${String(x).replace(".", ",")}`).join(", "), elements[e].perk, elements[e].temper]);
export const relationRows = (): Row[] =>
  Object.keys(elements).map((e) => {
    const feeder = Object.keys(elements).find((x) => elements[x].feeds === e)!;
    const beater = Object.keys(elements).find((x) => elements[x].beats === e)!;
    return [el(e), el(feeder), el(e), el(beater)];
  });

export const stageRows = (): Row[] =>
  (LIFE_STAGES as { name: string; fromWeek: number; rules: { maxHours: number; work: number; xp: number; sickness: number }; note: string }[]).map((s) => [
    s.name, s.fromWeek, s.rules.maxHours, `${Math.round(s.rules.work * 100)}%`, `×${String(s.rules.xp).replace(".", ",")}`, s.note,
  ]);

type Career = Named & { skill: string; pay: number[]; tips?: number };
export const careerRows = (): Row[] =>
  Object.values(CAREERS as Record<string, Career>).map((c) => [`${c.icon} ${c.name}`, `${skills[c.skill].icon} ${skills[c.skill].name}`, c.pay.join(" / "), c.tips ? `Boa thêm 0–${c.tips * 100}% lương` : ""]);
export const RANKS = RANK_TITLES as string[];
export const promotionRows = (): Row[] =>
  (PROMOTION as { hours: number; skill: number }[]).map((p, i) => [`${RANKS[i]} → ${RANKS[i + 1]}`, `${p.hours} giờ`, p.skill]);

export const classRows = (): Row[] => Object.entries(CLASSES as Record<string, Named & { cost: number }>).map(([s, c]) => [`${c.icon} ${c.name}`, skills[s].name, c.cost]);

type Fish = { name: string; portions: number; coins: number };
export const fishRows = (): Row[] => (FISH as Fish[]).map((f) => [f.name, f.portions, f.coins]);

type Quest = { text: string; reward: number; level?: number; needs?: string };
const QUEST_NEEDS: Record<string, string> = { friend: "Có bạn bè", guild: "Đã vào Hội", business: "Có quầy trà sữa" };
export const questRows = (): Row[] =>
  Object.values(QUESTS as Record<string, Quest>).map((q) => [q.text, q.reward, q.level ? `Cấp ${q.level}` : q.needs ? QUEST_NEEDS[q.needs] : ""]);

export const commodityRows = (): Row[] =>
  Object.keys(goods).map((id) => [good(id), goods[id].kind === "raw" ? "Thô" : "Chế biến", goods[id].base, goods[id].shelfDays ? `${goods[id].shelfDays} ngày` : "Không hư", goods[id].inputs ? inputs(goods[id].inputs!, " lô") : ""]);

export const cropRows = (): Row[] =>
  Object.values(CROPS as Record<string, Named & { commodity: string; hours: number; seed: number; yield: number[] }>).map((c) => [`${c.icon} ${c.name}`, `${c.hours} giờ`, c.seed, `${c.yield[0]}–${c.yield[1]} phần`, good(c.commodity)]);

type Dish = Named & { element: string; inputs: Record<string, number>; effect: Record<string, number>; hidden?: boolean };
export const dishRows = (): Row[] =>
  Object.values(DISHES as Record<string, Dish>).filter((d) => !d.hidden).map((d) => [`${d.icon} ${d.name}`, el(d.element), inputs(d.inputs), effects(d.effect)]);
export const HIDDEN_DISHES = Object.values(DISHES as Record<string, Dish>).filter((d) => d.hidden).length;

export const factoryRows = (): Row[] =>
  Object.values(FACTORIES as Record<string, Named & { input: Record<string, number>; output: Record<string, number>; perHour: number; build: number }>).map((f) => [
    `${f.icon} ${f.name}`, `${inputs(f.input, " lô")} → ${inputs(f.output, " lô")}`, f.perHour, f.build,
  ]);

export const locationRows = (): Row[] =>
  Object.values(LOCATIONS as Record<string, Named & { license: number; rent: number; traffic: number; promo: number }>).map((l) => [`${l.icon} ${l.name}`, l.license, l.rent, l.traffic, l.promo]);
export const recipeRows = (): Row[] =>
  Object.entries(RECIPES as Record<string, Named & { inputs: Record<string, number> }>).map(([id, r]) => [`${r.icon} ${r.name}`, inputs(r.inputs), refPrice(id)]);

export const creditTierRows = (): Row[] =>
  (CREDIT_TIERS as (Named & { min: number; limit: number; premium: number })[]).map((t) => [`${t.icon} ${t.name}`, `${t.min}+`, t.limit, `${String(+(t.premium * 100).toFixed(2)).replace(".", ",")}%/ngày`]);

export const proposalRows = (): Row[] => Object.values(PROPOSALS as Record<string, Named & { desc: string; cost: number }>).map((p) => [`${p.icon} ${p.name}`, p.cost, p.desc]);
export const guildProjectRows = (): Row[] =>
  Object.values(GUILD_PROJECTS as Record<string, Named & { needs: Record<string, number>; prestige: number; reward: number }>).map((p) => [`${p.icon} ${p.name}`, inputs(p.needs, " lô"), p.prestige, `${p.reward} xu`]);

// ---------------------------------------------------------------- gia tộc, đất, vĩ mô


type Industry = Named & { sector: string; comp: number; recipe?: { in: Record<string, number>; out: Record<string, number> }; extracts?: string; plants?: Record<string, Named & { in: Record<string, number>; out: Record<string, number> }> };
const industries = INDUSTRIES as unknown as Record<string, Industry>;
const sectors = SECTORS as Record<string, Named>;
const goodsInd = GOODS as Record<string, Named>;
const goodList = (m: Record<string, number>) => Object.entries(m).map(([id, n]) => `${goodsInd[id]?.icon ?? ""} ${goodsInd[id]?.name ?? id} ×${n}`).join(", ");
const EXTRACTS: Record<string, string> = { mineral: "khoáng sản trong mỏ của lô", oilgas: "dầu, khí trong mỏ của lô", forest: "gỗ, cao su của lô", crop: "nông sản của lô", livestock: "gia súc của lô" };
const pct = (x: number) => `${x > 0 ? "+" : ""}${String(Math.round(x * 1000) / 10).replace(".", ",")}%`;

export const INDUSTRY_COUNT = Object.keys(industries).length;
export const SERVICE_COUNT = Object.values(industries).filter((i) => i.sector === "service").length;
export const sectorRows = (): Row[] =>
  Object.entries(sectors).map(([k, s]) => [`${s.icon} ${s.name}`, Object.values(industries).filter((i) => i.sector === k).map((i) => `${i.icon} ${i.name}`).join(", ")]);
export const industryRows = (sector: string): Row[] =>
  Object.values(industries).filter((i) => i.sector === sector).map((i) => [
    `${i.icon} ${i.name}`,
    i.comp,
    i.extracts ? `Khai thác ${EXTRACTS[i.extracts] ?? i.extracts}` : i.plants ? Object.values(i.plants).map((p) => `${p.icon} ${p.name}`).join(", ") : i.recipe ? `${goodList(i.recipe.in)} → ${goodList(i.recipe.out)}` : "Doanh thu bằng xu mỗi đêm",
  ]);
export const clanLevelRows = (): Row[] =>
  (CLAN_LEVELS as number[]).map((xp, i) => {
    const p = clanPerks(i + 1) as { maxMembers: number; maxPlots: number; maxIndustries: number; prodBonus: number };
    return [i + 1, xp, p.maxMembers, p.maxPlots, p.maxIndustries, pct(p.prodBonus)];
  });
export const phaseRows = (): Row[] =>
  Object.values(PHASES as Record<string, Named & { factor: number; land: number; traffic: number }>).map((p) => [`${p.icon} ${p.name}`, `×${String(p.factor).replace(".", ",")}`, `${pct(p.land)}/ngày`, pct(p.traffic)]);
export const weatherRows = (): Row[] =>
  Object.values(WEATHER as Record<string, Named & { zones: Record<string, number>; climates: Record<string, number>; news: Record<string, number> }>).map((w) => [
    `${w.icon} ${w.name}`,
    [...Object.entries(w.zones).map(([z, v]) => `${(ZONES as Record<string, Named>)[z].name} ${pct(v)}`), ...Object.entries(w.climates).map(([c, v]) => `${(CLIMATES as Record<string, Named>)[c].name} ${pct(v)}`)].join(", ") || "Không ảnh hưởng",
    Object.entries(w.news).map(([g, v]) => `${good(g)} ${pct(v)}`).join(", ") || "",
  ]);
export const zoneRows = (): Row[] => Object.values(ZONES as Record<string, Named & { desc: string }>).map((z) => [`${z.icon} ${z.name}`, z.desc]);
export const climateNames = () => Object.values(CLIMATES as Record<string, Named>).map((c) => `${c.icon} ${c.name}`).join(", ");
export const LAND_RULES = LAND as { count: number; cols: number; rows: number; minPrice: number; maxPrice: number };
export const DESIGN_RULES = DESIGN as { maxPieces: number; minPieces: number };
export const INDUSTRIAL_MARKET = MARKET_RULES as { npcBuy: number; importMarkup: number; band: number[]; fee: number; warehouseBase: number; warehousePerLevel: number; maxListings: number; listingDays: number };
export const GOODS_COUNT = Object.keys(goodsInd).length;

export const freshnessRows = (): Row[] =>
  (FRESHNESS as { name: string; upTo: number; factor: number }[]).map((f, i, all) => [f.name, `${Math.round((all[i - 1]?.upTo ?? 0) * 100)}–${Math.round(f.upTo * 100)}% hạn dùng`, `${Math.round(f.factor * 100)}%`]);
export const COMMODITY_COUNT = Object.keys(goods).length;

const PLACE: Record<string, string> = {
  market: "[Sàn Nguyên Liệu](san-nguyen-lieu)", school: "[Trường học](truong-hoc)", garden: "[Vườn](vuon)", bank: "[Ngân hàng](ngan-hang)",
  townhall: "[Tòa thị chính](thue-toa-thi-chinh)", guild: "lập [Hội](hoi)", kitchen: "[Bếp](bep)", business: "[Quầy trà sữa](quay-tra-sua)",
  bazaar: "[Chợ Phiên](cho-phien)", factory: "xây xưởng ở [Khu công nghiệp](khu-cong-nghiep)", contracts: "hợp đồng cung ứng",
  advanced: "Tài chính nâng cao: [vay trả góp](tin-dung)",
};
/** The unlock table, from the game's levels (lib/wiki/rules.ts, checked against the game by a test). */
export const unlockRows = (extra: Record<number, string[]>): Row[] => {
  const by = new Map<number, string[]>([[1, ["Nhà, Siêu thị, Việc làm, Khu vui chơi, Phòng khám, Công viên, Bạn bè, vào Hội có sẵn"]]]);
  for (const [k, lv] of Object.entries(UNLOCKS)) by.set(lv, [...(by.get(lv) ?? []), PLACE[k] ?? k]);
  for (const [lv, list] of Object.entries(extra)) by.set(Number(lv), [...(by.get(Number(lv)) ?? []), ...list]);
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([lv, list]) => [lv, list.join(", ")]);
};

// ---------------------------------------------------------------- hình các bé (vẽ trong trình duyệt)

type PetItem = { id: string; stage?: string; level?: number; label: string; sub?: string };
const allSpecies = [...(MASCOTS as Species[]), ...(SPECIES as Species[])];
const byId = (id: string) => allSpecies.find((s) => s.id === id)!;
/** Every legendary species, in the element order of the game. */
export const legendaryPets = (level = 1): PetItem[] =>
  (SPECIES as Species[]).filter((s) => s.rarity === "huyenthoai").map((s) => ({ id: s.id, level, label: s.name, sub: el(s.element) }));
/** One species at every age stage. */
export const stagePets = (id: string): PetItem[] =>
  (LIFE_STAGES as { key: string; name: string; fromWeek: number }[]).map((s) => ({ id, stage: s.key, label: s.name, sub: `từ tuần ${s.fromWeek}` }));
/** One species at every level form. */
export const formPets = (id: string): PetItem[] =>
  (LEVEL_FORMS as { from: number; name: string }[]).map((f) => ({ id, level: f.from, label: f.name, sub: `từ cấp ${f.from}` }));
/** The first common species of each element (what a new player can adopt). */
export const elementPets = (): PetItem[] =>
  Object.keys(ELEMENTS).map((e) => (SPECIES as Species[]).find((s) => s.element === e && s.rarity === "thuong")!).map((s) => ({ id: s.id, label: s.name, sub: el(s.element) }));
/** The species of one rarity, one per element. */
export const rarityPets = (rarity: string): PetItem[] =>
  Object.keys(ELEMENTS).flatMap((e) => (SPECIES as Species[]).filter((s) => s.element === e && s.rarity === rarity).slice(0, 1)).map((s) => ({ id: s.id, label: s.name, sub: el(s.element) }));
export const MASCOT_ID = (MASCOTS as Species[])[0].id;
export const LEGEND_ID = legendaryPets()[0].id;
export const speciesName = (id: string) => byId(id).name;
