// Ngân hàng gia tộc: luật chung cho server, giao diện và wiki (hàm thuần, không đụng cơ sở dữ liệu).
// Gia tộc mua một trong các giấy phép ngân hàng tư ở Phố Ngân hàng để mở ngân hàng riêng: nhận tiền gửi kỳ hạn của người chơi (cạnh tranh
// với tiết kiệm NPC của Ngân hàng Trân Châu) và cho các gia tộc khác vay có thế chấp lô đất. Tiền gửi nằm ở tài khoản vốn
// riêng `bank:<clanId>`, không lẫn với quỹ gia tộc. Mọi con số ở đây được wiki đọc thẳng và có test đối chiếu.

export const CBANK = {
  /** Phố Ngân hàng có chừng này suất ngân hàng tư; mở ngân hàng là mua giấy phép một suất, trả từ quỹ gia tộc vào ngân sách. */
  license: { slots: 4, fee: 100_000 },
  /** Vốn chủ tối thiểu tộc trưởng chuyển từ quỹ gia tộc để mở ngân hàng. */
  minCapital: 50_000,
  /** Kỳ hạn gửi tiết kiệm (ngày). */
  terms: [7, 14, 30],
  /** Lãi tiền gửi tối đa = 3 × lãi tiết kiệm NPC (lãi suất cơ bản) mỗi ngày, tính lúc đặt lãi và lúc gửi. */
  maxRateMultiple: 3,
  /** Gửi tối thiểu mỗi khoản và tổng tối đa một người gửi ở một ngân hàng. */
  minDeposit: 100,
  maxPerDepositor: 50_000,
  /** Tiền mặt tối thiểu phải nằm yên ở tài khoản vốn: 20% tổng tiền gửi đang mở. */
  liquidityFloor: 0.2,
  /** Tổng tiền gửi tối đa = 10 × vốn chủ (tiền mặt + nợ cho vay − tiền gửi). */
  leverage: 10,
  /** Mỗi khoản gửi mới, ngân hàng nộp 1% vào quỹ bảo hiểm tiền gửi (trừ vào vốn của ngân hàng). */
  insurancePremium: 0.01,
  /** Ngân hàng đổ vỡ: quỹ bảo hiểm bù tối đa 80% phần gốc người gửi còn thiếu (trong phạm vi quỹ đang có). */
  insuranceCover: 0.8,
  /** Uy tín 0–100: mở ngân hàng 100, mỗi lần rút tiền phải xếp hàng −20 (tối đa một lần mỗi ngày), đêm không có ai xếp hàng +2. */
  reputation: { start: 100, runDrop: 20, dailyRecover: 2 },
  /** Uy tín dưới mức này thì không nhận tiền gửi mới. */
  minReputation: 40,
  /** Lệnh rút xếp hàng quá 3 đêm chưa trả được thì ngân hàng đổ vỡ. */
  failNights: 3,
  loan: {
    terms: [7, 14, 30],
    /** Lãi cho vay mỗi ngày: từ 1 tới 6 lần lãi suất cơ bản, do ngân hàng đặt. */
    minRateMultiple: 1,
    maxRateMultiple: 6,
    /** Khoản vay tối đa 60% giá trị tài sản thế chấp. */
    ltv: 0.6,
    minAmount: 10_000,
    /** Phí giải ngân 1% số tiền vay, gia tộc vay trả, vào quỹ bảo hiểm tiền gửi. */
    fee: 0.01,
    /** Quá hạn mà quỹ gia tộc vay không đủ trả: thêm 2 đêm ân hạn rồi mới vỡ nợ. */
    graceNights: 2,
    /** Mỗi đêm quá hạn cộng phí trễ 2% phần còn nợ. */
    lateFee: 0.02,
    /** Gia tộc vay tối đa 2 khoản đang nợ cùng lúc. */
    maxOpen: 2,
  },
  /** Giá trị thế chấp của một lô = giá trị lô đất + 50% số xu đã chi xây công trình trên lô. */
  buildingShare: 0.5,
  /** Hai gia tộc coi là liên quan nếu có người ra vào giữa hai bên trong 14 ngày, hoặc có thành viên vào game qua cùng một link mời. */
  relatedDays: 14,
  auction: {
    /** Phiên đấu giá lô bị siết nợ kéo dài 24 giờ, giá khởi điểm 70% giá trị thế chấp, bước giá tối thiểu 5%. */
    hours: 24,
    startShare: 0.7,
    step: 0.05,
  },
};

const round9 = (x) => Math.round(x * 1e9) / 1e9;

/** Lãi tiền gửi tối đa mỗi ngày khi lãi suất cơ bản là `baseRate`. */
export const maxDepositRate = (baseRate) => round9(baseRate * CBANK.maxRateMultiple);
/** Khoảng lãi cho vay mỗi ngày được phép. */
export const loanRateRange = (baseRate) => [round9(baseRate * CBANK.loan.minRateMultiple), round9(baseRate * CBANK.loan.maxRateMultiple)];

/** Lãi đơn cả kỳ của một khoản gửi hay khoản vay. */
export const simpleInterest = (amount, rate, days) => Math.floor(Math.round(amount * rate * days * 1e6) / 1e6);

/** Tiền nhận khi rút: đủ hạn thì gốc + lãi, rút trước hạn chỉ nhận gốc. */
export function depositPayout({ amount, rate, term_days: termDays, matures_at: maturesAt }, now) {
  const interest = now >= maturesAt ? simpleInterest(amount, rate, termDays) : 0;
  return { principal: amount, interest, total: amount + interest };
}

/** Giá trị thế chấp của một lô từ giá trị đất và số xu đã xây. */
export const collateralOf = (landValue, buildSpent) => Math.max(0, Math.round(landValue + Math.max(0, buildSpent) * CBANK.buildingShare));
/** Số tiền vay tối đa trên một tài sản thế chấp. */
export const maxLoanOn = (collateral) => Math.floor(collateral * CBANK.loan.ltv);

/**
 * Bảng cân đối của ngân hàng: `cash` tiền mặt ở tài khoản vốn, `loans` gốc + lãi còn phải thu, `deposits` gốc tiền gửi
 * đang mở (kể cả đang xếp hàng rút). Trả về vốn chủ, mức tiền mặt tối thiểu và trần tiền gửi.
 */
export function balanceSheet({ cash, loans, deposits }) {
  const equity = cash + loans - deposits;
  return {
    cash, loans, deposits, equity,
    floor: Math.ceil(deposits * CBANK.liquidityFloor),
    depositCap: Math.max(0, equity) * CBANK.leverage,
    liquidity: deposits > 0 ? cash / deposits : 1,
  };
}

/** Chia tiền khi ngân hàng đổ vỡ: tiền mặt trả theo tỉ lệ gốc, quỹ bảo hiểm bù tới 80% phần thiếu (trong phạm vi quỹ). */
export function failurePayout(principals, cash, fund) {
  const total = principals.reduce((s, p) => s + p, 0);
  if (!total) return { paid: [], insured: [], fundUsed: 0 };
  const ratio = Math.min(1, cash / total);
  const paid = principals.map((p) => Math.floor(p * ratio));
  const gaps = principals.map((p, i) => Math.floor((p - paid[i]) * CBANK.insuranceCover));
  const need = gaps.reduce((s, g) => s + g, 0);
  const k = need > fund ? fund / need : 1;
  const insured = gaps.map((g) => Math.floor(g * k));
  return { paid, insured, fundUsed: insured.reduce((s, x) => s + x, 0) };
}
