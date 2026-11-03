import type { WikiArticle } from "../types";
import { ESSENTIALS_SHOP, clanItemPrice, npcQuota } from "../rules-arena";
import { ITEMS } from "@/petdex/server/game.js";
import {
  ESSENTIALS, GOODS, MARKET_RULES, PRODUCTION_INDUSTRIES, essentialStage, npcPriceFactor, npcXpFactor, qualityScore, qualitySplit,
} from "@/public/ta-tua/game/js/shared/industry.js";

// Vật phẩm thiết yếu (petdex/server/essentials.js, sổ chào giá ở petdex/server/industry.js). Luật đọc từ
// public/ta-tua/game/js/shared/industry.js (ESSENTIALS); hai công thức chỉ có trong essentials.js được chép ở
// lib/wiki/rules-arena.ts và có test đối chiếu.

type Cat = "food" | "care";
type CatMeta = { name: string; label: string; icon: string; unit: string; good: string; industry: string; line?: string; upstream: string[]; perUnit: number; perPetDay: number };
type Item = { name: string; icon: string; type: string; effect: Record<string, number>; xp: number; clanMade?: boolean; quality?: number };

const num = (n: number) => Math.round(n).toLocaleString("vi-VN");
const xu = (n: number) => `${num(n)} xu`;
const pct = (x: number) => `${String(Math.round(x * 1000) / 10).replace(".", ",")}%`;
const times = (x: number) => `×${(Math.round(x * 100) / 100).toFixed(2).replace(".", ",")}`;

const CATS = Object.keys(ESSENTIALS.cats) as Cat[];
const meta = (c: Cat) => (ESSENTIALS.cats as Record<Cat, CatMeta>)[c];
const QUALITIES = ESSENTIALS.qualities as { key: string; name: string; mult: number }[];
const STAGES = ESSENTIALS.stages as { key: string; name: string; icon: string; from: number; npcBoost: number; npcSpare: number }[];
const goods = GOODS as Record<string, { name: string; icon: string; base: number }>;
const industries = PRODUCTION_INDUSTRIES as Record<string, { name: string; icon: string; lines?: Record<string, { name: string }> }>;
const D_MAX = 1 - ESSENTIALS.npcFloor;
const stageOf = (d: number) => essentialStage(d) as (typeof STAGES)[number];

/** Tên ngành (kèm dây chuyền nếu là nhà máy gộp), từ "ngành" hoặc "ngành:dây chuyền". */
const industryName = (industry: string, line?: string) => {
  const ind = industries[industry];
  return line && ind.lines?.[line] ? `${ind.icon} ${ind.name} (dây chuyền ${ind.lines[line].name})` : `${ind.icon} ${ind.name}`;
};
const upstreamName = (spec: string) => industryName(...(spec.split(":") as [string, string?]));

const EFFECT: Record<string, string> = { fullness: "No bụng", happiness: "Vui vẻ", energy: "Năng lượng", hygiene: "Sạch sẽ", health: "Sức khỏe" };
const clanItems = Object.values(ITEMS as Record<string, Item>).filter((i) => i.clanMade);
const ref = (c: Cat) => goods[meta(c).good].base;

const catRows = () => CATS.map((c) => {
  const m = meta(c);
  return [
    `${m.icon} ${m.name}`, `${goods[m.good].icon} ${goods[m.good].name}`, industryName(m.industry, m.line),
    `1 đơn vị = ${m.perUnit} ${m.unit}`, `${m.perPetDay} món`, m.upstream.map(upstreamName).join(", "),
  ];
});

const stageRange = (i: number) => {
  const next = STAGES[i + 1];
  return next ? `${pct(STAGES[i].from)} tới dưới ${pct(next.from)}` : `${pct(STAGES[i].from)} tới ${pct(D_MAX)}`;
};
const stageRows = () => STAGES.map((s, i) => [
  `${s.icon} ${s.name}`, stageRange(i), `×${s.npcBoost}, cộng ${s.npcSpare} món`,
  s.from === 0 ? pct(npcXpFactor(0)) : STAGES[i + 1] ? `${pct(npcXpFactor(s.from))} giảm dần còn ${pct(npcXpFactor(STAGES[i + 1].from - 1e-9))}` : pct(npcXpFactor(s.from)),
  STAGES[i + 1] && times(npcPriceFactor(s.from)) !== times(npcPriceFactor(STAGES[i + 1].from - 1e-9))
    ? `${times(npcPriceFactor(s.from))} tới ${times(npcPriceFactor(STAGES[i + 1].from - 1e-9))}`
    : times(npcPriceFactor(s.from)),
]);

const D_SAMPLES = [0, 0.1, 0.2, 0.4, 0.6, 0.8, D_MAX];
const quotaRows = () => D_SAMPLES.map((d) => [
  pct(d), stageOf(d).name,
  npcQuota(1, "food", d), npcQuota(4, "food", d), npcQuota(1, "care", d), npcQuota(4, "care", d),
  pct(npcXpFactor(d)), times(npcPriceFactor(d)),
]);

const itemRows = () => clanItems.map((i) => [
  `${i.icon} ${i.name}`, QUALITIES[i.quality ?? 0].name,
  Object.entries(i.effect).map(([k, v]) => `${EFFECT[k]} +${v}`).join(", "), i.xp,
  xu(clanItemPrice(i.type as Cat, ref(i.type as Cat), i.quality ?? 0)),
]);

const SCORES = [0, 0.25, 0.5, 0.75, 1];
const avgMult = (score: number) => qualitySplit(score).reduce((s: number, x: number, i: number) => s + x * QUALITIES[i].mult, 0);
const splitRows = () => SCORES.map((s) => [String(s).replace(".", ","), ...qualitySplit(s).map((x: number) => pct(x)), times(avgMult(s))]);

const W = ESSENTIALS.qualityWeights as { level: number; design: number; upstream: number };
const SCORE_EXAMPLES = [
  { label: "Gia tộc cấp 1, nhà xưởng chưa lắp mảnh nào, không tự chạy ngành đầu vào", level: 1, pieces: 0, upstream: 0 },
  { label: "Cấp 5, nhà xưởng 10 mảnh, không có ngành đầu vào", level: 5, pieces: 10, upstream: 0 },
  { label: "Cấp 5, nhà xưởng 10 mảnh, có lô chạy ngành đầu vào", level: 5, pieces: 10, upstream: 1 },
  { label: "Cấp 10, nhà xưởng 20 mảnh, có ngành đầu vào", level: 10, pieces: 20, upstream: 1 },
];
const scoreRows = () => SCORE_EXAMPLES.map((e) => [e.label, String(qualityScore(e)).replace(".", ",")]);

// ---------------------------------------------------------------- ví dụ gia tộc bán cho Siêu thị

const EX_SELL = { units: 100, ratio: 0.9, score: 0.5, cat: "food" as Cat };
const exGood = goods[meta(EX_SELL.cat).good];
const exShop = EX_SELL.units * exGood.base * EX_SELL.ratio * avgMult(EX_SELL.score);
const exNpc = EX_SELL.units * Math.max(1, Math.round(exGood.base * MARKET_RULES.npcBuy));
const exSuat = EX_SELL.units * meta(EX_SELL.cat).perUnit;

// ---------------------------------------------------------------- ví dụ người chơi

const EX_PLAYER = { pets: 2, d: 0.4 };
const exStage = stageOf(EX_PLAYER.d);

const askMin = Math.round(ESSENTIALS.askMin * 100);
const askMax = Math.round(ESSENTIALS.askMax * 100);

export const article: WikiArticle = {
  slug: "vat-pham-thiet-yeu",
  title: "Vật phẩm thiết yếu",
  category: "kinh-te",
  emoji: "🧺",
  summary: "Siêu thị mua Thực phẩm chế biến và Thuốc của các gia tộc để bán lại thành hàng gia tộc ba hạng, còn đồ ăn, đồ chăm sóc NPC bị giới hạn và giảm XP khi thị trấn tự chủ dần.",
  keywords: ["thiết yếu", "tự chủ", "đồ ăn", "đồ chăm sóc", "hạn mức", "NPC", "suất ăn gia tộc", "bộ chăm sóc gia tộc", "Ngon", "Tuyệt hảo", "sổ chào giá", "khai hoang", "siêu thị", "chất lượng"],
  related: ["sieu-thi", "gia-toc", "so-nha-dat", "kinh-te-vi-mo", "cham-soc"],
  sections: [
    {
      id: "tong-quan",
      title: "Thị trấn tự nuôi mình",
      blocks: [
        { p: "Đồ ăn và đồ chăm sóc trong [Siêu thị](sieu-thi) đến từ hai nguồn: **đồ NPC** (các món quen thuộc) và **hàng gia tộc** do các gia tộc làm ra rồi bán cho Siêu thị. Hai nhóm hàng tính riêng:" },
        { table: { head: ["Nhóm", "Hàng gia tộc làm từ", "Ngành làm ra", "Quy đổi", "Nhu cầu mỗi bé mỗi ngày", "Ngành đầu vào"], rows: catRows() } },
        { p: `Mỗi nhóm có một **chỉ số tự chủ** (gọi là D), từ 0% tới ${pct(D_MAX)}: phần nhu cầu của người chơi do gia tộc cung cấp. NPC luôn giữ ít nhất ${pct(ESSENTIALS.npcFloor)}. D chốt mỗi nửa đêm theo cung và cầu 7 ngày gần nhất (hàng Siêu thị mua của gia tộc so với lượng người chơi mua), mỗi ngày dịch tối đa **${Math.round(ESSENTIALS.maxDailyShift * 100)} điểm** để giá không sốc.` },
        { p: `Siêu thị hiện hai thanh **${meta("food").label}** và **${meta("care").label}** kèm giai đoạn, số món NPC bạn còn mua được hôm nay, XP và giá của đồ NPC, và kho hàng gia tộc theo từng hạng.` },
      ],
    },
    {
      id: "do-npc",
      title: "Đồ NPC: hạn mức, XP và giá",
      blocks: [
        { p: "D càng cao thì đồ NPC càng bị bó: mỗi người mỗi ngày mua được ít món hơn, món ăn cho ít XP hơn và đắt hơn một chút." },
        { p: `**Hạn mức mỗi nhóm mỗi ngày = làm tròn lên (số bé × nhu cầu mỗi bé × lớn hơn giữa ${pct(ESSENTIALS.npcFloor)} và (1 − D) × hệ số nới) + số món cộng thêm.** Số bé tính ít nhất là 1. Hạn mức làm mới lúc 0 giờ.` },
        { table: { head: ["Giai đoạn", "D", "Hạn mức", "XP đồ NPC", "Giá đồ NPC"], rows: stageRows() } },
        { table: { head: ["D", "Giai đoạn", "Đồ ăn, 1 bé", "Đồ ăn, 4 bé", "Chăm sóc, 1 bé", "Chăm sóc, 4 bé", "XP đồ NPC", "Giá đồ NPC"], rows: quotaRows() } },
        { list: [
          `Hết hạn mức, game báo *Hết hạn mức ... NPC hôm nay* và gợi ý mua hàng gia tộc. Hàng gia tộc **không tính** vào hạn mức này.`,
          "XP của đồ NPC nhân với hệ số ở bảng; thưởng hợp mệnh và các thưởng khác vẫn tính như thường. Hiệu ứng hồi chỉ số giữ nguyên.",
          `**Tài khoản mới trong ${ESSENTIALS.newbieDays} ngày đầu** được miễn hết: không giới hạn, đủ XP, giá gốc.`,
        ] },
        { p: `**Ví dụ:** nhà bạn có ${EX_PLAYER.pets} bé, D đồ ăn đang ${pct(EX_PLAYER.d)} (giai đoạn ${exStage.name}). Hôm nay bạn mua được ${npcQuota(EX_PLAYER.pets, "food", EX_PLAYER.d)} món đồ ăn NPC và ${npcQuota(EX_PLAYER.pets, "care", EX_PLAYER.d)} món đồ chăm sóc NPC (nếu D đồ chăm sóc cũng ${pct(EX_PLAYER.d)}). Mỗi món ăn NPC cho ${pct(npcXpFactor(EX_PLAYER.d))} XP so với ghi trên thẻ và giá ${times(npcPriceFactor(EX_PLAYER.d))}.` },
      ],
    },
    {
      id: "hang-gia-toc",
      title: "Hàng gia tộc ở Siêu thị",
      blocks: [
        { p: `Hàng gia tộc có ba hạng. **Hiệu ứng, XP và giá đều nhân theo hạng**: ${QUALITIES.map((q) => `${q.name} ×${String(q.mult).replace(".", ",")}`).join(", ")}. Hàng gia tộc **luôn đủ XP**, không bị giảm theo D.` },
        { table: { head: ["Món", "Hạng", "Hiệu quả", "XP", "Giá ở giá tham chiếu gốc"], rows: itemRows() } },
        { list: [
          `Giá một ${meta("food").unit} hoặc một ${meta("care").unit} = giá tham chiếu hôm nay của một đơn vị hàng ÷ số ${meta("food").unit}/${meta("care").unit} trong một đơn vị × ${String(ESSENTIALS.markup).replace(".", ",")} × hệ số hạng, làm tròn lên. Giá tham chiếu đổi theo cầu và chu kỳ kinh tế, xem [Kinh tế vĩ mô](kinh-te-vi-mo).`,
          "Chỉ mua được khi kho Siêu thị còn hàng; thẻ hạng Ngon và Tuyệt hảo chỉ hiện khi còn hàng hạng đó. Mỗi thẻ ghi số còn trong kho.",
          "Mỗi lần mua tối đa 20 món như các món khác.",
        ] },
        { tip: "D càng cao, đồ NPC càng ít XP, nên hàng gia tộc càng đáng tiền: món Tuyệt hảo cho XP gấp rưỡi món Thường mà không bị giảm." },
      ],
    },
    {
      id: "gia-toc-ban",
      title: "Gia tộc bán cho Siêu thị",
      blocks: [
        { p: `Mỗi nửa đêm Siêu thị lên kế hoạch thu mua: đủ hàng cho khoảng **${String(ESSENTIALS_SHOP.daysCovered).replace(".", ",")} ngày** phần nhu cầu của người chơi (phần ngoài ${pct(ESSENTIALS.npcFloor)} của NPC), trừ đi hàng còn trong kho. **Mỗi gia tộc bán tối đa ${Math.round(ESSENTIALS.perClanShare * 100)}%** lượng thu mua của một đêm, để không ai độc quyền.` },
        { steps: [
          `**Sổ chào giá** khớp trước. Tộc trưởng hoặc trưởng lão vào tab *Sản xuất & Kho*, ô **Sổ chào giá**, đặt bán tối đa bao nhiêu đơn vị hàng trong kho ở **${askMin}–${askMax}% giá tham chiếu**. Siêu thị khớp **giá thấp trước**; cùng giá thì hàng điểm chất lượng cao trước, rồi lệnh đặt sớm hơn.`,
          "Sau đó, khi các gia tộc chạy sản xuất đêm đó, Siêu thị mua tiếp **hàng vừa làm ra** (những mặt hàng không để *Giữ trong kho*) ở **100% giá tham chiếu**, tới khi đủ kế hoạch.",
          `Phần còn lại bán cho NPC như mọi hàng khác, ở ${Math.round(MARKET_RULES.npcBuy * 100)}% giá tham chiếu, hoặc nằm trong kho.`,
        ] },
        { list: [
          "Tiền = số đơn vị × giá tham chiếu × % giá chào × hệ số hạng của từng phần hàng. Tiền vào quỹ gia tộc ngay đêm đó và tính thuế như giao dịch trên sàn.",
          "Đặt lệnh chào thì mặt hàng tự chuyển sang *Giữ trong kho* (hàng chờ trong kho tới khi khớp). Đổi % giá thì lệnh mất chỗ xếp hàng theo thời gian; đặt số lượng 0 là hủy lệnh.",
          "Sổ chào cho thấy các mức giá đang chờ (gộp theo %, không lộ tên gia tộc) và lệnh của gia tộc mình.",
        ] },
        { tip: `Muốn chắc bán được khi nhiều gia tộc cùng bán? Chào thấp hơn (ví dụ ${askMin + 10}%) để được khớp trước. Hàng vừa làm ra không có lệnh luôn đứng sau sổ chào.` },
      ],
    },
    {
      id: "chat-luong",
      title: "Chất lượng: Thường, Ngon, Tuyệt hảo",
      blocks: [
        { p: `Mỗi gia tộc có **điểm chất lượng** từ 0 tới 1 cho từng nhóm hàng: **${Math.round(W.level * 100)}% theo cấp gia tộc** (cấp 1 là 0, cấp 10 trở lên là đủ), **${Math.round(W.design * 100)}% theo số mảnh của nhà xưởng đẹp nhất** đang làm hàng đó (20 mảnh là đủ) và **${Math.round(W.upstream * 100)}% nếu gia tộc có lô chạy một ngành đầu vào** (bảng ở trên). Xem cách lắp mảnh ở [Sở Nhà Đất và sản xuất](so-nha-dat).` },
        { table: { head: ["Gia tộc", "Điểm chất lượng"], rows: scoreRows() } },
        { p: "Hàng bán cho Siêu thị được chia hạng theo điểm. Hạng càng cao, Siêu thị trả càng nhiều:" },
        { table: { head: ["Điểm", "Thường", "Ngon", "Tuyệt hảo", "Giá trung bình Siêu thị trả"], rows: splitRows() } },
      ],
    },
    {
      id: "vi-du",
      title: "Ví dụ một đêm bán hàng",
      blocks: [
        { p: `Gia tộc của bạn có ${num(EX_SELL.units)} ${exGood.icon} ${exGood.name} trong kho, điểm chất lượng ${String(EX_SELL.score).replace(".", ",")}, giá tham chiếu đang ở mức gốc ${xu(exGood.base)}. Bạn chào bán cả ${num(EX_SELL.units)} ở ${Math.round(EX_SELL.ratio * 100)}%, và Siêu thị còn đủ chỗ thu mua.` },
        { list: [
          `Siêu thị mua cả ${num(EX_SELL.units)} đơn vị, chia hạng trung bình ${qualitySplit(EX_SELL.score).map((x: number, i: number) => `${pct(x)} ${QUALITIES[i].name}`).join(", ")} (phần lẻ làm tròn ngẫu nhiên).`,
          `Quỹ nhận khoảng ${xu(exShop)}: ${num(EX_SELL.units)} × ${num(exGood.base)} × ${Math.round(EX_SELL.ratio * 100)}% × ${String(Math.round(avgMult(EX_SELL.score) * 10000) / 10000).replace(".", ",")} (hệ số hạng trung bình).`,
          `Bán hết cho NPC thì chỉ được ${xu(exNpc)}. Dù chào ${Math.round(EX_SELL.ratio * 100)}%, bán cho Siêu thị vẫn hơn nhờ hệ số hạng.`,
          `Siêu thị bày bán ${num(exSuat)} ${meta(EX_SELL.cat).unit} cho người chơi, giá ${clanItemPrice(EX_SELL.cat, exGood.base, 0)}, ${clanItemPrice(EX_SELL.cat, exGood.base, 1)} hoặc ${clanItemPrice(EX_SELL.cat, exGood.base, 2)} xu mỗi ${meta(EX_SELL.cat).unit} tùy hạng.`,
        ] },
        { warn: `Siêu thị chỉ mua tới kế hoạch của đêm đó và tối đa ${Math.round(ESSENTIALS.perClanShare * 100)}% mỗi gia tộc. Gia tộc làm quá nhiều thì phần dư vẫn phải bán NPC giá thấp hơn.` },
      ],
    },
  ],
};

export default article;
