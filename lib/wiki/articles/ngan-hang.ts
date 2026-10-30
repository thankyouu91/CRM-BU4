import type { WikiArticle } from "../types";
import { UNLOCKS } from "../rules";
import { CB, cbHeadline, idx, interest, num, pct, policyExample, policyRows, pts, xu } from "./money";
import { BANK } from "@/petdex/server/rules/bank.js";
import { QUESTS } from "@/petdex/server/rules/town.js";
import { LOCATIONS } from "@/petdex/server/rules/business.js";
import { STRATEGIC_RULES } from "@/public/ta-tua/game/js/shared/industry.js";

// Ngân hàng Trân Châu (bank.js, rules/bank.js) and the Central Bank's weekly policy.

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
const longest = terms[terms.length - 1];
const deposit = 5_000;

export const article: WikiArticle = {
  slug: "ngan-hang",
  title: "Ngân hàng",
  category: "kinh-te",
  emoji: "🏦",
  summary: `Tiết kiệm có lãi mỗi ngày trên ${xu(BANK.savingsCap)} đầu, gửi kỳ hạn ${termDays} ngày, và cách Ngân hàng Trung ương đặt lãi suất cơ bản và chỉ số giá mỗi tuần.`,
  keywords: ["tiết kiệm", "lãi", "lãi suất", "gửi tiền", "kỳ hạn", "tất toán", "ngân hàng trung ương", "lạm phát", "chỉ số giá", "lãi suất cơ bản"],
  related: ["tai-chinh", "thue-toa-thi-chinh", "tin-dung", "vay-ngang-hang", "kinh-te-vi-mo"],
  sections: [
    {
      id: "tong-quan",
      title: "Ngân hàng Trân Châu",
      blocks: [
        { p: `**🏦 Ngân hàng Trân Châu** mở khi bé tốt nhất của bạn đạt **cấp ${UNLOCKS.bank}**. Có hai cách gửi tiền: **tiết kiệm** (gửi rút lúc nào cũng được) và **gửi kỳ hạn** (${termDays} ngày, lãi cao hơn, chốt lãi lúc gửi).` },
        { list: [
          `Mọi lãi suất đều tính **theo ngày**, dựa trên **lãi suất cơ bản** do Ngân hàng Trung ương đặt mỗi tuần. Lúc mới mở game lãi cơ bản là **${pct(BANK.defaultRate)}/ngày** (khoảng ${pct(BANK.defaultRate * 7, 2)}/tuần), luôn nằm trong khoảng **${pct(CB.rateMin)} đến ${pct(CB.rateMax)}/ngày**.`,
          "Gửi và rút tiết kiệm không mất phí. Tiền trong ví không có lãi.",
          `Lãi ngân hàng là **thu nhập chịu thuế** (xem [Thuế](thue-toa-thi-chinh)).`,
          `Nhiệm vụ ngày "Gửi tiền vào ngân hàng" (từ cấp ${save.level ?? 1}) thưởng **${xu(save.reward)}**: gửi tiết kiệm hay gửi kỳ hạn đều tính.`,
        ] },
      ],
    },
    {
      id: "tiet-kiem",
      title: "Tiết kiệm",
      blocks: [
        { list: [
          `Lãi chạy liên tục theo thời gian tiền nằm trong tài khoản, theo lãi suất cơ bản hiện tại. **Nửa đêm** ngân hàng cộng phần lãi tròn xu vào chính tài khoản tiết kiệm, phần lẻ để dành cộng tiếp đêm sau.`,
          `Chỉ **${xu(BANK.savingsCap)} đầu** được tính lãi. Gửi nhiều hơn vẫn được, nhưng phần vượt nằm yên không có lãi.`,
          "Vì lãi cộng thẳng vào tiết kiệm nên khi chưa chạm trần, lãi hôm qua cũng sinh lãi hôm nay.",
        ] },
        { table: { head: ["Lãi cơ bản", `Lãi một ngày trên ${xu(BANK.savingsCap)}`, "Khoảng một tuần"], rows: [
          [`${pct(CB.rateMin)}/ngày (thấp nhất)`, xu(perDay(CB.rateMin)), xu(perDay(CB.rateMin) * 7)],
          [`${pct(BANK.defaultRate)}/ngày (ban đầu)`, xu(perDay(BANK.defaultRate)), xu(perDay(BANK.defaultRate) * 7)],
          [`${pct(CB.rateMax)}/ngày (cao nhất)`, xu(perDay(CB.rateMax)), xu(perDay(CB.rateMax) * 7)],
        ] } },
        { p: `**Ví dụ:** bạn để ${xu(15_000)} trong tiết kiệm khi lãi cơ bản ${pct(BANK.defaultRate)}/ngày. Chỉ ${xu(BANK.savingsCap)} được tính, nên mỗi đêm nhận **${xu(perDay(BANK.defaultRate))}**, không phải ${xu(interest(15_000, BANK.defaultRate))}. ${xu(5_000)} còn lại nên chuyển sang gửi kỳ hạn.` },
        { tip: `Nếu có gia tộc đang vận hành **🏦 Ngân hàng nhà nước** (ngành chiến lược), mọi người chơi được thưởng thêm ${pct(levels[0].buff, 0)} đến ${pct(levels[levels.length - 1].buff, 0)} trên lãi tiết kiệm và lãi kỳ hạn, tùy cấp hạ tầng. Người ngoài gia tộc chủ trả phí hạ tầng bằng ${pct(STRATEGIC_RULES.fee, 0)} phần thưởng thêm đó. Phí thu **trước**, từ chính chỗ nhận lãi (tiết kiệm với lãi tiết kiệm, ví với lãi kỳ hạn): không đủ tiền trả phí thì lần đó không có phần thưởng thêm.` },
      ],
    },
    {
      id: "ky-han",
      title: "Gửi kỳ hạn",
      blocks: [
        { list: [
          `Chọn kỳ hạn **${termDays} ngày**, gửi tối thiểu **${xu(BANK.minDeposit)}**, không giới hạn số tiền (trần ${xu(BANK.savingsCap)} chỉ áp cho tiết kiệm).`,
          "Lãi suất = lãi cơ bản **lúc gửi** + phụ phí kỳ hạn, và được **chốt** tới hết kỳ: Ngân hàng Trung ương đổi lãi sau đó cũng không ảnh hưởng.",
          "Lãi đơn: tiền gửi × lãi/ngày × số ngày, làm tròn xuống. Màn Ngân hàng báo trước số lãi sẽ nhận.",
          "Đến hạn, ngân hàng **tự tất toán** lúc nửa đêm: gốc và lãi về **ví**.",
        ] },
        { table: { head: ["Kỳ hạn", "Phụ phí", `Lãi/ngày khi lãi cơ bản ${pct(BANK.defaultRate)}`, `Lãi nhận trên ${xu(sample)}`, "Theo lãi cơ bản thấp nhất đến cao nhất"], rows: termRows } },
        { p: `**Ví dụ:** gửi ${xu(deposit)} kỳ hạn ${longest.days} ngày khi lãi cơ bản ${pct(BANK.defaultRate)}: lãi ${pct(BANK.defaultRate + longest.premium)}/ngày, đáo hạn nhận ${xu(deposit)} gốc + **${xu(interest(deposit, BANK.defaultRate + longest.premium, longest.days))}** lãi. Để cùng số tiền đó trong tiết kiệm ${longest.days} ngày chỉ được khoảng ${xu(interest(deposit, BANK.defaultRate, longest.days))}.` },
        { warn: "Rút trước hạn thì nhận lại **đủ gốc** nhưng **mất toàn bộ lãi**, kể cả khi chỉ còn một ngày nữa là đến hạn." },
      ],
    },
    {
      id: "nhtw",
      title: "Ngân hàng Trung ương",
      blocks: [
        { p: `Ngân hàng Trung ương họp **mỗi nửa đêm cuối Chủ nhật**, sau khi đã cộng lãi đêm đó. Lãi suất và chỉ số giá mới áp dụng từ thứ Hai, giữ nguyên cả tuần. Tin tức trong game đăng kết quả mỗi buổi họp, ví dụ: "${cbHeadline(g1, w1.baseRate, w1.priceIndex)}". Màn Ngân hàng có lịch sử 12 tuần.` },
        { steps: [
          "**Đếm tổng số xu** trong thị trấn: ví của mọi người chơi, tiết kiệm, tiền gửi kỳ hạn, tiền ký quỹ lệnh chờ trên Sàn, lương ca làm ở quầy và xưởng chưa nhận, và mọi quỹ chung (quỹ gia tộc, quỹ Hội, quỹ hụi...). **Ngân sách thị trấn không tính.**",
          `**So với tổng số xu đếm được ở buổi họp tuần trước** để ra mức tăng trưởng. Mục tiêu là **tăng ${pct(CB.target, 1)}/tuần**. Chưa có số của tuần trước để so (như buổi họp đầu tiên) thì coi như đúng mục tiêu. Số người đang chơi không ảnh hưởng: người nghỉ mà vẫn giữ xu thì tổng không đổi.`,
          `**Chênh lệch** = mức tăng tuần này trừ ${pct(CB.target, 1)}. Mỗi **1 điểm %** vượt mục tiêu làm **lãi cơ bản giảm ${pts(CB.ratePerPoint)}/ngày** (tính từ mức ${pct(CB.neutral)}) và **chỉ số giá tăng ${pct(CB.indexPerPoint)}**. Thấp hơn mục tiêu thì ngược lại.`,
          `Giới hạn: lãi cơ bản kẹt ở **${pct(CB.rateMin)}** khi xu tăng từ ${pct(CB.rateFloorAt, 1)}/tuần trở lên và ở **${pct(CB.rateMax)}** khi xu tăng từ ${pct(CB.rateCeilAt, 1)}/tuần trở xuống. Chỉ số giá một tuần tăng tối đa **${pct(CB.indexUpMax, 1)}** (khi xu tăng từ ${pct(CB.indexUpAt, 1)}/tuần trở lên) và giảm tối đa **${pct(CB.indexDownMax, 1)}** (khi xu tăng từ ${pct(CB.indexDownAt, 1)}/tuần trở xuống).`,
        ] },
        { p: "Chỉ số giá **nhân dồn** qua các tuần (tuần này nhân lên chỉ số của tuần trước), còn lãi cơ bản thì **tính lại từ đầu** mỗi tuần chỉ theo mức tăng của tuần đó." },
        { table: { head: ["Tổng số xu tăng trong tuần", "Lãi cơ bản tuần sau", "Chỉ số giá thay đổi"], rows: policyRows().map((r) => r.map((c) => c.replace("-", "−"))) } },
        { p: `**Ví dụ hai tuần liền:** chỉ số giá đang là ${idx(1)}. Tuần 1 tổng số xu tăng **${pct(g1, 1)}** (vượt mục tiêu ${num((g1 - CB.target) * 100)} điểm %): lãi cơ bản xuống **${pct(w1.baseRate)}/ngày**, chỉ số giá lên **${idx(w1.priceIndex)}**. Giấy phép quầy Mặt phố giá gốc ${xu(license)} giờ tốn ${xu(Math.round(license * w1.priceIndex))}, còn ${xu(BANK.savingsCap)} tiết kiệm chỉ lãi khoảng ${xu(interest(BANK.savingsCap, w1.baseRate))}/ngày. Tuần 2 tổng số xu chỉ tăng **${pct(g2, 1)}** (thiếu ${num((CB.target - g2) * 100)} điểm %, bị kẹp ở mức giảm tối đa): lãi cơ bản lên trần **${pct(w2.baseRate)}/ngày**, chỉ số giá giảm còn **${idx(w2.priceIndex)}**, giấy phép đó còn ${xu(Math.round(license * w2.priceIndex))}.` },
      ],
    },
    {
      id: "anh-huong",
      title: "Lãi suất và chỉ số giá chạm tới đâu",
      blocks: [
        { p: "**Chỉ số giá** nhân vào giá gốc của hầu hết những gì bạn trả cho NPC, và cả giá tham chiếu của hàng hóa:" },
        { list: [
          "[Siêu thị](sieu-thi) (đồ ăn, đồ chăm sóc, đồ chơi, trang phục), học phí [Trường học](truong-hoc), phòng khám và bảo hiểm.",
          "Hạt giống và mở rộng [vườn](vuon), mở lại ô tưởng niệm, [phí chăm nuôi bé](tinh-cach-tuoi) mỗi ngày.",
          "[Quầy trà sữa](quay-tra-sua): giấy phép, tiền thuê mặt bằng, nâng cấp, quảng cáo, và cả giá tham chiếu từng món lẫn chi phí nguyên liệu.",
          "[Xưởng](khu-cong-nghiep): xây, nâng cấp, thuê đất.",
          "Giá trung bình mà nguyên liệu thô trên [Sàn](san-nguyen-lieu) dần quay về, giá trị món [Bếp](bep) bán cho NPC, giá tham chiếu ở [Chợ Phiên](cho-phien).",
        ] },
        { p: "**Lãi suất cơ bản** là nền của mọi khoản lãi:" },
        { list: [
          "Lãi tiết kiệm, lãi gửi kỳ hạn của người chơi và của quỹ gia tộc.",
          `Lãi [vay ngân hàng](tin-dung) = lãi cơ bản + phụ phí hạng tín dụng, cộng thêm phụ phí lạm phát khi tuần trước xu tăng nhanh hơn ${pct(CB.target, 1)}.`,
          `[Giá đất](so-nha-dat): lãi cơ bản càng cao hơn ${pct(BANK.defaultRate)} thì chỉ số giá đất mỗi ngày càng bị kéo xuống, thấp hơn thì được đẩy lên (xem [Kinh tế vĩ mô](kinh-te-vi-mo)).`,
        ] },
      ],
    },
    {
      id: "chien-luoc",
      title: "Khi nào gửi, khi nào mua",
      blocks: [
        { list: [
          `Giữ tới **${xu(BANK.savingsCap)}** trong tiết kiệm làm quỹ dự phòng: có lãi mà rút lúc nào cũng được. Tiền nhiều hơn để **gửi kỳ hạn**, vì phần vượt trần tiết kiệm không có lãi.`,
          `Lãi kỳ hạn chốt lúc gửi, nên **lãi cơ bản đang cao** là lúc nên gửi kỳ hạn dài (${longest.days} ngày). Khi lãi cơ bản đang ở đáy ${pct(CB.rateMin)}, gửi kỳ hạn ngắn để sớm gửi lại khi lãi lên.`,
          "Xem lịch sử ở màn Ngân hàng: nếu mấy tuần gần đây xu tăng nhanh hơn mục tiêu, chỉ số giá đang leo, các khoản lớn tính theo chỉ số (giấy phép, xây xưởng, nâng cấp) mua sớm thì đỡ tốn hơn. Giá chỉ đổi lúc họp đêm Chủ nhật.",
          `Chỉ số giá một tuần lên được tới ${pct(CB.indexUpMax, 1)} nhưng chỉ xuống tối đa ${pct(CB.indexDownMax, 1)}: giá lên thì nhanh, xuống thì chậm.`,
        ] },
        { warn: "Lãi kỳ hạn trả **một lần** vào ngày đáo hạn và tính hết vào thu nhập chịu thuế của ngày đó. Thuế thu nhập lũy tiến theo ngày, nên một khoản lãi lớn rơi vào một ngày có thể chịu bậc thuế cao. Chia thành nhiều khoản đáo hạn vào các ngày khác nhau sẽ nhẹ thuế hơn." },
      ],
    },
  ],
};
