// Luật ngân hàng và Ngân hàng Trung ương (hàm thuần).
import { DAY } from '../game.js';

export const BANK = {
  savingsCap: 10_000, // phần tiết kiệm được tính lãi
  defaultRate: 0.003, // lãi suất cơ bản ban đầu, mỗi ngày
  termPremium: { 3: 0.001, 7: 0.002, 14: 0.003 },
  minDeposit: 100,
  targetGrowth: 0.1, // mục tiêu tăng lượng xu bình quân mỗi tuần
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Lãi tích lũy thêm cho số dư tiết kiệm trong khoảng [from, to]. */
export function accrue(savings, rate, from, to) {
  const days = Math.max(0, to - from) / DAY;
  return Math.min(Math.max(0, savings), BANK.savingsCap) * rate * days;
}

/** Tiền nhận khi tất toán: đủ hạn thì có lãi đơn theo lãi suất đã chốt, rút sớm chỉ nhận gốc. */
export function depositPayout({ amount, rate, term_days, matures_at }, now) {
  const interest = now >= matures_at ? Math.floor(amount * rate * term_days) : 0;
  return { principal: amount, interest };
}

/**
 * Quyết định chính sách tuần từ mức tăng lượng xu bình quân `growth`.
 * Trong game, lãi tiết kiệm là một nguồn in tiền, nên xu tăng quá nhanh thì hạ lãi (bớt in) và nâng giá NPC (tăng hút),
 * xu co lại thì làm ngược lại.
 */
export function policy({ growth, priceIndex }) {
  const gap = growth - BANK.targetGrowth;
  return {
    priceIndex: priceIndex * (1 + 0.3 * clamp(gap, -0.05, 0.15)),
    baseRate: clamp(0.003 - gap / 20, 0.0005, 0.005),
  };
}
