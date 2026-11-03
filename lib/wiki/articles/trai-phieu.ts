import type { WikiArticle } from "../types";
import { UNLOCKS } from "../rules";
import { BANK } from "@/petdex/server/rules/bank.js";
import { BONDS, FINANCE_TAX, couponOf, couponRange, financeTax } from "@/public/ta-tua/game/js/shared/clan-bonds.js";

// Trái phiếu gia tộc và kho bạc (petdex/server/clan-bonds.js). Mọi con số đọc thẳng từ public/ta-tua/game/js/shared/clan-bonds.js;
// tests/petfarm-wiki-sync-clan-bonds.test.ts đối chiếu với code của game.

const xu = (n: number) => `${n.toLocaleString("vi-VN")} xu`;
const pct = (x: number) => `${String(+(x * 100).toFixed(3)).replace(".", ",")}%`;
const [lo, hi] = couponRange(BANK.defaultRate);

// Ví dụ: giữ 50 trái phiếu lãi gấp đôi lãi suất cơ bản ban đầu, kỳ 14 ngày.
const EX = { qty: 50, coupon: BANK.defaultRate * 2, term: 14 };
const exNight = couponOf(EX.qty, EX.coupon);
const exNet = exNight - financeTax(exNight);

export const article: WikiArticle = {
  slug: "trai-phieu",
  title: "Trái phiếu",
  category: "kinh-te",
  emoji: "📜",
  summary: `Gia tộc và kho bạc thị trấn vay xu của người chơi bằng trái phiếu mệnh giá ${xu(BONDS.face)}: lãi cố định trả mỗi đêm, gốc trả khi đáo hạn sau ${BONDS.terms.join(", ")} ngày. Trái phiếu mua bán lại được; gia tộc vỡ nợ thì trái chủ được trả trước cổ đông.`,
  keywords: ["trái phiếu", "coupon", "mệnh giá", "đáo hạn", "kho bạc", "trái chủ", "vỡ nợ", "sàn thứ cấp", "rao bán", "thuế lợi nhuận tài chính"],
  related: ["lai-suat-co-ban", "co-phan-gia-toc", "ngan-hang-gia-toc", "gia-toc"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: `Trái phiếu là một khoản cho vay chia nhỏ: bạn trả ${xu(BONDS.face)} cho mỗi trái phiếu, tổ chức phát hành trả bạn **lãi cố định mỗi nửa đêm** và trả lại **${xu(BONDS.face)} khi đáo hạn**. Tổ chức phát hành là một **gia tộc** (tộc trưởng quyết định) hoặc **kho bạc thị trấn** (quản trị viên quyết định).` },
        { p: `Mua ở màn **🏦 Ngân hàng → 📜 Trái phiếu** từ **cấp ${UNLOCKS.bank}**. Tộc trưởng cũng có thể mua bằng quỹ gia tộc (trừ trái phiếu của chính gia tộc mình).` },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { table: { head: ["Luật", "Con số"], rows: [
          ["Mệnh giá", xu(BONDS.face)],
          ["Kỳ hạn", `${BONDS.terms.join(", ")} ngày, tính từ lúc đóng mở bán`],
          ["Lãi coupon", `Cố định, từ ${BONDS.minCouponMultiple} tới ${BONDS.maxCouponMultiple} × lãi suất cơ bản lúc phát hành (lúc lãi suất cơ bản ${pct(BANK.defaultRate)}: ${pct(lo)}–${pct(hi)}/ngày); trả mỗi nửa đêm, phần lẻ dưới 1 xu cộng dồn sang đêm sau`],
          ["Một đợt phát hành", `${BONDS.minQty}–${BONDS.maxQty.toLocaleString("vi-VN")} trái phiếu, mở bán ${BONDS.subscribeHours} giờ theo mệnh giá; phần không ai mua bị hủy`],
          ["Trần của gia tộc", `Tổng mệnh giá đang lưu hành không quá ${pct(BONDS.clanBookShare)} giá trị sổ sách của gia tộc (quỹ + giá trị đất)`],
          ["Trần mỗi người", `Tối đa ${pct(BONDS.holderCap)} một đợt (tính theo số trái phiếu của đợt sau khi đóng mở bán)`],
          ["Phí", `Tổ chức phát hành trả ${pct(BONDS.issueFee)} số xu thu được; người mua trên sàn thứ cấp trả thêm ${pct(BONDS.tradeFee)}. Phí về gia tộc nắm Ngân hàng nhà nước`],
          ["Thuế", `Lãi trái phiếu của người chơi bị khấu ${pct(FINANCE_TAX.rate)} thuế lợi nhuận tài chính ngay khi nhận`],
        ] } },
        { p: `**Ví dụ:** giữ ${EX.qty} trái phiếu lãi ${pct(EX.coupon)}/ngày: mỗi đêm nhận ${xu(exNight)}, sau thuế còn ${xu(exNet)}; đáo hạn nhận lại ${xu(EX.qty * BONDS.face)}.` },
        { p: "**Sàn thứ cấp:** người đang giữ rao bán bao nhiêu trái phiếu, giá bao nhiêu tùy ý; người khác mua một phần hay cả lệnh. Lãi của đêm nào trả cho người đang giữ vào nửa đêm đó." },
        { p: "**Vỡ nợ:** đêm nào tổ chức phát hành không đủ tiền (gia tộc được tự phá cả tiền gửi kỳ hạn của quỹ), phần thiếu thành **khoản nợ trái chủ**. Mỗi đêm sau, tiền có được trả nợ cũ trước, rồi lãi đêm đó, rồi gốc; trả theo tỉ lệ số trái phiếu đang giữ." },
        { list: [
          "**Trái chủ trước cổ đông:** gia tộc còn nợ trái chủ thì không được chia cổ tức, không mua lại cổ phần và không phát hành thêm.",
          "**Gia tộc giải tán:** quỹ trả trái chủ (nợ cũ và gốc) trước khi phần còn lại về ngân sách; phần không đủ thì mất.",
        ] },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { list: [
          "**Tổ chức phát hành cạn tiền:** lãi và gốc có thể bị trả chậm hoặc không trả đủ; gia tộc giải tán là mất phần còn thiếu.",
          "**Lãi cố định:** nếu lãi suất cơ bản tăng sau khi bạn mua, trái phiếu của bạn kém hấp dẫn hơn đợt mới và khó bán lại giá cao.",
          "**Sàn thứ cấp không có người mua sẵn:** muốn bán trước hạn thì phải có ai đó chịu giá của bạn.",
        ] },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { list: [
          "Lãi càng cao thường là tổ chức phát hành càng cần tiền; nhìn quỹ và đất của gia tộc trước khi tin con số.",
          "Kỳ hạn dài khóa tiền lâu hơn; so với lãi tiết kiệm và ngân hàng gia tộc cùng số ngày.",
          "Trên sàn thứ cấp, số đêm còn lại tới đáo hạn quyết định một trái phiếu đáng giá bao nhiêu.",
        ] },
      ],
    },
  ],
};
