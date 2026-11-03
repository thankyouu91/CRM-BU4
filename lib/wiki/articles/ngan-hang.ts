import type { WikiArticle } from "../types";
import { RATE_POWER } from "@/public/ta-tua/game/js/shared/clan-bonds.js";
import { UNLOCKS } from "../rules";
import { MONEY } from "../rules-money";
import { CB, cbHeadline, idx, interest, num, pct, policyExample, policyRows, pts, xu } from "./money";
import { BANK } from "@/petdex/server/rules/bank.js";
import { QUESTS } from "@/petdex/server/rules/town.js";
import { LOCATIONS } from "@/petdex/server/rules/business.js";
import { STRATEGIC_RULES } from "@/public/ta-tua/game/js/shared/industry.js";

// Ngân hàng Trân Châu (bank.js, rules/bank.js) and the Central Bank's weekly policy.
// The article explains what each feature does; when to use it is left to the player.

const terms = Object.entries(BANK.termPremium as Record<string, number>).map(([d, premium]) => ({ days: Number(d), premium }));
const termDays = terms.map((t) => t.days).join(", ");
const sample = 10_000;
const termRows = terms.map(({ days, premium }) => [
  `${days} ngày`,
  `+${pts(premium)}`,
  `${pct(BANK.defaultRate + premium)}/ngày`,
  xu(interest(sample, BANK.defaultRate + premium, days)),
  `${xu(interest(sample, CB.rateMin + premium, days))} đến ${xu(interest(sample, CB.rateMax + premium, days))}`,
]);

const perDay = (rate: number) => interest(BANK.savingsCap, rate);
const levels = STRATEGIC_RULES.levels as { buff: number }[];
const { g1, w1, g2, w2 } = policyExample;
const license = LOCATIONS.street.license;
const save = QUESTS.save as { reward: number; level?: number };
const mid = terms[1];
const deposit = 5_000;
const over = 15_000;

export const article: WikiArticle = {
  slug: "ngan-hang",
  title: "Ngân hàng",
  category: "kinh-te",
  emoji: "🏦",
  summary: `Ngân hàng Trân Châu có tiết kiệm (lãi mỗi ngày trên ${xu(BANK.savingsCap)} đầu) và gửi kỳ hạn ${termDays} ngày; Ngân hàng Trung ương đặt lãi suất cơ bản và chỉ số giá mỗi tuần.`,
  keywords: ["tiết kiệm", "lãi", "lãi suất", "gửi tiền", "kỳ hạn", "tất toán", "rút sớm", "đáo hạn", "ngân hàng trung ương", "lạm phát", "chỉ số giá", "lãi suất cơ bản", "ngân hàng nhà nước", "đặt lãi suất"],
  related: ["tai-chinh", "thue-toa-thi-chinh", "tin-dung", "vay-ngang-hang", "hui", "kinh-te-vi-mo"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: `**🏦 Ngân hàng Trân Châu** là tòa nhà Ngân hàng trên bản đồ thị trấn. Nó mở khi bé tốt nhất của bạn đạt **cấp ${UNLOCKS.bank}**. Ở đây bạn để xu sinh lãi theo hai cách: **🐷 Tiết kiệm không kỳ hạn** và **📜 Gửi kỳ hạn**.` },
        { p: "Cùng màn có khung **🏛️ Ngân hàng Trung ương**: cơ quan họp mỗi tuần để đặt **lãi suất cơ bản** (nền của mọi khoản lãi) và **chỉ số giá** (nhân vào giá NPC). Hai con số này chạm tới gần như mọi khoản thu chi trong game." },
        { p: `Gia tộc đang nắm **Ngân hàng nhà nước** được đặt lại lãi suất cơ bản trong khoảng lãi chính sách ± ${pts(RATE_POWER.band)}/ngày (luôn trong ${pct(RATE_POWER.min)}–${pct(RATE_POWER.max)}/ngày), giữ tới buổi họp sau. Khi đó tiết kiệm, gửi kỳ hạn và vay ngân hàng dùng con số gia tộc đặt. Xem [Lãi suất cơ bản](lai-suat-co-ban).` },
        { p: "Từ màn Ngân hàng còn có lối sang [Tín dụng và vay](tin-dung), [Vay ngang hàng](vay-ngang-hang) và [Hụi](hui)." },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { p: "**Các thao tác**" },
        { table: { head: ["Nút", "Làm gì"], rows: [
          ["**Gửi vào** / **Rút ra** (Tiết kiệm)", "Chuyển xu giữa ví và tiết kiệm, số xu tùy bạn (trong số đang có), không mất phí."],
          ["Chọn kỳ hạn rồi bấm **Gửi … ngày** (Gửi kỳ hạn)", `Mở một khoản kỳ hạn ${termDays} ngày bằng xu trong ví, tối thiểu **${xu(BANK.minDeposit)}**, không giới hạn số khoản và số tiền.`],
          ["**Nhận tiền**", "Hiện khi khoản kỳ hạn đã đáo hạn: nhận gốc và lãi về ví ngay, không cần chờ nửa đêm."],
          ["**Rút sớm**", "Đóng khoản kỳ hạn trước hạn: nhận lại đủ gốc, **không có lãi**."],
        ] } },
        { p: "**Tiết kiệm**" },
        { list: [
          `Lãi chạy liên tục theo thời gian tiền nằm trong tài khoản, theo lãi suất cơ bản **hiện tại** (đổi mỗi tuần). Màn Ngân hàng hiện số "Lãi đang chạy".`,
          "**Nửa đêm** ngân hàng cộng phần lãi tròn xu vào chính tài khoản tiết kiệm, phần lẻ để dành cộng tiếp đêm sau. Vì lãi cộng thẳng vào tiết kiệm nên khi chưa chạm trần, lãi hôm qua cũng sinh lãi hôm nay.",
          `Chỉ **${xu(BANK.savingsCap)} đầu** được tính lãi. Gửi nhiều hơn vẫn được, phần vượt nằm yên không có lãi.`,
          "Tiền trong ví không có lãi.",
        ] },
        { table: { head: ["Lãi cơ bản", `Lãi một ngày trên ${xu(BANK.savingsCap)}`, "Khoảng một tuần"], rows: [
          [`${pct(CB.rateMin)}/ngày (thấp nhất)`, xu(perDay(CB.rateMin)), xu(perDay(CB.rateMin) * 7)],
          [`${pct(BANK.defaultRate)}/ngày (ban đầu)`, xu(perDay(BANK.defaultRate)), xu(perDay(BANK.defaultRate) * 7)],
          [`${pct(CB.rateMax)}/ngày (cao nhất)`, xu(perDay(CB.rateMax)), xu(perDay(CB.rateMax) * 7)],
        ] } },
        { p: `Ví dụ công thức: ${xu(over)} trong tiết kiệm, lãi cơ bản ${pct(BANK.defaultRate)}/ngày. Chỉ ${xu(BANK.savingsCap)} được tính, nên một đêm nhận **${xu(perDay(BANK.defaultRate))}** (không phải ${xu(interest(over, BANK.defaultRate))}).` },
        { p: "**Gửi kỳ hạn**" },
        { list: [
          `Kỳ hạn **${termDays} ngày**. Lãi suất = lãi cơ bản **lúc gửi** + phụ phí kỳ hạn, và được **chốt** tới hết kỳ: Ngân hàng Trung ương đổi lãi sau đó cũng không ảnh hưởng.`,
          "Lãi đơn: tiền gửi × lãi/ngày × số ngày, làm tròn xuống tới xu. Danh sách khoản gửi hiện trước số lãi sẽ nhận và thanh tiến độ tới ngày đáo hạn.",
          "Đến hạn mà chưa bấm **Nhận tiền** thì ngân hàng **tự tất toán** lúc nửa đêm: gốc và lãi về **ví**. Bản đồ hiện nhãn **Kỳ hạn đến hạn!** trên tòa Ngân hàng.",
          `Trần ${xu(BANK.savingsCap)} chỉ áp cho tiết kiệm, không áp cho kỳ hạn.`,
        ] },
        { table: { head: ["Kỳ hạn", "Phụ phí", `Lãi/ngày khi lãi cơ bản ${pct(BANK.defaultRate)}`, `Lãi nhận trên ${xu(sample)}`, "Theo lãi cơ bản thấp nhất đến cao nhất"], rows: termRows } },
        { p: `Ví dụ công thức: gửi ${xu(deposit)} kỳ hạn ${mid.days} ngày khi lãi cơ bản ${pct(BANK.defaultRate)}: lãi ${pct(BANK.defaultRate)} + ${pts(mid.premium)} = ${pct(BANK.defaultRate + mid.premium)}/ngày, đáo hạn nhận ${xu(deposit)} gốc + **${xu(interest(deposit, BANK.defaultRate + mid.premium, mid.days))}** lãi.` },
        { p: "**Lãi và thuế, nhiệm vụ, phần thưởng thêm**" },
        { list: [
          `Lãi tiết kiệm và lãi kỳ hạn đều là **thu nhập chịu thuế** của ngày nhận lãi (xem [Thuế và Tòa thị chính](thue-toa-thi-chinh)). Lãi kỳ hạn về **một lần** vào ngày tất toán.`,
          `Nhiệm vụ ngày "Gửi tiền vào ngân hàng" (từ cấp ${save.level ?? 1}) thưởng **${xu(save.reward)}**: gửi tiết kiệm hay gửi kỳ hạn đều tính.`,
          `Khi có gia tộc đang vận hành **🏦 Ngân hàng nhà nước** (ngành chiến lược, chỉ một gia tộc nắm), mọi người chơi được thưởng thêm ${pct(levels[0].buff, 0)} đến ${pct(levels[levels.length - 1].buff, 0)} trên lãi tiết kiệm và lãi kỳ hạn, tùy cấp hạ tầng. Người ngoài gia tộc chủ trả phí hạ tầng bằng ${pct(STRATEGIC_RULES.fee, 0)} phần thưởng thêm đó, thu **trước** từ chính chỗ nhận lãi (tiết kiệm với lãi tiết kiệm, ví với lãi kỳ hạn): không đủ tiền trả phí thì lần đó không có phần thưởng thêm.`,
        ] },
        { p: "**Ngân hàng Trung ương họp thế nào**" },
        { p: `Ngân hàng Trung ương họp **mỗi nửa đêm cuối Chủ nhật**, sau khi đã cộng lãi đêm đó. Lãi suất và chỉ số giá mới áp dụng từ thứ Hai, giữ nguyên cả tuần. Báo đăng kết quả mỗi buổi họp, ví dụ: "${cbHeadline(g1, w1.baseRate, w1.priceIndex)}". Màn Ngân hàng có biểu đồ ${MONEY.bankHistoryWeeks} buổi họp gần nhất.` },
        { steps: [
          "**Đếm tổng số xu** trong thị trấn: ví của mọi người chơi, tiết kiệm, tiền gửi kỳ hạn, tiền ký quỹ lệnh chờ trên Sàn, lương ca làm ở quầy và xưởng chưa nhận, và mọi quỹ chung (quỹ gia tộc, quỹ Hội, quỹ hụi...). **Ngân sách thị trấn không tính.**",
          `**So với tổng số xu ở buổi họp tuần trước** để ra mức tăng trưởng. Mục tiêu là **tăng ${pct(CB.target, 1)}/tuần**. Chưa có số của tuần trước để so (như buổi họp đầu tiên) thì coi như đúng mục tiêu. Số người đang chơi không ảnh hưởng: người nghỉ mà vẫn giữ xu thì tổng không đổi.`,
          `**Chênh lệch** = mức tăng tuần này trừ ${pct(CB.target, 1)}. Mỗi **1 điểm %** vượt mục tiêu làm **lãi cơ bản giảm ${pts(CB.ratePerPoint)}/ngày** (tính từ mức ${pct(CB.neutral)}) và **chỉ số giá tăng ${pct(CB.indexPerPoint)}**. Thấp hơn mục tiêu thì ngược lại.`,
          `Giới hạn: lãi cơ bản kẹt ở **${pct(CB.rateMin)}** khi xu tăng từ ${pct(CB.rateFloorAt, 1)}/tuần trở lên và ở **${pct(CB.rateMax)}** khi xu tăng từ ${pct(CB.rateCeilAt, 1)}/tuần trở xuống. Chỉ số giá một tuần tăng tối đa **${pct(CB.indexUpMax, 1)}** (khi xu tăng từ ${pct(CB.indexUpAt, 1)}/tuần trở lên) và giảm tối đa **${pct(CB.indexDownMax, 1)}** (khi xu tăng từ ${pct(CB.indexDownAt, 1)}/tuần trở xuống).`,
        ] },
        { p: "Chỉ số giá **nhân dồn** qua các tuần (tuần này nhân lên chỉ số của tuần trước), còn lãi cơ bản thì **tính lại từ đầu** mỗi tuần chỉ theo mức tăng của tuần đó." },
        { table: { head: ["Tổng số xu tăng trong tuần", "Lãi cơ bản tuần sau", "Chỉ số giá thay đổi"], rows: policyRows().map((r) => r.map((c) => c.replace("-", "−"))) } },
        { p: `Ví dụ hai tuần liền: chỉ số giá đang là ${idx(1)}. Tuần 1 tổng số xu tăng **${pct(g1, 1)}** (vượt mục tiêu ${num((g1 - CB.target) * 100)} điểm %): lãi cơ bản xuống **${pct(w1.baseRate)}/ngày**, chỉ số giá lên **${idx(w1.priceIndex)}**, giấy phép quầy Mặt phố giá gốc ${xu(license)} thành ${xu(Math.round(license * w1.priceIndex))}. Tuần 2 tổng số xu chỉ tăng **${pct(g2, 1)}** (thiếu ${num((CB.target - g2) * 100)} điểm %, bị kẹp ở mức giảm tối đa): lãi cơ bản lên trần **${pct(w2.baseRate)}/ngày**, chỉ số giá còn **${idx(w2.priceIndex)}**, giấy phép đó còn ${xu(Math.round(license * w2.priceIndex))}.` },
        { p: "**Lãi suất và chỉ số giá chạm tới đâu**" },
        { p: "**Chỉ số giá** nhân vào giá gốc của hầu hết những gì bạn trả cho NPC, và cả giá tham chiếu của hàng hóa:" },
        { list: [
          "[Siêu thị](sieu-thi) (đồ ăn, đồ chăm sóc, đồ chơi, trang phục), học phí [Trường học](truong-hoc), phòng khám và bảo hiểm.",
          "Hạt giống và mở rộng [vườn](vuon), mở lại ô tưởng niệm, [phí chăm nuôi bé](tinh-cach-tuoi) mỗi ngày.",
          "[Quầy trà sữa](quay-tra-sua): giấy phép, tiền thuê mặt bằng, nâng cấp, quảng cáo, và cả giá tham chiếu từng món lẫn chi phí nguyên liệu.",
          "[Xưởng](khu-cong-nghiep): xây, nâng cấp, thuê đất.",
          "Giá trung bình mà nguyên liệu thô trên [Sàn](san-nguyen-lieu) dần quay về, giá trị món [Bếp](bep) bán cho NPC, giá tham chiếu ở [Chợ Phiên](cho-phien).",
        ] },
        { p: "**Lãi suất cơ bản** là nền của:" },
        { list: [
          "Lãi tiết kiệm, lãi gửi kỳ hạn của người chơi và của quỹ gia tộc.",
          `Lãi [vay ngân hàng](tin-dung) = lãi cơ bản + phụ phí hạng tín dụng, cộng thêm phụ phí lạm phát khi tuần trước xu tăng nhanh hơn ${pct(CB.target, 1)}.`,
          `[Giá đất](so-nha-dat): lãi cơ bản càng cao hơn ${pct(BANK.defaultRate)} thì chỉ số giá đất mỗi ngày càng bị kéo xuống, thấp hơn thì được đẩy lên (xem [Kinh tế vĩ mô](kinh-te-vi-mo)).`,
        ] },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { list: [
          "Ngân hàng **không làm mất gốc**: tiết kiệm và tiền gửi kỳ hạn luôn trả lại đủ số đã gửi.",
          "**Rút sớm** khoản kỳ hạn thì **mất toàn bộ lãi**, kể cả khi chỉ còn vài phút nữa là đến hạn.",
          `Phần tiết kiệm vượt **${xu(BANK.savingsCap)}** không sinh lãi.`,
          `Lãi tiết kiệm **không chốt**: tuần sau lãi cơ bản có thể xuống tới ${pct(CB.rateMin)}/ngày. Lãi kỳ hạn thì chốt, nên nếu lãi cơ bản lên sau khi gửi, khoản đó vẫn giữ mức cũ.`,
          `Số xu bạn giữ không được nhân theo chỉ số giá. Khi chỉ số giá lên (tối đa ${pct(CB.indexUpMax, 1)} một tuần), cùng số xu đó mua được ít đồ NPC hơn.`,
          "Tiền trong tiết kiệm **không được giữ riêng** khi bạn nợ: ngân hàng lấy sang tiết kiệm khi ví không đủ trả góp [vay ngân hàng](tin-dung), trả [vay ngang hàng](vay-ngang-hang) đến hạn, hay thu nợ khi đã vỡ nợ.",
          "Tiền gửi kỳ hạn nằm im tới hạn: muốn dùng sớm thì chỉ có cách rút sớm và bỏ lãi.",
        ] },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { list: [
          `Lãi kỳ hạn bị chốt ở lúc gửi, còn lãi tiết kiệm đi theo từng tuần. Biểu đồ ${MONEY.bankHistoryWeeks} tuần ở màn Ngân hàng cho thấy hai con số ấy đã đi thế nào.`,
          `Chỉ số giá lên tối đa ${pct(CB.indexUpMax, 1)} một tuần nhưng xuống tối đa ${pct(CB.indexDownMax, 1)}, và chỉ đổi vào buổi họp đêm Chủ nhật.`,
          "Thuế thu nhập tính riêng từng ngày và lũy tiến. Hãy để ý lãi kỳ hạn rơi vào ngày nào.",
        ] },
      ],
    },
  ],
};
