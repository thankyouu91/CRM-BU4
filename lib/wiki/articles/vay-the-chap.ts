import type { WikiArticle } from "../types";
import { BANK } from "@/petdex/server/rules/bank.js";
import { CBANK, collateralOf, loanRateRange, maxLoanOn, simpleInterest } from "@/public/ta-tua/game/js/shared/clan-bank.js";

// Vay thế chấp ở ngân hàng gia tộc (petdex/server/clan-bank.js borrowFromBank, settleLoans, đấu giá lô siết nợ).
// Mọi con số đọc thẳng từ public/ta-tua/game/js/shared/clan-bank.js; tests/petfarm-wiki-sync-clan-bank.test.ts đối chiếu với code của game.

const xu = (n: number) => `${n.toLocaleString("vi-VN")} xu`;
const pct = (x: number) => `${String(+(x * 100).toFixed(3)).replace(".", ",")}%`;
const L = CBANK.loan;
const A = CBANK.auction;
const [lo, hi] = loanRateRange(BANK.defaultRate);

// Ví dụ: lô đất trị giá 300.000, đã xây công trình hết 80.000.
const EX = { land: 300_000, built: 80_000, term: 14, rate: lo * 3 };
const exValue = collateralOf(EX.land, EX.built);
const exMax = maxLoanOn(exValue);
const exAmount = 150_000;
const exOwed = exAmount + simpleInterest(exAmount, EX.rate, EX.term);
const exFee = Math.ceil(exAmount * L.fee);
const exLate = Math.ceil(exOwed * L.lateFee);
const exStart = Math.round(exValue * A.startShare);

export const article: WikiArticle = {
  slug: "vay-the-chap",
  title: "Vay thế chấp lô đất",
  category: "kinh-te",
  emoji: "📜",
  summary: `Gia tộc vay ngân hàng gia tộc khác, thế chấp một lô đất: vay tối đa ${pct(L.ltv)} giá trị lô, kỳ hạn ${L.terms.join(", ")} ngày. Quá hạn mà quỹ không đủ trả thì sau ${L.graceNights} đêm ân hạn, lô bị siết ra đấu giá.`,
  keywords: ["vay thế chấp", "thế chấp", "lô đất", "LTV", "siết nợ", "vỡ nợ", "đấu giá lô", "ngân hàng gia tộc", "vay gia tộc", "giải chấp"],
  related: ["ngan-hang-gia-toc", "gia-toc", "dau-truong", "vay-ngang-hang"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: `[Ngân hàng gia tộc](ngan-hang-gia-toc) đem tiền gửi và vốn chủ cho các gia tộc khác vay để mua đất, thâu tóm ngành hay xây công trình. Mỗi khoản vay giữ một **lô đất** của gia tộc vay làm tài sản thế chấp tới khi trả xong.` },
        { p: "Tiền vay vào thẳng **quỹ gia tộc**; tiền trả nợ cũng lấy từ quỹ gia tộc. Chỉ tộc trưởng được vay; tộc trưởng hoặc trưởng lão được trả nợ." },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { table: { head: ["Luật", "Con số"], rows: [
          ["Giá trị thế chấp", `Giá trị hiện tại của lô + ${pct(CBANK.buildingShare)} số xu đã chi xây công trình trên lô`],
          ["Số tiền vay", `Từ ${xu(L.minAmount)} tới ${pct(L.ltv)} giá trị thế chấp`],
          ["Kỳ hạn", `${L.terms.join(", ")} ngày`],
          ["Lãi", `Ngân hàng đặt, từ ${L.minRateMultiple} tới ${L.maxRateMultiple} × lãi suất cơ bản mỗi ngày (lúc lãi suất cơ bản ${pct(BANK.defaultRate)}: ${pct(lo)}–${pct(hi)}/ngày); lãi đơn, chốt lúc vay`],
          ["Phí giải ngân", `${pct(L.fee)} số tiền vay, trừ vào quỹ gia tộc vay, vào quỹ bảo hiểm tiền gửi`],
          ["Số khoản cùng lúc", `Mỗi gia tộc nợ tối đa ${L.maxOpen} khoản; mỗi lô chỉ thế chấp một khoản`],
          ["Ngân hàng phải còn tiền mặt", `Sau khi giải ngân vẫn giữ ≥ ${pct(CBANK.liquidityFloor)} tiền gửi, và không ai đang xếp hàng rút`],
          ["Trả nợ", "Trả một phần hay trả hết lúc nào cũng được (không giảm lãi khi trả sớm). Trả hết thì lô được giải chấp"],
          ["Lô đang thế chấp", "Vẫn chạy ngành và có doanh thu như thường, nhưng không bán lại cho Sở Nhà Đất được"],
        ] } },
        { p: `**Không cho vay chính mình hay gia tộc liên quan:** ngân hàng không cho gia tộc chủ của nó vay, cũng không cho gia tộc có người ra vào giữa hai bên trong **${CBANK.relatedDays} ngày** gần đây, hay có thành viên vào game qua cùng một link mời.` },
        { p: `**Ví dụ:** lô trị giá ${xu(EX.land)}, đã xây ${xu(EX.built)}: giá trị thế chấp ${xu(exValue)}, vay được tối đa ${xu(exMax)}. Vay ${xu(exAmount)} kỳ ${EX.term} ngày ở ${pct(EX.rate)}/ngày: quỹ nhận ${xu(exAmount)} rồi trả ${xu(exFee)} phí, đáo hạn phải trả ${xu(exOwed)}.` },
        { table: { head: ["Đêm", "Chuyện gì xảy ra"], rows: [
          ["Đêm đáo hạn", "Hệ thống tự thu phần còn nợ từ quỹ gia tộc (rút cả tiền gửi kỳ hạn của quỹ, mất lãi). Đủ thì khoản vay xong"],
          ["Mỗi đêm còn thiếu", `Khoản vay thành "quá hạn", cộng phí trễ ${pct(L.lateFee)} phần còn nợ (ví dụ trên: +${xu(exLate)} đêm đầu)`],
          [`Quá ${L.graceNights} đêm ân hạn`, `Vỡ nợ: ngân hàng siết lô, mở phiên đấu giá ${A.hours} giờ, giá khởi điểm ${pct(A.startShare)} giá trị thế chấp (ví dụ trên: ${xu(exStart)})`],
        ] } },
        { p: `**Đấu giá lô siết nợ:** tộc trưởng hoặc trưởng lão gia tộc khác trả giá từ quỹ (mỗi lần cao hơn ít nhất ${pct(A.step)}); tiền giá cao nhất được giữ lại, bị trả cao hơn thì hoàn ngay về quỹ. Gia tộc phải còn chỗ chứa thêm lô theo cấp. Gia tộc vỡ nợ và ngân hàng chủ nợ không trả giá được.` },
        { list: [
          "**Ngân hàng giữ lô:** khi chưa ai trả giá, tộc trưởng ngân hàng có thể nhận lô về gia tộc mình thay cho khoản nợ (cần còn chỗ chứa lô).",
          "**Có người mua:** tiền bán trả ngân hàng tới hết phần còn nợ, phần dư về quỹ gia tộc vỡ nợ. Lô sang tên kèm công trình; gia tộc mua chưa có ngành của lô thì lô về trạng thái chưa chọn ngành.",
          "**Không ai mua:** Sở Nhà Đất mua lại lô theo giá bán lại đất; tiền chia như trên.",
          "**Gia tộc vay giải tán** khi còn nợ: lô đang thế chấp về thẳng ngân hàng chủ nợ.",
        ] },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { list: [
          "**Gia tộc vay:** mất lô là mất cả công trình đã xây trên đó; phí trễ cộng dồn mỗi đêm.",
          "**Ngân hàng:** lô có thể bán được ít hơn số còn nợ. Lô bị gia tộc khác giành qua [Đấu trường](dau-truong) trước khi siết thì khoản nợ không còn gì để thu (mất trắng).",
          "**Thanh khoản:** tiền cho vay chỉ về khi đáo hạn, trong khi người gửi có thể rút sớm bất cứ lúc nào.",
        ] },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { list: [
          "Một khoản vay đáng giá khi thứ bạn mua bằng nó làm ra nhiều hơn tiền lãi trong cùng số ngày.",
          "Giá trị thế chấp tính cả công trình, nhưng chỉ một phần số xu đã xây.",
          "Ngân hàng chọn lãi cho vay; người vay chọn ngân hàng. Hai bên đều nên so với lãi suất cơ bản.",
          "Lô đang thế chấp vẫn có thể là mục tiêu ở Đấu trường.",
        ] },
      ],
    },
  ],
};
