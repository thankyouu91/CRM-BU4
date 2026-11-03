import type { WikiArticle } from "../types";
import { CLAN } from "../rules";
import { ARENA_SERVER } from "../rules-arena";
import { ARENA, combatPower as rawPower, elementMult, simulateBattle, slotTime, warSeed } from "@/public/ta-tua/game/js/shared/arena.js";
import { DEFAULT_GEAR_CONFIG, TIERS, TIER_ORDER } from "@/public/ta-tua/game/js/shared/gear.js";
import { ELEMENTS, RARITIES } from "@/public/ta-tua/game/js/shared/pets.js";
import { STRATEGIC_INDUSTRIES } from "@/public/ta-tua/game/js/shared/industry.js";

// Đấu trường gia tộc (petdex/server/arena.js). Luật và trận đánh đọc thẳng từ public/ta-tua/game/js/shared/arena.js,
// nên công thức, bảng và trận ví dụ ở đây là đúng trận mà máy chủ sẽ đánh với cùng đội hình và cùng seed.

type Rarity = "thuong" | "hiem" | "quy" | "huyenthoai";
type Tier = "blue" | "green" | "gold" | "red";
type Fighter = { power: number; rarity: Rarity; element: string };

/** combatPower của game (tham số mặc định `tiers = []` làm TypeScript đoán sai kiểu). */
const combatPower = rawPower as (f: { level: number; rarity: string; tiers?: string[] }) => number;

const num = (n: number) => Math.round(n).toLocaleString("vi-VN");
const xu = (n: number) => `${num(n)} xu`;
const pct = (x: number) => `${String(Math.round(x * 1000) / 10).replace(".", ",")}%`;
const times = (x: number) => `×${String(Math.round(x * 100) / 100).replace(".", ",")}`;

const rarities = RARITIES as Record<Rarity, { name: string; stars: number }>;
const RARITY_KEYS = Object.keys(ARENA.rarity) as Rarity[];
const tiers = TIERS as Record<Tier, { name: string }>;
const elements = ELEMENTS as Record<string, { name: string; icon: string; beats: string }>;
const el = (id: string) => `${elements[id].icon} ${elements[id].name}`;
const tierPoints = ARENA.tierPoints as Record<Tier, number>;
const strategic = STRATEGIC_INDUSTRIES as Record<string, { name: string; icon: string; maxClans: number }>;
const repair = (DEFAULT_GEAR_CONFIG.forge.repair as Record<Tier, { coins: number; lots: number }>);
const repairChance = DEFAULT_GEAR_CONFIG.forge.repairChance / 100;

const LEVELS = [1, 10, 20, 30, 50];
const powerRows = () => LEVELS.map((level) => [`Cấp ${level}`, ...RARITY_KEYS.map((r) => num(combatPower({ level, rarity: r })))]);

const GEAR_SETS: { label: string; tiers: Tier[] }[] = [
  { label: "3 món Xanh lam", tiers: ["blue", "blue", "blue"] },
  { label: "3 món Xanh lục", tiers: ["green", "green", "green"] },
  { label: "4 món Vàng (bé từ cấp 30)", tiers: ["gold", "gold", "gold", "gold"] },
  { label: "5 món Đỏ (bé Huyền thoại từ cấp 30)", tiers: ["red", "red", "red", "red", "red"] },
];
const gearRows = () => GEAR_SETS.map(({ label, tiers: list }) => {
  const points = list.reduce((s, t) => s + tierPoints[t], 0);
  return [label, points, times(1 + ARENA.gearPerPoint * points), num(combatPower({ level: 20, rarity: "thuong", tiers: list }))];
});

/** Hành bị mình khắc và hành khắc mình. */
const beatenBy = (e: string) => Object.keys(elements).find((x) => elements[x].beats === e)!;
const elementRows = () => Object.keys(elements).map((e) => [
  el(e),
  `${el(elements[e].beats)} (${times(elementMult(e, elements[e].beats))})`,
  `${el(beatenBy(e))} (${times(elementMult(e, beatenBy(e)))})`,
]);

// ---------------------------------------------------------------- trận ví dụ

const EX_TEAMS: { clan: string; pets: { name: string; level: number; rarity: Rarity; element: string; tiers: Tier[] }[] }[] = [
  { clan: "Hổ Vằn (thách đấu)", pets: [
    { name: "Lửa Nhỏ", level: 25, rarity: "quy", element: "hoa", tiers: ["gold", "green", "green"] },
    { name: "Sắt Son", level: 18, rarity: "hiem", element: "kim", tiers: ["green", "blue", "blue"] },
    { name: "Mầm Xanh", level: 12, rarity: "thuong", element: "moc", tiers: ["blue"] },
  ] },
  { clan: "Rùa Vàng (giữ đất)", pets: [
    { name: "Sóng Bạc", level: 30, rarity: "thuong", element: "thuy", tiers: ["red", "gold", "gold", "green"] },
    { name: "Đá Tảng", level: 20, rarity: "hiem", element: "tho", tiers: [] },
    { name: "Chuông Đồng", level: 15, rarity: "thuong", element: "kim", tiers: ["blue", "blue"] },
  ] },
];
const EX_WAR = { id: 17, day: "2026-11-05", hour: ARENA.hours[1] };
const exFighters = EX_TEAMS.map((t) => t.pets.map((p) => ({ ...p, power: combatPower(p) })).sort((a, b) => b.power - a.power));
const exBattle = simulateBattle(
  exFighters[0].map((p): Fighter => ({ power: p.power, rarity: p.rarity, element: p.element })),
  exFighters[1].map((p): Fighter => ({ power: p.power, rarity: p.rarity, element: p.element })),
  warSeed(EX_WAR.id, slotTime(EX_WAR.day, EX_WAR.hour)),
);
const exWinner = exBattle.winner === "a" ? 0 : 1;
const exHits = exBattle.rounds.flat() as number[][];
const exCrits = [0, 1].map((s) => exHits.filter((h) => h[0] === s && h[4]).length);
const exDamage = [0, 1].map((s) => exHits.filter((h) => h[0] === s).reduce((sum, h) => sum + h[3], 0));
const exSurvivors = exFighters[exWinner]
  .map((p, i) => ({ name: p.name, hp: exBattle.hp[exWinner][i], max: exBattle.maxHp[exWinner][i] }))
  .filter((p) => p.hp > 0)
  .map((p) => `${p.name} (${num(p.hp)}/${num(p.max)} máu)`);
const exFirst = exBattle.rounds[0][0] as number[];
const exFirstAttacker = exFighters[exFirst[0]][exFirst[1]];
const exFirstTarget = exFighters[1 - exFirst[0]][exFirst[2]];

const exTop = exFighters.flat().reduce((a, b) => (b.power > a.power ? b : a));

/** Cùng đội hình, đánh lại với 1.000 seed khác nhau: bên thách đấu thắng bao nhiêu trận. */
const TRIALS = 1000;
const exWins = Array.from({ length: TRIALS }, (_, i) => simulateBattle(
  exFighters[0].map((p): Fighter => ({ power: p.power, rarity: p.rarity, element: p.element })),
  exFighters[1].map((p): Fighter => ({ power: p.power, rarity: p.rarity, element: p.element })),
  i + 1,
).winner).filter((w) => w === "a").length;

const exTeamRows = () => exFighters.flatMap((team, s) => team.map((p) => [
  EX_TEAMS[s].clan,
  `${p.name} · ${el(p.element)} · ${rarities[p.rarity].name} · cấp ${p.level}`,
  p.tiers.length ? p.tiers.map((t) => tiers[t].name).join(", ") : "Không đeo",
  num(p.power),
  num(p.power * ARENA.hpPerPower),
  num(p.power * ARENA.atkPerPower),
]));

// ---------------------------------------------------------------- tiền phạt ví dụ

const EX_FUND = 200_000;
const penaltyOf = (rate: number) => {
  const total = Math.floor(EX_FUND * rate);
  const toWinner = Math.floor(total * ARENA_SERVER.winnerShare);
  return { total, toWinner, toTown: total - toWinner };
};
const exFight = penaltyOf(ARENA.penalty);
const exForfeit = penaltyOf(ARENA.forfeitPenalty);

const EX_GEAR = { members: ARENA.teamSize, pieces: 3, tier: "green" as Tier };
const exBroken = EX_GEAR.members * EX_GEAR.pieces;
const exRepairOnce = exBroken * repair[EX_GEAR.tier].coins;
const exRepairLots = exBroken * repair[EX_GEAR.tier].lots;

const hoursText = ARENA.hours.map((h: number) => `${h}h`).join(" hoặc ");
const strategicNames = Object.values(strategic).map((s) => `${s.icon} ${s.name}`).join(", ");

export const article: WikiArticle = {
  slug: "dau-truong",
  title: "Đấu trường gia tộc",
  category: "cong-dong",
  emoji: "⚔️",
  summary: `Thách đấu gia tộc khác để giành lô đất hoặc ghế ngành chiến lược: ${ARENA.teamSize} người mạnh nhất mỗi bên tự đánh theo lượt, bên thua mất mục tiêu và ${Math.round(ARENA.penalty * 100)}% quỹ.`,
  keywords: ["đấu trường", "thách đấu", "clan war", "pvp", "chiến lực", "trận đấu", "giành đất", "ghế chiến lược", "bỏ trận", "phạt quỹ", "đồ hỏng", "xem lại trận"],
  related: ["gia-toc", "so-nha-dat", "lo-ren", "trang-phuc", "ngu-hanh"],
  sections: [
    {
      id: "tong-quan",
      title: "Đấu trường là gì",
      blocks: [
        { p: `Tòa **⚔️ Đấu trường** nằm ở dãy trước trên bản đồ phố, mở cùng lúc với Gia tộc (bé cao nhất đạt **cấp ${CLAN.unlockLevel}**). Trang [Gia tộc](gia-toc) cũng có nút **⚔️ Đấu trường**. Muốn ra sân thì phải ở trong một gia tộc.` },
        { p: "Một gia tộc thách đấu gia tộc khác để giành **một mục tiêu** của họ:" },
        { list: [
          "**🗺️ Một lô đất** gia tộc kia đang giữ, kèm nhà máy và công trình trên lô. Xem [Sở Nhà Đất và sản xuất](so-nha-dat).",
          `**🏛️ Một ghế ngành chiến lược**: ${strategicNames}. Ghế đi kèm cấp hạ tầng gia tộc kia đã xây.`,
        ] },
        { p: `Đến giờ đấu, máy chủ tự cho **${ARENA.teamSize} thành viên có chiến lực cao nhất** mỗi bên đánh theo lượt. Bạn không cần bấm gì trong trận, chỉ cần có mặt trong đội hình. Bên thua mất mục tiêu (nếu là bên giữ) và **${Math.round(ARENA.penalty * 100)}% quỹ gia tộc**; trang phục đang đeo của mọi người ra sân, cả hai bên, **hỏng hẳn**.` },
        { warn: "Bên thách đấu thua cũng phải nộp phạt quỹ y như bên giữ. Đừng thách đấu khi chưa chắc đội mình mạnh hơn." },
      ],
    },
    {
      id: "thach-dau",
      title: "Thách đấu và chọn giờ",
      blocks: [
        { p: "Chỉ **👑 Tộc trưởng** hoặc **🎖️ Trưởng lão** được thách đấu, chọn giờ và rút lời thách." },
        { steps: [
          "Vào Đấu trường, ở ô **🎯 Thách đấu** chọn **Mục tiêu** (lô hoặc ghế, xếp theo gia tộc đang giữ).",
          `Chọn **Khung 1** và (nếu muốn) **Khung 2**: một ngày từ ngày mai tới ${ARENA.maxDaysAhead} ngày tới, lúc ${hoursText} giờ Việt Nam.`,
          "Bấm **⚔️ Gửi lời thách đấu**. Trận hiện ở trạng thái *Chờ chọn giờ*.",
          `Bên bị thách bấm **Chọn** một trong các khung đã đề xuất, trong vòng **${ARENA.confirmHours} giờ** (và trước khung cuối cùng). Trận chuyển sang *Đã chốt giờ* và cả thị trấn nhận một thông báo bật lên.`,
          "Đến giờ, trận tự đánh. Kết quả nằm ở **🏆 Lịch sử**, bấm **▶ Xem lại** để xem từng lượt.",
        ] },
        { table: { head: ["Luật", "Con số"], rows: [
          ["Khung giờ đề xuất", `1 hoặc ${ARENA.maxSlots} khung, ${hoursText} (giờ Việt Nam)`],
          ["Ngày đấu", `Từ ngày mai tới ${ARENA.maxDaysAhead} ngày tới`],
          ["Hạn chọn giờ", `${ARENA.confirmHours} giờ, nhưng không muộn hơn khung cuối cùng`],
          ["Không chọn giờ kịp", `Bên bị thách **bỏ trận**: mất mục tiêu và nộp ${Math.round(ARENA.forfeitPenalty * 100)}% quỹ`],
          ["Số trận một lúc", "Mỗi gia tộc chỉ một trận đang chờ; mỗi mục tiêu cũng chỉ một trận"],
          ["Thời gian chờ", `Một lô hay ghế vừa đấu xong (hoặc bị bỏ trận) không ai thách lại được trong ${ARENA.cooldownDays} ngày`],
          ["Rút lời thách", "Bên thách đấu rút được khi bên kia chưa chọn giờ, không mất gì"],
          ["Thách ghế chiến lược", `Gia tộc mình chưa giữ ghế chiến lược nào (mỗi gia tộc tối đa ${ARENA_SERVER.strategicSeats} ghế) và chưa đủ ${CLAN.industryLevels.length} ngành`],
        ] } },
        { p: "Quản trị viên có thể hủy một trận chưa đánh; khi đó không bên nào mất gì." },
      ],
    },
    {
      id: "chien-luc",
      title: "Chiến lực",
      blocks: [
        { p: `Mỗi thành viên ra sân bằng **bé có chiến lực cao nhất** của mình (không nhất thiết là bé chính). Chiến lực tính như sau:` },
        { p: `**Chiến lực = (${ARENA.basePower} + ${ARENA.powerPerLevel} × cấp) × hệ số độ hiếm × (1 + ${Math.round(ARENA.gearPerPoint * 100)}% × điểm trang phục)**, làm tròn.` },
        { table: { head: ["Độ hiếm", "Hệ số chiến lực", "Tỉ lệ chí mạng"], rows: RARITY_KEYS.map((r) => [
          `${"★".repeat(rarities[r].stars)} ${rarities[r].name}`, times(ARENA.rarity[r]), pct(ARENA.crit[r]),
        ]) } },
        { p: "Điểm trang phục: cộng điểm của từng món **đang đeo và còn dùng được**. Món hỏng hoặc đang sửa ở [Lò rèn](lo-ren) không tính." },
        { table: { head: ["Cấp món", ...(TIER_ORDER as Tier[]).map((t) => tiers[t].name)], rows: [["Điểm", ...(TIER_ORDER as Tier[]).map((t) => tierPoints[t])]] } },
        { table: { head: ["Chiến lực khi không đeo gì", ...RARITY_KEYS.map((r) => rarities[r].name)], rows: powerRows() } },
        { table: { head: ["Đồ đeo (bé Thường cấp 20)", "Điểm", "Nhân chiến lực", "Chiến lực"], rows: gearRows() } },
        { list: [
          "Chỉ **cấp, độ hiếm, cấp các món đang đeo** và **hành** của bé có tác dụng trong trận. Kỹ năng, No bụng, Vui vẻ, tuổi hay các dòng % trên trang phục không đổi gì ở Đấu trường.",
          "Số món được đeo vẫn theo luật thường: 3 món, từ cấp 30 được 4, bé Huyền thoại thêm 1. Xem [Trang phục](trang-phuc).",
          `Đội hình được tính lại **đúng giờ đấu**: ${ARENA.teamSize} người đầu danh sách ra sân, người không có bé thì không ra sân. Danh sách hiện trong ô đội hình của gia tộc, kèm ⚔️ chiến lực từng người.`,
        ] },
      ],
    },
    {
      id: "tran-dau",
      title: "Một trận đánh diễn ra thế nào",
      blocks: [
        { list: [
          `Mỗi bé vào trận với **máu = ${ARENA.hpPerPower} × chiến lực** và **sức đánh = ${String(ARENA.atkPerPower).replace(".", ",")} × chiến lực**.`,
          "Mỗi lượt, các bé còn đứng của hai bên lần lượt ra đòn **xen kẽ**: bé mạnh nhất bên thách đấu, rồi bé mạnh nhất bên giữ, rồi bé mạnh thứ hai bên thách đấu, cứ thế. Bé đã ngã trước tới lượt mình thì mất lượt.",
          "Mỗi đòn đánh vào **một bé còn đứng ngẫu nhiên** của bên kia.",
          `**Sát thương = sức đánh × một số ngẫu nhiên từ 0,85 tới 1,15 × hệ số ngũ hành × ${String(ARENA.critMult).replace(".", ",")} nếu chí mạng**, làm tròn, ít nhất 1.`,
          `Trận dừng khi một bên ngã hết, hoặc sau **${ARENA.maxRounds} lượt**. Hết ${ARENA.maxRounds} lượt mà hai bên còn người thì bên còn **nhiều % máu hơn** (tổng máu còn lại so với tổng máu ban đầu) thắng; bằng nhau thì **bên giữ** thắng.`,
          "Một bên không có ai ra sân thì bên kia thắng ngay. Cả hai bên đều không có ai thì bên giữ thắng.",
        ] },
        { p: `Ngũ hành: đánh vào hành mình khắc thì sát thương **${times(ARENA.beats)}**, đánh vào hành khắc mình thì **${times(ARENA.beaten)}**, các trường hợp khác giữ nguyên. Xem [Ngũ hành](ngu-hanh).` },
        { table: { head: ["Bé hành", "Đánh mạnh vào", "Đánh yếu vào"], rows: elementRows() } },
        { tip: "Mỗi trận có một **seed** riêng lấy từ mã trận và giờ đấu, nên phần ngẫu nhiên đã định sẵn: xem lại bao nhiêu lần cũng ra đúng trận đó. Muốn thắng chắc thì phải hơn hẳn về chiến lực, không trông vào may." },
      ],
    },
    {
      id: "vi-du",
      title: "Ví dụ một trận",
      blocks: [
        { p: `Để dễ theo dõi, ví dụ chỉ có 3 bé mỗi bên (trận thật tới ${ARENA.teamSize}). Gia tộc Hổ Vằn thách đấu Rùa Vàng giành một lô đất, trận lúc ${EX_WAR.hour}h ngày ${EX_WAR.day.split("-").reverse().join("/")}:` },
        { table: { head: ["Gia tộc", "Bé", "Đồ đang đeo", "Chiến lực", "Máu", "Sức đánh"], rows: exTeamRows() } },
        { p: `Tổng chiến lực hai bên gần bằng nhau: ${num(exFighters[0].reduce((s, p) => s + p.power, 0))} và ${num(exFighters[1].reduce((s, p) => s + p.power, 0))}. Đòn đầu tiên: **${exFirstAttacker.name}** đánh **${exFirstTarget.name}** ${num(exFirst[3])} máu${exFirst[4] ? " (chí mạng)" : ""}.` },
        { list: [
          `Trận kéo dài **${exBattle.rounds.length} lượt**, có ${exHits.length} đòn đánh.`,
          `Hổ Vằn gây tổng ${num(exDamage[0])} sát thương (${exCrits[0]} đòn chí mạng); Rùa Vàng gây ${num(exDamage[1])} (${exCrits[1]} đòn chí mạng).`,
          `**${EX_TEAMS[exWinner].clan.split(" (")[0]} thắng**; còn đứng: ${exSurvivors.join(", ") || "không ai (thắng theo % máu)"}.`,
          `Với đúng đội hình này mà đổi seed, đánh thử ${num(TRIALS)} trận thì Hổ Vằn thắng ${num(exWins)} trận (${pct(exWins / TRIALS)}). Hai đội ngang sức thì kết quả còn tùy may.`,
        ] },
        { p: `${exTop.name} (${el(exTop.element)}, cấp ${exTop.level}) có chiến lực cao nhất sân. Bé ${el("hoa")} của Hổ Vằn đánh vào bé ${el("thuy")} chỉ còn ${pct(elementMult("hoa", "thuy"))} sát thương, nhưng đánh vào bé ${el("kim")} thì được ${pct(elementMult("hoa", "kim"))}.` },
      ],
    },
    {
      id: "thang-thua",
      title: "Thắng thua được mất gì",
      blocks: [
        { table: { head: ["Kết quả", "Mục tiêu", "Quỹ"], rows: [
          ["Bên thách đấu thắng", "Chuyển sang bên thách đấu", `Bên giữ nộp ${Math.round(ARENA.penalty * 100)}% quỹ`],
          ["Bên giữ thắng", "Giữ nguyên", `Bên thách đấu nộp ${Math.round(ARENA.penalty * 100)}% quỹ`],
          ["Bên bị thách không chọn giờ (bỏ trận)", "Chuyển sang bên thách đấu", `Bên bị thách nộp ${Math.round(ARENA.forfeitPenalty * 100)}% quỹ`],
          ["Rút lời thách, quản trị viên hủy", "Giữ nguyên", "Không ai mất gì"],
        ] } },
        { p: `Tiền phạt tính trên quỹ bên thua lúc phân xử: **một nửa cho bên thắng, một nửa vào ngân sách thị trấn**. Ví dụ quỹ bên thua có ${xu(EX_FUND)}:` },
        { table: { head: ["Trường hợp", "Bên thua nộp", "Bên thắng nhận", "Ngân sách thị trấn"], rows: [
          [`Thua trận (${Math.round(ARENA.penalty * 100)}%)`, xu(exFight.total), xu(exFight.toWinner), xu(exFight.toTown)],
          [`Bỏ trận (${Math.round(ARENA.forfeitPenalty * 100)}%)`, xu(exForfeit.total), xu(exForfeit.toWinner), xu(exForfeit.toTown)],
        ] } },
        { list: [
          "**Giành lô**: lô sang tên bên thắng cùng nhà máy và công trình đang có; người đứng máy trên lô bị gỡ ra.",
          "**Giành ghế chiến lược**: bên thua mất ghế và cấp hạ tầng; các lô của họ đang chạy ngành đó thôi chạy (công trình vẫn còn), nên họ mất luôn buff và phí hạ tầng mà ghế mang lại. Bên thắng nhận ghế cùng cấp hạ tầng của bên thua.",
          "Nếu tới lúc phân xử bên thắng đã có ghế chiến lược khác hoặc đã đủ ngành, ghế không về tay ai mà **trả về thị trấn**; bên thua vẫn mất ghế.",
          "Lô hay ghế đã không còn thuộc bên thua lúc phân xử thì không chuyển gì, nhưng tiền phạt vẫn tính.",
        ] },
        { tip: `Bỏ trận chỉ mất ${Math.round(ARENA.forfeitPenalty * 100)}% quỹ thay vì ${Math.round(ARENA.penalty * 100)}%, và không ai hỏng đồ. Nếu đội mình yếu hẳn mà mục tiêu không quá quý, để hết hạn chọn giờ có khi đỡ tốn hơn. Nhưng mục tiêu vẫn mất.` },
      ],
    },
    {
      id: "do-hong",
      title: "Trang phục hỏng sau trận",
      blocks: [
        { p: "Ngay khi trận đánh xong, **mọi trang phục đang đeo** trên **mọi bé** của từng người đã ra sân (cả hai bên, thắng hay thua) đều **hỏng hẳn**, kể cả món đang chờ ở lò. Người không có tên trong đội hình thì không sao. Trận bỏ (không chọn giờ) không làm hỏng đồ." },
        { list: [
          "Món hỏng vẫn nằm trên người bé nhưng **không cộng dòng chỉ số nào**, không tính vào bộ đồ theo hành và không tính chiến lực ở trận sau.",
          "Món hỏng không bày bán hay đấu giá được ở Chợ Phiên; bán nhanh cho Siêu thị thì chỉ được mức thấp nhất.",
          "Sửa ở [Lò rèn](lo-ren): tốn xu và vật liệu, có thể thất bại, sửa xong còn phải chờ ở lò mới dùng lại được.",
        ] },
        { p: `Ví dụ: ${num(EX_GEAR.members)} người ra sân, mỗi người đeo ${EX_GEAR.pieces} món ${tiers[EX_GEAR.tier].name} trên bé ra trận là ${num(exBroken)} món hỏng. Mỗi lượt sửa hết chừng ấy món tốn ${xu(exRepairOnce)} và ${num(exRepairLots)} lô vật liệu, mà mỗi lần chỉ ${Math.round(repairChance * 100)}% thành công. Đó là cái giá của một trận, dù thắng.` },
        { warn: "Đồ trên **các bé khác** trong nhà cũng hỏng, không riêng bé ra trận. Trước giờ đấu nên tháo trang phục quý khỏi những bé không ra sân." },
        { tip: "Muốn giữ đồ quý mà vẫn ra sân? Món tháo ra trước giờ đấu thì không hỏng, nhưng chiến lực cũng không được cộng điểm của món đó. Cân nhắc giữa thắng trận và tiền sửa đồ." },
      ],
    },
  ],
};

export default article;
