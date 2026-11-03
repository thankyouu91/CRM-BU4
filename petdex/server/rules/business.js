// Luật quầy trà sữa (hàm thuần): vị trí, công thức, giá tham chiếu, lượng khách, công suất, uy tín.
import { clamp } from '../game.js';
import { COMMODITIES, LOT } from './market.js';
import { RECIPES, TEA_SHOP, teaItemId } from './recipes.js';

export const LOCATIONS = {
  alley: { name: 'Hẻm nhỏ', icon: '🏮', license: 1500, rent: 40, traffic: 8, promo: 100 },
  street: { name: 'Mặt phố', icon: '🏙️', license: 5000, rent: 120, traffic: 20, promo: 300 },
  center: { name: 'Trung tâm', icon: '🌆', license: 15000, rent: 300, traffic: 45, promo: 600 },
};

export { RECIPES, TEA_SHOP, teaItemId };

export const UPGRADES = {
  counter: { name: 'Quầy pha rộng hơn', desc: '+4 ly mỗi giờ', costs: [800, 2000] },
  menu: { name: 'Thêm món', desc: '+1 món trong thực đơn', costs: [500, 1000, 2000, 4000] },
  decor: { name: 'Trang trí quầy', desc: '+10% khách', costs: [1000, 3000] },
};

export const BUSINESS = {
  markup: 2.3, // giá tham chiếu = chi phí nguyên liệu × hệ số
  conversion: 0.3, // tỉ lệ khách qua đường ghé mua
  baseMenuSlots: 2,
  revenueTax: 0.03,
  promoHours: 6,
  promoBoost: 0.5,
  unpaidLimit: 3, // nợ tiền thuê 3 đêm liền thì đóng cửa
  wageMin: 8,
  wageMax: 80,
  maxStaffSlots: 3,
};

/** Chi phí nguyên liệu một ly theo giá gốc × chỉ số giá. */
export function unitCost(recipeId, index = 1) {
  return Object.entries(RECIPES[recipeId].inputs)
    .reduce((sum, [c, qty]) => sum + (COMMODITIES[c].base * index * qty) / LOT, 0);
}

export const refPrice = (recipeId, index = 1) => Math.round(unitCost(recipeId, index) * BUSINESS.markup);

/** Hệ số giờ cao điểm theo giờ Việt Nam. */
export function peakFactor(hourVN) {
  if ((hourVN >= 11 && hourVN < 13) || (hourVN >= 17 && hourVN < 21)) return 1.5;
  if (hourVN >= 23 || hourVN < 6) return 0.3;
  return 1;
}

/** Độ hấp dẫn của một món theo giá: rẻ hơn tham chiếu thì hút khách, đắt thì khách ngại. */
export const appeal = (price, ref) => Math.min(3, (ref / Math.max(1, price)) ** 1.5);

/** Công suất pha mỗi giờ của một bé đang trực, cộng thêm theo Khéo tay và nâng cấp quầy. */
export const staffCapacity = (craft, counterLevel = 0) => 7 + craft / 10 + counterLevel * 4;

/** Số khách muốn mua trong một giờ (chưa chia theo món). */
export function customersPerHour({ location, hourVN, reputation, decorLevel = 0, promo = false, bonus = 0, menuAppeal = 1 }) {
  const loc = LOCATIONS[location];
  return loc.traffic * peakFactor(hourVN) * reputation * (1 + 0.1 * decorLevel) * (promo ? 1 + BUSINESS.promoBoost : 1)
    * (1 + bonus) * BUSINESS.conversion * Math.min(1.5, menuAppeal);
}

/** Uy tín sau một giờ: hết hàng hoặc bán đắt thì giảm, bán đủ giá hợp lý thì tăng dần. */
export function nextReputation(rep, { served, wanted, priceRatio }) {
  let next = rep;
  if (wanted - served > 0.5) next -= 0.03 * Math.min(1, (wanted - served) / Math.max(1, wanted));
  if (priceRatio > 1.3) next -= 0.01 * (priceRatio - 1.3) * 10;
  else if (served > 0 && priceRatio <= 1.1) next += 0.004;
  return clamp(next, 0.5, 1.5);
}

export const menuSlots = (upgrades) => BUSINESS.baseMenuSlots + (upgrades.menu ?? 0);
export const upgradeCost = (key, level) => UPGRADES[key]?.costs[level] ?? null;
