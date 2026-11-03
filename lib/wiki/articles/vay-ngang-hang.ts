import type { WikiArticle } from "../types";
import { UNLOCKS } from "../rules";
import { P2P_EXTRA } from "../rules-credit";
import { CREDIT, LOANS, TIERS, ceilCoins } from "@/petdex/server/rules/production.js";
import { P2P, p2pInterest, p2pLimit, splitRepayment } from "@/petdex/server/rules/finance.js";

// Vay ngang hàng qua Ngân hàng Trân Châu làm trung gian (petdex/server/p2p.js, rules/finance.js P2P).
// Mọi con số đọc từ luật của game hoặc lib/wiki/rules-credit.ts (có test đối chiếu).
// Bài viết nói rõ từng chức năng làm gì; đặt lãi bao nhiêu, cho ai vay là việc người chơi tự quyết.

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

// ---------------------------------------------------------------- ví dụ trễ hạn: 2 đêm không trả, đêm thứ 3 trả đủ

const LATE_NIGHTS = 2;
const lateRows: (string | number)[][] = [];
let lateOwed = exOwed;
for (let night = 1; night <= LATE_NIGHTS; night++) {
  const fee = ceilCoins(lateOwed * P2P.lateFee);
  lateOwed += fee;
  lateRows.push([`Đêm đáo hạn${night > 1 ? ` +${night - 1}` : ""}`, "Ví và tiết kiệm trống", `+${xu(fee)} phí trễ`, xu(lateOwed), String(CREDIT.late).replace("-", "−")]);
}
const lateSplit = payout(EX.amount, lateOwed, cutOf[EX.tier.key]);
lateRows.push([`Đêm đáo hạn +${LATE_NIGHTS}`, `Thu đủ ${xu(lateOwed)}`, "", "0 xu", `+${P2P_EXTRA.repaidCredit}`]);

// ---------------------------------------------------------------- bảng theo hạng

const RISK = { amount: 2_000, term: 7, rate: 0.01 };
const riskInterest = p2pInterest(RISK.amount, RISK.rate, RISK.term);
const riskRows = [...TIERS].reverse().map((t) => {
  const cut = cutOf[t.key];
  const s = payout(RISK.amount, RISK.amount + riskInterest, cut);
  return [`${t.icon} ${t.name}`, `${Math.max(CREDIT.min, t.min)}+`, xu(p2pLimit(t.min)), pct(cut), xu(s.lender - RISK.amount), xu(s.bank)];
});

const minus = (n: number) => String(n).replace("-", "−");

export const article: WikiArticle = {
  slug: "vay-ngang-hang",
  title: "Vay ngang hàng (P2P)",
  category: "kinh-te",
  emoji: "🤝",
  summary: `Người chơi cho nhau vay ${terms} ngày qua Ngân hàng Trân Châu làm trung gian: người vay tự đặt lãi ${pct(rateLo)} đến ${pct(rateHi)}/ngày, ngân hàng giữ ${pct(cutOf.diamond)} đến ${pct(cutOf.bronze)} tiền lãi, người cho vay nhận phần còn lại và tự chịu rủi ro.`,
  keywords: ["p2p", "vay ngang hàng", "cho vay", "chợ vay", "rót vốn", "lãi", "người vay", "người cho vay", "phí trung gian", "trễ hạn", "vỡ nợ", "đăng yêu cầu vay", "rút yêu cầu"],
  related: ["tin-dung", "hui", "ngan-hang", "tai-chinh"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: `Vay ngang hàng là người chơi cho người chơi khác vay xu, với **Ngân hàng Trân Châu** đứng giữa thu nợ và giữ một phần tiền lãi. Vào màn **🤝 Vay ngang hàng & Hụi** (từ màn [Ngân hàng](ngan-hang)), tab **🤝 Vay ngang hàng**.` },
        { p: `Mở từ **cấp ${UNLOCKS.bank}** (cùng lúc với Ngân hàng), **không cần** bật Tài chính nâng cao như [vay ngân hàng](tin-dung). Ai cũng có thể vừa đi vay vừa cho vay.` },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { p: "**Một khoản vay đi qua các bước:**" },
        { steps: [
          "**Người vay** điền **📝 Đăng yêu cầu vay**: số tiền, kỳ hạn và lãi mỗi ngày tự đặt, rồi bấm **Đăng yêu cầu**. Khung ước tính dưới form cho biết đáo hạn phải trả bao nhiêu, người cho vay nhận bao nhiêu và ngân hàng giữ bao nhiêu.",
          "Yêu cầu hiện trên **🏪 Chợ vay**. **Người cho vay** bấm **Cho vay** để rót **đủ cả khoản một lần** từ ví của mình; tiền chuyển thẳng vào ví người vay và kỳ hạn bắt đầu tính từ lúc đó.",
          "Tới ngày đáo hạn, lúc quyết toán nửa đêm, hệ thống tự thu **gốc + lãi một lần** từ ví người vay (thiếu thì lấy sang tiết kiệm).",
          "Ngân hàng chuyển gốc cho người cho vay trước, rồi tới tiền lãi sau khi **giữ lại phí trung gian**. Phí này vào ngân sách thị trấn.",
        ] },
        { p: "**Tiền lãi** = số tiền × lãi/ngày × số ngày, làm tròn tới xu, cố định từ lúc đăng. **Phí trung gian** là một phần trăm của tiền lãi, theo hạng tín dụng của người vay **lúc đăng yêu cầu**, và giữ nguyên cho cả khoản dù sau đó điểm lên hay xuống." },
        { p: "**Luật cho người vay**" },
        { table: { head: ["Luật", "Giá trị"], rows: [
          ["Số tiền", `từ ${xu(P2P.minAmount)} tới **${P2P.limitMultiplier} lần hạn mức hạng** của bạn (xem bảng ở [Tín dụng và vay](tin-dung))`],
          ["Kỳ hạn", `${terms} ngày`],
          ["Lãi tự đặt", `${pct(rateLo)} tới ${pct(rateHi)} mỗi ngày`],
          ["Yêu cầu nằm trên chợ", `${P2P.listDays} ngày, không ai rót vốn thì **Hết hạn đăng**`],
          ["Số khoản cùng lúc", `tối đa ${P2P.maxOpen} (tính cả yêu cầu đang chờ lẫn khoản đang nợ)`],
          ["Tài khoản", `đủ ${P2P.minAccountDays * 24} giờ tuổi, không bị cấm vay, không có khoản vay ngang hàng nào đang trễ hạn hay vỡ nợ`],
          ["Trả xong", `+${P2P_EXTRA.repaidCredit} điểm tín dụng (trừ khi khoản đó đã vỡ nợ)`],
        ] } },
        { list: [
          "Chưa ai rót vốn thì bấm **Rút yêu cầu** để gỡ xuống, không mất gì.",
          "Bấm **Trả hết** để trả sớm bất cứ lúc nào, bằng xu trong **ví**: trả đủ gốc và **cả tiền lãi đã thỏa thuận**, trả sớm không bớt lãi.",
          "Theo dõi ở **📥 Khoản bạn vay**: trạng thái, còn nợ bao nhiêu, đáo hạn khi nào, đã trễ mấy ngày.",
        ] },
        { p: "**Luật cho người cho vay**" },
        { list: [
          `Ai mở được Ngân hàng (cấp ${UNLOCKS.bank}) và có đủ xu trong ví đều cho vay được, trừ cho chính mình. Không cần điểm tín dụng.`,
          "Mỗi dòng trên **🏪 Chợ vay** cho thấy người vay, **điểm tín dụng và hạng**, số tiền, kỳ hạn, lãi/ngày, phần trăm ngân hàng giữ và cột **Bạn nhận về** (gốc + lãi sau phí nếu trả đúng hạn).",
          "Rót vốn là chuyển **toàn bộ số tiền** ngay, không chia nhỏ được, không rút lại được.",
          "Người vay trễ hạn thì **phí trễ cộng vào khoản nợ**. Khi thu được, phí trễ được chia như tiền lãi: bạn có phần, sau phí ngân hàng.",
          "Theo dõi ở **📤 Khoản bạn cho vay**.",
        ] },
        { table: { head: ["Hạng người vay", "Điểm", "Hạn mức P2P", "Ngân hàng giữ", `Lãi người cho vay nhận (${xu(RISK.amount)}, ${RISK.term} ngày, ${pct(RISK.rate)}/ngày)`, "Ngân hàng giữ (xu)"], rows: riskRows } },
        { p: "**Trễ hạn.** Nửa đêm ngày đáo hạn mà người vay không đủ tiền (ví cộng tiết kiệm) thì hệ thống thu được bao nhiêu chuyển bấy nhiêu, phần còn lại thành **⚠️ Trễ hạn**. Mỗi đêm sau đó hệ thống thử thu lại toàn bộ:" },
        { list: [
          `Mỗi đêm còn thiếu: **phí trễ ${pct(P2P.lateFee)}** trên số còn nợ và **${minus(CREDIT.late)} điểm** tín dụng của người vay.`,
          "Đang có khoản trễ thì người vay không đăng thêm yêu cầu vay ngang hàng nào được.",
        ] },
        { p: `**Vỡ nợ.** Trễ **${P2P.defaultAfter} đêm** là **⛔ Vỡ nợ**: người vay bị **${minus(CREDIT.defaulted)} điểm** và **cấm vay ${LOANS.banDays} ngày** (cả ở ngân hàng). Từ đó:` },
        { list: [
          `Mỗi đêm ngân hàng giữ **${pct(P2P.garnish)} thu nhập trong ngày** của người vay (lấy từ ví, thiếu thì lấy sang tiết kiệm) để trả dần cho người cho vay, tới khi hết nợ.`,
          "Khoản nợ **không cộng thêm phí trễ** nữa.",
          "Người vay vẫn tự bấm **Trả hết** được bất cứ lúc nào.",
        ] },
        { p: `**Ví dụ công thức: trả đúng hạn.** Người vay hạng ${EX.tier.icon} ${EX.tier.name} (ngân hàng giữ ${pct(cutOf[EX.tier.key])} tiền lãi) đăng vay **${xu(EX.amount)}, ${EX.term} ngày, ${pct(EX.rate)}/ngày**. Tiền lãi: ${EX.amount.toLocaleString("vi-VN")} × ${pct(EX.rate)} × ${EX.term} = ${xu(exInterest)}.` },
        { table: { head: ["Ai", "Bỏ ra", "Nhận về", "Chênh lệch"], rows: [
          ["Người vay", xu(exOwed), xu(EX.amount), `−${xu(exInterest)} tiền lãi`],
          ["Người cho vay", xu(EX.amount), xu(exSplit.lender), `+${xu(exSplit.lender - EX.amount)}`],
          ["Ngân hàng trung gian", "", xu(exSplit.bank), `${pct(cutOf[EX.tier.key])} của ${xu(exInterest)}`],
        ] } },
        { p: `**Ví dụ công thức: trễ ${LATE_NIGHTS} đêm rồi mới trả.** Cùng khoản trên, ${LATE_NIGHTS} đêm đầu không thu được gì:` },
        { table: { head: ["Đêm", "Thu được", "Phí", "Còn nợ", "Điểm người vay"], rows: lateRows } },
        { p: `Người vay trả tổng ${xu(lateOwed)} và mất ${LATE_NIGHTS * -CREDIT.late - P2P_EXTRA.repaidCredit} điểm sau khi cộng ${P2P_EXTRA.repaidCredit} điểm trả xong. Người cho vay nhận ${xu(lateSplit.lender)} (hơn số rót ${xu(lateSplit.lender - EX.amount)}), ngân hàng giữ ${xu(lateSplit.bank)}.` },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { p: "**Người cho vay**" },
        { list: [
          "Ngân hàng chỉ đứng giữa, **không đền** cho bạn. Người vay vỡ nợ mà ít thu nhập thì bạn chỉ thu lại dần, có khi rất lâu.",
          "Từ lúc vỡ nợ, khoản nợ không lớn thêm vì phí trễ nữa, nên phần bạn được chia cũng dừng ở đó.",
          "Số xu đã rót nằm ngoài tay bạn cho tới khi thu về: không rút lại, không chuyển cho người khác.",
        ] },
        { p: "**Người vay**" },
        { list: [
          `Một khoản bỏ mặc tới vỡ nợ mất ${P2P.defaultAfter} × ${-CREDIT.late} + ${-CREDIT.defaulted} = **${P2P.defaultAfter * -CREDIT.late - CREDIT.defaulted} điểm**, giống vỡ nợ ngân hàng, kèm ${LOANS.banDays} ngày cấm vay ở cả hai nơi.`,
          "Hệ thống thu nợ cả từ **tiết kiệm**, không chỉ từ ví.",
          "Trả sớm không bớt được tiền lãi.",
          "Lãi tự đặt là lãi thật bạn phải trả, cộng phí trễ nếu trễ hạn.",
        ] },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { list: [
          "Chợ vay là nơi người cho vay chọn giữa nhiều yêu cầu. Thử nhìn các yêu cầu đang treo trước khi đặt lãi của mình.",
          "Cột **Bạn nhận về** đã trừ phí ngân hàng, và điểm tín dụng của người vay nằm ngay cạnh tên.",
          "Phí trung gian chốt theo hạng lúc đăng, nên điểm tín dụng lúc bấm **Đăng yêu cầu** mới là điểm được tính.",
        ] },
      ],
    },
  ],
};
