import type { WikiArticle } from "../types";
import { CLAN } from "../rules";
import { KIND_LABELS as L, MONEY, upkeepCharge } from "../rules-money";
import { CB, TAXABLE, andList, idx, interest, isTaxed, num, pct, xu } from "./money";
import { BANK, policy } from "@/petdex/server/rules/bank.js";
import { PROPOSALS, incomeTax } from "@/petdex/server/rules/town.js";
import { BUSINESS } from "@/petdex/server/rules/business.js";
import { loanRate } from "@/petdex/server/rules/production.js";
import { ESSENTIALS } from "@/public/ta-tua/game/js/shared/industry.js";
import { PHASES } from "@/public/ta-tua/game/js/shared/clan.js";
import { UPKEEP, upkeepOf } from "@/public/ta-tua/game/js/shared/pets.js";

// The hub of the money system: where coins come from (ledger.js KINDS), where they go, who sets the
// knobs (bank.js weekly, macro.js daily, town.js weekly) and how one change runs through the others.

const half = pct(MONEY.treasuryShare, 0);
const k = (...kinds: (keyof typeof L)[]) => kinds.map((x) => `"${L[x]}"`).join(", ");
const taxNote = (...kinds: string[]) => (kinds.every(isTaxed) ? "Chịu thuế thu nhập" : kinds.some(isTaxed) ? "Một phần chịu thuế thu nhập" : "Miễn thuế");

// Chain 1: coins grow fast.
const hot = 0.2;
const hotWeek = policy({ growth: hot, priceIndex: 1 });
const bill = 1_000;
const petLevel = 20;

// Chain 7: pet upkeep follows the price index and the day's income.
const pets = [10, 20];
const upkeepFull = upkeepCharge({ levels: pets, income: Infinity }).due;
const upkeepHot = upkeepCharge({ levels: pets, priceIndex: hotWeek.priceIndex, income: Infinity }).due;
const busyDay = 1_000;
const quietDay = 300;
const atIncome = (income: number) => upkeepCharge({ levels: pets, income }).due;

// Chain 3: loans in a hot week (inflation premium on top of the base rate and the credit tier).
const hotLoan = 0.17;
const inflation = loanRate(0, 500, hotLoan) - loanRate(0, 500, 0);

// Chain 4: the base rate and land prices.
const phases = PHASES as Record<string, { name: string; land: number }>;
const recovery = phases.recovery;
const landAt = (rate: number) => recovery.land - (rate - BANK.defaultRate) * MONEY.landRateDrag;

// Chain 6: players stop playing while their coins stay.
const before = { players: 20, avg: 5_000 };
const quit = 5;
const total = before.players * before.avg;
const after = total / (before.players - quit);
const quitGrowth = (after - before.avg) / before.avg;
const quitWeek = policy({ growth: quitGrowth, priceIndex: 1 });

const fest = PROPOSALS.food_fest;

export const article: WikiArticle = {
  slug: "tai-chinh",
  title: "Hệ thống tài chính",
  category: "kinh-te",
  emoji: "💹",
  summary: "Bức tranh toàn cảnh về xu ở Petfarm: xu sinh ra từ đâu, mất đi đâu, ai điều chỉnh lãi suất, giá cả và ngân sách, và một thay đổi lan sang mọi thứ khác thế nào.",
  keywords: ["tài chính", "kinh tế", "dòng tiền", "lạm phát", "giảm phát", "in tiền", "hủy xu", "sổ cái", "ví", "chỉ số giá", "lãi suất", "ngân sách", "chiến lược"],
  related: ["ngan-hang", "thue-toa-thi-chinh", "kinh-te-vi-mo", "tin-dung", "vay-ngang-hang", "hui", "so-cong-thuong", "sieu-thi"],
  sections: [
    {
      id: "ba-loai",
      title: "Xu sinh ra, mất đi và đổi chủ",
      blocks: [
        { p: "Mỗi đồng xu trong game đều đi qua **sổ cái**: màn **Ví** ghi từng dòng, kèm số dư sau giao dịch. Mọi dòng thuộc một trong ba loại:" },
        { list: [
          "**Sinh ra**: game trả xu cho bạn mà không lấy của ai (lương việc làm, quà ngày, NPC mua hàng, lãi ngân hàng...). Đây là các **vòi** bơm xu vào thị trấn.",
          "**Mất đi**: bạn trả xu cho NPC hoặc cho thị trấn và số xu đó bị hủy (Siêu thị, học phí, phí chăm nuôi bé, một nửa thuế và phí...). Đây là các **cống** hút xu ra.",
          "**Đổi chủ**: xu đi từ người này sang người khác hoặc sang một quỹ (Chợ Phiên, vay ngang hàng, hụi, quỹ gia tộc...). Tổng số xu của thị trấn không đổi.",
        ] },
        { p: "Báo cáo **Thu** và **Chi** của Ví chỉ tính các khoản thu chi thật; những lần chuyển giữa các túi của chính bạn (gửi tiết kiệm, gửi kỳ hạn, ký quỹ lệnh, nhận gốc vay) không được tính là thu hay chi." },
        { p: "Thị trấn có thể có **cư dân tự động** do máy chủ điều khiển; họ chơi theo đúng luật như mọi người chơi, cùng hạn mức, phí và thuế." },
        { tip: `Vòi chảy mạnh hơn cống thì lượng xu bình quân tăng. Ngân hàng Trung ương muốn nó tăng khoảng **${pct(CB.target, 0)} mỗi tuần**: nhanh hơn thì hãm, chậm hơn thì nới (xem [Ngân hàng](ngan-hang)).` },
      ],
    },
    {
      id: "vao-ra",
      title: "Vòi và cống",
      blocks: [
        { p: "Tên trong ngoặc kép là tên dòng sổ cái bạn thấy trong màn Ví. Mua bán trên Sàn chỉ sinh ra hoặc hủy xu khi khớp với NPC; khớp với lệnh của người chơi khác thì chỉ là đổi chủ." },
        { table: { head: ["Xu sinh ra từ", "Dòng sổ cái", "Ghi chú"], rows: [
          ["Việc làm cho NPC", k("salary"), "Ca làm ở quầy hay xưởng của người chơi thì là tiền chủ quầy trả, không phải xu mới"],
          ["Phần thưởng", k("daily", "quest", "level", "play", "gift_code", "mail"), taxNote("daily", "quest", "level", "play", "gift_code", "mail")],
          ["Mini-game", k("minigame"), taxNote("minigame")],
          ["NPC mua hàng", k("market_sell", "business_income", "kitchen_sale", "gear_quicksell"), "Bán cho NPC trên Sàn, khách NPC ở quầy, Bếp bán món"],
          ["Lãi và thưởng", k("interest", "infra_bonus", "gear_trade"), "Lãi ngân hàng chịu thuế"],
          ["Vay ngân hàng", k("loan_in"), "Ngân hàng tạo xu mới khi giải ngân; trả gốc thì số xu đó bị hủy"],
          ["Gia tộc", k("clan_revenue", "clan_land"), "Doanh thu từ NPC, tiền Sở Nhà Đất trả khi bán lại đất"],
          ["Ngân sách thị trấn chi ra", k("stipend", "guild_reward"), "Không phải xu mới, nhưng ngân sách không được đếm nên vẫn làm lượng xu đo được tăng"],
        ] } },
        { table: { head: ["Xu mất đi ở", "Dòng sổ cái", "Phần bị hủy"], rows: [
          ["Mua của NPC", k("shop", "adopt", "school", "clinic", "insurance", "seeds"), "Tất cả"],
          ["Làm ăn với NPC", k("license", "rent", "biz_upgrade", "factory_build", "gear_repair", "market_buy"), "Tất cả"],
          ["Thuế và phí", k("tax", "fee", "loan_interest"), `Một nửa (${half} còn lại vào ngân sách)`],
          ["Nuôi bé", `${k("upkeep")}, mỗi nửa đêm`, "Tất cả"],
          ["Trả gốc vay ngân hàng", k("loan_repay"), "Tất cả"],
          ["Gia tộc", `${k("corp_tax", "clan_upkeep")}, mua đất`, `Thuế, phí: một nửa. Mua đất: ${pct(1 - CLAN.land.treasuryShare, 0)}`],
        ] } },
        { p: `Còn lại là **đổi chủ**: ${k("bazaar_sale", "toll_income", "wage", "clan_dividend", "p2p_lend", "hui_pay")}, lệnh mua bán khớp giữa người chơi trên Sàn, hợp đồng cung ứng, góp quỹ Hội và gia tộc. Xem [Vay ngang hàng](vay-ngang-hang), [Hụi](hui), [Chợ Phiên](cho-phien).` },
      ],
    },
    {
      id: "nut-van",
      title: "Ai điều chỉnh",
      blocks: [
        { table: { head: ["Ai", "Khi nào", "Đổi cái gì"], rows: [
          ["🏦 Ngân hàng Trung ương", "Nửa đêm cuối Chủ nhật", `Lãi suất cơ bản (${pct(CB.rateMin)} đến ${pct(CB.rateMax)}/ngày) và chỉ số giá (tăng tối đa ${pct(CB.indexUpMax, 1)}, giảm tối đa ${pct(CB.indexDownMax, 1)} mỗi tuần), theo mức tăng xu bình quân. Xem [Ngân hàng](ngan-hang).`],
          ["🌦️ Kinh tế vĩ mô", "Mỗi nửa đêm", "Pha kinh tế, thời tiết, cầu từng ngành, chỉ số giá đất (bị lãi suất cơ bản kéo). Pha làm doanh thu gia tộc, giá đất và lượng khách quầy lên xuống. Xem [Kinh tế vĩ mô](kinh-te-vi-mo)."],
          ["🏛️ Tòa thị chính (người chơi bầu)", "Nửa đêm cuối Chủ nhật", "Một đề xuất chi ngân sách: thêm khách cho quầy, giảm thuế, trợ giá, trợ cấp tân thủ. Xem [Thuế và Tòa thị chính](thue-toa-thi-chinh)."],
          ["🛒 Siêu thị", "Mỗi nửa đêm", `Độ tự chủ D của đồ ăn và đồ chăm sóc: D càng cao (gia tộc cung cấp càng nhiều) thì đồ NPC càng đắt, tới +${pct(ESSENTIALS.npcPriceUp, 0)}. Tài khoản dưới ${ESSENTIALS.newbieDays} ngày được miễn. Xem [Siêu thị](sieu-thi).`],
        ] } },
        { p: "Mỗi nửa đêm game **đóng sổ** theo thứ tự cố định:" },
        { steps: [
          "Quầy (bán bù, tiền thuê), xưởng, gia tộc (doanh thu, thuế doanh nghiệp, phí duy trì, hoàn thuế cuối tháng) rồi tạo trạng thái vĩ mô ngày mai.",
          "Sức khỏe và bảo hiểm, vòng đời bé, phí chăm nuôi bé, giao hàng hợp đồng.",
          "Lãi tiết kiệm, tất toán kỳ hạn đến hạn; tiền gửi gia tộc; trả góp vay ngân hàng, vay ngang hàng, hụi.",
          "Thuế thu nhập của ngày vừa qua.",
          "Hết hạn lệnh trên Sàn và tin Chợ Phiên, chụp tài sản ròng.",
          "Nếu là Chủ nhật: Ngân hàng Trung ương họp, rồi Tòa thị chính đóng phiên bầu.",
        ] },
      ],
    },
    {
      id: "day-chuyen",
      title: "Tác động dây chuyền",
      blocks: [
        { p: `**1. Xu tăng quá nhanh tự hãm lại.** Một tuần xu bình quân tăng ${pct(hot, 0)} → lãi cơ bản xuống **${pct(hotWeek.baseRate)}/ngày** và chỉ số giá lên **${idx(hotWeek.priceIndex)}**. → ${xu(BANK.savingsCap)} tiết kiệm chỉ lãi ${xu(interest(BANK.savingsCap, hotWeek.baseRate))}/ngày thay vì ${xu(interest(BANK.savingsCap, BANK.defaultRate))}, hóa đơn Siêu thị ${xu(bill)} thành khoảng ${xu(Math.round(bill * hotWeek.priceIndex))}, phí chăm nuôi một bé cấp ${petLevel} từ ${xu(upkeepOf(petLevel))} lên ${xu(upkeepOf(petLevel, hotWeek.priceIndex))} mỗi ngày. → Vòi lãi chảy yếu đi, cống mua sắm và nuôi bé hút mạnh hơn, tuần sau xu tăng chậm lại.` },
        { p: `**2. Chỉ số giá lên không chỉ làm đắt.** Giá trung bình nguyên liệu thô trên Sàn cũng nhân theo chỉ số, nên giá Sàn dần trôi lên. → Người bán hàng thô thu được nhiều xu hơn, món Bếp bán cho NPC được giá hơn, và giá tham chiếu món của quầy (chi phí nguyên liệu × ${num(BUSINESS.markup, 1)}) lên theo, nên chủ quầy nâng giá bán mà khách vẫn thấy hợp lý. → Nhưng giấy phép, tiền thuê, nâng cấp, học phí cũng lên cùng tỉ lệ, nên ai chỉ tiêu mà không bán thì thiệt.` },
        { p: `**3. Lạm phát làm vay đắt.** Lãi vay ngân hàng cộng thêm phụ phí lạm phát khi tuần trước xu tăng quá ${pct(CB.target, 0)}. Xu tăng ${pct(hotLoan, 0)} → phụ phí **+${pct(inflation, 2)}/ngày**, lớn hơn cả lãi cơ bản lúc đó (${pct(policy({ growth: hotLoan, priceIndex: 1 }).baseRate)}). → Vay để mở quầy hay xưởng lúc đó tốn hơn nhiều. Xem [Tín dụng](tin-dung).` },
        { p: `**4. Lãi suất kéo giá đất.** Mỗi ngày chỉ số giá đất đi theo pha kinh tế, trừ ${num(MONEY.landRateDrag)} lần phần lãi cơ bản vượt ${pct(BANK.defaultRate)}. Trong pha ${recovery.name} (+${pct(recovery.land, 1)}/ngày): lãi cơ bản ${pct(CB.rateMax)} → giá đất trôi khoảng **${pct(landAt(CB.rateMax), 1).replace("-", "−")}/ngày**; lãi ${pct(CB.rateMin)} → **+${pct(landAt(CB.rateMin), 1)}/ngày** (chưa kể nhiễu ngẫu nhiên). → Xu co lại (lãi cao) là lúc đất rẻ dần cho [gia tộc](so-nha-dat) mua, đồng thời gửi kỳ hạn lại lời.` },
        { p: `**5. Thuế quay vòng qua ngân sách.** Thuế và phí hủy ${half} số thu và đưa ${half} vào ngân sách, mà ngân sách không được Ngân hàng Trung ương đếm, nên thuế làm lượng xu đo được giảm. → Ngân sách chi lại qua đề xuất, ví dụ **${fest.name}** (${xu(fest.cost)}): ${fest.desc.replace(/\.$/, "")}. → Quầy bán nhiều hơn, nộp thêm thuế doanh thu ${pct(BUSINESS.revenueTax)} và thuế thu nhập trên lợi nhuận, ngân sách lại đầy dần.` },
        { p: `**6. Người chơi nghỉ cũng đẩy giá.** Ngân hàng Trung ương đếm xu của **mọi** tài khoản nhưng chỉ chia cho người có giao dịch trong ${MONEY.activeWindowDays} ngày. ${before.players} người đang chơi, bình quân ${xu(before.avg)}; tuần sau ${quit} người nghỉ mà vẫn giữ xu → bình quân thành ${xu(Math.round(after))}, tăng ${pct(quitGrowth, 0)} dù không ai kiếm thêm. → Lãi cơ bản xuống ${pct(quitWeek.baseRate)}, chỉ số giá lên ${idx(quitWeek.priceIndex)}. Ngược lại, nhiều người mới vào với ít xu kéo bình quân xuống, lãi lên và giá giảm.` },
        { p: `**7. Phí chăm nuôi theo giá và theo thu nhập.** Mỗi nửa đêm mỗi bé tốn (${UPKEEP.base} + ${UPKEEP.perLevel} × cấp) xu × chỉ số giá. Nuôi một bé cấp ${pets[0]} và một bé cấp ${pets[1]}: đủ phí là **${xu(upkeepFull)}** mỗi ngày khi chỉ số giá ${idx(1)}, và **${xu(upkeepHot)}** sau một tuần xu tăng ${pct(hot, 0)} như ở mục 1 (chỉ số ${idx(hotWeek.priceIndex)}). → Phí cả ngày không quá ${pct(UPKEEP.incomeShare, 0)} số xu bạn thu vào hôm đó, nhưng ít nhất ${xu(UPKEEP.base)} mỗi bé: ngày thu ${xu(busyDay)} thì trừ đủ ${xu(atIncome(busyDay))}, ngày chỉ thu ${xu(quietDay)} thì trừ ${xu(atIncome(quietDay))}, ngày không thu gì vẫn trừ ${xu(atIncome(0))}. → Người kiếm nhiều trả đủ phí theo chỉ số giá, người chơi ít vẫn giữ phần lớn số xu kiếm được. Không vào game quá ${UPKEEP.activeDays} ngày thì không bị tính; ví không đủ thì chỉ trừ phần đang có, không ghi nợ. Xem [Tính cách, tuổi và vòng đời](tinh-cach-tuoi).` },
      ],
    },
    {
      id: "nen-lam-gi",
      title: "Nên làm gì",
      blocks: [
        { list: [
          `**Đọc tin Ngân hàng Trung ương mỗi sáng thứ Hai.** Lãi cơ bản cao thì gửi kỳ hạn dài để chốt lãi; lãi ở đáy thì gửi kỳ hạn ngắn hoặc giữ trong tiết kiệm (chỉ ${xu(BANK.savingsCap)} đầu có lãi).`,
          `**Rải thu nhập chịu thuế ra nhiều ngày.** Thuế lũy tiến theo ngày: ${xu(3_000)} trong một ngày chịu ${xu(incomeTax(3_000))}, chia ba ngày chỉ ${xu(3 * incomeTax(1_000))}. ${andList(TAXABLE).replace(/^./, (c) => c.toUpperCase())} chịu thuế; quà ngày, nhiệm vụ, Bếp, Chợ Phiên thì không.`,
          "**Để sẵn tiền trong ví lúc nửa đêm.** Thuế và phí chăm nuôi chỉ trừ ví; thiếu tiền nộp thuế thì thành nợ thuế cộng vào hôm sau.",
          "**Khi chỉ số giá leo đều nhiều tuần**, mua sớm các khoản lớn tính theo chỉ số (giấy phép quầy, xây xưởng, nâng cấp); giá chỉ đổi lúc họp đêm Chủ nhật. Người bán nguyên liệu thô thì có lợi vì giá Sàn trôi theo.",
          "**Trước khi vay, cộng cả phụ phí lạm phát.** Lãi cơ bản thấp thường đi kèm xu tăng nhanh, và khi đó phụ phí lạm phát có thể lớn hơn phần lãi cơ bản giảm được.",
          "**Bầu đề xuất vừa với ngân sách.** Màn Tòa thị chính hiện số dư ngân sách; đề xuất thắng mà ngân sách không đủ thì cả tuần không có gì.",
        ] },
        { warn: "Những con số trong bài là luật của game, không phải dự báo. Không ai biết trước mức tăng xu của tuần này cho tới khi Ngân hàng Trung ương họp." },
      ],
    },
  ],
};
