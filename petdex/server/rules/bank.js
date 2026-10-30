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
  // Làm tròn 6 chữ số trước khi lấy phần nguyên, để 0,1 + 0,2 kiểu số thực không bớt mất 1 xu.
  const interest = now >= matures_at ? Math.floor(Math.round(amount * rate * term_days * 1e6) / 1e6) : 0;
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
    // Phản ứng 0,6 × độ lệch, tối đa +15%/tuần khi xu tăng quá nóng (trước đây 0,3 và +4,5%: không đuổi kịp lượng xu).
    priceIndex: priceIndex * (1 + 0.6 * clamp(gap, -0.05, 0.25)),
    // Làm tròn 9 chữ số: 0,003 − 0,04/20 phải ra đúng 0,001 (không 0,000999…), nếu không 10.000 xu chỉ ra 9 xu lãi.
    baseRate: Math.round(clamp(0.003 - gap / 20, 0.0005, 0.005) * 1e9) / 1e9,
  };
}
