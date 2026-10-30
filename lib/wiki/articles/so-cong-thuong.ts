import type { WikiArticle } from "../types";
import { antitrustTax, buyCapLeft } from "../rules-macro";
import { INDUSTRIAL_MARKET } from "../game-data";
import { CLIMATES, ZONES } from "@/public/ta-tua/game/js/shared/clan.js";
import { ESSENTIALS, GOODS, MARKET_RULES, STRATEGIC_INDUSTRIES, STRATEGIC_RULES, combinedBuff } from "@/public/ta-tua/game/js/shared/industry.js";
import { ELEMENTS } from "@/public/ta-tua/game/js/shared/pets.js";

// Sở Công Thương: chống thao túng sàn công nghiệp giữa các gia tộc (petdex/server/commerce.js, industry.js buyListing;
// luật ở shared/industry.js MARKET_RULES), trần bán cho Siêu thị (ESSENTIALS.perClanShare) và các ngành chiến lược
// (strategic.js, shared/industry.js STRATEGIC_*).

type Named = { name: string; icon: string };
type Strategic = Named & { comp: number; maxClans: number; places: string[]; climatesOk?: string[]; effect: string };
const R = MARKET_RULES as typeof MARKET_RULES & Record<string, number>;
const strategic = STRATEGIC_INDUSTRIES as Record<string, Strategic>;
const zones = ZONES as Record<string, Named>;
const climates = CLIMATES as Record<string, Named>;
const elements = ELEMENTS as Record<string, Named>;
const steel = (GOODS as Record<string, Named>).steel;

const num = (n: number) => n.toLocaleString("vi-VN");
const pct = (x: number) => `${num(Math.round(x * 1000) / 10)}%`;

// Ví dụ thuế chống độc quyền: 7 ngày qua các gia tộc mua bán với nhau 200 Thép, gia tộc bán đã bán 70.
const EX = { total: 200, mine: 70, qty: 60, price: 250 };
const exTax = antitrustTax({ total: EX.total, mine: EX.mine }, EX.qty, EX.price);
const exValue = EX.qty * EX.price;
const exFee = Math.ceil(exValue * INDUSTRIAL_MARKET.fee);
const exAllowed = Math.floor(R.antitrustShare * (EX.total + EX.qty));
// Ví dụ giới hạn mua gom: các gia tộc khác đang niêm yết 300 Thép, gia tộc mua chưa mua gì trong 24 giờ.
const LISTED = 300;
const capStart = buyCapLeft(LISTED, 0);
const capAfter = buyCapLeft(LISTED - EX.qty, EX.qty);

const placeOf = (s: Strategic) => [...s.places.map((z) => `${zones[z].icon} ${zones[z].name}`), ...(s.climatesOk ?? []).map((c) => `mọi lô ${climates[c].icon} ${climates[c].name}`)].join(", ");
const strategicRows = () => Object.values(strategic).map((s) => [`${s.icon} ${s.name}`, s.effect, s.maxClans, placeOf(s), num(s.comp)]);
const levelRows = () => STRATEGIC_RULES.levels.map((l, i) => [i + 1, `+${pct(l.buff)}`, l.cost ? `${num(l.cost)} xu` : "Có sẵn khi thâu tóm"]);
const operatorText = Object.entries(STRATEGIC_RULES.operatorBonus).map(([e, v]) => `${elements[e].name} +${pct(v)}`).join(", ");
const twoOwners = combinedBuff([STRATEGIC_RULES.levels[2].buff, STRATEGIC_RULES.levels[0].buff]);

export const article: WikiArticle = {
  slug: "so-cong-thuong",
  title: "Sở Công Thương",
  category: "kinh-te",
  emoji: "🏛️",
  summary: "Luật chống thao túng sàn công nghiệp: thuế chống độc quyền, giới hạn mua gom 24 giờ, trần bán cho Siêu thị và cách các ngành chiến lược được nắm giữ.",
  keywords: ["sở công thương", "chống độc quyền", "thuế chống độc quyền", "độc quyền", "thao túng", "mua gom", "hạn mức mua", "sàn công nghiệp", "ngành chiến lược", "hạ tầng", "trị thủy", "năng lượng gió", "ngân hàng nhà nước", "thuế vụ", "phí hạ tầng"],
  related: ["gia-toc", "so-nha-dat", "kinh-te-vi-mo", "dau-truong", "sieu-thi"],
  sections: [
    {
      id: "la-gi",
      title: "Sở Công Thương làm gì",
      blocks: [
        { p: "Trên **🏪 Sàn công nghiệp**, các gia tộc đăng bán hàng trong kho cho nhau. Để một gia tộc lớn không ôm hết một mặt hàng rồi tự đặt giá, Sở Công Thương áp hai luật, ghi ngay dưới tiêu đề của tab Sàn công nghiệp:" },
        { list: [
          `**Thuế chống độc quyền**: bán quá ${pct(R.antitrustShare)} khối lượng một mặt hàng trong ${R.windowDays} ngày thì phần vượt chịu thêm ${pct(R.antitrustRate)}.`,
          `**Giới hạn mua gom**: trong 24 giờ mỗi gia tộc mua tối đa ${pct(R.buyCapShare)} số hàng đang niêm yết của một mặt hàng (luôn được ít nhất ${num(R.buyCapMin)} đơn vị).`,
        ] },
        { p: "Hai luật chỉ tính **giao dịch giữa các gia tộc** trên sàn công nghiệp. Bán cho NPC, bán cho Siêu thị và nhập khẩu không tính vào thị phần, cũng không bị giới hạn mua gom." },
      ],
    },
    {
      id: "thue-doc-quyen",
      title: "Thuế chống độc quyền",
      blocks: [
        { table: { head: ["Luật", "Con số"], rows: [
          ["Khoảng thời gian tính", `${R.windowDays} ngày gần nhất (kể cả hôm nay)`],
          ["Ngưỡng thị phần", `trên ${pct(R.antitrustShare)} khối lượng mặt hàng đó`],
          ["Chỉ áp khi", `tổng khối lượng mặt hàng (kể cả lần bán này) từ ${num(R.antitrustMinVolume)} đơn vị`],
          ["Thuế suất", `${pct(R.antitrustRate)} tiền hàng của phần vượt ngưỡng`],
          ["Ai trả", "Gia tộc bán, trừ thẳng vào quỹ ngay lúc có người mua"],
          ["Tiền đi đâu", "Toàn bộ vào ngân sách thị trấn"],
        ] } },
        { steps: [
          "Mỗi lần một gia tộc khác mua tin đăng của bạn, Sở cộng lần bán này vào khối lượng 7 ngày: của bạn và của cả sàn.",
          `Nếu cả sàn chưa tới ${num(R.antitrustMinVolume)} đơn vị, hoặc phần của bạn chưa quá ${pct(R.antitrustShare)}, không có thuế.`,
          `Nếu quá: phần vượt = khối lượng của bạn − ${pct(R.antitrustShare)} khối lượng cả sàn (làm tròn lên, không quá số vừa bán).`,
          `Thuế = phần vượt × giá bán mỗi đơn vị × ${pct(R.antitrustRate)}.`,
        ] },
        { p: `Thuế này cộng thêm vào phí sàn ${pct(INDUSTRIAL_MARKET.fee)}. Tiền bán sau phí và thuế mới tính vào doanh thu chịu [thuế doanh nghiệp](gia-toc) đêm đó.` },
      ],
    },
    {
      id: "mua-gom",
      title: "Giới hạn mua gom",
      blocks: [
        { list: [
          `Hạn mức 24 giờ của một mặt hàng = ${pct(R.buyCapShare)} × (số hàng các gia tộc khác đang niêm yết + số bạn đã mua trong 24 giờ qua), nhưng không dưới ${num(R.buyCapMin)} đơn vị.`,
          "Hạn mức tính theo 24 giờ trượt, không đợi qua nửa đêm: lần mua sớm nhất ra khỏi 24 giờ thì hạn mức được nhả ra.",
          "Ô mua trên sàn tự giới hạn số lượng; hết hạn mức thì hiện **Đã đủ hạn mức mua 24 giờ**.",
          "Tin đăng của chính gia tộc bạn không tính vào số hàng đang niêm yết.",
        ] },
        { tip: "Cần nhiều nguyên liệu hơn hạn mức? Phần còn thiếu có thể **nhập khẩu** từ NPC (đắt hơn) ở tab Sản xuất & Kho, hoặc tự khai thác." },
      ],
    },
    {
      id: "vi-du",
      title: "Ví dụ",
      blocks: [
        { p: `Trong 7 ngày qua các gia tộc mua bán với nhau **${num(EX.total)} ${steel.icon} ${steel.name}**, trong đó gia tộc Sóc Nâu bán ${num(EX.mine)}. Hôm nay gia tộc Cá Chép mua cả tin đăng ${num(EX.qty)} ${steel.name} của Sóc Nâu, giá ${num(EX.price)} xu mỗi đơn vị.` },
        { table: { head: ["Bước", "Tính", "Kết quả"], rows: [
          ["Khối lượng 7 ngày sau lần bán", `${num(EX.total)} + ${num(EX.qty)}`, num(EX.total + EX.qty)],
          ["Phần của Sóc Nâu", `${num(EX.mine)} + ${num(EX.qty)}`, `${num(EX.mine + EX.qty)} (${pct(exTax.share)})`],
          ["Được bán tới ngưỡng", `${pct(R.antitrustShare)} × ${num(EX.total + EX.qty)}`, num(exAllowed)],
          ["Phần vượt chịu thuế", `${num(EX.mine + EX.qty)} − ${num(exAllowed)}`, `${num(exTax.taxedQty)} đơn vị`],
          ["Thuế chống độc quyền", `${num(exTax.taxedQty)} × ${num(EX.price)} × ${pct(R.antitrustRate)}`, `${num(exTax.tax)} xu`],
          ["Phí sàn", `${num(exValue)} × ${pct(INDUSTRIAL_MARKET.fee)}`, `${num(exFee)} xu`],
          ["**Sóc Nâu thực nhận**", `${num(exValue)} − ${num(exFee)} − ${num(exTax.tax)}`, `**${num(exValue - exFee - exTax.tax)} xu**`],
        ] } },
        { p: `Phía người mua: trước đó các gia tộc khác đang niêm yết ${num(LISTED)} ${steel.name}, nên hạn mức 24 giờ của Cá Chép là ${pct(R.buyCapShare)} × ${num(LISTED)} = **${num(capStart)}**. Mua xong ${num(EX.qty)}, Cá Chép còn được mua thêm **${num(capAfter)}** ${steel.name} trong 24 giờ đó.` },
        { tip: `Thuế chỉ đánh vào phần vượt ngưỡng, không phải cả lô hàng. Bán cho NPC (${pct(INDUSTRIAL_MARKET.npcBuy)} giá tham chiếu) không tính vào thị phần, nhưng bán trên sàn với giá tốt rồi chịu ${pct(R.antitrustRate)} phần vượt nhiều khi vẫn lời hơn.` },
      ],
    },
    {
      id: "sieu-thi",
      title: "Trần bán cho Siêu thị",
      blocks: [
        { p: `Mỗi đêm Siêu thị mua Thực phẩm chế biến và Thuốc của các gia tộc để bán lại cho người chơi (xem [Gia tộc](gia-toc)). Để không gia tộc nào nắm hết hàng thiết yếu, mỗi gia tộc chỉ bán được tối đa **${pct(ESSENTIALS.perClanShare)}** lượng Siêu thị thu mua của một đêm, tính chung cả hàng khớp từ sổ chào giá lẫn hàng vừa làm ra.` },
      ],
    },
    {
      id: "chien-luoc",
      title: "Ngành chiến lược",
      blocks: [
        { p: "Bốn ngành chiến lược không làm ra hàng. Gia tộc nắm ngành xây hạ tầng, tạo **buff cho cả server**; ai hưởng buff thì trả **phí hạ tầng** cho gia tộc chủ. Lô làm ngành chiến lược không tự có doanh thu: gia tộc chủ kiếm tiền từ phí hạ tầng." },
        { table: { head: ["Ngành", "Buff cho ai", "Số gia tộc chủ tối đa", "Dựng được trên lô", "Bồi thường thị trường (xu)"], rows: strategicRows() } },
        { table: { head: ["Cấp hạ tầng", "Buff (Thuế vụ: hoa hồng truy thu)", "Chi phí nâng lên cấp này"], rows: levelRows() } },
        { list: [
          "**Nắm ngành**: tộc trưởng thâu tóm như ngành thường, nhưng mỗi gia tộc chỉ nắm **1** ngành chiến lược, và ngành đã đủ số gia tộc chủ thì không vào được nữa. Ngành chiến lược vẫn chiếm một suất trong 3 ngành và cần đủ cấp gia tộc như ngành thường, nhưng luôn trả mức bồi thường gốc (không bị nhân lên khi là ngành thứ hai, thứ ba).",
          "**Vận hành**: buff chỉ chạy khi gia tộc có ít nhất một lô làm ngành này với công trình hoàn chỉnh. Tộc trưởng nâng cấp hạ tầng bằng quỹ gia tộc.",
          `**Phí hạ tầng**: người chơi và gia tộc hưởng buff trả ${pct(STRATEGIC_RULES.fee)} phần được tăng thêm; không đủ tiền trả thì lần đó không được buff. Gia tộc chủ không trả phí cho chính mình.`,
          `**Nhiều gia tộc cùng nắm**: buff chung = mức cao nhất + 25% các mức còn lại, tối đa ${pct(STRATEGIC_RULES.softCap)}. Ví dụ một chủ cấp 3 và một chủ cấp 1: ${pct(STRATEGIC_RULES.levels[2].buff)} + 25% × ${pct(STRATEGIC_RULES.levels[0].buff)} = ${pct(twoOwners)}. Phí chia cho các chủ theo phần buff mỗi chủ góp.`,
          `**Năng lượng gió**: thành viên gia tộc chủ được thêm +${pct(STRATEGIC_RULES.ownerMemberBonus)} và không trả phí. Cho bé huyền thoại đứng máy ở trang trại gió thì gia tộc thêm theo hành của bé tốt nhất: ${operatorText}.`,
          `**Thuế vụ**: tộc trưởng hoặc trưởng lão của gia tộc nắm Thuế vụ thấy hồ sơ khai thiếu thuế của các gia tộc khác và đi truy thu: gia tộc trốn thuế nộp phần thuế trốn cộng ${pct(STRATEGIC_RULES.collectPenalty)} tiền phạt (tới hết quỹ), gia tộc Thuế vụ hưởng hoa hồng theo cấp hạ tầng, còn lại vào ngân sách.`,
        ] },
        { tip: "Ghế ngành chiến lược không giữ mãi được: gia tộc khác có thể thách đấu để giành ghế ở [Đấu trường](dau-truong)." },
      ],
    },
    {
      id: "bang-quan-tri",
      title: "Bảng theo dõi của Sở",
      blocks: [
        { p: "Ban quản lý game có một bảng **Sở Công Thương** riêng (người chơi không thấy, bảng chỉ để xem). Bảng cho biết mỗi mặt hàng trên sàn có tập trung vào vài gia tộc không, gia tộc nào bán nhiều nhất, giá bình quân lệch giá tham chiếu bao nhiêu, ai bán hàng thiết yếu cho Siêu thị, và số thuế chống độc quyền đã thu." },
        { p: "Bảng còn gắn cờ các tài khoản vào game qua **cùng một link mời** nhưng ở những gia tộc khác nhau cùng nắm ngành chiến lược. Cờ chỉ để ban quản lý xem xét, game không tự phạt ai vì cờ này." },
        { warn: "Lập nhiều gia tộc \"anh em\" để chia nhau thị phần hay chia nhau ghế ngành chiến lược dễ bị phát hiện qua bảng này." },
      ],
    },
  ],
};
