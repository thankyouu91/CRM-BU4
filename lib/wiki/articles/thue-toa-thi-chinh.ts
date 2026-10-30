import type { WikiArticle } from "../types";
import { CLAN, UNLOCKS } from "../rules";
import { MONEY } from "../rules-money";
import { proposalRows } from "../game-data";
import { TAX_FREE, bracketRows, bracketSum, isTaxed, num, pct, taxRange, taxRows, taxSteps, xu } from "./money";
import { GUILD_PROJECTS, PROPOSALS, STIPEND, TREASURY_SEED, incomeTax } from "@/petdex/server/rules/town.js";
import { BUSINESS } from "@/petdex/server/rules/business.js";
import { MARKET } from "@/petdex/server/rules/market.js";
import { BAZAAR, LOANS } from "@/petdex/server/rules/production.js";
import { P2P } from "@/petdex/server/rules/finance.js";
import { MARKET_RULES, STRATEGIC_RULES } from "@/public/ta-tua/game/js/shared/industry.js";
import { UPKEEP } from "@/public/ta-tua/game/js/shared/pets.js";

// Taxes (town.js, ledger.js chargeTax, business.js, clans.js, commerce.js), fees and the town budget.

const half = pct(MONEY.treasuryShare, 0);
const cut = PROPOSALS.tax_cut.effect.value;
const fund = PROPOSALS.newbie_fund.effect.value;
const rewards = Object.values(GUILD_PROJECTS as Record<string, { reward: number }>).map((p) => p.reward);
const p2pCuts = Object.values(P2P.cut as Record<string, number>);
const levels = STRATEGIC_RULES.levels as { buff: number }[];

// A day of income for the worked example.
const day = { salary: 1_200, interest: 30, business: 600, trading: 400, daily: 60, minigame: 150 };
const taxable = day.salary + day.interest + day.business + day.trading + (isTaxed("minigame") ? day.minigame : 0);
const dayTax = incomeTax(taxable);
const dayTaxRounded = bracketSum(taxable) !== dayTax; // incomeTax() rounds the bracket sum down

// A clan with two industries for the corporate tax example.
const clanRate = CLAN.baseTax + CLAN.extraTaxPerIndustry;
const revenue = 10_000;
const declared = 0.8;
const fullTax = Math.round(revenue * clanRate);
const lowTax = Math.round(Math.round(revenue * declared) * clanRate);
const evaded = Math.round((revenue - Math.round(revenue * declared)) * clanRate);
const collected = Math.round(evaded * (1 + STRATEGIC_RULES.collectPenalty));

export const article: WikiArticle = {
  slug: "thue-toa-thi-chinh",
  title: "Thuế và Tòa thị chính",
  category: "kinh-te",
  emoji: "🏛️",
  summary: "Thuế thu nhập lũy tiến theo ngày, thuế quầy và thuế doanh nghiệp gia tộc, các loại phí, ngân sách thị trấn đi đâu về đâu và bỏ phiếu chọn đề xuất mỗi tuần.",
  keywords: ["thuế", "thuế thu nhập", "thuế doanh nghiệp", "thuế doanh thu", "nợ thuế", "trốn thuế", "thuế vụ", "phí", "ngân sách", "bỏ phiếu", "đề xuất", "trợ cấp tân thủ", "tòa thị chính"],
  related: ["tai-chinh", "ngan-hang", "quay-tra-sua", "gia-toc", "so-cong-thuong", "moi-ngay"],
  sections: [
    {
      id: "tong-quan",
      title: "Các loại thuế",
      blocks: [
        { p: `Thuế và phí là cách thị trấn hút bớt xu: **${half}** số thu vào **ngân sách thị trấn**, phần còn lại **bị hủy** khỏi nền kinh tế (trừ vài khoản ghi rõ bên dưới). Xem bức tranh chung ở [Hệ thống tài chính](tai-chinh).` },
        { table: { head: ["Thuế", "Ai nộp", "Mức", "Vào ngân sách"], rows: [
          ["Thuế thu nhập", "Mọi người chơi, mỗi nửa đêm", `${taxRange()} theo bậc, tính trên thu nhập trong ngày`, half],
          ["Thuế doanh thu quầy", "Chủ quầy trà sữa", `${pct(BUSINESS.revenueTax)} doanh thu`, half],
          ["Thuế doanh nghiệp", "Quỹ gia tộc, mỗi nửa đêm", `${pct(CLAN.baseTax)} + ${pct(CLAN.extraTaxPerIndustry)} cho mỗi ngành thêm, trên doanh thu khai báo`, half],
          ["Truy thu thuế", "Gia tộc khai thiếu", `Phần thuế trốn + phạt ${pct(STRATEGIC_RULES.collectPenalty, 0)}`, "Tất cả (trừ hoa hồng Thuế vụ)"],
          ["Thuế chống độc quyền", "Gia tộc bán quá nhiều một mặt hàng", `${pct(MARKET_RULES.antitrustRate, 0)} tiền hàng của phần vượt ngưỡng`, "Tất cả"],
        ] } },
      ],
    },
    {
      id: "thue-thu-nhap",
      title: "Thuế thu nhập",
      blocks: [
        { p: "Mỗi nửa đêm, Tòa thị chính cộng **thu nhập chịu thuế trong ngày** của bạn rồi tính thuế **lũy tiến từng bậc**: mỗi bậc chỉ đánh trên phần thu nhập nằm trong bậc đó." },
        { table: { head: ["Phần thu nhập trong ngày", "Thuế suất"], rows: bracketRows() } },
        { p: "**Tính vào thu nhập chịu thuế:**" },
        { list: [
          "**Lương** mọi ca làm, kể cả làm thuê ở quầy hay xưởng của người khác.",
          "**Tiền thưởng mini-game** (câu cá, hứng trân châu, ghép hình).",
          "**Lãi ngân hàng**: lãi tiết kiệm và lãi kỳ hạn (phần thưởng thêm của Ngân hàng nhà nước không tính).",
          "**Phí gia công** xưởng của bạn thu được.",
          "**Lợi nhuận quầy**: doanh thu trừ nguyên liệu, tiền thuê, lương nhân viên và thuế doanh thu. Ngày lỗ tính là 0.",
          "**Lãi bán hàng** trên [Sàn](san-nguyen-lieu) và theo hợp đồng cung ứng: tiền bán (sau phí) trừ giá vốn. Lãi và lỗ trong cùng ngày bù trừ cho nhau, tổng âm tính là 0.",
        ] },
        { p: "**Không chịu thuế:** mọi khoản thu khác, ví dụ quà ngày, nhiệm vụ, thưởng lên cấp, bán món Bếp, bán ở Chợ Phiên, cổ tức gia tộc, trợ cấp tân thủ." },
        { table: { head: ["Thu nhập chịu thuế trong ngày", "Thuế", "Thuế suất thực"], rows: taxRows([100, 250, 800, 1_000, 2_500, 5_000]) } },
        { p: `**Ví dụ một ngày:** lương ${xu(day.salary)}, lãi tiết kiệm ${xu(day.interest)}, lợi nhuận quầy ${xu(day.business)}, lãi bán trên Sàn ${xu(day.trading)}, tiền thưởng mini-game ${xu(day.minigame)}, cộng thêm quà ngày ${xu(day.daily)} (khoản này miễn thuế). Thu nhập chịu thuế = **${xu(taxable)}**. Thuế = ${taxSteps(taxable)} = **${xu(dayTax)}**${dayTaxRounded ? " (làm tròn xuống)" : ""}. Ngân sách nhận ${xu(Math.floor(dayTax * MONEY.treasuryShare))}, phần còn lại bị hủy.` },
        { list: [
          "Thuế trừ thẳng vào **ví** (không đụng tiết kiệm). Ví không đủ thì phần thiếu thành **nợ thuế**, cộng vào hóa đơn đêm sau. Màn Tòa thị chính hiện thuế 7 ngày gần nhất và nợ thuế.",
          `Khi đề xuất **Giảm thuế** đang chạy, mọi bậc giảm ${num(cut * 100)} điểm % (không xuống dưới 0%). Với ${xu(2_500)} thu nhập, thuế còn ${xu(incomeTax(2_500, cut))} thay vì ${xu(incomeTax(2_500))}.`,
        ] },
        { tip: `Thuế tính riêng từng ngày: kiếm ${xu(3_000)} trong một ngày chịu ${xu(incomeTax(3_000))} thuế, còn ${xu(1_000)} mỗi ngày trong 3 ngày chỉ chịu ${xu(3 * incomeTax(1_000))}. Ai có thu nhập chịu thuế không quá ${xu(TAX_FREE)} một ngày không phải nộp gì.` },
      ],
    },
    {
      id: "thue-doanh-nghiep",
      title: "Thuế quầy và thuế gia tộc",
      blocks: [
        { p: `**Quầy trà sữa** trả **${pct(BUSINESS.revenueTax)} doanh thu** ngay khi bán (doanh thu ${xu(2_000)} thì thuế ${xu(Math.round(2_000 * BUSINESS.revenueTax))}). Lợi nhuận còn lại của quầy lại tính vào thuế thu nhập của chủ quầy.` },
        { p: `**Thuế doanh nghiệp** đánh trên doanh thu mỗi ngày của [gia tộc](gia-toc): **${pct(CLAN.baseTax)}** với một ngành, thêm **${pct(CLAN.extraTaxPerIndustry)}** cho mỗi ngành nữa. Thuế lấy từ quỹ gia tộc (quỹ thiếu thì tự rút gấp tiền gửi ngân hàng của gia tộc). Cuối tháng, ngân sách **hoàn lại ${pct(CLAN.refundRate)}** số thuế doanh nghiệp cả tháng, nếu ngân sách còn đủ tiền.` },
        { p: "Tộc trưởng tự chọn **tỉ lệ khai báo** từ 0% đến 100% doanh thu. Khai thiếu thì phần thuế trốn được ghi thành hồ sơ. Gia tộc nắm **🧾 Thuế vụ** (ngành chiến lược) xem được hồ sơ của gia tộc khác và đi truy thu: lấy từ quỹ gia tộc trốn thuế phần thuế trốn cộng tiền phạt, hưởng hoa hồng, phần còn lại vào ngân sách. Quản trị viên cũng truy thu được." },
        { p: `**Ví dụ:** gia tộc có 2 ngành, thuế suất ${pct(clanRate)}, doanh thu một ngày ${xu(revenue)}. Khai đủ: thuế **${xu(fullTax)}**. Khai ${pct(declared, 0)}: thuế ${xu(lowTax)}, trốn ${xu(evaded)}. Nếu bị Thuế vụ truy thu, gia tộc mất ${xu(evaded)} × (1 + ${pct(STRATEGIC_RULES.collectPenalty, 0)}) = **${xu(collected)}**, nhiều hơn số đã trốn. Gia tộc Thuế vụ hưởng ${pct(levels[0].buff, 0)} đến ${pct(levels[levels.length - 1].buff, 0)} số truy thu tùy cấp hạ tầng.` },
        { p: `**Thuế chống độc quyền** (do [Sở Công Thương](so-cong-thuong) áp trên sàn hàng công nghiệp): khi một gia tộc bán quá **${pct(MARKET_RULES.antitrustShare, 0)}** khối lượng ${MARKET_RULES.windowDays} ngày của một mặt hàng (và tổng khối lượng từ ${num(MARKET_RULES.antitrustMinVolume)} đơn vị), phần vượt chịu thêm **${pct(MARKET_RULES.antitrustRate, 0)}** tiền hàng, nộp hết vào ngân sách.` },
      ],
    },
    {
      id: "phi",
      title: "Các loại phí",
      blocks: [
        { table: { head: ["Phí", "Mức", "Vào ngân sách"], rows: [
          ["Mua hoặc bán trên Sàn Nguyên Liệu", `${pct(MARKET.fee)} giá trị (tối thiểu 1 xu)`, half],
          ["Đăng tin Chợ Phiên, mở phiên đấu giá", `${pct(BAZAAR.listFee)} giá (tối thiểu 1 xu)`, half],
          ["Bán được ở Chợ Phiên hoặc đấu giá (người bán trả)", `${pct(BAZAAR.saleFee)} giá (tối thiểu 1 xu)`, half],
          ["Sàn hàng công nghiệp (gia tộc bán)", `${pct(MARKET_RULES.fee)} tiền hàng`, half],
          ["Vay ngân hàng: phí giải ngân, lãi vay", `Phí giải ngân ${pct(LOANS.originationFee)}, lãi theo [Tín dụng](tin-dung)`, half],
          ["Vay ngang hàng: phần lãi ngân hàng trung gian giữ", `${pct(Math.min(...p2pCuts), 0)} đến ${pct(Math.max(...p2pCuts), 0)} tiền lãi`, "Tất cả"],
          ["Lập gia tộc", xu(CLAN.createCost), half],
          ["Phí duy trì gia tộc mỗi ngày", `${xu(CLAN.upkeepPerLevel)} × cấp + ${xu(CLAN.upkeepPerPlot)} × số lô`, half],
          ["Bồi thường thị trường khi gia tộc thâu tóm ngành", "Theo ngành", half],
          ["Gia tộc mua đất", "Giá lô", pct(CLAN.land.treasuryShare, 0)],
          ["Phí chăm nuôi bé mỗi ngày", `(${UPKEEP.base} + ${UPKEEP.perLevel} × cấp) xu mỗi bé × chỉ số giá, không quá ${pct(UPKEEP.incomeShare, 0)} thu nhập trong ngày. Xem [Tính cách, tuổi và vòng đời](tinh-cach-tuoi)`, "Không, bị hủy hẳn"],
          ["Thua Đấu trường", "Một phần quỹ gia tộc", "Phần không chia cho bên thắng (khoảng một nửa)"],
        ] } },
        { p: "Tiền mua đồ của NPC (Siêu thị, học phí, phòng khám, hạt giống, giấy phép, tiền thuê...) **không** vào ngân sách: số xu đó bị hủy hẳn." },
      ],
    },
    {
      id: "ngan-sach",
      title: "Ngân sách thị trấn",
      blocks: [
        { p: `Ngân sách bắt đầu bằng **quỹ khởi tạo ${xu(TREASURY_SEED)}**, sau đó sống nhờ phần thuế và phí kể trên. Màn Tòa thị chính hiện số dư và dòng tiền vào ra 7 ngày qua. Ngân sách **không** được tính vào lượng xu mà Ngân hàng Trung ương đo (xem [Ngân hàng](ngan-hang)).` },
        { p: "**Ngân sách chi cho:**" },
        { list: [
          `**Trợ cấp tân thủ**: trong ${STIPEND.days} ngày đầu của tài khoản, mỗi lần nhận quà ngày được thêm **${xu(STIPEND.amount)}** (đề xuất Quỹ chào tân thủ nâng lên ${xu(fund)}). Ngân sách còn ít hơn thì chỉ trả bằng số còn lại.`,
          "**Đề xuất** thắng phiếu mỗi tuần (bảng bên dưới).",
          `**Thưởng dự án Hội**: Hội góp đủ nguyên liệu cho dự án tuần thì mỗi thành viên nhận ${rewards.length ? `${xu(Math.min(...rewards))} đến ${xu(Math.max(...rewards))}` : "thưởng"} từ ngân sách (xem [Hội](hoi)).`,
          `**Hoàn thuế doanh nghiệp** ${pct(CLAN.refundRate)} cho các gia tộc vào cuối tháng.`,
        ] },
        { warn: "Ngân sách cạn thì tân thủ nhận ít trợ cấp hơn, dự án Hội có thể không đủ thưởng cho mọi người và đề xuất thắng phiếu có thể không được làm. Nộp thuế đều đặn chính là nuôi các khoản đó." },
      ],
    },
    {
      id: "bo-phieu",
      title: "Bỏ phiếu đề xuất",
      blocks: [
        { steps: [
          `Từ **cấp ${UNLOCKS.townhall}**, mỗi người được bầu. Mỗi tuần (thứ Hai tới hết Chủ nhật) Tòa thị chính bốc ngẫu nhiên **3 trong ${Object.keys(PROPOSALS).length}** đề xuất.`,
          "Mỗi người một phiếu, đổi ý được tới lúc đóng phiên.",
          "Nửa đêm cuối Chủ nhật đóng phiên: đề xuất nhiều phiếu nhất thắng, hòa thì lấy cái rẻ hơn. Không ai bầu thì tuần đó không làm gì.",
          "Đề xuất thắng chỉ được làm khi **ngân sách đủ tiền** lúc đóng phiên. Đủ thì ngân sách trả tiền và hiệu ứng bắt đầu ngay; thiếu thì tin tức báo đề xuất thắng nhưng chưa đủ ngân sách.",
        ] },
        { table: { head: ["Đề xuất", "Chi phí (xu)", "Tác dụng"], rows: proposalRows() } },
        { tip: `Giảm thuế có lợi nhất cho người có thu nhập chịu thuế trên ${xu(TAX_FREE)} mỗi ngày; người chủ quầy hưởng nhiều nhất từ các đề xuất thêm khách; người mới chơi thì Quỹ chào tân thủ.` },
      ],
    },
  ],
};
