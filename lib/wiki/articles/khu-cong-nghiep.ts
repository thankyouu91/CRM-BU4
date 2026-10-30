import type { WikiArticle } from "../types";
import { UNLOCKS } from "../rules";
import { PLANT } from "../rules-business";
import { factoryRows } from "../game-data";
import { num, pct } from "./money";
import { BUSINESS } from "@/petdex/server/rules/business.js";
import { CHAIN_STOPS, CONTRACTS, CREDIT, FACTORY, NIGHT_SHIFT, batchesPerHour, contractEscrows, shortfallPenalty } from "@/petdex/server/rules/production.js";
import { SHIFT_HOURS, XP_PER_HOUR, shiftEnergy } from "@/petdex/server/rules/careers.js";
import { ELEMENT_RULES } from "@/public/ta-tua/game/js/shared/pets.js";
import { HEAVY_INDUSTRIES, PRODUCTION_INDUSTRIES } from "@/public/ta-tua/game/js/shared/industry.js";

// Khu công nghiệp: xưởng chế biến của từng người chơi (petdex/server/factory.js, luật ở rules/production.js),
// ca đứng máy (jobs.js, rules/careers.js) và hợp đồng cung ứng (contracts.js). Vài con số nằm trong factory.js và
// routes-production.js thì chép ở lib/wiki/rules-business.ts (có kiểm thử).

type Named = { name: string; icon: string };
const B = BUSINESS as typeof BUSINESS & Record<string, number>;
const clock = (h: number) => `${String(h).padStart(2, "0")}:00`;
const plus = (x: number) => `+${pct(x, 1)}`;
const heavyNames = (HEAVY_INDUSTRIES as string[]).map((id) => (PRODUCTION_INDUSTRIES as Record<string, Named>)[id].name).join(", ");

// Tốc độ: hệ số kỹ năng lấy từ batchesPerHour (mẻ/giờ gốc × (1 + skillBoost × trung bình Sức mạnh và Khéo tay ÷ 100)).
const SKILL_MAX = batchesPerHour("dryer", 0, 100, 100) / batchesPerHour("dryer", 0, 0, 0) - 1;
const NIGHT_ENERGY = shiftEnergy(NIGHT_SHIFT.hours, true);

// Ví dụ cách tính hợp đồng (số trung tính): 5 lô mỗi đêm, 40 xu mỗi lô, 7 ngày.
const EX = { lots: 5, price: 40, days: 7, short: 2, market: 50 };
const exEscrow = contractEscrows(EX.lots, EX.price, EX.days);
const exPenalty = shortfallPenalty(EX.short, EX.price, EX.market);

export const article: WikiArticle = {
  slug: "khu-cong-nghiep",
  title: "Khu công nghiệp và hợp đồng",
  category: "kinh-te",
  emoji: "🏭",
  summary: `Xưởng chế biến của riêng bạn (tối đa ${PLANT.maxFactories}), bé đứng máy theo ca, chạy liên tục, ca đêm, gia công thuê cho người khác và hợp đồng cung ứng giữa hai người chơi.`,
  keywords: ["xưởng", "nhà máy", "gia công", "sản xuất", "hợp đồng", "cung ứng", "công nhân", "chạy liên tục", "ca đêm", "đứng máy", "ký quỹ"],
  related: ["san-nguyen-lieu", "quay-tra-sua", "viec-lam", "tin-dung", "so-nha-dat"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: "Khu công nghiệp là nơi bạn xây **xưởng chế biến của riêng mình**: xưởng lấy hàng thô trong kho [Sàn Nguyên Liệu](san-nguyen-lieu) (lá trà, sắn, mía, sữa) và làm ra hàng chế biến (trà khô, trân châu, đường, sữa đặc) cũng để trong kho đó. Ở đây còn có gia công thuê và hợp đồng cung ứng giữa hai người chơi." },
        { list: [
          `Xây xưởng từ **cấp ${UNLOCKS.factory}**. Gửi hàng nhờ xưởng người khác gia công từ **cấp ${UNLOCKS[PLANT.tollUnlock]}**.`,
          `Hợp đồng cung ứng mở ở **cấp ${UNLOCKS.contracts}**.`,
          `Xưởng ở đây là của từng người chơi, khác với các ngành sản xuất trên đất của gia tộc ở [Sở Nhà Đất](so-nha-dat). Việc gia tộc tạm đóng công nghiệp nặng (${heavyNames}) không ảnh hưởng gì tới xưởng của bạn.`,
        ] },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { p: `**Xây xưởng.** Mỗi người có tối đa **${PLANT.maxFactories} xưởng** (cùng loại hay khác loại đều được). Giá xây và giá nâng cấp nhân với chỉ số giá lúc trả.` },
        { table: { head: ["Xưởng", "Mỗi mẻ", "Mẻ/giờ ở cấp 1", "Giá xây"], rows: factoryRows() } },
        { list: [
          `**Nâng cấp** lên cấp ${FACTORY.upgradeCosts.map((_, i) => i + 2).join(", ")}: ${FACTORY.upgradeCosts.map(num).join(", ")} xu; mỗi cấp +${FACTORY.perLevel} mẻ/giờ.`,
          `**Tốc độ** = (mẻ/giờ gốc + ${FACTORY.perLevel} × số lần nâng cấp) × (1 + tới ${pct(SKILL_MAX, 0)} theo trung bình Sức mạnh và Khéo tay của bé). Bé hành **Kim** chạy thêm ${plus(ELEMENT_RULES.perks.kim.factory)}. Nhiều bé cùng đứng máy thì xưởng chạy theo **bé nhanh nhất**, tốc độ không cộng dồn. Phần mẻ lẻ trong giờ được làm tròn ngẫu nhiên.`,
          "Mỗi mẻ lấy nguyên liệu trong kho của chủ xưởng; hàng làm ra vào kho và mang giá vốn của nguyên liệu đã dùng (sổ lãi lỗ trên Sàn tính theo giá vốn này).",
          `**Thuê đất** ${FACTORY.landRent} xu mỗi đêm cho mỗi xưởng (nhân chỉ số giá), trừ lúc nửa đêm dù xưởng có chạy hay không. Đóng xưởng thì không được hoàn tiền xây.`,
        ] },

        { p: `**Bé đứng máy.** Xưởng **chỉ chạy khi có bé đứng máy**. Bé nhà mình không lương. Muốn thuê công nhân, bạn đăng tin ${B.wageMin}–${B.wageMax} xu/giờ cho ${PLANT.workers[0]}–${PLANT.workers[1]} người; lương cả ca trừ khỏi ví bạn ngay lúc công nhân vào ca. Ca thường dài ${SHIFT_HOURS.join(", ")} giờ và tính vào giờ làm trong ngày của bé; xong ca bé lên Sức mạnh và ${XP_PER_HOUR} XP mỗi giờ.` },

        { p: "**Chạy liên tục.** Bật ở thẻ xưởng. Khi một ca thường của bé nhà mình ở xưởng đó kết thúc, bé tự vào ca kế cùng độ dài ngay lúc đó, kể cả khi bạn không mở game. Bật lên thì các ca đã xong trước đó không được nối bù; công nhân thuê và ca đêm không tự nối. Chuỗi ca dừng khi:" },
        { list: Object.values(CHAIN_STOPS as Record<string, string>).map((s) => `${s.charAt(0).toUpperCase()}${s.slice(1)}${s === CHAIN_STOPS.stock ? " (kho không còn đủ cho một mẻ, tính cả đơn gia công đang chờ)" : s === CHAIN_STOPS.hours ? " (giờ làm trong ngày tính lại sau nửa đêm)" : s === CHAIN_STOPS.tired ? " (không đủ năng lượng, đang ốm hoặc quá đói)" : ""}.`) },
        { p: "Thẻ xưởng cho biết ca kế bắt đầu lúc nào, hoặc lý do chuỗi ca đã dừng." },

        { p: `**Ca đêm.** Ca ${NIGHT_SHIFT.hours} giờ, nhận từ ${clock(NIGHT_SHIFT.from)} tới trước ${clock(NIGHT_SHIFT.until)}, chỉ cho bé nhà mình ở xưởng của mình.` },
        { list: [
          "Mỗi bé một ca đêm mỗi đêm; ca đêm không tính vào giờ làm trong ngày.",
          `Bé phải có đủ **${NIGHT_ENERGY} năng lượng** mới vào ca, không ốm và không quá đói. Trong ca bé hao sức gấp ${num(NIGHT_SHIFT.energy, 1)} lần ca thường.`,
          `Xưởng chạy **${pct(NIGHT_SHIFT.speed, 0)} tốc độ**, không lương.`,
          "Ca vắt qua nửa đêm: mẻ làm trước 00:00 tính cho ngày cũ, phần sau tính cho ngày mới.",
        ] },

        { p: `**Gia công thuê.** Chủ xưởng bật nhận gia công và đặt phí 0–${FACTORY.maxTollFee} xu mỗi mẻ. Người khác chọn xưởng trong danh sách và gửi ${PLANT.tollBatches[0]}–${PLANT.tollBatches[1]} mẻ một đơn:` },
        { list: [
          "Nguyên liệu rời kho người gửi ngay; phí cả đơn bị giữ lại, mẻ nào xong thì phí mẻ đó chuyển cho chủ xưởng.",
          "Đơn gia công được làm **trước** hàng của chủ xưởng, theo thứ tự gửi. Đơn chỉ chạy khi xưởng có bé đứng máy; đơn không có hạn chót.",
          "Hàng làm xong về kho người gửi. Kho người gửi đầy thì các mẻ không chứa được coi như chưa làm (nguyên liệu và phí vẫn nằm trong đơn).",
          "Người gửi hủy đơn lúc nào cũng được: nhận lại nguyên liệu của các mẻ chưa làm và phần phí còn giữ.",
          "Chủ xưởng không đóng được xưởng khi còn đơn đang chờ. Phí gia công là thu nhập chịu [thuế](thue-toa-thi-chinh) của chủ xưởng.",
        ] },

        { p: `**Hợp đồng cung ứng.** Hai người chơi thỏa thuận giao một mặt hàng Sàn mỗi đêm với giá cố định. Người đề xuất chọn vai bán hay mua, mặt hàng, số lô, giá và số ngày; người kia nhận hoặc từ chối.` },
        { table: { head: ["Luật", "Con số"], rows: [
          ["Số lô mỗi đêm", `1–${CONTRACTS.maxLots} lô`],
          ["Thời hạn", `${CONTRACTS.days[0]}–${CONTRACTS.days[1]} ngày`],
          ["Giá mỗi lô", `${pct(CONTRACTS.band[0], 0)}–${pct(CONTRACTS.band[1], 0)} giá Sàn lúc đề xuất`],
          ["Hợp đồng đang mở", `Tối đa ${CONTRACTS.maxOpen} mỗi người (tính cả đề xuất chưa ai nhận)`],
          ["Đề xuất", `Hết hạn sau ${CONTRACTS.proposalHours} giờ; người đề xuất ký quỹ ngay khi gửi và được hoàn nếu bị từ chối, tự rút hoặc hết hạn`],
          ["Ký quỹ", `Bên mua: tiền hàng một đêm. Bên bán: ${pct(CONTRACTS.sellerEscrow, 0)} tổng giá trị hợp đồng`],
          ["Giao thiếu", `Bên bán bồi thường: số lô thiếu × (phần giá Sàn cao hơn giá hợp đồng, nếu có + ${pct(CONTRACTS.shortfallExtra, 0)} giá hợp đồng)`],
          ["Phá hợp đồng", `Bên kia nhận ${pct(CONTRACTS.breakShare, 0)} giá trị các đêm còn lại (lấy từ ký quỹ bên phá, tối đa bằng ký quỹ đó); bên phá mất ${-CREDIT.contractBroken} điểm tín dụng`],
          ["Mỗi đêm giao và trả đủ", `Cả hai bên +${CREDIT.contractDay} điểm tín dụng`],
        ] } },
        { list: [
          "Lượt giao đầu tiên vào nửa đêm sau khi ký. Hàng lấy từ kho bên bán; tiền trả từ ví bên mua trước, thiếu thì trừ vào ký quỹ của bên mua.",
          "Kho bên mua đầy thì phần không chứa được ở lại kho bên bán và không tính là giao thiếu.",
          "Bên mua không đủ tiền (cả ví lẫn ký quỹ) trả cho phần hàng có sẵn thì bị tính là bên mua phá hợp đồng. Bên bán không đủ tiền bồi thường giao thiếu thì bị tính là bên bán phá hợp đồng.",
          "Hết hạn, ký quỹ còn lại trả về hai bên. Lãi bên bán (so với giá vốn hàng) tính vào thu nhập chịu thuế như lãi bán trên Sàn.",
        ] },
        { p: `Ví dụ cách tính (số trung tính): hợp đồng ${EX.lots} lô mỗi đêm, ${EX.price} xu mỗi lô, ${EX.days} ngày. Bên mua ký quỹ ${num(exEscrow.buyer)} xu, bên bán ký quỹ ${num(exEscrow.seller)} xu. Một đêm bên bán thiếu ${EX.short} lô khi giá Sàn là ${EX.market} xu thì bồi thường ${EX.short} × (${EX.market - EX.price} + ${num(EX.price * CONTRACTS.shortfallExtra)}) = **${num(exPenalty)} xu**.` },
        { p: "**Báo cáo.** Mỗi xưởng có báo cáo 7 ngày (mẻ của mình, mẻ gia công, phí gia công, tiền thuê đất, lương). Cột bên phải màn hình cho biết tổng quan các xưởng và tồn kho: sức chứa kho, phần giữ cho lệnh mua đang chờ, và nguyên liệu đủ cho bao nhiêu mẻ." },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { warn: `Ví không đủ tiền thuê đất lúc nửa đêm thì ghi nợ một đêm. Nợ **${B.unpaidLimit} đêm liền** thì xưởng bị đóng (trừ khi còn đơn gia công đang chờ), mất ${-CREDIT.evicted} điểm [tín dụng](tin-dung) và tin đóng cửa lên Báo.` },
        { list: [
          "Lá trà tươi và sữa tươi có hạn dùng: để trong kho chờ xưởng chạy thì có thể hư mất.",
          "Lương công nhân trả trước cho cả ca, không hoàn lại nếu xưởng hết nguyên liệu giữa ca.",
          "Ca đêm làm bé hao sức nhiều; bé mệt, ốm hay đói thì chuỗi chạy liên tục dừng và các việc khác của bé cũng chờ.",
          "Gửi gia công: nguyên liệu rời kho bạn ngay, và đơn chỉ tiến khi chủ xưởng có bé đứng máy.",
          "Hợp đồng ràng buộc theo đêm: giá Sàn chạy ngược chiều, giao thiếu hay hủy ngang đều tốn xu và điểm tín dụng.",
        ] },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { tip: "Giá hàng chế biến trên Sàn bám theo giá nguyên liệu đầu vào. Theo dõi cả hai đầu trước khi xây thêm hay nâng cấp." },
        { tip: "Chạy liên tục chỉ đi xa bằng kho nguyên liệu và sức của bé. Thẻ xưởng cho biết điều gì sẽ làm nó dừng." },
        { tip: "Chưa đủ cấp xây xưởng thì gia công thuê là một cách khác để có hàng chế biến." },
        { tip: "Ký quỹ, bồi thường và điểm tín dụng của hợp đồng đều tính trên số lô và số ngày, nên cỡ hợp đồng quan trọng như giá." },
      ],
    },
  ],
};
