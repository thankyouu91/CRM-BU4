// Luật tài chính (hàm thuần): quản trị gia tộc (bỏ phiếu phế truất), tiền gửi kỳ hạn của gia tộc,
// vay ngang hàng qua ngân hàng trung gian, và hụi (người chơi hoặc gia tộc).
import { DAY } from '../game.js';
import { ceilCoins, floorCoins, tierOf } from './production.js';

// ---------------------------------------------------------------- quản trị gia tộc

/**
 * Phế truất tộc trưởng: thành viên (đã ở gia tộc đủ `joinedHours`) mở phiếu, đề cử người thay.
 * Thông qua khi số phiếu thuận vượt `threshold` số người được bầu (mọi thành viên trừ tộc trưởng).
 * Phiếu mở `voteHours` giờ; thất bại thì `cooldownDays` ngày sau mới mở lại được.
 */
export const CLAN_GOV = { voteHours: 48, joinedHours: 24, minMembers: 3, threshold: 0.5, cooldownDays: 3 };

/** Kết quả phiếu: 'passed' khi thuận vượt ngưỡng, 'failed' khi không thể vượt nữa (hoặc đã hết giờ), còn lại 'open'. */
export function voteOutcome({ yes, no, eligible, expired }) {
  const need = Math.floor(eligible * CLAN_GOV.threshold) + 1;
  if (yes >= need) return 'passed';
  if (expired || eligible - no < need) return 'failed';
  return 'open';
}

// ---------------------------------------------------------------- tiền gửi gia tộc

/**
 * Quỹ gia tộc gửi kỳ hạn: lãi = lãi cơ bản + phụ phí kỳ hạn + ưu đãi gia tộc (mỗi ngày).
 * Rút trước hạn mất lãi và bị phạt `earlyPenalty` gốc; khi quỹ cạn (không đủ trả phí, thuế) thì
 * hệ thống tự rút gấp, phạt `emergencyPenalty` gốc.
 */
export const CLAN_BANK = { termPremium: { 3: 0.001, 7: 0.002, 14: 0.003 }, clanBonus: 0.0005, minDeposit: 1000, earlyPenalty: 0.05, emergencyPenalty: 0.03 };

export const clanDepositRate = (baseRate, term) => Math.round((baseRate + CLAN_BANK.termPremium[term] + CLAN_BANK.clanBonus) * 1e6) / 1e6;

/** Tất toán một khoản: đúng hạn thì gốc + lãi; trước hạn thì gốc trừ phạt, không lãi. */
export function clanDepositPayout(dep, now, { emergency = false } = {}) {
  if (now >= dep.matures_at) return { principal: dep.amount, interest: floorCoins(dep.amount * dep.rate * dep.term_days), penalty: 0, kind: 'matured' };
  const penalty = ceilCoins(dep.amount * (emergency ? CLAN_BANK.emergencyPenalty : CLAN_BANK.earlyPenalty));
  return { principal: dep.amount - penalty, interest: 0, penalty, kind: emergency ? 'emergency' : 'early' };
}

// ---------------------------------------------------------------- vay ngang hàng

/**
 * Vay ngang hàng: người vay đặt số tiền, kỳ hạn, lãi/ngày; người cho vay rót đủ một lần.
 * Đáo hạn trả gốc + lãi một lần. Ngân hàng làm trung gian giữ `cut` phần lãi theo hạng tín dụng của người vay
 * (người vay càng rủi ro, ngân hàng giữ càng nhiều: 10–20%). Trễ hạn: phí trễ mỗi ngày, trừ điểm tín dụng;
 * trễ `defaultAfter` ngày là vỡ nợ: ngân hàng giữ `garnish` thu nhập hằng ngày của người vay trả dần cho người cho vay.
 */
export const P2P = {
  terms: [3, 7, 14],
  minAmount: 200,
  limitMultiplier: 2, // tối đa gấp đôi hạn mức vay ngân hàng theo hạng
  rateRange: [0.002, 0.03], // lãi/ngày người vay được đặt
  cut: { diamond: 0.1, gold: 0.13, silver: 0.16, bronze: 0.2 },
  maxOpen: 2, // số yêu cầu đang chờ + khoản đang nợ tối đa của một người
  listDays: 2, // yêu cầu không ai rót vốn thì hết hạn
  lateFee: 0.01,
  defaultAfter: 7,
  garnish: 0.3,
  minAccountDays: 1,
};

export const p2pCut = (creditScore) => P2P.cut[tierOf(creditScore).key] ?? P2P.cut.bronze;
/** Hạn mức vay ngang hàng: gấp `limitMultiplier` hạn mức vay ngân hàng của hạng tín dụng. */
export const p2pLimit = (creditScore) => tierOf(creditScore).limit * P2P.limitMultiplier;
export const p2pInterest = (amount, rate, term) => Math.round(Math.round(amount * rate * term * 1e6) / 1e6);

/** Chia một khoản người vay vừa trả: trả gốc cho người cho vay trước, rồi lãi (ngân hàng giữ `cut`). */
export function splitRepayment(paid, { principalLeft, interestLeft, cut }) {
  const principal = Math.min(paid, principalLeft);
  const interest = Math.min(paid - principal, interestLeft);
  const bank = Math.round(interest * cut);
  return { principal, interest, bank, lender: principal + interest - bank };
}

// ---------------------------------------------------------------- hụi

/**
 * Hụi bỏ thăm: mỗi kỳ (1 ngày) mọi thành viên góp `amount`; người chưa hốt được bỏ thăm (tiền thăm tối đa
 * `maxBidRatio` quỹ kỳ đó), người bỏ cao nhất hốt hụi: nhận quỹ trừ tiền thăm, tiền thăm chia đều cho những
 * người cùng góp kỳ đó. Kỳ không ai bỏ thăm: kỳ đầu chủ hụi hốt, các kỳ sau theo thứ tự vào nhóm.
 * Đến kỳ mà không đủ tiền góp thì bị loại khỏi nhóm, không hoàn số đã góp; người chơi bị cấm chơi hụi `banDays` ngày.
 */
export const HUI = {
  player: { minAmount: 100, maxAmount: 20_000, minSize: 3, maxSize: 10 },
  clan: { minAmount: 5_000, maxAmount: 500_000, minSize: 3, maxSize: 8 },
  maxBidRatio: 0.3,
  banDays: 14,
  creditPenalty: -60, // bỏ hụi sau khi đã hốt (giật hụi) bị trừ nặng hơn
  creditPenaltyBeforeWin: -25,
  openDays: 3, // nhóm chưa đủ người sau 3 ngày thì tự hủy (hoàn tiền vì chưa góp kỳ nào)
};

/**
 * Chọn người hốt hụi kỳ `round` trong số `eligible` (đã góp kỳ này, chưa hốt; theo thứ tự vào nhóm):
 * thăm cao nhất (bằng nhau thì ai bỏ trước), không ai bỏ thì kỳ 1 chủ hụi, còn lại người vào nhóm sớm nhất.
 */
export function pickWinner(eligible, bids, round, ownerId) {
  if (!eligible.length) return null;
  const valid = bids.filter((b) => b.bid > 0 && eligible.includes(b.member_id)).sort((a, b) => b.bid - a.bid || a.at - b.at);
  if (valid.length) return { winner: valid[0].member_id, bid: valid[0].bid };
  if (round === 1 && eligible.includes(ownerId)) return { winner: ownerId, bid: 0 };
  return { winner: eligible[0], bid: 0 };
}

/** Người hốt nhận quỹ trừ tiền thăm; tiền thăm chia đều cho `others` người góp còn lại, phần lẻ trả về người hốt. */
export function splitPot(pot, bid, others) {
  const each = others > 0 ? Math.floor(bid / others) : 0;
  return { winner: pot - each * others, each };
}

export const huiRoundTime = (from) => from + DAY;
