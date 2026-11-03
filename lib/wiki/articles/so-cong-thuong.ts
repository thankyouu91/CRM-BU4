import type { WikiArticle } from "../types";
import { HEAVY, antitrustTax, buyCapLeft } from "../rules-macro";
import { INDUSTRIAL_MARKET } from "../game-data";
import { CLIMATES, ZONES } from "@/public/ta-tua/game/js/shared/clan.js";
import { ESSENTIALS, GOODS, HEAVY_INDUSTRIES, MARKET_RULES, PRODUCTION_INDUSTRIES, STRATEGIC_INDUSTRIES, STRATEGIC_RULES, combinedBuff } from "@/public/ta-tua/game/js/shared/industry.js";
import { ELEMENTS } from "@/public/ta-tua/game/js/shared/pets.js";

// Sở Công Thương: chống thao túng sàn công nghiệp giữa các gia tộc (petdex/server/commerce.js, industry.js buyListing;
// luật ở shared/industry.js MARKET_RULES), trần bán cho Siêu thị (ESSENTIALS.perClanShare) và các ngành chiến lược
// (strategic.js, shared/industry.js STRATEGIC_*), công nghiệp nặng tạm đóng (heavy-industry.js).

type Named = { name: string; icon: string };
type Strategic = Named & { comp: number; maxClans: number; places: string[]; climatesOk?: string[]; effect: string };
const R = MARKET_RULES as typeof MARKET_RULES & Record<string, number>;
const strategic = STRATEGIC_INDUSTRIES as Record<string, Strategic>;
const zones = ZONES as Record<string, Named>;
const climates = CLIMATES as Record<string, Named>;
const elements = ELEMENTS as Record<string, Named>;
const timber = (GOODS as Record<string, Named>).timber;
const heavyNames = HEAVY_INDUSTRIES.map((id) => `${(PRODUCTION_INDUSTRIES as Record<string, Named>)[id].icon} ${(PRODUCTION_INDUSTRIES as Record<string, Named>)[id].name}`).join(", ");

const num = (n: number) => n.toLocaleString("vi-VN");
const pct = (x: number) => `${num(Math.round(x * 1000) / 10)}%`;

// Ví dụ thuế chống độc quyền: 7 ngày qua các gia tộc mua bán với nhau 200 Gỗ, gia tộc bán đã bán 70.
const EX = { total: 200, mine: 70, qty: 60, price: 250 };
const exTax = antitrustTax({ total: EX.total, mine: EX.mine }, EX.qty, EX.price);
const exValue = EX.qty * EX.price;
const exFee = Math.ceil(exValue * INDUSTRIAL_MARKET.fee);
const exAllowed = Math.floor(R.antitrustShare * (EX.total + EX.qty));
// Ví dụ giới hạn mua gom: các gia tộc khác đang niêm yết 300 Gỗ, gia tộc mua chưa mua gì trong 24 giờ.
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
  summary: "Luật của sàn công nghiệp giữa các gia tộc (thuế chống độc quyền, giới hạn mua gom 24 giờ), trần bán cho Siêu thị, các ngành chiến lược và việc tạm đóng công nghiệp nặng.",
  keywords: ["sở công thương", "chống độc quyền", "thuế chống độc quyền", "độc quyền", "thao túng", "mua gom", "hạn mức mua", "sàn công nghiệp", "ngành chiến lược", "hạ tầng", "trị thủy", "năng lượng gió", "ngân hàng nhà nước", "thuế vụ", "phí hạ tầng", "công nghiệp nặng", "tạm đóng", "sở kế hoạch"],
  related: ["gia-toc", "so-nha-dat", "kinh-te-vi-mo", "dau-truong", "sieu-thi"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: "Sở Công Thương đặt luật chơi cho việc làm ăn giữa các [gia tộc](gia-toc): để không gia tộc nào ôm hết một mặt hàng rồi tự đặt giá, hay nắm hết hàng thiết yếu, hay giữ một mình hạ tầng của cả server." },
        { list: [
          "Luật sàn được ghi ngay dưới tiêu đề tab **🏪 Sàn công nghiệp** trong màn **🏯 Gia tộc & Sở Nhà Đất**.",
          "Chỉ gia tộc mới mua bán trên sàn công nghiệp và nắm ngành; người chơi gặp các luật này từ khi vào hoặc lập gia tộc.",
          "Ngành chiến lược hiện ở mục thâu tóm ngành như các ngành khác; buff của chúng thì cả server đều hưởng.",
        ] },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { p: `**Thuế chống độc quyền.** Gia tộc bán quá ${pct(R.antitrustShare)} khối lượng một mặt hàng trong ${R.windowDays} ngày thì phần vượt chịu thêm ${pct(R.antitrustRate)}.` },
        { table: { head: ["Luật", "Con số"], rows: [
          ["Khoảng thời gian tính", `${R.windowDays} ngày gần nhất (kể cả hôm nay)`],
          ["Ngưỡng thị phần", `trên ${pct(R.antitrustShare)} khối lượng mặt hàng đó`],
          ["Chỉ áp khi", `tổng khối lượng mặt hàng (kể cả lần bán này) từ ${num(R.antitrustMinVolume)} đơn vị`],
          ["Thuế suất", `${pct(R.antitrustRate)} tiền hàng của phần vượt ngưỡng`],
          ["Ai trả", "Gia tộc bán, trừ thẳng vào quỹ ngay lúc có người mua"],
          ["Tiền đi đâu", "Toàn bộ vào ngân sách thị trấn"],
        ] } },
        { steps: [
          `Mỗi lần một gia tộc khác mua tin đăng của bạn, Sở cộng lần bán này vào khối lượng ${R.windowDays} ngày: của bạn và của cả sàn.`,
          `Nếu cả sàn chưa tới ${num(R.antitrustMinVolume)} đơn vị, hoặc phần của bạn chưa quá ${pct(R.antitrustShare)}, không có thuế.`,
          `Nếu quá: phần vượt = khối lượng của bạn − ${pct(R.antitrustShare)} khối lượng cả sàn (làm tròn lên, không quá số vừa bán).`,
          `Thuế = phần vượt × giá bán mỗi đơn vị × ${pct(R.antitrustRate)}.`,
        ] },
        { p: `Thuế này cộng thêm vào phí sàn ${pct(INDUSTRIAL_MARKET.fee)}. Tiền bán sau phí và thuế mới tính vào doanh thu chịu [thuế doanh nghiệp](gia-toc) đêm đó.` },
        { p: "**Giới hạn mua gom.**" },
        { list: [
          `Hạn mức 24 giờ của một mặt hàng = ${pct(R.buyCapShare)} × (số hàng các gia tộc khác đang niêm yết + số bạn đã mua trong 24 giờ qua), nhưng không dưới ${num(R.buyCapMin)} đơn vị.`,
          "Hạn mức tính theo 24 giờ trượt, không đợi qua nửa đêm: lần mua sớm nhất ra khỏi 24 giờ thì hạn mức được nhả ra.",
          "Ô mua trên sàn tự giới hạn số lượng; hết hạn mức thì hiện **Đã đủ hạn mức mua 24 giờ**.",
          "Tin đăng của chính gia tộc bạn không tính vào số hàng đang niêm yết.",
        ] },
        { p: "Hai luật trên chỉ tính **giao dịch giữa các gia tộc** trên sàn công nghiệp. Bán cho NPC, bán cho Siêu thị và nhập khẩu từ NPC không tính vào thị phần, cũng không bị giới hạn mua gom." },
        { p: `**Ví dụ minh họa công thức.** Trong ${R.windowDays} ngày qua các gia tộc mua bán với nhau **${num(EX.total)} ${timber.icon} ${timber.name}**, trong đó gia tộc A bán ${num(EX.mine)}. Hôm nay gia tộc B mua cả tin đăng ${num(EX.qty)} ${timber.name} của A, giá ${num(EX.price)} xu mỗi đơn vị.` },
        { table: { head: ["Bước", "Tính", "Kết quả"], rows: [
          [`Khối lượng ${R.windowDays} ngày sau lần bán`, `${num(EX.total)} + ${num(EX.qty)}`, num(EX.total + EX.qty)],
          ["Phần của A", `${num(EX.mine)} + ${num(EX.qty)}`, `${num(EX.mine + EX.qty)} (${pct(exTax.share)})`],
          ["Được bán tới ngưỡng", `${pct(R.antitrustShare)} × ${num(EX.total + EX.qty)}`, num(exAllowed)],
          ["Phần vượt chịu thuế", `${num(EX.mine + EX.qty)} − ${num(exAllowed)}`, `${num(exTax.taxedQty)} đơn vị`],
          ["Thuế chống độc quyền", `${num(exTax.taxedQty)} × ${num(EX.price)} × ${pct(R.antitrustRate)}`, `${num(exTax.tax)} xu`],
          ["Phí sàn", `${num(exValue)} × ${pct(INDUSTRIAL_MARKET.fee)}`, `${num(exFee)} xu`],
          ["**A thực nhận**", `${num(exValue)} − ${num(exFee)} − ${num(exTax.tax)}`, `**${num(exValue - exFee - exTax.tax)} xu**`],
        ] } },
        { p: `Phía người mua: trước đó các gia tộc khác đang niêm yết ${num(LISTED)} ${timber.name}, nên hạn mức 24 giờ của B là ${pct(R.buyCapShare)} × ${num(LISTED)} = **${num(capStart)}**. Mua xong ${num(EX.qty)}, B còn được mua thêm **${num(capAfter)}** ${timber.name} trong 24 giờ đó.` },
        { p: `**Trần bán cho Siêu thị.** Mỗi đêm Siêu thị mua Thực phẩm chế biến và Thuốc của các gia tộc để bán lại cho người chơi (xem [Gia tộc](gia-toc)). Mỗi gia tộc chỉ bán được tối đa **${pct(ESSENTIALS.perClanShare)}** lượng Siêu thị thu mua của một đêm, tính chung cả hàng khớp từ sổ chào giá lẫn hàng vừa làm ra.` },
        { p: `**Công nghiệp nặng tạm đóng.** Mặc định ${HEAVY.closedByDefault ? "đóng" : "mở"}: ${heavyNames}. Mục thâu tóm ngành ghi "Công nghiệp nặng (...) đang tạm đóng" và không hiện các ngành này.` },
        { list: [
          "Ngành đang đóng không thâu tóm được, không chọn được cho lô đất, và lô đang làm ngành đó không chạy trong đêm.",
          `Khi Sở Kế hoạch đóng các ngành này: gia tộc đang nắm được hoàn ${HEAVY.refundShare === 1 ? "toàn bộ" : pct(HEAVY.refundShare)} phí thâu tóm đã trả vào quỹ, ngành bị gỡ khỏi gia tộc (trả lại suất ngành), lô đang làm ngành đó về **chưa chọn ngành** nhưng ${HEAVY.keepsBuilding ? "**giữ nguyên công trình**" : "mất công trình"}. Tộc trưởng nhận thư, Báo đăng tin.`,
          "Ban quản lý có thể mở lại; khi đó ai muốn làm thì thâu tóm lại như thường, và nếu đóng lần nữa thì lại hoàn phí như trên.",
          "Hàng hóa của các ngành này vẫn còn: hàng trong kho vẫn đăng bán, bán NPC, nhập khẩu được như hàng khác.",
          "Việc đóng không đụng tới ngành chiến lược.",
        ] },
      ],
    },
    {
      id: "chien-luoc",
      title: "Ngành chiến lược",
      blocks: [
        { p: "Bốn ngành chiến lược không làm ra hàng. Gia tộc nắm ngành xây hạ tầng, tạo **buff cho cả server**; ai hưởng buff thì trả **phí hạ tầng** cho gia tộc chủ. Lô làm ngành chiến lược không tự có doanh thu: gia tộc chủ thu tiền từ phí hạ tầng (Thuế vụ thì từ hoa hồng truy thu)." },
        { table: { head: ["Ngành", "Buff cho ai", "Số gia tộc chủ tối đa", "Dựng được trên lô", "Bồi thường thị trường (xu)"], rows: strategicRows() } },
        { table: { head: ["Cấp hạ tầng", "Buff (Thuế vụ: hoa hồng truy thu)", "Chi phí nâng lên cấp này"], rows: levelRows() } },
        { list: [
          "**Nắm ngành**: tộc trưởng thâu tóm như ngành thường, nhưng mỗi gia tộc chỉ nắm **1** ngành chiến lược, và ngành đã đủ số gia tộc chủ thì không vào được nữa. Ngành chiến lược vẫn chiếm một suất trong 3 ngành và cần đủ cấp gia tộc như ngành thường, nhưng luôn trả mức bồi thường gốc (không bị nhân lên khi là ngành thứ hai, thứ ba).",
          "**Vận hành**: buff chỉ chạy khi gia tộc có ít nhất một lô làm ngành này với công trình hoàn chỉnh. Tộc trưởng nâng cấp hạ tầng bằng quỹ gia tộc.",
          `**Phí hạ tầng**: người chơi và gia tộc hưởng buff trả ${pct(STRATEGIC_RULES.fee)} phần được tăng thêm; không đủ tiền trả thì lần đó không được buff. Gia tộc chủ không trả phí cho chính mình.`,
          `**Nhiều gia tộc cùng nắm**: buff chung = mức cao nhất + 25% các mức còn lại, tối đa ${pct(STRATEGIC_RULES.softCap)}. Ví dụ một chủ cấp 3 và một chủ cấp 1: ${pct(STRATEGIC_RULES.levels[2].buff)} + 25% × ${pct(STRATEGIC_RULES.levels[0].buff)} = ${pct(twoOwners)}. Phí chia cho các chủ theo phần buff mỗi chủ góp.`,
          `**Năng lượng gió**: thành viên gia tộc chủ được thêm +${pct(STRATEGIC_RULES.ownerMemberBonus)} và không trả phí. Thành viên cho bé đứng máy ở trang trại gió (mỗi lô một bé); bé huyền thoại tốt nhất cộng thêm theo hành: ${operatorText}. Bé thường đứng máy không cộng gì.`,
          `**Thuế vụ**: tộc trưởng hoặc trưởng lão của gia tộc nắm Thuế vụ thấy hồ sơ khai thiếu thuế của các gia tộc khác và đi truy thu: gia tộc trốn thuế nộp phần thuế trốn cộng ${pct(STRATEGIC_RULES.collectPenalty)} tiền phạt (tới hết quỹ và tiền gửi kỳ hạn), gia tộc Thuế vụ hưởng hoa hồng theo cấp hạ tầng, còn lại vào ngân sách.`,
        ] },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { list: [
          `Bán dồn một mặt hàng cho các gia tộc khác thì phần vượt ${pct(R.antitrustShare)} mất thêm ${pct(R.antitrustRate)} tiền hàng, ngoài phí sàn ${pct(INDUSTRIAL_MARKET.fee)}.`,
          "Hết hạn mức mua gom thì phải chờ 24 giờ trượt; sàn không cho mua vượt.",
          "Ghế ngành chiến lược không giữ mãi được: gia tộc khác có thể thách đấu giành ghế ở [Đấu trường](dau-truong). Mất ghế thì mất luôn cấp hạ tầng (về tay bên thắng), các lô làm ngành đó về chưa chọn ngành và bé đứng máy bị cho nghỉ.",
          "Buff tắt ngay khi gia tộc chủ không còn lô nào làm ngành đó với công trình hoàn chỉnh. Người hưởng buff không đủ tiền trả phí thì lần đó không có buff.",
          "Công nghiệp nặng có thể đóng hoặc mở lại theo quyết định của ban quản lý. Phí thâu tóm được hoàn, nhưng xu đã chi cho đất, công trình và hàng trong kho thì không.",
        ] },
        { p: "Ban quản lý game có bảng **Sở Công Thương** riêng (người chơi không thấy, bảng chỉ để xem): mức tập trung của từng mặt hàng, gia tộc bán nhiều nhất, giá bình quân lệch giá tham chiếu bao nhiêu, ai bán hàng thiết yếu cho Siêu thị, số thuế chống độc quyền đã thu. Bảng còn gắn cờ các tài khoản vào game qua **cùng một link mời** nhưng ở những gia tộc khác nhau cùng nắm ngành chiến lược. Cờ chỉ để ban quản lý xem xét, game không tự phạt ai vì cờ này." },
        { warn: "Lập nhiều gia tộc \"anh em\" để chia nhau thị phần hay chia nhau ghế ngành chiến lược dễ bị phát hiện qua bảng này." },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { tip: "Thuế chống độc quyền chỉ đánh vào phần vượt ngưỡng, không phải cả lô hàng. Hãy tự tính xem phần vượt đó đáng bao nhiêu so với các cách bán khác." },
        { tip: "Sàn công nghiệp không phải nguồn hàng duy nhất của gia tộc." },
        { tip: "Một ngành chiến lược có số ghế giới hạn, và buff chung của nhiều chủ không cộng thẳng. Đếm ghế còn trống trước khi tính chuyện thâu tóm." },
      ],
    },
  ],
};
