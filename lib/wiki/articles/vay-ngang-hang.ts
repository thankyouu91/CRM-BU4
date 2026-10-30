import type { WikiArticle } from "../types";
import { UNLOCKS } from "../rules";
import { P2P_EXTRA } from "../rules-credit";
import { CREDIT, LOANS, TIERS } from "@/petdex/server/rules/production.js";
import { BANK } from "@/petdex/server/rules/bank.js";
import { P2P, p2pInterest, splitRepayment } from "@/petdex/server/rules/finance.js";

// Vay ngang hàng qua Ngân hàng Trân Châu làm trung gian (petdex/server/p2p.js, rules/finance.js P2P).
// Mọi con số đọc từ luật của game hoặc lib/wiki/rules-credit.ts (có test đối chiếu).

const xu = (n: number) => `${n.toLocaleString("vi-VN")} xu`;
const pct = (x: number) => `${String(+(x * 100).toFixed(2)).replace(".", ",")}%`;
const cutOf = P2P.cut as Record<string, number>;
const tierBy = (key: string) => TIERS.find((t) => t.key === key)!;
const [rateLo, rateHi] = P2P.rateRange;
const terms = (P2P.terms as number[]).join(", ");

/** Người cho vay nhận về bao nhiêu khi người vay trả đủ `owed` cho khoản gốc `amount`. */
const payout = (amount: number, owed: number, cut: number) => splitRepayment(owed, { principalLeft: amount, interestLeft: owed - amount, cut });

// ---------------------------------------------------------------- ví dụ trả đúng hạn

const EX = { amount: 3_000, term: 7, rate: 0.008, tier: tierBy("gold") };
const exInterest = p2pInterest(EX.amount, EX.rate, EX.term);
const exOwed = EX.amount + exInterest;
const exSplit = payout(EX.amount, exOwed, cutOf[EX.tier.key]);
// So với gửi kỳ hạn cùng số ngày ở lãi suất cơ bản ban đầu (petdex/server/rules/bank.js).
const depositRate = BANK.defaultRate + (BANK.termPremium as Record<number, number>)[EX.term];
const depositInterest = Math.floor(EX.amount * depositRate * EX.term);

// ---------------------------------------------------------------- ví dụ trễ hạn: 2 đêm không trả, đêm thứ 3 trả đủ

const LATE_NIGHTS = 2;
const lateRows: (string | number)[][] = [];
let lateOwed = exOwed;
for (let night = 1; night <= LATE_NIGHTS; night++) {
  const fee = Math.ceil(lateOwed * P2P.lateFee);
  lateOwed += fee;
  lateRows.push([`Đêm đáo hạn${night > 1 ? ` +${night - 1}` : ""}`, "Ví và tiết kiệm trống", `+${xu(fee)} phí trễ`, xu(lateOwed), String(CREDIT.late).replace("-", "−")]);
}
const lateSplit = payout(EX.amount, lateOwed, cutOf[EX.tier.key]);
lateRows.push([`Đêm đáo hạn +${LATE_NIGHTS}`, `Thu đủ ${xu(lateOwed)}`, "", "0 xu", `+${P2P_EXTRA.repaidCredit}`]);

// ---------------------------------------------------------------- bảng rủi ro theo hạng

const RISK = { amount: 2_000, term: 7, rate: 0.01 };
const riskInterest = p2pInterest(RISK.amount, RISK.rate, RISK.term);
const riskRows = [...TIERS].reverse().map((t) => {
  const cut = cutOf[t.key];
  const s = payout(RISK.amount, RISK.amount + riskInterest, cut);
  return [`${t.icon} ${t.name}`, `${Math.max(CREDIT.min, t.min)}+`, xu(t.limit * P2P.limitMultiplier), pct(cut), xu(s.lender - RISK.amount), xu(s.bank)];
});

export const article: WikiArticle = {
  slug: "vay-ngang-hang",
  title: "Vay ngang hàng (P2P)",
  category: "kinh-te",
  emoji: "🤝",
  summary: `Người chơi cho nhau vay ${terms} ngày qua Ngân hàng Trân Châu làm trung gian: người vay đặt lãi ${pct(rateLo)}–${pct(rateHi)}/ngày, người cho vay nhận lãi sau khi ngân hàng giữ ${pct(cutOf.diamond)}–${pct(cutOf.bronze)}, và chịu rủi ro nếu người vay vỡ nợ.`,
  keywords: ["p2p", "vay ngang hàng", "cho vay", "chợ vay", "rót vốn", "lãi", "người vay", "người cho vay", "phí trung gian", "vỡ nợ", "đăng yêu cầu vay"],
  related: ["tin-dung", "hui", "ngan-hang", "tai-chinh"],
  sections: [
    {
      id: "co-che",
      title: "Cách hoạt động",
      blocks: [
        { p: `Vào màn **🤝 Vay ngang hàng & Hụi**, tab **🤝 Vay ngang hàng**. Mở từ **cấp ${UNLOCKS.bank}** (cùng lúc với [Ngân hàng](ngan-hang)), **không cần** bật Tài chính nâng cao như vay ngân hàng.` },
        { steps: [
          "**Người vay** đăng yêu cầu ở **📝 Đăng yêu cầu vay**: số tiền, kỳ hạn và lãi mỗi ngày tự đặt.",
          "Yêu cầu hiện trên **🏪 Chợ vay**. **Người cho vay** bấm **Cho vay** để rót **đủ cả khoản một lần**, tiền chuyển thẳng vào ví người vay.",
          "Tới ngày đáo hạn, lúc quyết toán nửa đêm, hệ thống tự thu **gốc + lãi một lần** từ ví người vay (thiếu thì lấy tiết kiệm).",
          "Ngân hàng chuyển gốc cho người cho vay, rồi tới tiền lãi sau khi **giữ lại một phần làm phí trung gian** (theo hạng tín dụng của người vay). Phần ngân hàng giữ vào ngân sách thị trấn.",
        ] },
        { p: "**Tiền lãi** = số tiền × lãi/ngày × số ngày, cố định từ lúc đăng. Người vay trả đúng số đó dù trả sớm hay đúng hạn." },
      ],
    },
    {
      id: "nguoi-vay",
      title: "Người vay",
      blocks: [
        { table: { head: ["Luật", "Giá trị"], rows: [
          ["Số tiền", `từ ${xu(P2P.minAmount)} tới **${P2P.limitMultiplier} lần hạn mức hạng** của bạn (xem bảng ở [Tín dụng và vay](tin-dung))`],
          ["Kỳ hạn", `${terms} ngày`],
          ["Lãi tự đặt", `${pct(rateLo)} tới ${pct(rateHi)} mỗi ngày`],
          ["Yêu cầu nằm trên chợ", `${P2P.listDays} ngày, không ai rót vốn thì **Hết hạn đăng**`],
          ["Số khoản cùng lúc", `tối đa ${P2P.maxOpen} (tính cả yêu cầu đang chờ lẫn khoản đang nợ)`],
          ["Tài khoản", `đủ ${P2P.minAccountDays * 24} giờ tuổi, không bị cấm vay, không có khoản vay ngang hàng nào đang trễ hạn hay vỡ nợ`],
          ["Trả xong", `+${P2P_EXTRA.repaidCredit} điểm tín dụng (trừ khi đã vỡ nợ)`],
        ] } },
        { list: [
          "Chưa ai rót vốn thì bấm **Rút yêu cầu** để gỡ xuống.",
          "Muốn trả sớm thì bấm **Trả hết** (cần đủ xu trong ví): trả đủ gốc và **cả tiền lãi đã thỏa thuận**, không được bớt.",
          "Lãi đặt càng cao thì người cho vay càng thấy hời, nhưng bạn trả càng nhiều. Điểm càng cao thì ngân hàng giữ càng ít phí trên tiền lãi bạn trả.",
        ] },
        { tip: "Lúc gõ số tiền và lãi, khung ước tính ngay dưới form cho biết đáo hạn phải trả bao nhiêu, người cho vay nhận bao nhiêu và ngân hàng giữ bao nhiêu." },
      ],
    },
    {
      id: "nguoi-cho-vay",
      title: "Người cho vay",
      blocks: [
        { p: `Ai mở được Ngân hàng (cấp ${UNLOCKS.bank}) và có đủ xu trong ví đều cho vay được, trừ cho chính mình. Mỗi dòng trên **🏪 Chợ vay** cho thấy người vay, **điểm tín dụng và hạng**, số tiền, kỳ hạn, lãi/ngày, phần ngân hàng giữ và cột **Bạn nhận về** (gốc + lãi sau phí nếu trả đúng hạn).` },
        { list: [
          "Rót vốn là chuyển **toàn bộ số tiền** ngay, không chia nhỏ được.",
          "Đúng hạn bạn nhận lại gốc + tiền lãi trừ phần ngân hàng giữ.",
          "Người vay trễ hạn thì **phí trễ cộng vào khoản nợ**: khi thu được, phí trễ được chia như tiền lãi, nên bạn có phần (sau phí ngân hàng).",
          "Theo dõi ở **📤 Khoản bạn cho vay**: trạng thái, còn nợ bao nhiêu, đáo hạn khi nào.",
        ] },
        { table: { head: [`Hạng người vay`, "Điểm", "Hạn mức P2P", "Ngân hàng giữ", `Lãi bạn nhận (${xu(RISK.amount)}, ${RISK.term} ngày, ${pct(RISK.rate)}/ngày)`, "Ngân hàng giữ (xu)"], rows: riskRows } },
        { p: `Cùng một khoản ${xu(RISK.amount)} lãi ${xu(riskInterest)}, cho người hạng cao vay thì bạn giữ được nhiều lãi hơn.` },
      ],
    },
    {
      id: "tre-han",
      title: "Trễ hạn và vỡ nợ",
      blocks: [
        { p: "Nửa đêm của ngày đáo hạn mà người vay không đủ tiền (ví cộng tiết kiệm) thì hệ thống thu được bao nhiêu chuyển bấy nhiêu, phần còn lại thành **⚠️ Trễ hạn**. Mỗi đêm sau đó hệ thống thử thu lại:" },
        { list: [
          `Mỗi đêm còn thiếu: **phí trễ ${pct(P2P.lateFee)}** trên số còn nợ và **${String(CREDIT.late).replace("-", "−")} điểm** tín dụng của người vay.`,
          "Đang có khoản trễ thì người vay không đăng thêm yêu cầu vay ngang hàng nào được.",
          `Trễ **${P2P.defaultAfter} đêm** là **⛔ Vỡ nợ**: người vay bị **${String(CREDIT.defaulted).replace("-", "−")} điểm** và **cấm vay ${P2P_EXTRA.banDays} ngày** (cả ở ngân hàng).`,
          `Từ lúc vỡ nợ, mỗi đêm ngân hàng giữ **${pct(P2P.garnish)} số dư ví** của người vay để trả dần cho người cho vay, tới khi hết nợ. Người vay vẫn có thể tự bấm **Trả hết** bất cứ lúc nào.`,
        ] },
        { warn: `Cho vay là chịu rủi ro thật. Ngân hàng chỉ đứng giữa, **không đền** cho bạn: người vay vỡ nợ mà ví trống thì bạn chỉ thu lại dần, có khi rất lâu. Xem kỹ điểm tín dụng, chia nhỏ số tiền cho nhiều người, và đừng cho vay số xu bạn sắp cần.` },
        { p: `Với người vay, một khoản bỏ mặc tới vỡ nợ mất ${P2P.defaultAfter} × ${-CREDIT.late} + ${-CREDIT.defaulted} = **${P2P.defaultAfter * -CREDIT.late - CREDIT.defaulted} điểm**, giống như vỡ nợ ngân hàng (ngân hàng cấm ${LOANS.banDays} ngày).` },
      ],
    },
    {
      id: "vi-du",
      title: "Ví dụ có số thật",
      blocks: [
        { p: `**Trả đúng hạn.** Bạn hạng ${EX.tier.icon} ${EX.tier.name} (ngân hàng giữ ${pct(cutOf[EX.tier.key])} tiền lãi) đăng vay **${xu(EX.amount)}, ${EX.term} ngày, ${pct(EX.rate)}/ngày**.` },
        { table: { head: ["Ai", "Bỏ ra", "Nhận về", "Lời / lỗ"], rows: [
          ["Người vay", xu(exOwed), xu(EX.amount), `−${xu(exInterest)} tiền lãi`],
          ["Người cho vay", xu(EX.amount), xu(exSplit.lender), `+${xu(exSplit.lender - EX.amount)}`],
          ["Ngân hàng trung gian", "", xu(exSplit.bank), `${pct(cutOf[EX.tier.key])} của ${xu(exInterest)}`],
        ] } },
        { p: `Tiền lãi: ${EX.amount.toLocaleString("vi-VN")} × ${pct(EX.rate)} × ${EX.term} = ${xu(exInterest)}. Để so sánh, gửi kỳ hạn ${EX.term} ngày ở [Ngân hàng](ngan-hang) lúc lãi cơ bản ${pct(BANK.defaultRate)} được ${pct(depositRate)}/ngày, tức ${xu(depositInterest)}: ít hơn, nhưng không có rủi ro.` },
        { p: `**Trễ ${LATE_NIGHTS} đêm rồi mới trả.** Cùng khoản trên, người vay tiêu hết tiền nên ${LATE_NIGHTS} đêm đầu không thu được gì:` },
        { table: { head: ["Đêm", "Thu được", "Phí", "Còn nợ", "Điểm người vay"], rows: lateRows } },
        { p: `Người vay trả tổng ${xu(lateOwed)} và mất ${LATE_NIGHTS * -CREDIT.late - P2P_EXTRA.repaidCredit} điểm sau khi cộng ${P2P_EXTRA.repaidCredit} điểm trả xong. Người cho vay nhận ${xu(lateSplit.lender)} (lời ${xu(lateSplit.lender - EX.amount)}), ngân hàng giữ ${xu(lateSplit.bank)}.` },
      ],
    },
  ],
};
