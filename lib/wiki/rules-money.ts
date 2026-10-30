// Money rules the wiki has to copy because they live inside modules that open the game database
// (ledger.js, town.js, bank.js, lifecycle.js). tests/petfarm-wiki-sync-money.test.ts runs those modules on an
// in-memory database and fails when one of these no longer matches what the game does.

import { UPKEEP, upkeepOf } from "@/public/ta-tua/game/js/shared/pets.js";

export const MONEY = {
  /** Share of every tax and fee that goes to the town budget; the rest is destroyed (ledger.js chargeTax, chargeFee). */
  treasuryShare: 0.5,
  /**
   * Ledger kinds counted as taxable income each day (town.js settleTaxes). Business profit and realised trading
   * gains are added on top; every other income is tax free.
   */
  taxableKinds: ["salary", "interest", "toll_income", "minigame"],
  /** The Central Bank divides the coins by the players active in this many days (bank.js centralBankWeek). */
  activeWindowDays: 7,
  /**
   * Each night the land price index moves by the phase's drift minus this × (base rate − 0,3%/day), so a high
   * base rate pulls land prices down and a low one pushes them up (macro.js rollMacro).
   */
  landRateDrag: 2,
} as const;

/**
 * Pet upkeep charged at midnight for one player (lifecycle.js settleUpkeepDay): the full fee of every living pet
 * (shared/pets.js upkeepOf, scaled by the price index), capped at UPKEEP.incomeShare of the coins that entered the
 * wallet that day (every ledger kind in the "income" group) but never below UPKEEP.base per pet, and never more than
 * the wallet holds. Only players seen in the last UPKEEP.activeDays days pay; the coins are destroyed.
 */
export function upkeepCharge({ levels, priceIndex = 1, income, wallet = Infinity }: { levels: number[]; priceIndex?: number; income: number; wallet?: number }) {
  const full = levels.reduce((sum, lv) => sum + upkeepOf(lv, priceIndex), 0);
  const due = Math.min(full, Math.max(UPKEEP.base * levels.length, Math.floor(income * UPKEEP.incomeShare)));
  return { full, due, paid: Math.min(due, Math.max(0, wallet)) };
}

/** Names of ledger lines as the Ví screen shows them (ledger.js KINDS), for the lines the money articles mention. */
export const KIND_LABELS = {
  salary: "Lương",
  daily: "Quà ngày",
  quest: "Nhiệm vụ",
  level: "Thưởng lên cấp",
  play: "Chơi với bé",
  minigame: "Mini-game",
  market_sell: "Bán trên Sàn",
  market_buy: "Mua trên Sàn",
  business_income: "Doanh thu quầy",
  kitchen_sale: "Bán món ăn",
  gear_quicksell: "Bán nhanh trang phục",
  interest: "Lãi ngân hàng",
  infra_bonus: "Buff hạ tầng chiến lược",
  gear_trade: "Thưởng giao dịch (trang phục)",
  loan_in: "Giải ngân khoản vay",
  loan_repay: "Trả gốc vay",
  gift_code: "Mã quà",
  mail: "Quà trong hộp thư",
  stipend: "Trợ cấp tân thủ",
  guild_reward: "Thưởng dự án Hội",
  clan_revenue: "Doanh thu gia tộc",
  clan_land: "Mua bán đất",
  shop: "Siêu thị",
  upkeep: "Phí chăm nuôi",
  adopt: "Nhận nuôi",
  school: "Học phí",
  clinic: "Phòng khám",
  insurance: "Bảo hiểm",
  seeds: "Hạt giống",
  license: "Giấy phép quầy",
  rent: "Thuê mặt bằng",
  biz_upgrade: "Nâng cấp quầy",
  factory_build: "Xây xưởng",
  gear_repair: "Sửa trang phục (Lò rèn)",
  tax: "Thuế",
  fee: "Phí giao dịch",
  loan_interest: "Lãi vay",
  clan_upkeep: "Phí duy trì gia tộc",
  corp_tax: "Thuế doanh nghiệp",
  bazaar_sale: "Bán ở Chợ Phiên",
  toll_income: "Thu phí gia công",
  wage: "Trả lương nhân viên",
  clan_dividend: "Cổ tức gia tộc",
  p2p_lend: "Cho vay ngang hàng",
  hui_pay: "Góp hụi",
} as const;
