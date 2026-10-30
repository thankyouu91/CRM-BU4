import type { WikiArticle } from "../types";
import { UNLOCKS } from "../rules";
import { STALL } from "../rules-business";
import { locationRows, recipeRows } from "../game-data";
import { num, pct } from "./money";
import {
  BUSINESS, LOCATIONS, TEA_SHOP, UPGRADES, appeal, customersPerHour, nextReputation, peakFactor, staffCapacity,
} from "@/petdex/server/rules/business.js";
import { CREDIT } from "@/petdex/server/rules/production.js";
import { SHIFT_HOURS } from "@/petdex/server/rules/careers.js";
import { GUILD_UPGRADES, PROPOSALS } from "@/petdex/server/rules/town.js";
import { ITEMS } from "@/petdex/server/game.js";
import { ELEMENT_RULES } from "@/public/ta-tua/game/js/shared/pets.js";
import { PHASES } from "@/public/ta-tua/game/js/shared/clan.js";

// Quầy trà sữa (petdex/server/business.js, luật thuần ở petdex/server/rules/business.js và rules/recipes.js).
// Số liệu đọc từ luật của game; vài con số nằm trong business.js thì chép ở lib/wiki/rules-business.ts (có kiểm thử).

type Item = { name: string; icon: string; price: number; effect: Record<string, number>; xp: number };
type Upgrade = { name: string; desc: string; costs: number[] };
type Effect = { kind: string; target: string | null; value: number; days: number };

const items = ITEMS as Record<string, Item>;
const upgrades = UPGRADES as Record<string, Upgrade>;
const B = BUSINESS as typeof BUSINESS & Record<string, number>;
const times = (x: number) => `×${num(x, 2)}`;
const plus = (x: number) => `${x >= 0 ? "+" : "−"}${pct(Math.abs(x), 1)}`;

// ---------------------------------------------------------------- giờ trong ngày (peakFactor)

/** Các khoảng giờ có cùng hệ số, ví dụ "11 giờ tới 13 giờ và 17 giờ tới 21 giờ". */
function hoursWith(factor: number) {
  const hs = Array.from({ length: 24 }, (_, h) => h).filter((h) => peakFactor(h) === factor);
  const runs: [number, number][] = [];
  for (const h of hs) {
    const last = runs.at(-1);
    if (last && last[1] === h) last[1] = h + 1;
    else runs.push([h, h + 1]);
  }
  if (runs.length > 1 && runs[0][0] === 0 && runs.at(-1)![1] === 24) runs[0][0] = runs.pop()![0] - 24;
  return runs.map(([a, b]) => `${(a + 24) % 24} giờ tới ${b} giờ`).join(" và ");
}
// Các hệ số khác 1 trước (cao xuống thấp), "các giờ còn lại" sau cùng.
const FACTORS = [...new Set(Array.from({ length: 24 }, (_, h) => peakFactor(h)))].sort((a, b) => (a === 1 ? 1 : b === 1 ? -1 : b - a));

// ---------------------------------------------------------------- công thức khách (customersPerHour, appeal, staffCapacity)

const base = { location: "street", hourVN: 15, reputation: 1 };
const c0 = customersPerHour(base);
const DECOR = customersPerHour({ ...base, decorLevel: 1 }) / c0 - 1;
const APPEAL_CAP = customersPerHour({ ...base, menuAppeal: 100 }) / c0;
const APPEAL_MAX = appeal(1, 1e9);
const APPEAL_POW = Math.log(appeal(1, 2)) / Math.log(2);
const CAP = { base: staffCapacity(0, 0), perTenCraft: staffCapacity(10, 0) - staffCapacity(0, 0), perCounter: staffCapacity(0, 1) - staffCapacity(0, 0) };

// ---------------------------------------------------------------- uy tín (nextReputation)

const ratios = Array.from({ length: 101 }, (_, i) => Math.round((1 + i / 100) * 100) / 100);
const after = (r: number) => nextReputation(1, { served: 1, wanted: 1, priceRatio: r });
const REP = {
  min: nextReputation(0, { served: 0, wanted: 0, priceRatio: 1.2 }),
  max: nextReputation(9, { served: 0, wanted: 0, priceRatio: 1.2 }),
  shortDrop: Math.round((1 - nextReputation(1, { served: 0, wanted: 10, priceRatio: 1 })) * 1e6) / 1e6,
  riseUpTo: ratios.filter((r) => after(r) > 1).at(-1)!,
  rise: Math.round((after(1) - 1) * 1e6) / 1e6,
  dropAbove: ratios.filter((r) => after(r) >= 1).at(-1)!,
};
const DROP_PER_TENTH = Math.round((1 - after(Math.round((REP.dropAbove + 0.1) * 100) / 100)) * 1e6) / 1e6;

// ---------------------------------------------------------------- thưởng khách

const trafficProposals = Object.values(PROPOSALS as Record<string, { name: string; icon: string; effect: Effect }>)
  .filter((p) => p.effect.kind === "traffic")
  .map((p) => `${p.icon} ${p.name} (${plus(p.effect.value)}${p.effect.target ? ` cho ${(LOCATIONS as Record<string, { name: string }>)[p.effect.target].name}` : ""}, ${p.effect.days} ngày)`)
  .join(", ");
const phaseTraffic = Object.values(PHASES as Record<string, { name: string; traffic: number }>)
  .filter((p) => p.traffic)
  .map((p) => `${p.name} ${plus(p.traffic)}`)
  .join(", ");
const sign = GUILD_UPGRADES.sign as { name: string; costs: number[]; per: number };

// ---------------------------------------------------------------- đồ uống cho bé

const boba = items.boba;
const drinkRows = () => Object.entries(items).filter(([id]) => id.startsWith("tea_")).map(([, d]) => [
  `${d.icon} ${d.name}`, `+${d.effect.fullness} No bụng, +${d.effect.happiness} Vui vẻ`, `+${d.xp} XP`,
]);

export const article: WikiArticle = {
  slug: "quay-tra-sua",
  title: "Quầy trà sữa",
  category: "kinh-te",
  emoji: "🧋",
  summary: `Mở quầy ở một trong ${Object.keys(LOCATIONS).length} vị trí, đặt thực đơn và giá, cho bé trực để bán cho khách; người chơi khác ghé mua đồ uống cho bé (gấp ${TEA_SHOP.statMult} lần trà sữa Siêu thị).`,
  keywords: ["kinh doanh", "quầy", "trà sữa", "bán hàng", "khách", "uy tín", "thuê", "quảng cáo", "đồ uống", "mua cho bé", "giờ cao điểm", "nhân viên"],
  related: ["san-nguyen-lieu", "khu-cong-nghiep", "viec-lam", "thue-toa-thi-chinh", "hoi", "kinh-te-vi-mo"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: `Quầy trà sữa là cửa hàng riêng của bạn ở thị trấn. Bạn chọn vị trí, đặt thực đơn và giá, để nguyên liệu trong kho [Sàn Nguyên Liệu](san-nguyen-lieu) và cho bé ra trực quầy; mỗi giờ có bé trực, khách trong thị trấn ghé mua.` },
        { list: [
          `Mở ở **cấp ${UNLOCKS.business}**, mỗi người **một quầy**.`,
          "Ở màn Quầy trà sữa còn có danh sách **các quầy đang có bé trực**: ai cũng mua đồ uống cho bé ở đó được, kể cả người chưa đủ cấp mở quầy.",
        ] },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { p: `**Mở quầy.** Đặt tên (${STALL.nameLength[0]} đến ${STALL.nameLength[1]} ký tự), chọn vị trí và trả tiền giấy phép. Quầy mới có sẵn một món là Trà sữa trân châu, bán đúng giá tham chiếu.` },
        { table: { head: ["Vị trí", "Giấy phép", "Thuê mỗi đêm", "Lượng khách gốc", "Quảng cáo 6 giờ"], rows: locationRows() } },
        { p: "Giá trong bảng là giá gốc; giấy phép, tiền thuê, quảng cáo và nâng cấp đều nhân với chỉ số giá của Ngân hàng Trung ương lúc bạn trả." },

        { p: `**Thực đơn và giá.** Mỗi ly dùng nguyên liệu (tính theo phần, 1 lô = 10 phần) trong kho Sàn của chủ quầy. **Giá tham chiếu** của một món = tiền nguyên liệu theo giá gốc Sàn × ${num(B.markup, 2)} × chỉ số giá. Bạn tự đặt giá bán từ 1 xu tới **${STALL.maxPriceRatio} lần** giá tham chiếu; mỗi món chỉ có một lần trong thực đơn.` },
        { table: { head: ["Món", "Nguyên liệu mỗi ly", "Giá tham chiếu (giá gốc)"], rows: recipeRows() } },

        { p: "**Nâng cấp.** Mua bằng xu, mỗi cấp một lần, không bán lại được." },
        { table: { head: ["Nâng cấp", "Tác dụng", "Giá các cấp"], rows: Object.values(upgrades).map((u) => [u.name, u.desc, u.costs.map(num).join(" / ")]) } },
        { p: `Thực đơn có **${B.baseMenuSlots} chỗ** lúc đầu, tối đa ${B.baseMenuSlots + upgrades.menu.costs.length} món khi mua hết cấp Thêm món.` },

        { p: `**Bé trực quầy.** Quầy **chỉ bán khi có bé trực**. Bé nhà mình trực không lương. Muốn thuê bé người khác, bạn đăng tin tuyển ${B.wageMin}–${B.wageMax} xu/giờ cho 1–${B.maxStaffSlots} người; tiền lương cả ca trừ khỏi ví bạn ngay lúc bé kia vào ca (ví không đủ thì bé không vào ca được). Ca trực dài ${SHIFT_HOURS.join(", ")} giờ và tính vào giờ làm trong ngày của bé như ca ở [Việc làm](viec-lam); xong ca bé lên Khéo tay và kinh nghiệm.` },
        { p: `**Công suất pha** của mỗi bé trực: ${CAP.base} + Khéo tay ÷ 10 + ${CAP.perCounter} × cấp Quầy pha rộng hơn (ly mỗi giờ). Nhiều bé cùng trực thì công suất cộng lại.` },

        { p: "**Khách mỗi giờ** (chỉ tính những giờ có bé trực):" },
        { steps: [
          "Lượng khách gốc của vị trí × hệ số giờ × uy tín.",
          `× (1 + ${pct(DECOR, 0)} × cấp Trang trí quầy) × (1 + ${pct(B.promoBoost, 0)} nếu đang quảng cáo) × (1 + tổng thưởng khách).`,
          `× ${pct(B.conversion, 0)} (phần khách qua đường ghé mua) × độ hấp dẫn của thực đơn (tối đa ${num(APPEAL_CAP, 1)}).`,
          `× một hệ số ngẫu nhiên từ ${num(STALL.noise[0], 2)} tới ${num(STALL.noise[1], 2)}.`,
        ] },
        { table: { head: ["Giờ (giờ Việt Nam)", "Hệ số giờ"], rows: FACTORS.map((f) => [f === 1 ? "Các giờ còn lại" : hoursWith(f), times(f)]) } },
        { list: [
          `**Độ hấp dẫn** của một món = (giá tham chiếu ÷ giá bán) mũ ${num(APPEAL_POW, 1)}, tối đa ${num(APPEAL_MAX)}. Độ hấp dẫn của thực đơn là trung bình các món; khách chia cho từng món theo độ hấp dẫn của món đó.`,
          `**Thưởng khách** cộng dồn: bé **Có duyên** đang trực ${plus(STALL.charmingBonus)}, bé hành **Thủy** đang trực ${plus(ELEMENT_RULES.perks.thuy.customers)}, ${sign.name} ${plus(sign.per)} mỗi cấp (xem [Hội](hoi)), đề xuất thắng phiếu ở [Tòa thị chính](thue-toa-thi-chinh): ${trafficProposals}, và pha kinh tế: ${phaseTraffic} (xem [Kinh tế vĩ mô](kinh-te-vi-mo)).`,
          "Số ly bán được mỗi giờ không vượt quá công suất pha và số ly nguyên liệu trong kho đủ làm. Khách không mua được thì tính là **khách hụt** trong báo cáo.",
        ] },
        { p: `Ví dụ cách tính (số trung tính): quầy ở Mặt phố lúc 15 giờ, uy tín 1, không nâng cấp, không thưởng, bán đúng giá tham chiếu: ${LOCATIONS.street.traffic} × 1 × 1 × ${num(B.conversion, 1)} × 1 = **${num(c0, 1)} khách** trước hệ số ngẫu nhiên.` },

        { p: `**Uy tín** bắt đầu ở 1 và nằm trong khoảng ${num(REP.min, 1)}–${num(REP.max, 1)}. Sau mỗi giờ có bé trực:` },
        { list: [
          `Có khách hụt: giảm tới ${num(REP.shortDrop, 2)}, theo tỉ lệ khách hụt trên số khách muốn mua.`,
          `Giá bán trung bình của thực đơn cao hơn ${num(REP.dropAbove, 1)} lần giá tham chiếu: giảm ${num(DROP_PER_TENTH, 2)} cho mỗi 0,1 lần vượt quá.`,
          `Ngược lại, nếu bán được ly nào và giá trung bình không quá ${num(REP.riseUpTo, 1)} lần giá tham chiếu: tăng ${num(REP.rise, 3)}.`,
        ] },

        { p: `**Quảng cáo.** Trả giá quảng cáo của vị trí để có thêm ${B.promoHours} giờ khách ${plus(B.promoBoost)}; mua tiếp khi đang chạy thì cộng nối thêm ${B.promoHours} giờ.` },

        { p: `**Đồ uống cho bé.** Người chơi khác mua đồ uống ở quầy đang có bé trực: mỗi lần 1–${TEA_SHOP.maxPerOrder} ly, mỗi người tối đa **${TEA_SHOP.dailyCups} ly mỗi ngày** (cộng mọi quầy), chỉ những món có trong thực đơn. Người mua trả giá thực đơn cho chủ quầy; mua ở quầy nhà mình thì không mất xu. Ly làm từ nguyên liệu trong kho chủ quầy (không tính vào công suất pha) và vào Túi đồ của người mua. Siêu thị không bán các ly này.` },
        { table: { head: ["Đồ uống", "Tác dụng mỗi ly", "Kinh nghiệm"], rows: drinkRows() } },
        { p: `Mỗi ly bằng **${TEA_SHOP.statMult} lần** ${boba.icon} ${boba.name} của [Siêu thị](sieu-thi) (+${boba.effect.fullness} No bụng, +${boba.effect.happiness} Vui vẻ, +${boba.xp} XP), và kinh nghiệm không bị giảm theo hạn mức đồ Siêu thị như ở [Vật phẩm thiết yếu](vat-pham-thiet-yeu).` },

        { p: `**Thuế và báo cáo.** Mọi doanh thu (khách và đồ uống bán cho người chơi) chịu **thuế doanh thu ${pct(B.revenueTax, 0)}** trừ ngay. Lãi trong ngày của quầy (doanh thu trừ tiền nguyên liệu theo giá tham chiếu, tiền thuê, lương và thuế doanh thu) cộng vào thu nhập chịu [thuế thu nhập](thue-toa-thi-chinh). Báo cáo 7 ngày ghi số ly, khách, khách hụt, doanh thu, tiền nguyên liệu, tiền thuê, lương, thuế và lãi.` },
        { p: "**Tiền thuê** trừ lúc nửa đêm mỗi đêm, có bán hay không. **Đóng quầy** lúc nào cũng được; giấy phép không được hoàn lại." },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { warn: `Ví không đủ tiền thuê lúc nửa đêm thì ghi nợ một đêm. Nợ **${B.unpaidLimit} đêm liền** thì quầy bị đóng, mất ${-CREDIT.evicted} điểm [tín dụng](tin-dung), tin đóng cửa lên Báo, và giấy phép đã trả không được hoàn.` },
        { list: [
          "Nguyên liệu có hạn dùng (sữa tươi, dâu, trân châu, sữa đặc) hư trong kho dù quầy có bán hay không.",
          "Lương bé làm thuê trả trước cho cả ca, không hoàn lại nếu trong ca quầy hết nguyên liệu hay vắng khách.",
          "Hết hàng giữa giờ hoặc bán đắt thì uy tín tụt, và uy tín thấp làm mọi giờ sau ít khách hơn.",
          `Lượng khách mỗi giờ có phần ngẫu nhiên (${num(STALL.noise[0], 2)}–${num(STALL.noise[1], 2)} lần), và đổi theo pha kinh tế cùng chỉ số giá.`,
          "Quầy không có bé trực thì không bán được gì, kể cả đồ uống cho người chơi khác.",
        ] },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { tip: "Báo cáo 7 ngày tách riêng doanh thu, nguyên liệu, tiền thuê, lương và khách hụt. Đọc nó trước khi đổi giá hay mua nâng cấp." },
        { tip: "Kho nguyên liệu và công suất pha là hai giới hạn khác nhau. Để ý cái nào chạm trần trước ở từng khung giờ." },
        { tip: "Khách không đến đều trong ngày, và pha kinh tế cũng xê dịch lượng khách." },
        { tip: "Khách của quầy không chỉ là người qua đường: người chơi khác cũng ghé mua đồ uống cho bé." },
      ],
    },
  ],
};
