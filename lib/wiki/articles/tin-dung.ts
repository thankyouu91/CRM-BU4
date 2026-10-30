import type { WikiArticle } from "../types";
import { UNLOCKS } from "../rules";
import { BANK_LOAN, P2P_EXTRA } from "../rules-credit";
import { CREDIT, LOANS, TIERS, ceilCoins, installment, loanLimit, loanRate } from "@/petdex/server/rules/production.js";
import { BANK } from "@/petdex/server/rules/bank.js";
import { HUI, P2P, p2pLimit } from "@/petdex/server/rules/finance.js";

// Điểm tín dụng, bốn hạng và vay trả góp ở ngân hàng (petdex/server/credit.js, rules/production.js).
// Mọi con số đọc từ luật của game hoặc lib/wiki/rules-credit.ts (có test đối chiếu).
// Bài viết nói rõ từng chức năng làm gì; vay khi nào, bao nhiêu là việc người chơi tự quyết.

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
  summary: `Điểm tín dụng từ ${CREDIT.min} đến ${CREDIT.max} lên xuống vì đâu, bốn hạng và hạn mức, vay trả góp ở ngân hàng từ cấp ${UNLOCKS.advanced}, và chuyện gì xảy ra khi trễ kỳ hay vỡ nợ.`,
  keywords: ["vay", "nợ", "tín dụng", "điểm tín dụng", "trả góp", "nợ xấu", "vỡ nợ", "hạn mức", "tài chính nâng cao", "lãi vay", "phí giải ngân", "hạng", "cấm vay", "trả trước", "phụ phí lạm phát"],
  related: ["ngan-hang", "vay-ngang-hang", "hui", "kinh-te-vi-mo", "khu-cong-nghiep", "tai-chinh"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: `Ai cũng có **điểm tín dụng**, bắt đầu từ **${CREDIT.start} điểm**. Điểm ghi lại bạn giữ lời hứa tới đâu (trả nợ, giao hàng hợp đồng, đóng hụi) và quyết định bạn vay được bao nhiêu, với lãi bao nhiêu. Xem điểm, hạng và **🕑 Thay đổi gần đây** ở màn **💳 Tín dụng** (vào từ màn [Ngân hàng](ngan-hang)).` },
        { p: `**Vay trả góp ở ngân hàng** mở khi có một bé đạt **cấp ${UNLOCKS.advanced}** và bạn bấm **🎓 Bật Tài chính nâng cao** ở màn 💳 Tín dụng (máy chủ có thể tắt chế độ này). Điểm tín dụng còn dùng cho [vay ngang hàng](vay-ngang-hang) và bị ảnh hưởng bởi [hụi](hui).` },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { p: `**Điểm tín dụng** nằm trong thang **${CREDIT.min} đến ${CREDIT.max}** (chạm trần hay chạm đáy thì dừng ở đó).` },
        { table: { head: ["Việc", "Điểm"], rows: [
          ["Trả một kỳ góp ngân hàng đúng hạn", signed(CREDIT.onTime)],
          ["Tất toán một khoản vay ngân hàng (không tính khoản đã vỡ nợ)", signed(CREDIT.repaid)],
          ["Trả xong một khoản [vay ngang hàng](vay-ngang-hang) (không tính khoản đã vỡ nợ)", signed(P2P_EXTRA.repaidCredit)],
          ["Mỗi đêm hợp đồng cung ứng giao và trả đủ (cả hai bên)", signed(CREDIT.contractDay)],
          ["Trễ một kỳ trả góp, hoặc một đêm trễ hạn vay ngang hàng", signed(CREDIT.late)],
          ["Bỏ [hụi](hui) khi chưa hốt", signed(HUI.creditPenaltyBeforeWin)],
          ["Phá hợp đồng cung ứng", signed(CREDIT.contractBroken)],
          ["Quầy hoặc xưởng bị đóng vì nợ tiền thuê", signed(CREDIT.evicted)],
          ["Bỏ hụi sau khi đã hốt (giật hụi)", signed(HUI.creditPenalty)],
          [`Vỡ nợ (trễ ${LOANS.defaultAfter} kỳ liền), ngân hàng hay vay ngang hàng`, signed(CREDIT.defaulted)],
        ] } },
        { p: "**Hạng và hạn mức.** Điểm chia thành bốn hạng. Hạng quyết định hạn mức tối đa và phụ phí lãi khi vay ngân hàng, cùng hạn mức và phí trung gian khi vay ngang hàng." },
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
          "Thu nhập là các khoản thu vào **ví** (lương, bán hàng, lãi kỳ hạn, lãi cho vay ngang hàng...). Tiền vay, tiền rút từ tiết kiệm hay hốt hụi không tính; lãi tiết kiệm cộng thẳng vào tiết kiệm nên cũng không tính.",
        ] },
        { p: `Ví dụ công thức: hạng ${EX.tier.icon} ${EX.tier.name}, thu nhập bình quân ${xu(LIM.income)}/ngày, tiết kiệm ${xu(LIM.savings)}, chưa nợ gì: 3 × ${LIM.income} + ${LIM.savings.toLocaleString("vi-VN")} ÷ 2 = ${(3 * LIM.income + LIM.savings / 2).toLocaleString("vi-VN")}, nhỏ hơn hạn mức hạng ${xu(EX.tier.limit)}, nên vay được tối đa **${xu(limEx)}**.` },
        { p: "**Vay trả góp.** Ở khung **🏦 Vay trả góp**, nhập số tiền (hoặc bấm 25%, 50%, Tối đa), chọn kỳ hạn, xem bảng ước tính rồi bấm **💳 Vay ngay**. Điều kiện:" },
        { list: [
          `Đã bật Tài chính nâng cao, tài khoản đủ **${LOANS.minAccountDays} ngày tuổi**, không bị cấm vay, không có khoản vay ngân hàng nào đang trễ hay vỡ nợ.`,
          `Số tiền từ **${xu(BANK_LOAN.min)}** tới hạn mức còn lại, kỳ hạn **${terms} ngày**, mỗi lúc tối đa **${BANK_LOAN.maxOpen} khoản vay**.`,
          `**Lãi mỗi ngày** = lãi suất cơ bản + phụ phí hạng + phụ phí lạm phát. Phụ phí lạm phát = (mức tăng xu tuần trước − ${pct(BANK.targetGrowth)}) ÷ 7, chỉ có khi xu tăng quá ${pct(BANK.targetGrowth)}/tuần. Lãi **chốt lúc vay**, không đổi về sau.`,
          `Lãi suất cơ bản ban đầu là **${pct(BANK.defaultRate)}/ngày**, Ngân hàng Trung ương chỉnh mỗi tuần (xem [Ngân hàng](ngan-hang)).`,
          `**Phí giải ngân ${pct(LOANS.originationFee)}** (làm tròn lên) trừ ngay khi nhận tiền, nên vào ví ít hơn số vay.`,
          "Một nửa tiền lãi và phí vào ngân sách thị trấn, nửa còn lại bị hủy khỏi nền kinh tế.",
        ] },
        { p: "**Trả góp mỗi đêm.** Lúc quyết toán nửa đêm (giờ Việt Nam), ngân hàng **tự trừ một kỳ** từ ví, thiếu thì lấy sang tiết kiệm. Kỳ đầu tiên là **ngay nửa đêm hôm vay**. Mỗi kỳ gồm:" },
        { list: [
          `**Lãi** = dư nợ gốc × lãi/ngày, làm tròn lên tới xu (dư nợ ${xu(ROUND)} ở lãi ${pct(exRate)} là đúng ${xu(roundInterest)}).`,
          "**Gốc** = số vay ÷ số ngày (làm tròn lên). Tới hạn mà còn gốc thì phải trả hết.",
          "Cộng thêm lãi và phí còn nợ từ các kỳ trước (nếu có). Thẻ khoản vay hiện trước **🌙 Kỳ tối nay** bao nhiêu.",
        ] },
        { p: `Ví dụ công thức: hạng ${EX.tier.icon} ${EX.tier.name} lúc lãi cơ bản ${pct(BANK.defaultRate)}, không có phụ phí lạm phát: lãi vay ${pct(BANK.defaultRate)} + ${pct(EX.tier.premium)} = **${pct(exRate)}/ngày**. Vay **${xu(EX.principal)} trong ${EX.term} ngày**, phí giải ngân ${xu(exFee)} nên ví nhận ${xu(EX.principal - exFee)}.` },
        { table: { head: ["Kỳ", "Dư nợ đầu kỳ", "Lãi", "Gốc", "Tổng kỳ"], rows: ex.rows } },
        { p: `Tổng cộng: ${xu(EX.principal)} gốc + ${xu(ex.interest)} lãi + ${xu(exFee)} phí = **${xu(EX.principal + ex.interest + exFee)}**. Trả đủ cả ${ex.nights} kỳ thì điểm tín dụng tăng ${ex.nights} × ${CREDIT.onTime} + ${CREDIT.repaid} = **+${exCredit} điểm**.` },
        { p: "**Trả trước.** Nhập số xu rồi bấm **Trả nợ** (nút **Trả hết** điền sẵn toàn bộ số nợ), bất cứ lúc nào, bằng xu trong **ví**. Tiền trả đi vào lãi, phí còn nợ trước rồi tới gốc, không tính lãi của hôm đó. Lãi các kỳ sau tính trên dư nợ gốc còn lại; trả hết trong ngày thì đêm đó không còn kỳ nào." },
        { p: "**Trễ kỳ.** Nửa đêm mà ví và tiết kiệm cộng lại không đủ một kỳ thì ngân hàng lấy được bao nhiêu hay bấy nhiêu, phần thiếu thành **trễ kỳ**:" },
        { list: [
          `Cộng **phí trễ ${pct(LOANS.lateFee)}** trên toàn bộ phần còn nợ (gốc còn lại cộng lãi, phí chưa trả), và **${signed(CREDIT.late)} điểm** tín dụng.`,
          "Đang có khoản trễ thì không vay ngân hàng thêm được.",
          "Kỳ sau trả đủ, hoặc tự trả hết phần lãi và phí còn nợ, thì khoản vay hết trễ và số kỳ trễ đếm lại từ đầu.",
        ] },
        { p: `**Vỡ nợ.** Trễ **${LOANS.defaultAfter} kỳ liền** là vỡ nợ: thêm **${signed(CREDIT.defaulted)} điểm** và **cấm vay ${LOANS.banDays} ngày** (cả ngân hàng lẫn vay ngang hàng). Khoản đã vỡ nợ không trừ kỳ góp nữa mà:` },
        { list: [
          "Vẫn **tính lãi** mỗi đêm như cũ.",
          `Mỗi đêm ngân hàng giữ **${pct(LOANS.garnish)} thu nhập trong ngày** của bạn (lấy từ ví, thiếu thì lấy sang tiết kiệm) để trả lãi, phí còn nợ rồi tới gốc.`,
          `Phần còn nợ sau đó lại bị cộng **phí trễ ${pct(LOANS.lateFee)}**. Cứ thế tới khi hết nợ. Bạn vẫn tự trả bằng **Trả nợ** được.`,
          "Tất toán một khoản đã vỡ nợ thì không được cộng điểm tất toán.",
        ] },
        { p: "**Liên thông với vay ngang hàng và hụi.**" },
        { list: [
          `[Vay ngang hàng](vay-ngang-hang) mở từ cấp ${UNLOCKS.bank}, không cần Tài chính nâng cao. Hạn mức gấp ${P2P.limitMultiplier} hạn mức hạng, ngân hàng trung gian giữ ${pct(p2pCut.diamond)} đến ${pct(p2pCut.bronze)} tiền lãi tùy hạng. Người cho vay thấy điểm và hạng của bạn trên **🏪 Chợ vay**.`,
          `[Hụi](hui) không cần điểm để vào dây, nhưng bỏ hụi thì bị trừ ${-HUI.creditPenaltyBeforeWin} điểm (chưa hốt) hoặc ${-HUI.creditPenalty} điểm (đã hốt).`,
          "Lệnh **cấm vay** vì vỡ nợ dùng chung: vỡ nợ ở ngân hàng thì cũng không đăng yêu cầu vay ngang hàng được, và ngược lại.",
        ] },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { list: [
          "Ngân hàng tự trừ kỳ góp lúc nửa đêm, **lấy cả tiết kiệm** khi ví không đủ.",
          `Một khoản bỏ mặc tới vỡ nợ mất tổng cộng ${LOANS.defaultAfter} × ${-CREDIT.late} + ${-CREDIT.defaulted} = **${-worstCase} điểm**, đủ kéo người vừa lên ${TIERS[2].icon} ${TIERS[2].name} (${TIERS[2].min} điểm) xuống tận ${TIERS[0].icon} ${TIERS[0].name}.`,
          `Nợ đã vỡ **không đứng yên**: lãi và phí trễ ${pct(LOANS.lateFee)} vẫn cộng mỗi đêm, trong khi ngân hàng giữ ${pct(LOANS.garnish)} thu nhập mỗi ngày. Ngày không có thu nhập thì nợ chỉ tăng.`,
          `Bị cấm vay ${LOANS.banDays} ngày ở cả ngân hàng lẫn vay ngang hàng.`,
          "Lãi chốt lúc vay: tuần sau lãi cơ bản xuống thì khoản đang vay vẫn giữ mức cũ.",
          "Phí giải ngân không hoàn lại, kể cả khi trả hết ngay trong ngày.",
          "Dư nợ trừ thẳng vào hạn mức: còn nợ thì hạn mức vay thêm nhỏ lại.",
        ] },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { list: [
          "Bảng điểm có những dòng cộng điểm mỗi đêm mà không cần vay đồng nào.",
          "Hạn mức nhìn vào cả thu nhập 7 ngày qua lẫn tiền tiết kiệm, không chỉ vào hạng.",
          "Lãi mỗi kỳ tính trên dư nợ gốc còn lại, còn phí giải ngân thì tính một lần trên cả khoản.",
          "Phụ phí lạm phát lấy từ mức tăng xu của tuần trước, con số đăng trên báo sau mỗi buổi họp của Ngân hàng Trung ương.",
        ] },
      ],
    },
  ],
};
