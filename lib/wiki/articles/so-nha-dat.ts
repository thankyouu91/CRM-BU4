import type { WikiArticle } from "../types";
import { CLAN } from "../rules";
import { LAND_PRICE } from "../rules-business";
import { DESIGN_RULES, GOODS_COUNT, INDUSTRIAL_MARKET, LAND_RULES, SERVICE_COUNT, climateNames, industryRows, zoneRows } from "../game-data";
import { num, pct } from "./money";
import { CLIMATES, INDUSTRIES, INDUSTRY_ORDER, LAND, PIECES, ZONES, clanPerks, designBonus, scarcityFactor } from "@/public/ta-tua/game/js/shared/clan.js";
import { GOODS, HEAVY_INDUSTRIES, PRODUCTION_INDUSTRIES, PRODUCTION_YIELD, batchesOf } from "@/public/ta-tua/game/js/shared/industry.js";

// Sở Nhà Đất: lô đất, công trình và chuỗi sản xuất của gia tộc (petdex/server/clans.js, industry.js, heavy-industry.js;
// luật thuần ở public/ta-tua/game/js/shared/clan.js và industry.js). Mặc định giá đất của clans.js thì chép ở
// lib/wiki/rules.ts CLAN và lib/wiki/rules-business.ts LAND_PRICE (có kiểm thử).

type Named = { name: string; icon: string };
type Recipe = { in: Record<string, number>; out: Record<string, number> };
type Plant = Named & Recipe & { zones?: string[]; climates?: string[] };
type Prod = Named & { sector: string; comp: number; recipe?: Recipe; lines?: Record<string, Named & { recipe: Recipe; zones?: string[] }>; plants?: Record<string, Plant> };

const prod = PRODUCTION_INDUSTRIES as unknown as Record<string, Prod>;
const goods = GOODS as Record<string, Named>;
const zones = ZONES as Record<string, Named>;
const climates = CLIMATES as Record<string, Named>;
const sectorOf = (id: string) => (INDUSTRIES as unknown as Record<string, { sector: string }>)[id].sector;
const closed = new Set(HEAVY_INDUSTRIES as string[]);
const heavyNames = (HEAVY_INDUSTRIES as string[]).map((id) => `${prod[id].icon} ${prod[id].name}`).join(", ");
/** Hàng chỉ ngành đang tạm đóng làm ra. */
const closedGoods = () => [...new Set((HEAVY_INDUSTRIES as string[]).flatMap((id) => [prod[id].recipe, ...Object.values(prod[id].lines ?? {}).map((l) => l.recipe)])
  .flatMap((r) => (r ? Object.keys(r.out) : [])))].map((g) => `${goods[g].icon} ${goods[g].name}`).join(", ");
const goodList = (m: Record<string, number>) => Object.entries(m).map(([g, n]) => `${goods[g].icon} ${goods[g].name} ×${n}`).join(", ");
const place = (p: { zones?: string[]; climates?: string[] }) =>
  [...(p.zones ?? []).map((z) => `lô ${zones[z].icon} ${zones[z].name}`), ...(p.climates ?? []).map((c) => `lô ${climates[c].icon} ${climates[c].name}`)].join(" hoặc ");

/** Nhà máy (công nghiệp nhẹ, nặng): mỗi dây chuyền một dòng, kèm số mẻ tối đa mỗi đêm và ngành nào đang tạm đóng. */
const factoryRows = (sector: string) => INDUSTRY_ORDER.filter((id: string) => sectorOf(id) === sector).flatMap((id: string) => {
  const ind = prod[id];
  const name = `${ind.icon} ${ind.name}${closed.has(id) ? " (tạm đóng)" : ""}`;
  const lines = ind.lines ? Object.entries(ind.lines) : [[null, { name: ind.name, icon: ind.icon, recipe: ind.recipe! }] as const];
  return lines.map(([line, l]) => [
    name, num(ind.comp), `${ind.lines ? `${l.icon} ${l.name}: ` : ""}${goodList(l.recipe.in)} → ${goodList(l.recipe.out)}${"zones" in l && l.zones ? ` (chỉ ${place(l)})` : ""}`,
    batchesOf(id, line),
  ]);
});
const plantRows = () => Object.values(prod.power.plants!).map((p) => [
  `${p.icon} ${p.name}`, Object.keys(p.in).length ? goodList(p.in) : "Không cần", goodList(p.out), place(p) || "Mọi lô",
]);

// Giá đất: hệ số khan hiếm theo phần lô đã bán (scarcityFactor), giá trị lô tăng theo % riêng mỗi tháng.
const scarcityRows = () => [0, 0.25, 0.5, 0.75, 1].map((sold) => [pct(sold, 0), `×${num(scarcityFactor(sold, LAND_PRICE.scarcityK), 2)}`]);
const pieceCosts = (PIECES as { cost: number }[]).map((p) => p.cost);
const PER_PIECE = designBonus(Array.from({ length: 3 }, () => ({ piece: "base-1" }))) / 3;
const DESIGN_MAX = designBonus(Array.from({ length: DESIGN_RULES.maxPieces }, () => ({ piece: "base-1" })));
const perks = (lv: number) => clanPerks(lv) as { maxPlots: number };

export const article: WikiArticle = {
  slug: "so-nha-dat",
  title: "Sở Nhà Đất và sản xuất",
  category: "kinh-te",
  emoji: "🗺️",
  summary: `${LAND_RULES.count} lô đất có địa hình và khí hậu riêng, công trình lắp ghép, ngành dịch vụ thu xu, chuỗi sản xuất từ mỏ tới nhà máy (công nghiệp nặng đang tạm đóng), kho gia tộc và sàn công nghiệp.`,
  keywords: ["đất", "lô đất", "bản đồ", "sở nhà đất", "công trình", "khai thác", "nhà máy", "điện", "kho", "sàn công nghiệp", "nhập khẩu", "công nghiệp nặng", "tạm đóng", "dây chuyền"],
  related: ["gia-toc", "kinh-te-vi-mo", "so-cong-thuong", "vat-pham-thiet-yeu", "dau-truong"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: "Sở Nhà Đất quản lý bản đồ đất của thị trấn. [Gia tộc](gia-toc) mua lô bằng quỹ gia tộc, lắp công trình trên lô và cho lô làm một ngành mà gia tộc đã thâu tóm: ngành dịch vụ thu xu mỗi đêm, ngành sản xuất làm ra hàng hóa." },
        { list: [
          `Cần ở trong một gia tộc (gia tộc mở ở cấp ${CLAN.unlockLevel}). Tộc trưởng hoặc trưởng lão mua đất, xây công trình, chọn ngành cho lô; chỉ tộc trưởng bán lại đất.`,
          `Hiện **công nghiệp nặng đang tạm đóng**: ${heavyNames}. Xem mục Chức năng bên dưới và [Sở Công Thương](so-cong-thuong).`,
        ] },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { p: `**Bản đồ.** ${LAND_RULES.count} lô (${LAND.cols} cột × ${LAND.rows} hàng). Giá gốc một lô từ ${num(LAND_RULES.minPrice)} tới ${num(LAND_RULES.maxPrice)} xu, trung tâm đắt nhất. Mỗi lô còn có **% tăng giá mỗi tháng** riêng (tối đa ${pct(LAND.maxGrowth, 0)}) và **tốc độ** riêng (tối đa +${pct(LAND.maxProd, 0)} sản lượng), lô càng đắt càng cao.` },
        { table: { head: ["Địa hình", "Đặc điểm"], rows: zoneRows() } },
        { p: `Mỗi lô có một kiểu khí hậu: ${climateNames()}. Ngành nào hợp địa hình và khí hậu của lô thì thu nhiều hơn.` },

        { p: `**Mua đất.** Trả bằng quỹ gia tộc; gia tộc giữ tối đa 1 + 2 × cấp gia tộc lô (cấp 1: ${perks(1).maxPlots} lô, cấp 10: ${perks(10).maxPlots} lô). Giá lô còn trống = giá gốc × hệ số khan hiếm × [chỉ số giá đất](kinh-te-vi-mo), làm tròn tới 1.000 xu. Hệ số khan hiếm = 1 + ${LAND_PRICE.scarcityK} × (phần lô đã bán)^2,5:` },
        { table: { head: ["Phần lô đã có chủ", "Hệ số khan hiếm"], rows: scarcityRows() } },
        { list: [
          `${pct(CLAN.land.treasuryShare, 0)} tiền mua đất vào ngân sách thị trấn, phần còn lại biến mất khỏi nền kinh tế.`,
          `**Giá trị lô đã mua** = giá đã trả × (1 + % tăng của lô)^số tháng đã giữ (tối đa ×${LAND_PRICE.maxAppreciation}) × (chỉ số giá đất hôm nay ÷ chỉ số lúc mua).`,
          `**Bán lại** cho Sở Nhà Đất được **${pct(CLAN.land.resaleRate, 0)}** giá trị hiện tại; công trình và ngành của lô bị xóa.`,
          `Mỗi lô tốn phí duy trì ${num(CLAN.upkeepPerPlot)} xu mỗi đêm từ quỹ gia tộc (xem [Gia tộc](gia-toc)).`,
        ] },

        { p: `**Công trình.** Lắp từ các mảnh ghép, tối đa ${DESIGN_RULES.maxPieces} mảnh, giá mỗi mảnh ${num(Math.min(...pieceCosts))}–${num(Math.max(...pieceCosts))} xu tùy cỡ. Sửa công trình chỉ trả phần giá vượt quá số đã chi cho lô đó. Công trình **hoàn chỉnh** khi có ít nhất ${DESIGN_RULES.minPieces} mảnh, trong đó có móng nền; lô chỉ hoạt động khi công trình hoàn chỉnh. Công trình hoàn chỉnh cho thêm ${pct(PER_PIECE, 1)} sản lượng mỗi mảnh, tối đa +${pct(DESIGN_MAX, 0)}. Đổi ngành của lô không mất công trình.` },

        { p: `**Ngành dịch vụ (${SERVICE_COUNT} ngành)** thu **xu** vào quỹ mỗi đêm: giá gốc lô × ${pct(CLAN.land.yieldRate, 1)} × tốc độ lô × độ hợp địa hình và khí hậu × thời tiết × pha kinh tế × nhu cầu của ngành × cạnh tranh (số gia tộc cùng ngành) × thưởng cấp gia tộc × thưởng công trình. Chi tiết các hệ số ở [Kinh tế vĩ mô](kinh-te-vi-mo).` },
        { table: { head: ["Ngành", "Bồi thường thị trường", "Hợp đất nào nhất"], rows: industryRows("service") } },

        { p: `**Ngành sản xuất** làm ra **hàng hóa** (${GOODS_COUNT} loại) thay vì xu. Mỗi đêm các lô chạy lần lượt: khai thác, phát điện, rồi các nhà máy từ thượng nguồn tới hạ nguồn, giới hạn bởi hàng có trong kho gia tộc và điện.` },
        { list: [
          `Sản lượng mỗi lô nhân thêm hệ số theo giá gốc của lô: ${PRODUCTION_YIELD.scale} × giá gốc ÷ ${num(PRODUCTION_YIELD.refPrice)}, trong khoảng ${PRODUCTION_YIELD.min}–${PRODUCTION_YIELD.max}; cùng với tốc độ lô, độ hợp đất, thời tiết, pha kinh tế, thưởng cấp gia tộc và thưởng công trình.`,
          "**Khai thác**: mỗi lô có mỏ cố định theo địa hình và khí hậu; ngành khai thác lấy những gì mỏ của lô có.",
          "**Năng lượng**: chọn loại nhà máy điện cho từng lô. Điện chạy nhà máy của gia tộc, không trữ được: điện thừa bán cho hệ thống ngay trong đêm.",
          "**Nhà máy**: mỗi lô chạy một dây chuyền, mỗi mẻ theo công thức; số mẻ tối đa mỗi đêm nhân với các hệ số ở trên.",
        ] },
        { table: { head: ["Khai thác", "Bồi thường", "Làm gì"], rows: industryRows("raw") } },
        { table: { head: ["Nhà máy điện", "Cần", "Mỗi mẻ ra", "Dựng được trên"], rows: plantRows() } },
        { table: { head: ["Công nghiệp nhẹ", "Bồi thường", "Công thức mỗi mẻ", "Mẻ tối đa mỗi đêm"], rows: factoryRows("light") } },
        { table: { head: ["Công nghiệp nặng", "Bồi thường", "Công thức mỗi mẻ", "Mẻ tối đa mỗi đêm"], rows: factoryRows("heavy") } },

        { p: `**Công nghiệp nặng tạm đóng.** Mặc định ${heavyNames} đang đóng: không gia tộc nào thâu tóm mới được, không chọn được cho lô, và lô đang làm các ngành này không chạy. Khi đóng, gia tộc đang nắm được hoàn phí thâu tóm vào quỹ, ngành bị gỡ khỏi gia tộc, lô về trạng thái chưa chọn ngành (vẫn giữ công trình) và tộc trưởng nhận thư báo. Quản trị viên có thể mở lại; hàng hóa và công thức vẫn giữ nguyên. Trong lúc đóng, không gia tộc nào làm ra ${closedGoods()}.` },

        { p: "**Kho gia tộc và sàn công nghiệp.** Hàng làm ra vào kho gia tộc. Nguyên liệu mà các lô của gia tộc cần thì mặc định được giữ lại; hàng khác, điện thừa và phần tràn kho bán cho hệ thống ngay trong đêm. Với từng mặt hàng, gia tộc chỉnh được giữ lại trong kho hay để bán." },
        { table: { head: ["Luật", "Con số"], rows: [
          ["Sức chứa kho", `${num(INDUSTRIAL_MARKET.warehouseBase)} + ${num(INDUSTRIAL_MARKET.warehousePerLevel)} × cấp gia tộc (đơn vị hàng, không tính điện)`],
          ["Bán cho hệ thống", `${pct(INDUSTRIAL_MARKET.npcBuy, 0)} giá tham chiếu của ngày`],
          ["Nhập khẩu từ hệ thống", `${pct(INDUSTRIAL_MARKET.importMarkup, 0)} giá tham chiếu`],
          ["Đăng bán trên sàn chung", `${pct(INDUSTRIAL_MARKET.band[0], 0)}–${pct(INDUSTRIAL_MARKET.band[1], 0)} giá tham chiếu, phí ${pct(INDUSTRIAL_MARKET.fee, 0)}, tin còn ${INDUSTRIAL_MARKET.listingDays} ngày, tối đa ${INDUSTRIAL_MARKET.maxListings} tin`],
        ] } },
        { list: [
          "Giá tham chiếu của hàng = giá gốc × nhu cầu của ngành làm ra hàng đó × hệ số pha kinh tế của ngày.",
          "Thực phẩm chế biến và Thuốc bán cho **Siêu thị** trước (qua ô **Sổ chào giá** ở tab *Sản xuất & Kho*, hoặc hàng vừa làm ra), phần dư mới bán cho hệ thống. Xem [Vật phẩm thiết yếu](vat-pham-thiet-yeu).",
          "Mua bán giữa các gia tộc chịu luật chống thao túng của [Sở Công Thương](so-cong-thuong).",
          "Tiền bán hàng tính vào doanh thu chịu [thuế doanh nghiệp](gia-toc) cùng đêm.",
        ] },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { warn: "Lô đất và ghế ngành chiến lược có thể bị gia tộc khác giành qua [Đấu trường](dau-truong)." },
        { list: [
          `Bán lại chỉ được ${pct(CLAN.land.resaleRate, 0)} giá trị, tiền xây công trình không được hoàn.`,
          "Giá trị lô đi theo chỉ số giá đất, nên có thể thấp hơn giá đã trả khi kinh tế suy thoái.",
          "Lô có công trình chưa hoàn chỉnh, hoặc làm ngành đang tạm đóng, không thu được gì nhưng vẫn tốn phí duy trì.",
          "Nhà máy thiếu nguyên liệu hay thiếu điện thì chạy ít mẻ hơn hoặc đứng yên.",
          `Kho đầy thì phần tràn bị bán ngay trong đêm, cho hệ thống chỉ ${pct(INDUSTRIAL_MARKET.npcBuy, 0)} giá tham chiếu.`,
        ] },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { tip: "Để ý pha kinh tế và chỉ số giá đất trước khi mở rộng quỹ đất." },
        { tip: "Một chuỗi sản xuất cần cả đầu vào lẫn điện. Thử vẽ ra trước gia tộc sẽ lấy chúng ở đâu." },
        { tip: "Gia tộc chỉ nắm được vài ngành, nên chọn ngành là chọn cả chuỗi bạn sẽ làm." },
      ],
    },
  ],
};
