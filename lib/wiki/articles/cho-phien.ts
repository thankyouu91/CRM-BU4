import type { WikiArticle } from "../types";
import { UNLOCKS } from "../rules";
import { FAIR } from "../rules-business";
import { num, pct } from "./money";
import { AUCTION, BAZAAR, KITCHEN, QUALITY } from "@/petdex/server/rules/production.js";
import { TIERS, TIER_ORDER, TIER_VALUE } from "@/public/ta-tua/game/js/shared/gear.js";

// Chợ Phiên (petdex/server/bazaar.js) và đấu giá trang phục (auction.js). Luật thuần ở rules/production.js BAZAAR, AUCTION;
// phần phí vào ngân sách thì chép ở lib/wiki/rules-business.ts (có kiểm thử).

const tiers = TIERS as Record<string, { name: string }>;
const tierValue = TIER_VALUE as Record<string, number>;
const tierText = (TIER_ORDER as string[]).map((t) => `${tiers[t].name} ×${tierValue[t]}`).join(", ");
const qualityText = (QUALITY as { name: string; mult: number }[]).map((q) => `${q.name} ×${num(q.mult, 1)}`).join(", ");
const accountAge = BAZAAR.minAccountDays === 1 ? "24 giờ" : `${BAZAAR.minAccountDays} ngày`;
const band = (b: readonly number[]) => `${pct(b[0], 0)}–${pct(b[1], 0)}`;

// Ví dụ cách tính (số trung tính): một món bán được giá 200 xu.
const EX = 200;
const exList = Math.max(1, Math.round(EX * BAZAAR.listFee));
const exSale = Math.max(1, Math.round(EX * BAZAAR.saleFee));

export const article: WikiArticle = {
  slug: "cho-phien",
  title: "Chợ Phiên",
  category: "kinh-te",
  emoji: "🏮",
  summary: "Người chơi bày bán cho nhau đồ trong túi, trang phục (kể cả hộp chưa mở) và món tự nấu, hoặc đem trang phục ra đấu giá: giá cho phép, phí, thời hạn và điều kiện.",
  keywords: ["chợ", "bán đồ", "mua đồ", "trao đổi", "người chơi", "phiên", "đấu giá", "trả giá", "hộp", "phí", "tin đăng"],
  related: ["trang-phuc", "bep", "sieu-thi", "quay-tra-sua", "san-nguyen-lieu"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: "Chợ Phiên là nơi người chơi bày bán đồ cho nhau với giá tự đặt (trong khoảng cho phép), và đem trang phục ra **đấu giá** ở tab 🔨 Đấu giá. Hệ thống không mua, không bán ở đây: người mua luôn là một người chơi khác." },
        { list: [
          `Mở ở **cấp ${UNLOCKS.bazaar}** cho cả mua lẫn bán.`,
          `Muốn bày bán hay mở phiên đấu giá, tài khoản phải đủ **${accountAge} tuổi**; mua và trả giá thì không cần chờ.`,
        ] },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { p: "**Bày bán.** Chọn một món, đặt giá, trả phí đăng tin. Món rời túi (hoặc tủ đồ) trong lúc tin còn mở." },
        { table: { head: ["Luật", "Con số"], rows: [
          ["Bán được", "Đồ trong túi (đồ Siêu thị, đồ uống mua ở quầy trà sữa...), trang phục (đã mở hoặc còn nguyên hộp), món tự nấu"],
          ["Giá", `${band(BAZAAR.band)} giá tham chiếu`],
          ["Phí đăng tin", `${pct(BAZAAR.listFee, 0)} giá bán (tối thiểu 1 xu), không hoàn`],
          ["Phí khi bán được", `${pct(BAZAAR.saleFee, 0)} giá bán (tối thiểu 1 xu), người bán trả`],
          ["Thời hạn tin", `${BAZAAR.hours} giờ (món nấu không quá hạn dùng của món)`],
          ["Số tin cùng lúc", `Tối đa ${BAZAAR.maxListings}`],
        ] } },
        { list: [
          `**Giá tham chiếu**: đồ trong túi theo giá Siêu thị × chỉ số giá; trang phục theo giá shop × chỉ số giá × hệ số cấp (${tierText}), hộp chưa mở tính ×1; món nấu theo tiền nguyên liệu × ${num(KITCHEN.valueMarkup, 1)} × hệ số chất lượng (${qualityText}).`,
          "Hộp trang phục chưa mở bán nguyên hộp: người mua chỉ thấy các loại chỉ số món đó có thể ra; cấp và % chỉ lộ khi mở.",
          "Người mua trả đúng giá niêm yết; người bán nhận giá bán trừ phí. Món dùng mãi (như đồ chơi) thì không mua được nếu đã có.",
          "Gỡ tin lúc nào cũng được: món về lại túi, phí đăng tin không hoàn. Tin hết hạn cũng trả món về; món nấu đã quá hạn dùng thì mất.",
          `Phí bán: ${pct(FAIR.saleFeeToTreasury, 0)} vào ngân sách thị trấn, phần còn lại biến mất khỏi nền kinh tế.`,
          "Dòng **Thu nhập giao dịch** trên [trang phục](trang-phuc) cho người bán thêm xu mỗi lần bán được, ở cả Chợ Phiên lẫn đấu giá.",
          "Tiền bán ở Chợ Phiên và đấu giá không tính vào thu nhập chịu thuế thu nhập.",
        ] },
        { p: `Ví dụ cách tính (số trung tính): bày một món giá ${EX} xu tốn ${exList} xu phí đăng tin; bán được thì người mua trả ${EX} xu, người bán nhận ${EX - exSale} xu.` },

        { p: "**Đấu giá trang phục.** Đặt giá khởi điểm và thời hạn, ai trả cao nhất khi hết giờ thì được món." },
        { table: { head: ["Luật", "Con số"], rows: [
          ["Giá khởi điểm", `${band(AUCTION.startBand)} giá tham chiếu`],
          ["Thời hạn", `${AUCTION.hours.join(", ")} giờ`],
          ["Bước giá", `Cao hơn giá đang dẫn ít nhất ${pct(AUCTION.stepPct, 0)} (tối thiểu ${AUCTION.minStep} xu); lượt đầu từ giá khởi điểm`],
          ["Xu khi trả giá", "Bị giữ lại khỏi ví; có người trả cao hơn thì hoàn ngay"],
          ["Trả giá sát giờ", `Trong ${AUCTION.snipeMs / 60_000} phút cuối thì phiên kéo dài tới ${AUCTION.snipeMs / 60_000} phút sau lần trả đó`],
          ["Phí", `${pct(BAZAAR.listFee, 0)} giá khởi điểm khi mở phiên (không hoàn), ${pct(BAZAAR.saleFee, 0)} giá chốt khi bán được`],
          ["Giới hạn", `Tối đa ${AUCTION.maxOpen} phiên cùng lúc; chưa ai trả giá thì hủy được`],
        ] } },
        { list: [
          "Không trả giá cho phiên của mình, và không trả tiếp khi mình đang dẫn.",
          "Hết giờ mà không ai trả giá thì món về lại tủ đồ. Có người trả thì món sang tủ đồ người thắng, người bán nhận giá chốt trừ phí.",
        ] },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { list: [
          "Phí đăng tin và phí mở phiên mất luôn, dù món có bán được hay không.",
          "Xu đã trả giá bị giữ tới khi có người trả cao hơn hoặc phiên kết thúc; không rút ra được giữa chừng.",
          "Có người trả giá rồi thì người bán không hủy phiên được nữa, kể cả khi giá đang thấp.",
          "Món nấu vẫn hư theo hạn dùng trong lúc đang bày bán.",
          "Mua hộp chưa mở là mua khi chưa biết cấp và chỉ số bên trong.",
        ] },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { tip: "Giá tham chiếu chỉ là mốc để giới hạn khoảng giá. Giá bán được là do người mua quyết." },
        { tip: "Phiên đấu giá kéo dài khi có người trả sát giờ, nên giờ kết thúc ghi trên phiên chưa chắc là giờ chốt." },
        { tip: "Xem các tin đang bày và phiên đang mở trước khi tự đặt giá cho món của mình." },
      ],
    },
  ],
};
