import type { WikiArticle } from "../types";
import { UNLOCKS } from "../rules";
import { BANK_LOAN, P2P_EXTRA } from "../rules-credit";
import { CREDIT, LOANS, TIERS, ceilCoins, installment, loanLimit, loanRate } from "@/petdex/server/rules/production.js";
import { BANK } from "@/petdex/server/rules/bank.js";
import { HUI, P2P, p2pLimit } from "@/petdex/server/rules/finance.js";

// Điểm tín dụng, bốn hạng và vay trả góp ở ngân hàng (petdex/server/credit.js, rules/production.js).
// Mọi con số đọc từ luật của game hoặc lib/wiki/rules-credit.ts (có test đối chiếu).

const xu = (n: number) => `${n.toLocaleString("vi-VN")} xu`;
const pct = (x: number) => `${String(+(x * 100).toFixed(2)).replace(".", ",")}%`;
const signed = (n: number) => (n > 0 ? `+${n}` : `−${-n}`);
const terms = (LOANS.terms as number[]).join(", ");
const tierBy = (key: string) => TIERS.find((t) => t.key === key)!;
const p2pCut = P2P.cut as Record<string, number>;

// ---------------------------------------------------------------- ví dụ vay trả góp

const EX = { principal: 1_050, term: 7, tier: tierBy("silver") };
const exRate = loanRate(BANK.defaultRate, EX.tier.min);
const exFee = ceilCoins(EX.principal * LOANS.originationFee);

/** Các kỳ trả góp của một khoản trả đúng hạn, tính bằng đúng hàm của game. */
function schedule(principal: number, term: number, rate: number) {
  const rows: (string | number)[][] = [];
  let remaining = principal;
  let interest = 0;
  for (let night = 1; remaining > 0 && night <= term; night++) {
    const due = installment({ principal, remaining, rate, term_days: term, fees: 0 }, false);
    rows.push([`Đêm ${night}`, remaining, due.interest, due.principal, due.total]);
    remaining -= due.principal;
    interest += due.interest;
  }
  return { rows, interest, nights: rows.length };
}
const ex = schedule(EX.principal, EX.term, exRate);
const exCredit = ex.nights * CREDIT.onTime + CREDIT.repaid;
// Một kỳ lãi tròn: game làm tròn tới 6 chữ số thập phân rồi mới làm tròn lên xu (rules/production.js ceilCoins).
const ROUND = 1_000;
const roundInterest = installment({ principal: ROUND, remaining: ROUND, rate: exRate, term_days: 1, fees: 0 }, false).interest;

// Ví dụ hạn mức: hạng Bạc, thu nhập bình quân 300 xu/ngày, tiết kiệm 1.000 xu, chưa nợ gì.
const LIM = { income: 300, savings: 1_000 };
const limEx = loanLimit({ score: EX.tier.min, avgIncome: LIM.income, savings: LIM.savings, outstanding: 0 });

const worstCase = LOANS.defaultAfter * CREDIT.late + CREDIT.defaulted;

export const article: WikiArticle = {
  slug: "tin-dung",
  title: "Tín dụng và vay",
  category: "kinh-te",
  emoji: "💳",
  summary: `Điểm tín dụng ${CREDIT.min}–${CREDIT.max} lên xuống vì đâu, bốn hạng và hạn mức, vay trả góp ở ngân hàng từ cấp ${UNLOCKS.advanced} và cái giá của trễ hạn, vỡ nợ.`,
  keywords: ["vay", "nợ", "tín dụng", "điểm tín dụng", "trả góp", "nợ xấu", "vỡ nợ", "hạn mức", "tài chính nâng cao", "lãi vay", "phí giải ngân", "hạng"],
  related: ["ngan-hang", "vay-ngang-hang", "hui", "kinh-te-vi-mo", "khu-cong-nghiep", "tai-chinh"],
  sections: [
    {
      id: "diem",
      title: "Điểm tín dụng",
      blocks: [
        { p: `Ai cũng có **điểm tín dụng**, bắt đầu từ **${CREDIT.start} điểm**, trong thang **${CREDIT.min}–${CREDIT.max}** (chạm trần hay chạm đáy thì dừng ở đó). Điểm cho thấy bạn giữ lời hứa tới đâu: điểm cao thì vay được nhiều hơn, lãi thấp hơn. Xem điểm và **🕑 Thay đổi gần đây** ở màn **💳 Tín dụng**.` },
        { table: { head: ["Việc", "Điểm"], rows: [
          ["Trả một kỳ góp ngân hàng đúng hạn", signed(CREDIT.onTime)],
          ["Tất toán một khoản vay ngân hàng", signed(CREDIT.repaid)],
          ["Trả xong một khoản [vay ngang hàng](vay-ngang-hang)", signed(P2P_EXTRA.repaidCredit)],
          ["Mỗi đêm hợp đồng cung ứng giao và trả đủ (cả hai bên)", signed(CREDIT.contractDay)],
          ["Trễ một kỳ trả góp, hoặc một đêm trễ hạn vay ngang hàng", signed(CREDIT.late)],
          ["Bỏ [hụi](hui) khi chưa hốt", signed(HUI.creditPenaltyBeforeWin)],
          ["Phá hợp đồng cung ứng", signed(CREDIT.contractBroken)],
          ["Quầy hoặc xưởng bị đóng vì nợ tiền thuê", signed(CREDIT.evicted)],
          ["Bỏ hụi sau khi đã hốt (giật hụi)", signed(HUI.creditPenalty)],
          [`Vỡ nợ (trễ ${LOANS.defaultAfter} kỳ liền), ngân hàng hay vay ngang hàng`, signed(CREDIT.defaulted)],
        ] } },
        { tip: `Chưa vay được thì cứ giữ chữ tín với hợp đồng cung ứng ở [Khu công nghiệp](khu-cong-nghiep): mỗi đêm giao đủ là ${signed(CREDIT.contractDay)} điểm cho cả bên bán lẫn bên mua.` },
        { warn: `Tất toán một khoản **đã vỡ nợ** thì không được cộng điểm tất toán.` },
      ],
    },
    {
      id: "hang",
      title: "Hạng và hạn mức",
      blocks: [
        { p: "Điểm chia thành bốn hạng. Hạng quyết định hạn mức tối đa, phụ phí lãi khi vay ngân hàng, và cả hạn mức lẫn phí trung gian khi vay ngang hàng." },
        { table: {
          head: ["Hạng", "Từ điểm", "Hạn mức vay ngân hàng", "Phụ phí lãi", "Hạn mức vay ngang hàng", "Ngân hàng giữ (P2P)"],
          rows: TIERS.map((t) => [
            `${t.icon} ${t.name}`, Math.max(CREDIT.min, t.min), xu(t.limit), `+${pct(t.premium)}/ngày`, xu(p2pLimit(t.min)), `${pct(p2pCut[t.key])} tiền lãi`,
          ]),
        } },
        { p: "Hạn mức của hạng chỉ là trần. **Hạn mức thực tế** khi vay ngân hàng là:" },
        { list: [
          "Lấy số nhỏ hơn giữa **hạn mức hạng** và **(3 × thu nhập bình quân 7 ngày qua + 50% tiền tiết kiệm)**,",
          "rồi trừ đi **dư nợ đang có** (gốc còn lại cộng lãi, phí còn nợ).",
        ] },
        { p: `Ví dụ: hạng ${EX.tier.icon} ${EX.tier.name}, thu nhập bình quân ${xu(LIM.income)}/ngày, tiết kiệm ${xu(LIM.savings)}, chưa nợ gì: 3 × ${LIM.income} + ${LIM.savings.toLocaleString("vi-VN")} ÷ 2 = ${(3 * LIM.income + LIM.savings / 2).toLocaleString("vi-VN")}, nhỏ hơn hạn mức hạng ${xu(EX.tier.limit)}, nên vay được tối đa **${xu(limEx)}**.` },
        { tip: "Thu nhập tính từ các khoản thu vào ví (lương, bán hàng, lãi...). Gửi thêm tiết kiệm cũng nới hạn mức." },
      ],
    },
    {
      id: "vay",
      title: "Vay trả góp ở ngân hàng",
      blocks: [
        { steps: [
          `Có một bé đạt **cấp ${UNLOCKS.advanced}**, rồi bấm **🎓 Bật Tài chính nâng cao** ở màn 💳 Tín dụng (máy chủ có thể tắt chế độ này).`,
          `Tài khoản đủ **${LOANS.minAccountDays} ngày tuổi**, không bị cấm vay, không có khoản nào đang trễ hạn hay vỡ nợ.`,
          `Chọn số tiền (từ **${xu(BANK_LOAN.min)}** tới hạn mức còn lại) và kỳ hạn **${terms} ngày**, rồi bấm **💳 Vay ngay**.`,
        ] },
        { list: [
          `Mỗi lúc có tối đa **${BANK_LOAN.maxOpen} khoản vay**.`,
          `**Lãi mỗi ngày** = lãi suất cơ bản + phụ phí hạng, cộng thêm phụ phí lạm phát khi lượng xu tăng quá ${pct(BANK.targetGrowth)}/tuần (phần vượt chia 7). Lãi chốt lúc vay, không đổi về sau.`,
          `Lãi suất cơ bản ban đầu là **${pct(BANK.defaultRate)}/ngày**, Ngân hàng Trung ương chỉnh mỗi tuần (xem [Kinh tế vĩ mô](kinh-te-vi-mo)).`,
          `**Phí giải ngân ${pct(LOANS.originationFee)}** trừ ngay khi nhận tiền, nên vào ví ít hơn số vay một chút.`,
          "Một nửa tiền lãi và phí vào ngân sách thị trấn, nửa còn lại bị hủy khỏi nền kinh tế.",
        ] },
      ],
    },
    {
      id: "tra-gop",
      title: "Trả góp mỗi đêm",
      blocks: [
        { p: "Lúc quyết toán nửa đêm (giờ Việt Nam), ngân hàng **tự trừ một kỳ** từ ví, thiếu thì lấy sang tiết kiệm. Kỳ đầu tiên là **ngay nửa đêm hôm vay**." },
        { list: [
          `**Lãi kỳ này** = dư nợ gốc × lãi/ngày, làm tròn lên tới xu (dư nợ ${xu(ROUND)} ở lãi ${pct(exRate)} là đúng ${xu(roundInterest)}).`,
          "**Gốc kỳ này** = số vay ÷ số ngày (làm tròn lên). Tới hạn mà còn gốc thì phải trả hết.",
          "Cộng thêm lãi và phí còn nợ từ các kỳ trước (nếu có).",
        ] },
        { p: `Ví dụ: hạng ${EX.tier.icon} ${EX.tier.name} lúc lãi cơ bản ${pct(BANK.defaultRate)}, lãi vay là ${pct(BANK.defaultRate)} + ${pct(EX.tier.premium)} = **${pct(exRate)}/ngày**. Vay **${xu(EX.principal)} trong ${EX.term} ngày**, phí giải ngân ${xu(exFee)} nên ví nhận ${xu(EX.principal - exFee)}.` },
        { table: { head: ["Kỳ", "Dư nợ đầu kỳ", "Lãi", "Gốc", "Tổng kỳ"], rows: ex.rows } },
        { p: `Tổng cộng: trả ${xu(EX.principal)} gốc + ${xu(ex.interest)} lãi + ${xu(exFee)} phí = **${xu(EX.principal + ex.interest + exFee)}**. Trả đủ cả ${ex.nights} kỳ thì điểm tín dụng tăng ${ex.nights} × ${CREDIT.onTime} + ${CREDIT.repaid} = **+${exCredit} điểm**.` },
        { tip: "Bấm **Trả nợ** hoặc **Trả hết** để trả trước bất cứ lúc nào: tiền trả đi vào lãi, phí còn nợ trước rồi tới gốc, không kèm lãi của hôm đó. Gốc giảm sớm thì lãi các kỳ sau tính trên dư nợ nhỏ hơn; trả hết trong ngày thì đêm đó không còn kỳ nào." },
      ],
    },
    {
      id: "tre-han",
      title: "Trễ hạn và vỡ nợ",
      blocks: [
        { p: "Nửa đêm mà ví và tiết kiệm cộng lại không đủ một kỳ thì ngân hàng lấy được bao nhiêu hay bấy nhiêu, phần thiếu thành **trễ kỳ**:" },
        { list: [
          `Cộng **phí trễ ${pct(LOANS.lateFee)}** trên phần còn nợ, và **${signed(CREDIT.late)} điểm** tín dụng.`,
          "Đang có khoản trễ thì không vay thêm được.",
          "Kỳ sau trả đủ (hoặc tự trả hết phần lãi, phí còn nợ) thì khoản vay hết trễ, đếm lại từ đầu.",
          `Trễ **${LOANS.defaultAfter} kỳ liền** là **vỡ nợ**: thêm **${signed(CREDIT.defaulted)} điểm** và **cấm vay ${LOANS.banDays} ngày** (cả ngân hàng lẫn vay ngang hàng).`,
          `Khoản đã vỡ nợ **vẫn tính lãi** mỗi đêm như cũ. Ngân hàng giữ **${pct(LOANS.garnish)} thu nhập trong ngày** của bạn (lấy từ ví, thiếu thì lấy sang tiết kiệm) để trả lãi, phí còn nợ rồi tới gốc; phần còn nợ sau đó lại bị cộng **phí trễ ${pct(LOANS.lateFee)}**. Cứ thế cho tới khi hết nợ.`,
        ] },
        { warn: `Một khoản bỏ mặc tới vỡ nợ mất tổng cộng ${LOANS.defaultAfter} × ${-CREDIT.late} + ${-CREDIT.defaulted} = **${-worstCase} điểm**, đủ kéo người vừa lên ${TIERS[2].icon} ${TIERS[2].name} (${TIERS[2].min} điểm) xuống tận ${TIERS[0].icon} ${TIERS[0].name}. Đừng vay quá sức trả mỗi đêm.` },
      ],
    },
    {
      id: "lien-thong",
      title: "Điểm tín dụng dùng ở đâu nữa",
      blocks: [
        { list: [
          `**[Vay ngang hàng](vay-ngang-hang)** (mở từ cấp ${UNLOCKS.bank}, không cần Tài chính nâng cao): hạn mức gấp ${P2P.limitMultiplier} hạn mức hạng, ngân hàng trung gian giữ ${pct(p2pCut.diamond)}–${pct(p2pCut.bronze)} tiền lãi tùy hạng. Người cho vay thấy điểm và hạng của bạn trên **🏪 Chợ vay** trước khi rót vốn.`,
          `**[Hụi](hui)**: không cần điểm để vào dây, nhưng bỏ hụi thì bị trừ ${-HUI.creditPenaltyBeforeWin} điểm (chưa hốt) hoặc ${-HUI.creditPenalty} điểm (đã hốt).`,
          "Lệnh **cấm vay** vì vỡ nợ dùng chung: vỡ nợ ở ngân hàng thì cũng không đăng yêu cầu vay ngang hàng được, và ngược lại.",
        ] },
      ],
    },
  ],
};
