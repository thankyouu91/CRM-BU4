import type { WikiArticle } from "../types";
import { BANK } from "@/petdex/server/rules/bank.js";
import { RATE_POWER, rateBand } from "@/public/ta-tua/game/js/shared/clan-bonds.js";

// Quyền đặt lãi suất cơ bản của gia tộc nắm Ngân hàng nhà nước (petdex/server/clan-bonds.js setBaseRate, rateWeek; bank.js economy).
// Mọi con số đọc thẳng từ public/ta-tua/game/js/shared/clan-bonds.js; tests/petfarm-wiki-sync-clan-bonds.test.ts đối chiếu với code của game.

const xu = (n: number) => `${n.toLocaleString("vi-VN")} xu`;
const pct = (x: number) => `${String(+(x * 100).toFixed(3)).replace(".", ",")}%`;
const [lo, hi] = rateBand(BANK.defaultRate);

export const article: WikiArticle = {
  slug: "lai-suat-co-ban",
  title: "Lãi suất cơ bản và Ngân hàng nhà nước",
  category: "kinh-te",
  emoji: "🏛️",
  summary: `Gia tộc nắm Ngân hàng nhà nước được đặt lãi suất cơ bản trong khoảng lãi chính sách ± ${pct(RATE_POWER.band)}/ngày tới phiên họp sau của Ngân hàng Trung ương. Lãi tiết kiệm, gửi kỳ hạn và vay NPC đều theo con số này; để lượng xu tăng quá nhanh thì bị phạt hoặc mất ghế.`,
  keywords: ["lãi suất cơ bản", "lãi chính sách", "ngân hàng nhà nước", "ngân hàng trung ương", "điều hành lãi suất", "lạm phát", "lượng xu", "phạt", "mất ghế"],
  related: ["trai-phieu", "ngan-hang", "kinh-te-vi-mo", "ngan-hang-gia-toc"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: "Mỗi Chủ nhật, [Ngân hàng Trung ương](ngan-hang) họp và tính ra **lãi chính sách** từ tốc độ tăng lượng xu của cả server. Lãi suất cơ bản quyết định lãi tiết kiệm, lãi gửi kỳ hạn, lãi vay NPC và khoảng lãi của [ngân hàng gia tộc](ngan-hang-gia-toc) và [trái phiếu](trai-phieu)." },
        { p: "Gia tộc đang nắm ngành chiến lược **🏦 Ngân hàng nhà nước** được tự đặt lãi suất cơ bản quanh lãi chính sách, ở màn **📜 Trái phiếu**. Quyền đi kèm trách nhiệm về lượng xu." },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { table: { head: ["Luật", "Con số"], rows: [
          ["Ai đặt", "Tộc trưởng gia tộc nắm Ngân hàng nhà nước"],
          ["Khoảng được đặt", `Lãi chính sách ± ${pct(RATE_POWER.band)}/ngày, và luôn trong ${pct(RATE_POWER.min)}–${pct(RATE_POWER.max)}/ngày (lúc lãi chính sách là ${pct(BANK.defaultRate)}: ${pct(lo)}–${pct(hi)})`],
          ["Hiệu lực", "Ngay lập tức cho tới phiên họp Chủ nhật kế tiếp; sau phiên họp lãi về lãi chính sách mới, muốn khác thì đặt lại"],
          ["Áp vào", "Lãi tiết kiệm, lãi gửi kỳ hạn mới, lãi vay NPC mới, trần lãi ngân hàng gia tộc, khoảng lãi trái phiếu mới. Khoản đã chốt lãi trước đó giữ nguyên"],
          ["Phạt", `Tuần gia tộc đặt lãi **thấp hơn** lãi chính sách mà lượng xu tăng quá ${pct(RATE_POWER.growthCap)}/tuần: quỹ gia tộc nộp ${xu(RATE_POWER.penalty)} vào ngân sách (phá cả tiền gửi kỳ hạn nếu thiếu)`],
          ["Mất ghế", `Bị phạt lần thứ hai trong ${RATE_POWER.strikeDays} ngày: gia tộc mất ngành Ngân hàng nhà nước (ngân hàng gia tộc của nó chuyển sang chỉ trả tiền gửi và thu nợ cũ)`],
        ] } },
        { p: "Đặt lãi **bằng hoặc cao hơn** lãi chính sách thì không bao giờ bị phạt, kể cả khi lượng xu tăng nhanh." },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { list: [
          "**Lãi thấp** làm vay rẻ và tiết kiệm kém hấp dẫn: kinh tế sôi động hơn nhưng lượng xu dễ tăng quá nhanh, và gia tộc chịu phạt.",
          "**Lãi cao** làm người gửi vui nhưng người vay (kể cả gia tộc vay ngân hàng) khó trả hơn.",
          "Ghế Ngân hàng nhà nước có thể bị giành ở [Đấu trường](dau-truong); quyền đặt lãi đi theo ghế.",
        ] },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { list: [
          "Báo của Ngân hàng Trung ương mỗi Chủ nhật cho biết lượng xu đang tăng nhanh hay chậm.",
          "Lãi suất cơ bản đổi thì trần lãi tiền gửi của chính ngân hàng gia tộc bạn cũng đổi theo.",
          "Người khác cũng đọc được con số bạn đặt và đoán được bạn muốn gì.",
        ] },
      ],
    },
  ],
};
