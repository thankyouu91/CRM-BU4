import type { WikiArticle } from "../types";
import { FORGE_SHOP } from "../rules-arena";
import { DEFAULT_GEAR_CONFIG, QUICK_SELL, TIERS, TIER_ORDER, UPGRADE_MAX_CHANCE, nextTier, upgradeAffixes } from "@/public/ta-tua/game/js/shared/gear.js";
import { COMMODITIES, LOT } from "@/petdex/server/rules/market.js";

// Lò rèn và Tiệm vật liệu (petdex/server/forge.js). Giá, tỉ lệ và biên độ đọc từ cấu hình trang phục mặc định
// (public/ta-tua/game/js/shared/gear.js); quản trị viên chỉnh được trong game, nên wiki ghi mức mặc định.

type Tier = "blue" | "green" | "gold" | "red";
type Cost = { coins: number; lots: number };

const num = (n: number) => Math.round(n).toLocaleString("vi-VN");
const xu = (n: number) => `${num(n)} xu`;
const lots = (n: number) => `${String(Math.round(n * 10) / 10).replace(".", ",")} lô`;
const ratio = (x: number) => String(Math.round(x * 100) / 100).replace(".", ",");

const F = DEFAULT_GEAR_CONFIG.forge as {
  repairChance: number; repairHours: number; repair: Record<Tier, Cost>;
  upgradeChance: Record<string, number>; upgrade: Record<string, Cost>; shopMarkup: number;
};
const ranges = DEFAULT_GEAR_CONFIG.ranges as unknown as Record<Tier, Record<string, [number, number]>>;
const tiers = TIERS as Record<Tier, { name: string; lines: number }>;
const ORDER = TIER_ORDER as Tier[];
const UPGRADABLE = ORDER.filter((t) => nextTier(t));
const name = (t: Tier) => tiers[t].name;

const goods = COMMODITIES as Record<string, { name: string; icon: string; kind: string; base: number; shelfDays?: number }>;
const RAW = Object.keys(goods).filter((c) => goods[c].kind === "raw").sort((a, b) => goods[a].base - goods[b].base);
const shopPrice = (c: string) => Math.ceil(goods[c].base * F.shopMarkup);
const cheapest = RAW[0];

/** Chi phí trung bình tới khi thành công: thất bại vẫn mất phí, nên chia cho tỉ lệ thành công. */
const expected = (cost: Cost, chancePct: number) => ({ coins: cost.coins / (chancePct / 100), lots: cost.lots / (chancePct / 100) });

const repairRows = () => ORDER.map((t) => {
  const e = expected(F.repair[t], F.repairChance);
  return [name(t), xu(F.repair[t].coins), lots(F.repair[t].lots), `${F.repairChance}%`, `${xu(e.coins)} + ${lots(e.lots)}`];
});
const upgradeRows = () => UPGRADABLE.map((t) => {
  const e = expected(F.upgrade[t], F.upgradeChance[t]);
  return [`${name(t)} → ${name(nextTier(t) as Tier)}`, xu(F.upgrade[t].coins), lots(F.upgrade[t].lots), `${ratio(F.upgradeChance[t])}%`, `${xu(e.coins)} + ${lots(e.lots)}`];
});
const toRed = UPGRADABLE.reduce((s, t) => {
  const e = expected(F.upgrade[t], F.upgradeChance[t]);
  return { coins: s.coins + e.coins, lots: s.lots + e.lots };
}, { coins: 0, lots: 0 });

const materialRows = () => RAW.map((c) => [
  `${goods[c].icon} ${goods[c].name}`, xu(goods[c].base), xu(shopPrice(c)), goods[c].shelfDays ? `${goods[c].shelfDays} ngày` : "Không hư",
]);

// ---------------------------------------------------------------- ví dụ sửa một món Vàng

const EX_REPAIR = { tier: "gold" as Tier };
const exRepair = F.repair[EX_REPAIR.tier];
const exBuy = exRepair.lots * shopPrice(cheapest);
const exTry = exRepair.coins + exBuy;
const exAvg = exTry / (F.repairChance / 100);

// ---------------------------------------------------------------- ví dụ nâng một món Xanh lục

const EX_UP = { from: "green" as Tier, affixes: { income: 6, stats: 8 } };
const exTo = nextTier(EX_UP.from) as Tier;
const exAfter = upgradeAffixes(EX_UP.from, exTo, EX_UP.affixes, ranges, () => 0) as Record<string, number>;
const AFFIX_NAME: Record<string, string> = { income: "💼 Thu nhập ca làm", stats: "📈 Chỉ số", trade: "🏮 Thu nhập giao dịch", luck: "🍀 May mắn" };
const exLineRows = () => Object.entries(EX_UP.affixes).map(([a, v]) => [
  AFFIX_NAME[a], `${v}% (biên độ ${ranges[EX_UP.from][a][0]}–${ranges[EX_UP.from][a][1]}%)`, `${exAfter[a]}% (biên độ ${ranges[exTo][a][0]}–${ranges[exTo][a][1]}%)`,
]);
const exUpCost = F.upgrade[EX_UP.from];

export const article: WikiArticle = {
  slug: "lo-ren",
  title: "Lò rèn",
  category: "nuoi-be",
  emoji: "🔨",
  summary: `Sửa trang phục hỏng sau Đấu trường (${F.repairChance}% thành công) và thử vận may nâng cấp lên cấp cao hơn, bằng xu và vật liệu thô.`,
  keywords: ["lò rèn", "rèn", "sửa đồ", "đồ hỏng", "nâng cấp", "upgrade", "vật liệu", "tiệm vật liệu", "lô", "đỏ", "vàng", "trang phục"],
  related: ["trang-phuc", "dau-truong", "san-nguyen-lieu", "mini-game"],
  sections: [
    {
      id: "o-dau",
      title: "Lò rèn ở đâu",
      blocks: [
        { p: "Trên bản đồ phố, dãy sau có hai tòa mới cạnh nhau: **⚒️ Lò rèn** (sửa và nâng cấp trang phục) và **🧺 Tiệm vật liệu** (bán hàng thô để rèn). Trong **Túi đồ**, mỗi món trang phục cũng có sẵn nút **🔨 Sửa** hoặc **⬆️ Nâng cấp** kèm tỉ lệ thành công." },
        { list: [
          "Chỉ rèn được món **đã mở hộp** và **không đang bày bán hay đấu giá** ở Chợ Phiên.",
          "Trước khi làm, game hỏi lại: tỉ lệ thành công, giá xu, số lô vật liệu cần và bạn đang có bao nhiêu lô, điều gì xảy ra khi thất bại.",
          "Màn Lò rèn xếp đồ hỏng lên đầu, rồi đồ đang sửa, rồi đồ nâng cấp được (cấp cao trước).",
        ] },
        { p: "Các con số dưới đây là **mức mặc định**; ban quản lý chỉnh được trong game, nên hãy xem số ghi trên nút và trong lời hỏi lại." },
      ],
    },
    {
      id: "tinh-trang",
      title: "Ba tình trạng của một món",
      blocks: [
        { table: { head: ["Tình trạng", "Nhãn trong game", "Cộng chỉ số và chiến lực", "Làm được gì"], rows: [
          ["Dùng được", "Không có nhãn", "Có", `Nâng cấp (nếu chưa phải ${name(ORDER[ORDER.length - 1])}), bày bán, đấu giá`],
          ["Hỏng", "🔧 Hỏng", "Không", "Sửa; bán nhanh cho Siêu thị ở mức thấp nhất"],
          ["Đang sửa", "⏳ Đang sửa · còn …", "Không", "Chờ hết giờ; chưa nâng cấp, chưa bày bán được"],
        ] } },
        { p: "Trang phục chỉ **hỏng** sau một trận ở [Đấu trường gia tộc](dau-truong): mọi món đang đeo của người ra sân hỏng hẳn. Món hỏng vẫn nằm trên người bé (vẫn chiếm khe) nhưng không cộng dòng chỉ số, không tính vào bộ đồ theo hành và không cộng chiến lực." },
      ],
    },
    {
      id: "sua",
      title: "Sửa đồ hỏng",
      blocks: [
        { p: `Mỗi lần sửa trả xu và vật liệu theo cấp món, rồi quay **${F.repairChance}%**. Thành công thì món nằm ở lò **${F.repairHours} giờ** rồi mới cộng chỉ số lại. Thất bại thì **mất xu và vật liệu**, món vẫn hỏng, sửa lại thì trả lại từ đầu.` },
        { table: { head: ["Cấp món", "Xu mỗi lần", "Vật liệu mỗi lần", "Tỉ lệ", "Trung bình tới khi xong"], rows: repairRows() } },
        { p: `Cột cuối là chi phí trung bình: mỗi lần chỉ ${F.repairChance}% thành công nên trung bình cần khoảng ${ratio(100 / F.repairChance)} lần.` },
        { p: `**Ví dụ:** sửa một món ${name(EX_REPAIR.tier)} cần ${xu(exRepair.coins)} và ${lots(exRepair.lots)}. Kho trống, bạn mua ${lots(exRepair.lots)} ${goods[cheapest].icon} ${goods[cheapest].name} ở Tiệm vật liệu (${xu(shopPrice(cheapest))}/lô ở giá gốc) hết ${xu(exBuy)}. Một lần sửa tốn ${xu(exTry)}; trung bình tới khi xong khoảng ${xu(exAvg)}.` },
        { warn: `Món đang chờ ở lò mà vẫn đeo trên bé ra sân Đấu trường thì **hỏng lại** sau trận. Đợi đủ ${F.repairHours} giờ mới tính là dùng được.` },
      ],
    },
    {
      id: "nang-cap",
      title: "Nâng cấp",
      blocks: [
        { p: `Nâng một món còn lành lên **cấp kế tiếp** (${ORDER.map(name).join(" → ")}). Rất đắt và tỉ lệ thấp, không bao giờ quá **${UPGRADE_MAX_CHANCE}%**, cấp càng cao càng khó. Thất bại thì mất xu và vật liệu, món giữ nguyên cấp và các dòng.` },
        { table: { head: ["Nâng", "Xu mỗi lần", "Vật liệu mỗi lần", "Tỉ lệ", "Trung bình tới khi xong"], rows: upgradeRows() } },
        { list: [
          "Thành công: **giữ các dòng cũ**, mỗi dòng giữ vị trí tương đối trong biên độ của cấp mới (dòng đang cao vẫn cao), và **thêm đúng một dòng mới** quay trong biên độ cấp mới, ưu tiên các loại chỉ số món đó hay ra.",
          `Món ${name(ORDER[ORDER.length - 1])} là cao nhất, không nâng nữa.`,
          "Món hỏng phải sửa xong, món đang ở lò phải chờ xong, rồi mới nâng được.",
        ] },
        { p: `**Ví dụ:** một món ${name(EX_UP.from)} có hai dòng. Nâng lên ${name(exTo)} (${ratio(F.upgradeChance[EX_UP.from])}%, mỗi lần ${xu(exUpCost.coins)} và ${lots(exUpCost.lots)}). Nếu thành công:` },
        { table: { head: ["Dòng", `Trước (${name(EX_UP.from)})`, `Sau (${name(exTo)})`], rows: [
          ...exLineRows(),
          ["Dòng mới", "", `Một loại chưa có, ${ranges[exTo].income[0]}–${ranges[exTo].income[1]}%`],
        ] } },
        { warn: `Đi từ ${name(ORDER[0])} lên ${name(ORDER[ORDER.length - 1])} bằng Lò rèn trung bình tốn khoảng **${xu(toRed.coins)}** và **${lots(toRed.lots)}** vật liệu. Đồ Vàng, Đỏ rớt từ mini-game hoặc mua ở Chợ Phiên nhiều khi rẻ hơn.` },
      ],
    },
    {
      id: "vat-lieu",
      title: "Vật liệu và Tiệm vật liệu",
      blocks: [
        { p: `Vật liệu rèn là **hàng thô bất kỳ trong kho** của bạn ở [Sàn Nguyên Liệu](san-nguyen-lieu), tính bằng lô (1 lô = ${LOT} phần). Các loại hàng thô cộng chung: 5 phần Lá trà và 5 phần Sữa cũng là 1 lô. Khi rèn, game lấy **hàng đang rẻ nhất trên Sàn trước**, để bạn đỡ mất hàng đắt.` },
        { list: [
          `Mỗi ván [mini-game](mini-game) có ${DEFAULT_GEAR_CONFIG.materialChance}% rớt ${DEFAULT_GEAR_CONFIG.materialQty[0]}–${DEFAULT_GEAR_CONFIG.materialQty[1]} lô hàng thô (May mắn tăng tỉ lệ này).`,
          "Mua trên Sàn Nguyên Liệu ở giá thị trường.",
          `Mua ở **🧺 Tiệm vật liệu**: giá gấp **${ratio(F.shopMarkup)} lần** giá Sàn lúc đó, mỗi lần ${FORGE_SHOP.minLots}–${FORGE_SHOP.maxLots} lô (nút *Mua 1 lô* và *Mua 5 lô*), hàng về thẳng kho.`,
        ] },
        { table: { head: ["Hàng thô", "Giá Sàn gốc / lô", "Giá Tiệm ở giá gốc / lô", "Hạn dùng trong kho"], rows: materialRows() } },
        { p: "Giá Sàn thay đổi liên tục, nên giá Tiệm cũng đổi theo; bảng trên tính ở giá gốc." },
        { tip: `${goods[RAW[0]].name} và ${goods[RAW[1]].name} rẻ nhất${goods[RAW[0]].shelfDays || goods[RAW[1]].shelfDays ? "" : " và không hư"}, rất hợp để trữ sẵn làm vật liệu. Hàng có hạn dùng (${RAW.filter((c) => goods[c].shelfDays).map((c) => goods[c].name).join(", ")}) để lâu sẽ hư và mất khỏi kho.` },
        { warn: "Hàng mua ở Tiệm vật liệu vẫn chiếm chỗ trong kho Sàn. Kho đầy thì không mua thêm được." },
      ],
    },
    {
      id: "meo",
      title: "Mẹo dùng Lò rèn",
      blocks: [
        { list: [
          "Trước trận ở [Đấu trường](dau-truong), tháo những món quý khỏi các bé không ra sân: mọi món đang đeo trên mọi bé của người ra sân đều hỏng sau trận.",
          `Món hỏng bán nhanh chỉ được mức thấp nhất (${Math.round(QUICK_SELL.min * 100)}% giá trị). Món rẻ mà sửa đắt thì có khi bán đi, mua hộp mới còn lợi hơn.`,
          "Đọc kỹ lời hỏi lại trước khi bấm: thất bại là mất cả xu lẫn vật liệu.",
        ] },
      ],
    },
  ],
};

export default article;
