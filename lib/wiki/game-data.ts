import { ITEMS } from "@/petdex/server/game.js";
import { CAREERS, RANK_TITLES, PROMOTION, SKILLS } from "@/petdex/server/rules/careers.js";
import { COMMODITIES } from "@/petdex/server/rules/market.js";
import { LOCATIONS, RECIPES, refPrice } from "@/petdex/server/rules/business.js";
import { CLASSES, CROPS, DISHES, FACTORIES, TIERS as CREDIT_TIERS } from "@/petdex/server/rules/production.js";
import { PROPOSALS, QUESTS, GUILD_PROJECTS } from "@/petdex/server/rules/town.js";
import { ELEMENTS, LEVEL_FORMS, LIFE_STAGES, RARITIES, SLOTS, SPECIES, MASCOTS, WEARABLES } from "@/public/ta-tua/game/js/shared/pets.js";
import { DEFAULT_GEAR_CONFIG, TIERS, TIER_ORDER, TIER_VALUE } from "@/public/ta-tua/game/js/shared/gear.js";
import { FISH } from "@/public/ta-tua/game/js/shared/minigames.js";

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
  Object.keys(ELEMENTS).map((e) => [el(e), ...["head", "face", "neck", "back"].map((s) => items.filter((i) => i.type === "accessory" && i.slot === s && i.element === e).map((i) => i.name).join(", "))]);

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
