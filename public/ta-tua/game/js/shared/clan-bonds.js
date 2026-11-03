// Trái phiếu, quyền lãi suất cơ bản của gia tộc nắm Ngân hàng nhà nước và thuế lợi nhuận tài chính: luật chung cho server,
// giao diện và wiki (hàm thuần). Mọi con số ở đây được wiki đọc thẳng và có test đối chiếu.

export const BONDS = {
  /** Mệnh giá mỗi trái phiếu. */
  face: 100,
  terms: [7, 14, 30],
  /** Lãi coupon mỗi ngày: từ 1 tới 5 lần lãi suất cơ bản, cố định từ lúc phát hành, trả mỗi nửa đêm. */
  minCouponMultiple: 1,
  maxCouponMultiple: 5,
  minQty: 10,
  maxQty: 5_000,
  /** Gia tộc phát hành: tổng mệnh giá đang lưu hành không quá 50% giá trị sổ sách của gia tộc. */
  clanBookShare: 0.5,
  subscribeHours: 24,
  /** Phí phát hành 1% số xu thu được và phí 1% mỗi lần mua trên sàn thứ cấp, trả cho gia tộc nắm Ngân hàng nhà nước. */
  issueFee: 0.01,
  tradeFee: 0.01,
  /** Một người giữ tối đa 20% một đợt phát hành. */
  holderCap: 0.2,
};

export const RATE_POWER = {
  /** Gia tộc nắm Ngân hàng nhà nước đặt lãi suất cơ bản trong khoảng lãi chính sách ± 0,1 điểm %/ngày (và trong 0,05–0,5%/ngày). */
  band: 0.001,
  min: 0.0005,
  max: 0.005,
  /** Lượng xu tăng quá 15%/tuần trong tuần gia tộc đặt lãi thấp hơn lãi chính sách: phạt; lần thứ hai trong 28 ngày: mất ghế. */
  growthCap: 0.15,
  penalty: 50_000,
  strikeDays: 28,
};

/** Thuế lợi nhuận tài chính: khấu trừ 10% lãi tiền gửi ngân hàng gia tộc, cổ tức và lãi trái phiếu của người chơi. */
export const FINANCE_TAX = { rate: 0.1 };

const round9 = (x) => Math.round(x * 1e9) / 1e9;

/** Khoảng lãi coupon được phép. */
export const couponRange = (baseRate) => [round9(baseRate * BONDS.minCouponMultiple), round9(baseRate * BONDS.maxCouponMultiple)];
/** Khoảng lãi suất cơ bản gia tộc được đặt quanh lãi chính sách. */
export const rateBand = (policyRate) => [round9(Math.max(RATE_POWER.min, policyRate - RATE_POWER.band)), round9(Math.min(RATE_POWER.max, policyRate + RATE_POWER.band))];
/** Tiền lãi một đêm của `qty` trái phiếu. */
export const couponOf = (qty, coupon) => Math.floor(Math.round(qty * BONDS.face * coupon * 1e6) / 1e6);
/** Thuế khấu trừ trên một khoản lợi nhuận tài chính. */
export const financeTax = (gross) => Math.floor(Math.max(0, gross) * FINANCE_TAX.rate);
