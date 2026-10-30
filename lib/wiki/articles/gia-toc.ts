import type { WikiArticle } from "../types";
import { CLAN } from "../rules";
import { CLAN_XP, HEAVY, clanItemPrice } from "../rules-macro";
import { INDUSTRY_COUNT, clanLevelRows } from "../game-data";
import { INDUSTRIES, INDUSTRY_ORDER, competitionFactor } from "@/public/ta-tua/game/js/shared/clan.js";
import { ESSENTIALS, GOODS, HEAVY_INDUSTRIES, PRODUCTION_INDUSTRIES, SECTORS, STRATEGIC_INDUSTRIES, qualityScore, qualitySplit } from "@/public/ta-tua/game/js/shared/industry.js";
import { IMPACT, INDUSTRY_MARKET, industryInfluence, industryMarketText, industryStrength } from "@/public/ta-tua/game/js/shared/industry-market.js";
import { CLAN_BANK, CLAN_GOV, HUI, clanDepositPayout, clanDepositRate } from "@/petdex/server/rules/finance.js";
import { BANK } from "@/petdex/server/rules/bank.js";
import { COMMODITIES } from "@/petdex/server/rules/market.js";

// Gia tộc: lập và vai trò (clans.js), quỹ và cấp, thâu tóm ngành (26 ngành sau khi gộp, nhà máy gộp chọn dây chuyền
// theo lô), tác động của ngành lên Sàn Nguyên Liệu (shared/industry-market.js), thuế doanh nghiệp, tiền gửi kỳ hạn và
// phế truất (clan-gov.js, rules/finance.js), hụi lớn (hui.js), bán hàng thiết yếu cho Siêu thị (essentials.js, industry.js),
// công nghiệp nặng tạm đóng (heavy-industry.js).

type Named = { name: string; icon: string };
const num = (n: number) => Math.round(n).toLocaleString("vi-VN");
const mult = (x: number) => x.toLocaleString("vi-VN");
const pct = (x: number, digits = 1) => `${(Math.round(x * 100 * 10 ** digits) / 10 ** digits).toLocaleString("vi-VN")}%`;
const industries = INDUSTRIES as unknown as Record<string, Named & { sector: string }>;
const goodsNames = Object.fromEntries(Object.entries(COMMODITIES as Record<string, Named>).map(([id, g]) => [id, `${g.icon} ${g.name}`]));
const ind = (id: string) => `${industries[id].icon} ${industries[id].name}`;
const lined = Object.entries(PRODUCTION_INDUSTRIES as Record<string, Named & { lines?: Record<string, Named> }>).filter(([, i]) => i.lines);
const strategicNames = Object.values(STRATEGIC_INDUSTRIES as Record<string, Named>).map((s) => `${s.icon} ${s.name}`).join(", ");
const heavy = HEAVY_INDUSTRIES as string[];
const heavyNames = heavy.map(ind).join(", ");
const openIds = INDUSTRY_ORDER.filter((id) => !(HEAVY.closedByDefault && heavy.includes(id)));
// Bảng khối ngành: ngành công nghiệp nặng (đang tạm đóng) ghi kèm.
const sectorRows = () =>
  Object.entries(SECTORS as Record<string, Named>).map(([k, sec]) => [
    `${sec.icon} ${sec.name}`,
    INDUSTRY_ORDER.filter((id) => industries[id].sector === k).map((id) => `${ind(id)}${HEAVY.closedByDefault && heavy.includes(id) ? " (tạm đóng)" : ""}`).join(", "),
  ]);
const competitionStep = 1 / competitionFactor(2) - 1; // mỗi gia tộc khác cùng ngành
const taxRate = (n: number) => CLAN.baseTax + CLAN.extraTaxPerIndustry * (n - 1);

// ---- tác động lên Sàn Nguyên Liệu
const impactRows = () =>
  openIds.filter((id) => industryMarketText(id, goodsNames)).map((id) => {
    const w = (INDUSTRY_MARKET as Record<string, { weight?: number }>)[id].weight ?? 1;
    return [ind(id), industryMarketText(id, goodsNames), w === 1 ? "đầy đủ" : pct(w, 0)];
  });
const exStrength = industryStrength({ clans: 1, plots: 4 });
const fullPlots = Math.ceil((1 - IMPACT.perClan) / IMPACT.perPlot);
// Every open industry held and running at full strength: how far each good's mean price ends up.
const allFull = Object.values(
  industryInfluence(Object.fromEntries(Object.keys(INDUSTRY_MARKET).filter((id) => openIds.includes(id)).map((id) => [id, { clans: 1, plots: fullPlots }]))) as Record<string, { mean: number }>,
);
const allMeanLow = Math.min(...allFull.map((c) => c.mean)) - 1;
const allMeanHigh = Math.max(...allFull.map((c) => c.mean)) - 1;
const signedPct = (x: number) => `${x < 0 ? "−" : "+"}${pct(Math.abs(x))}`;

// ---- tiền gửi kỳ hạn: ví dụ 100.000 xu, 7 ngày, lãi cơ bản mặc định
const DEP = { amount: 100_000, term: 7 };
const depRate = clanDepositRate(BANK.defaultRate, DEP.term);
const dep = { amount: DEP.amount, rate: depRate, term_days: DEP.term, matures_at: DEP.term };
const onTime = clanDepositPayout(dep, DEP.term);
const early = clanDepositPayout(dep, 1);
const emergency = clanDepositPayout(dep, 1, { emergency: true });
const termRows = () =>
  Object.entries(CLAN_BANK.termPremium).map(([days, premium]) => [
    `${days} ngày`, `+${pct(premium, 2)}`, `+${pct(CLAN_BANK.clanBonus, 2)}`, `${pct(clanDepositRate(BANK.defaultRate, Number(days)), 2)}/ngày`,
  ]);

// ---- bỏ phiếu: gia tộc 9 người
const VOTERS = 8;
const need = Math.floor(VOTERS * CLAN_GOV.threshold) + 1;

// ---- Siêu thị: gia tộc cấp 5, nhà xưởng 12 mảnh, có tự trồng nguyên liệu
const food = ESSENTIALS.cats.food;
const care = ESSENTIALS.cats.care;
const goodsInd = GOODS as Record<string, Named & { base: number }>;
const ref = goodsInd[food.good].base;
const score = qualityScore({ level: 5, pieces: 12, upstream: 1 });
const split = qualitySplit(score);
const avgMult = split.reduce((s, share, i) => s + share * ESSENTIALS.qualities[i].mult, 0);
const ASK = 0.8;

export const article: WikiArticle = {
  slug: "gia-toc",
  title: "Gia tộc",
  category: "kinh-te",
  emoji: "🏯",
  summary: `Lập hoặc vào gia tộc từ cấp ${CLAN.unlockLevel}: góp quỹ, lên cấp, thâu tóm tới ${CLAN_XP.maxIndustries} ngành, nộp thuế doanh nghiệp, gửi quỹ kỳ hạn, bầu lại tộc trưởng và bán hàng cho Siêu thị.`,
  keywords: ["clan", "gia tộc", "tộc trưởng", "trưởng lão", "quỹ", "góp quỹ", "cổ tức", "ngành", "thâu tóm", "dây chuyền", "thuế doanh nghiệp", "tiền gửi", "kỳ hạn", "phế truất", "bỏ phiếu", "quản trị", "hụi lớn", "siêu thị", "suất ăn gia tộc", "chất lượng", "công nghiệp nặng", "tạm đóng", "giải tán"],
  related: ["so-nha-dat", "kinh-te-vi-mo", "so-cong-thuong", "dau-truong", "hui", "tai-chinh", "sieu-thi", "thue-toa-thi-chinh"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: "Gia tộc là nhóm người chơi góp chung một **quỹ** để mua đất, thâu tóm ngành và làm ăn trên đất đó. Doanh thu của gia tộc vào quỹ, không vào ví từng người; tộc trưởng chia cổ tức từ quỹ khi muốn." },
        { list: [
          `Mở khi có một bé đạt **cấp ${CLAN.unlockLevel}**. Vào màn **🏯 Gia tộc & Sở Nhà Đất** trên bản đồ phố.`,
          "Các tab: 🏯 Gia tộc (thành viên, quỹ, ngành), 🗺️ Bản đồ đất, 🏗️ Xây dựng, 🏭 Sản xuất & Kho, 🏪 Sàn công nghiệp, 🧾 Thuế, 📊 Vĩ mô, và 👑 Quản trị (chỉ tộc trưởng thấy).",
          "Đất, công trình và sản xuất trên đất xem ở [Sở Nhà Đất và sản xuất](so-nha-dat); tình hình kinh tế chung xem ở [Kinh tế vĩ mô](kinh-te-vi-mo).",
        ] },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { p: "**Lập, gia nhập và vai trò.**" },
        { list: [
          `**Lập gia tộc** tốn **${num(CLAN.createCost)} xu**: đặt tên (3–24 ký tự), chọn huy hiệu và màu. Một nửa số tiền vào ngân sách thị trấn.`,
          "Mỗi người chỉ ở **một gia tộc**. Gia nhập tự do tới khi gia tộc đủ người (số người tối đa tăng theo cấp gia tộc).",
          "Tộc trưởng rời đi thì trưởng lão (rồi người góp quỹ nhiều nhất) lên thay; người từng bị phế truất không được chọn.",
        ] },
        { table: { head: ["Việc", "Ai làm được"], rows: [
          ["Góp quỹ, bỏ phiếu phế truất, cho bé đứng máy trang trại gió", "Mọi thành viên"],
          ["Mua đất, chọn ngành và dây chuyền cho lô, lắp công trình", "👑 Tộc trưởng, 🎖️ Trưởng lão"],
          ["Mua bán hàng của gia tộc (sàn công nghiệp, nhập khẩu, bán NPC, sổ chào giá Siêu thị)", "👑 Tộc trưởng, 🎖️ Trưởng lão"],
          ["Thách đấu và chọn giờ đấu ở [Đấu trường](dau-truong)", "👑 Tộc trưởng, 🎖️ Trưởng lão"],
          ["Thâu tóm ngành, nộp tờ khai thuế, chia cổ tức, bán lại đất", "👑 Tộc trưởng"],
          ["Phân vai, mời ra, nhường chức, nâng cấp hạ tầng chiến lược", "👑 Tộc trưởng"],
          ["Bảng **👑 Quản trị**: gửi quỹ kỳ hạn; cho gia tộc chơi hụi lớn", "👑 Tộc trưởng (chưa từng bị phế truất)"],
        ] } },
        { p: "**Quỹ và cấp gia tộc.**" },
        { list: [
          `Thành viên **góp quỹ** từ ${num(CLAN_XP.minDonation)} xu; cứ ${num(CLAN_XP.perDonation)} xu góp được 1 XP cho gia tộc.`,
          `Mỗi tuần mỗi thành viên nên góp **${num(CLAN.donationQuotaPerLevel)} × cấp gia tộc** xu. Đêm Chủ nhật, gia tộc mất 1 XP cho mỗi ${num(CLAN_XP.perQuota)} xu các thành viên còn góp thiếu.`,
          `Mỗi đêm gia tộc trả **phí duy trì** ${num(CLAN.upkeepPerLevel)} × cấp + ${num(CLAN.upkeepPerPlot)} × số lô đất; một nửa vào ngân sách thị trấn.`,
          `Doanh thu sau thuế mỗi đêm cũng cộng XP: 1 XP cho mỗi ${num(CLAN_XP.perRevenue)} xu.`,
          "Tộc trưởng **chia cổ tức** từ quỹ, chia đều cho mọi thành viên (kể cả tộc trưởng), mỗi người nhận phần nguyên, số lẻ ở lại quỹ.",
        ] },
        { table: { head: ["Cấp", "XP cần", "Thành viên tối đa", "Lô đất tối đa", "Số ngành", "Sản lượng thêm"], rows: clanLevelRows() } },
        { p: `**Thâu tóm ngành.** Gia tộc chỉ làm ăn trên đất bằng những **ngành** đã thâu tóm. Có ${INDUSTRY_COUNT} ngành chia theo khối. ${lined.map(([, i]) => `${i.icon} ${i.name}`).join(", ")} là nhà máy nhiều **dây chuyền**: mỗi lô chọn một dây chuyền (như chọn loại nhà máy điện của ngành Năng lượng), tộc trưởng hoặc trưởng lão đổi được ở ô thông tin của lô trên Bản đồ đất.` },
        { table: { head: ["Khối", "Các ngành"], rows: sectorRows() } },
        { list: [
          `Ngành thứ 1, 2, 3 cần gia tộc đạt cấp ${CLAN.industryLevels.join(", ")}; tối đa ${CLAN_XP.maxIndustries} ngành.`,
          `Thâu tóm phải trả **bồi thường thị trường** của ngành (xem bảng ở [Sở Nhà Đất và sản xuất](so-nha-dat)); từ ngành thứ hai trả gấp **${CLAN.expandMultiplier} lần**. Một nửa tiền bồi thường vào ngân sách thị trấn.`,
          `Ngành chiến lược (${strategicNames}) theo luật riêng: mỗi gia tộc một ngành, có số gia tộc chủ tối đa, luôn trả mức gốc. Xem [Sở Công Thương](so-cong-thuong).`,
          `Ngành dịch vụ: nhiều gia tộc cùng nắm một ngành thì doanh thu lô của ai cũng nhân hệ số cạnh tranh 1 ÷ (1 + ${pct(competitionStep, 0)} × số gia tộc khác cùng ngành); ví dụ 3 gia tộc cùng ngành thì ×${mult(Math.round(competitionFactor(3) * 1000) / 1000)}.`,
          "Gia tộc từng nắm hai ngành nay đã gộp làm một thì giữ một suất và được hoàn tiền thâu tóm của suất thừa.",
        ] },
        { p: `**Công nghiệp nặng tạm đóng.** ${heavyNames} ${HEAVY.closedByDefault ? "đang tạm đóng" : "đang mở"}. Ngành đóng không thâu tóm được, không chọn được cho lô, và lô đang làm ngành đó không chạy. Khi đóng, gia tộc đang nắm được hoàn ${HEAVY.refundShare === 1 ? "toàn bộ" : pct(HEAVY.refundShare)} phí thâu tóm vào quỹ, ngành được gỡ (trả lại suất ngành), lô về chưa chọn ngành nhưng ${HEAVY.keepsBuilding ? "giữ công trình" : "mất công trình"}. Ban quản lý mở lại được. Chi tiết ở [Sở Công Thương](so-cong-thuong).` },
        { p: "**Ngành của gia tộc làm giá Sàn.** Ngành có gia tộc nắm sẽ đẩy giá trung bình của một số hàng trên [Sàn Nguyên Liệu](san-nguyen-lieu): ngành làm ra hàng thì cung tăng, giá giảm; ngành dùng hàng thì cầu tăng, giá lên; ngành điện, nhiên liệu làm hàng chế biến rẻ đi; ngành giao vận, máy móc làm giá bớt nhảy. Ngành chưa ai nắm thì hàng chạy theo thị trường bình thường." },
        { list: [
          `**Độ mạnh** của một ngành (0 đến 1) = ${num(IMPACT.perClan * 100)}% cho mỗi gia tộc đang nắm + 1/${num(1 / IMPACT.perPlot)} cho mỗi lô có công trình hoàn chỉnh đang làm ngành đó. Một gia tộc cần khoảng ${fullPlots} lô để ngành chạy hết sức.`,
          `Hết sức (và trọng số đầy đủ): cung tăng làm giá trung bình **−${pct(IMPACT.supply, 0)}**, cầu tăng **+${pct(IMPACT.demand, 0)}**, chi phí chế biến giảm **−${pct(IMPACT.cost, 0)}**, biến động giảm **${pct(IMPACT.stabilize, 0)}**. Gộp lại, giá trung bình một hàng không xuống dưới ${pct(IMPACT.meanRange[0], 0)} hay lên quá ${pct(IMPACT.meanRange[1], 0)}, và biến động không giảm quá ${pct(1 - IMPACT.minVol, 0)}.`,
          `Ví dụ: một gia tộc nắm ${ind("tea")} với 4 lô đang chạy có độ mạnh ${num(exStrength * 100)}%, nên giá trung bình Lá trà tươi và Trà khô bị kéo xuống ${pct(IMPACT.supply * exStrength)}.`,
          `Nếu mọi ngành đang mở đều có gia tộc chạy hết sức, lực kéo lên và kéo xuống gần bù nhau: giá trung bình mỗi hàng chỉ lệch trong khoảng ${signedPct(allMeanLow)} đến ${signedPct(allMeanHigh)}.`,
          "Tab 👑 Quản trị liệt kê tác động của các ngành gia tộc đang nắm. Người chơi trên Sàn xem được hàng nào đang bị ngành gia tộc kéo giá ở trang chi tiết mặt hàng.",
        ] },
        { table: { head: ["Ngành đang mở", "Tác động lên Sàn Nguyên Liệu", "Trọng số"], rows: impactRows() } },
        { p: "**Thuế doanh nghiệp.**" },
        { table: { head: ["Số ngành đang nắm", "Thuế suất trên doanh thu"], rows: [1, 2, 3].map((n) => [n, pct(taxRate(n))]) } },
        { list: [
          "Doanh thu chịu thuế mỗi đêm gồm: doanh thu lô dịch vụ, tiền bán hàng cho NPC và Siêu thị, tiền bán trên sàn công nghiệp trong ngày (sau phí), và phần xu thêm từ Năng lượng gió. Ngành chiến lược cũng tính là một ngành khi xét thuế suất.",
          "Thuế trừ thẳng vào quỹ; một nửa tiền thuế vào ngân sách thị trấn.",
          `Cuối mỗi tháng gia tộc được **hoàn ${pct(CLAN.refundRate, 0)}** số thuế đã nộp trong tháng (không quá số tiền ngân sách đang có).`,
          "Tộc trưởng tự khai phần doanh thu chịu thuế ở tab **🧾 Thuế** (mặc định 100%); tab này có sổ thuế 14 ngày.",
        ] },
        { p: `**Gửi quỹ kỳ hạn.** Ở tab **👑 Quản trị**, tộc trưởng gửi một phần quỹ vào ngân hàng có kỳ hạn, tối thiểu **${num(CLAN_BANK.minDeposit)} xu** một khoản. Lãi mỗi ngày = lãi suất cơ bản (mặc định ${pct(BANK.defaultRate)}) + phụ phí kỳ hạn + **ưu đãi gia tộc**, chốt lúc gửi; đến hạn, gốc và lãi tự về quỹ lúc nửa đêm.` },
        { table: { head: ["Kỳ hạn", "Phụ phí kỳ hạn", "Ưu đãi gia tộc", "Lãi khi lãi cơ bản là " + pct(BANK.defaultRate)], rows: termRows() } },
        { table: { head: ["Rút", "Nhận về quỹ", "Mất"], rows: [
          ["Đúng hạn", "Gốc + lãi", "Không mất gì"],
          ["Tộc trưởng rút gấp trước hạn", `Gốc trừ ${pct(CLAN_BANK.earlyPenalty, 0)}`, `Toàn bộ lãi và ${pct(CLAN_BANK.earlyPenalty, 0)} gốc`],
          ["Hệ thống tự rút gấp (quỹ không đủ trả phí duy trì, thuế, hoặc gia tộc giải tán)", `Gốc trừ ${pct(CLAN_BANK.emergencyPenalty, 0)}`, `Toàn bộ lãi và ${pct(CLAN_BANK.emergencyPenalty, 0)} gốc`],
          ["Thu hồi bắt buộc (nộp phạt Đấu trường, bị truy thu thuế)", "Gốc", "Toàn bộ lãi"],
        ] } },
        { p: `**Ví dụ minh họa.** Gửi ${num(DEP.amount)} xu kỳ hạn ${DEP.term} ngày khi lãi cơ bản ${pct(BANK.defaultRate)}: lãi ${pct(depRate, 2)}/ngày, đáo hạn về quỹ **${num(onTime.principal + onTime.interest)} xu** (lãi ${num(onTime.interest)}). Rút gấp hôm sau còn **${num(early.principal)} xu**; hệ thống tự rút thì còn ${num(emergency.principal)} xu. Một nửa tiền phạt vào ngân sách thị trấn.` },
        { p: `**Hụi lớn gia tộc.** Tộc trưởng cho gia tộc vào dây hụi với các gia tộc khác ở màn **🤝 Vay ngang hàng & Hụi**, góp bằng quỹ: mỗi kỳ ${num(HUI.clan.minAmount)}–${num(HUI.clan.maxAmount)} xu, dây ${HUI.clan.minSize}–${HUI.clan.maxSize} gia tộc. Luật bỏ thăm xem ở [Hụi](hui).` },
        { p: "**Bảng quản trị.** Tab **👑 Quản trị** chỉ hiện với tộc trưởng đương nhiệm: quỹ tiền mặt, tiền đang gửi ngân hàng, phí duy trì mỗi đêm, doanh thu và thuế 7 ngày, số thành viên; các khoản gửi kỳ hạn; tác động của các ngành đang nắm lên Sàn; danh sách người đã bị phế truất và các lần bỏ phiếu. Bảng cảnh báo khi quỹ tiền mặt sắp không đủ trả phí duy trì." },
        { p: "**Bỏ phiếu phế truất** (tab 🏯 Gia tộc):" },
        { steps: [
          `Thành viên đã ở gia tộc đủ **${CLAN_GOV.joinedHours} giờ** mở phiếu và đề cử một thành viên khác lên thay. Gia tộc cần ít nhất **${CLAN_GOV.minMembers} người**; người mở phiếu tự tính một phiếu thuận.`,
          `Phiếu mở **${CLAN_GOV.voteHours} giờ**. Mọi thành viên trừ tộc trưởng được bỏ phiếu thuận hoặc chống, đổi được tới khi phiếu đóng.`,
          "Thông qua ngay khi số phiếu thuận **quá nửa** số người được bầu. Phiếu khép sớm nếu không thể đủ thuận nữa, hoặc khi hết giờ.",
          "Thông qua: tộc trưởng cũ thành thành viên thường, người được đề cử lên làm tộc trưởng, Báo đăng tin.",
          `Không thành: ${CLAN_GOV.cooldownDays} ngày sau mới mở phiếu mới được. Tộc trưởng nhường chức hay rời gia tộc giữa chừng thì phiếu bị hủy.`,
        ] },
        { p: `Ví dụ gia tộc ${VOTERS + 1} người: ${VOTERS} người được bầu, cần **${need} phiếu thuận** để thông qua. Mới có 3 thuận mà đã 4 chống thì phiếu khép ngay vì không thể đủ ${need}.` },
      ],
    },
    {
      id: "sieu-thi",
      title: "Bán hàng thiết yếu cho Siêu thị",
      blocks: [
        { p: `Siêu thị mua hai mặt hàng công nghiệp nhẹ của gia tộc để bán lại cho người chơi: **${goodsInd[food.good].icon} ${goodsInd[food.good].name}** (1 đơn vị = ${food.perUnit} ${food.unit} 🍱 Suất ăn gia tộc, làm ở ${ind(food.industry)} dây chuyền Thực phẩm chế biến) và **${goodsInd[care.good].icon} ${goodsInd[care.good].name}** (1 đơn vị = ${care.perUnit} ${care.unit} 🧴 Bộ chăm sóc gia tộc, làm ở ${ind(care.industry)}).` },
        { list: [
          `**Sổ chào giá** (tab 🏭 Sản xuất & Kho): đặt lệnh bán hàng trong kho ở ${pct(ESSENTIALS.askMin, 0)}–${pct(ESSENTIALS.askMax, 0)} giá tham chiếu. Nửa đêm Siêu thị khớp từ giá thấp lên; cùng giá thì hàng chất lượng cao hơn, rồi lệnh đặt trước, được mua trước. Đặt lệnh thì mặt hàng tự chuyển sang Giữ trong kho.`,
          "Sau sổ chào giá, Siêu thị mới mua hàng vừa làm ra trong đêm (phần không giữ trong kho) theo 100% giá tham chiếu, rồi phần thừa mới bán NPC.",
          `Mỗi gia tộc bán tối đa **${pct(ESSENTIALS.perClanShare, 0)}** lượng Siêu thị thu mua của một đêm. Tiền bán tính vào doanh thu chịu thuế như giao dịch trên sàn.`,
          `Hàng được chia theo ba hạng: ${ESSENTIALS.qualities.map((q) => `${q.name} ×${mult(q.mult)}`).join(", ")}. Hệ số hạng nhân giá Siêu thị trả gia tộc, giá bán cho người chơi, hiệu ứng và XP của món.`,
          `**Điểm chất lượng** = ${pct(ESSENTIALS.qualityWeights.level, 0)} theo cấp gia tộc + ${pct(ESSENTIALS.qualityWeights.design, 0)} theo số mảnh của nhà xưởng đẹp nhất (đủ 20 mảnh là tối đa) + ${pct(ESSENTIALS.qualityWeights.upstream, 0)} nếu gia tộc có lô đang chạy ngành nguyên liệu (${ind("agriculture")} cho đồ ăn; ${ind("agriculture")}, hoặc ${ind("petrochem")} dây chuyền Hóa chất khi công nghiệp nặng mở, cho đồ chăm sóc). Phần Tuyệt hảo = 35% × điểm, Ngon = 20% + 40% × điểm, còn lại là Thường.`,
        ] },
        { p: `**Ví dụ minh họa.** Gia tộc cấp 5, nhà xưởng 12 mảnh, có lô ${ind("agriculture")}: điểm chất lượng ${num(score * 100)}%, nên khoảng ${pct(split[2], 0)} hàng Tuyệt hảo, ${pct(split[1], 0)} Ngon, ${pct(split[0], 0)} Thường, bình quân ×${mult(Math.round(avgMult * 100) / 100)}. Giá tham chiếu ${goodsInd[food.good].name} khi cầu và pha bình thường là ${num(ref)} xu; một lệnh chào ở ${pct(ASK, 0)} bán được bình quân khoảng **${num(ref * ASK * avgMult)} xu** mỗi đơn vị. Người chơi mua một Suất ăn gia tộc hạng Thường giá ${num(clanItemPrice("food", ref, 0))} xu, hạng Tuyệt hảo ${num(clanItemPrice("food", ref, 2))} xu.` },
        { p: "Hàng gia tộc ở Siêu thị càng nhiều thì đồ ăn và đồ chăm sóc NPC càng bị giới hạn, ít XP và đắt hơn. Xem [Siêu thị](sieu-thi)." },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { list: [
          `**Quỹ cạn.** Quỹ tiền mặt không đủ trả phí duy trì hay thuế thì hệ thống tự rút gấp tiền gửi kỳ hạn (mất lãi và ${pct(CLAN_BANK.emergencyPenalty, 0)} gốc, khoản sắp đáo hạn bị rút trước, Báo đăng tin). Vẫn không đủ phí duy trì thì gia tộc mất 1 XP cho mỗi ${num(CLAN_XP.perUpkeep)} xu phí; mất XP có thể làm gia tộc tụt cấp.`,
          "**Phí duy trì trả mỗi đêm** bất kể đêm đó thu được bao nhiêu; pha kinh tế, thời tiết và cầu ngành làm doanh thu lên xuống (xem [Kinh tế vĩ mô](kinh-te-vi-mo)).",
          "**Khai thiếu doanh thu là trốn thuế.** Phần khai thiếu được ghi vào hồ sơ mà gia tộc không thấy; ban quản lý, hoặc gia tộc nắm Thuế vụ, có thể truy thu phần thuế trốn kèm tiền phạt, lấy từ quỹ, quỹ thiếu thì thu hồi tiền gửi kỳ hạn (chỉ trả gốc, mất lãi). Hoàn thuế cuối tháng chỉ tính trên số thuế thật sự đã nộp.",
          "**Mất đất, mất ghế.** Lô đất và ghế ngành chiến lược có thể bị gia tộc khác giành mất qua [Đấu trường](dau-truong); phạt Đấu trường cũng thu từ quỹ và tiền gửi kỳ hạn.",
          `**Bán lại đất** chỉ được ${pct(CLAN.land.resaleRate, 0)} giá trị lô và công trình trên lô bị xóa.`,
          `**Hụi lớn**: tới kỳ mà quỹ không đủ tiền góp thì gia tộc bị loại khỏi dây, không hoàn số đã góp.`,
          "**Giải tán.** Tộc trưởng rời đi mà không còn ai đủ quyền lên thay (người cuối cùng, hoặc những người còn lại đều từng bị phế truất) thì gia tộc giải tán: tiền gửi bị rút gấp về quỹ, **đất trả về Sở Nhà Đất không được đồng nào**, ngành bị gỡ, trận Đấu trường đang chờ bị hủy, lệnh chào giá Siêu thị bị bỏ, quỹ còn lại về ngân sách thị trấn, mọi thành viên còn lại được tự do.",
          "**Phế truất là vĩnh viễn**: người bị phế truất không bao giờ được làm tộc trưởng hay trưởng lão lại trong gia tộc đó, không vào được bảng Quản trị và không cho gia tộc chơi hụi được nữa.",
          `**Công nghiệp nặng** (${heavyNames}) đóng hay mở do ban quản lý quyết định. Khi đóng chỉ phí thâu tóm được hoàn; xu đã chi cho đất, công trình và hàng trong kho thì không.`,
        ] },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { tip: "Bảng Quản trị có ô Phí duy trì/đêm. So con số đó với tiền mặt trong quỹ thường xuyên." },
        { tip: "Thuế suất tăng theo số ngành, phí thâu tóm từ ngành thứ hai cũng nhân lên. Thêm một ngành không chỉ thêm doanh thu." },
        { tip: "Điểm chất lượng hàng Siêu thị có ba phần; không phần nào bắt buộc, nhưng mỗi phần đều đổi tỉ lệ hạng." },
        { tip: "Độ mạnh ngành trên Sàn tính theo số lô của mọi gia tộc trong ngành, không chỉ của riêng bạn." },
      ],
    },
  ],
};
