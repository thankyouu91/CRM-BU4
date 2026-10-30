import type { WikiArticle } from "../types";
import { CLAN } from "../rules";
import { MACRO, servicePlotRevenue, weatherChance } from "../rules-macro";
import { INDUSTRY_COUNT, phaseRows } from "../game-data";
import { CLIMATES, INDUSTRIES, PHASES, PHASE_NEXT, PLOTS, WEATHER, ZONES } from "@/public/ta-tua/game/js/shared/clan.js";
import { COMMODITIES } from "@/petdex/server/rules/market.js";
import { BANK, policy } from "@/petdex/server/rules/bank.js";

// Kinh tế vĩ mô: pha, thời tiết, cầu từng ngành và chỉ số giá đất (petdex/server/macro.js), và chúng chạm vào
// đâu: doanh thu lô gia tộc (clans.js plotRevenue), giá tham chiếu hàng công nghiệp (industry.js refPrice), tin
// trên Sàn Nguyên Liệu (macro.js write → market.js), khách quầy trà sữa (town.js trafficBonus).

type Named = { name: string; icon: string };
type Phase = Named & { factor: number; land: number; traffic: number };
type Weather = Named & { zones: Record<string, number>; climates: Record<string, number>; news: Record<string, number>; weight: number };
const phases = PHASES as Record<string, Phase>;
const weathers = WEATHER as Record<string, Weather>;
const zones = ZONES as Record<string, Named>;
const climates = CLIMATES as Record<string, Named>;
const goods = COMMODITIES as Record<string, Named>;
const industries = INDUSTRIES as unknown as Record<string, Named & { sector: string; commodities: string[] }>;

const num = (n: number, digits = 0) => n.toLocaleString("vi-VN", { maximumFractionDigits: digits });
const pct = (x: number, digits = 1) => `${num(Math.round(x * 100 * 10 ** digits) / 10 ** digits, digits)}%`;
const signed = (x: number, digits = 1) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${pct(Math.abs(x), digits)}`;
const phaseName = (id: string) => `${phases[id].icon} ${phases[id].name}`;
const good = (id: string) => `${goods[id].icon} ${goods[id].name}`;

/** Each phase: where it can go each day, how long it lasts on average, the GDP shown. */
const transitionRows = () =>
  Object.keys(phases).map((id) => {
    const next = Object.entries((PHASE_NEXT as Record<string, Record<string, number>>)[id] ?? {});
    const leave = next.reduce((s, [, p]) => s + p, 0);
    return [phaseName(id), next.map(([to, p]) => `${phaseName(to)} ${pct(p, 0)}`).join(", "), `khoảng ${num(1 / leave, 1)} ngày`, signed(MACRO.gdp[id])];
  });

const weatherRows = () =>
  Object.entries(weathers).map(([id, w]) => [
    `${w.icon} ${w.name}`,
    pct(weatherChance(id), 0),
    [...Object.entries(w.zones).map(([z, v]) => `${zones[z].name} ${signed(v, 0)}`), ...Object.entries(w.climates).map(([c, v]) => `${climates[c].name} ${signed(v, 0)}`)].join(", ") || "Không ảnh hưởng",
    Object.entries(w.news).map(([g, v]) => `${good(g)} ${signed(v, 0)}`).join(", ") || "Không có tin",
  ]);

const serviceWithGoods = Object.values(industries).filter((i) => i.sector === "service" && i.commodities.length);
const halfLife = Math.log(0.5) / Math.log(MACRO.demand.keep);
const resaleBreakEven = 1 / CLAN.land.resaleRate - 1;
const rateLow = policy({ growth: 10, priceIndex: 1 }).baseRate;
const rateHigh = policy({ growth: -10, priceIndex: 1 }).baseRate;
const landPerRate = MACRO.land.rateWeight * 0.001; // mỗi 0,1 điểm lãi suất
const recessionDays = 1 / Object.values((PHASE_NEXT as Record<string, Record<string, number>>).recession).reduce((s, p) => s + p, 0);
const minWeather = 0.3; // shared/clan.js weatherFactor: không thấp hơn 30%

// Ví dụ: một lô ven biển nhiều nắng làm Thủy hải sản, gia tộc cấp 3, công trình 10 mảnh, chỉ một gia tộc trong ngành.
const PLOT = PLOTS.find((p) => p.zone === "coast" && p.climate === "sunny")! as { code: string; zone: string; climate: string; basePrice: number; prod: number };
const DESIGN = [{ piece: "base-3" }, ...Array.from({ length: 9 }, () => ({ piece: "wall_brick-8" }))];
const good_ = { phase: "boom", weather: "calm", demand: 1.1 };
const bad = { phase: "recession", weather: "storm", demand: 0.9 };
const run = (m: typeof good_) => servicePlotRevenue(PLOT, { industry: "fishery", design: DESIGN, level: 3, clans: 1, ...m });
const GOOD = run(good_);
const BAD = run(bad);
const TAX = CLAN.baseTax;
const x = (v: number) => `×${num(v, 3)}`;

export const article: WikiArticle = {
  slug: "kinh-te-vi-mo",
  title: "Kinh tế vĩ mô",
  category: "kinh-te",
  emoji: "🌦️",
  summary: "Pha kinh tế, thời tiết, cầu từng ngành và chỉ số giá đất đổi mỗi nửa đêm, làm doanh thu gia tộc, giá hàng công nghiệp, giá trên Sàn, giá đất và khách quầy trà sữa lên xuống.",
  keywords: ["vĩ mô", "pha", "chu kỳ", "suy thoái", "tăng trưởng nóng", "đỉnh chu kỳ", "phục hồi", "thời tiết", "bão", "cầu", "cú sốc", "giá đất", "chỉ số giá đất", "GDP", "tăng trưởng", "giá tham chiếu", "lãi suất"],
  related: ["gia-toc", "so-nha-dat", "san-nguyen-lieu", "quay-tra-sua", "ngan-hang", "so-cong-thuong", "sieu-thi"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: "Kinh tế vĩ mô là \"thời tiết chung\" của cả thị trấn. Mỗi nửa đêm, lúc đóng sổ ngày cũ, game tạo sẵn tình hình của ngày mới gồm bốn chỉ số: **pha kinh tế**, **thời tiết**, **cầu của từng ngành** và **chỉ số giá đất**. Cả ngày hôm đó dùng chung một bộ số này." },
        { list: [
          "Xem ở tab **📊 Vĩ mô** trong màn **🏯 Gia tộc & Sở Nhà Đất**. Ai cũng xem được, không cần vào gia tộc, không cần cấp nào.",
          `Tab Vĩ mô có biểu đồ chỉ số giá đất 14 ngày (dải màu bên dưới là pha của từng ngày) và cầu hôm nay của ${INDUSTRY_COUNT} ngành.`,
          "Thời tiết và các cú sốc cầu được đăng lên **Báo Trân Châu** ngay đầu ngày.",
          "Bạn không điều khiển được các chỉ số này; chỉ đọc chúng và quyết định việc làm ăn của mình.",
        ] },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { p: "**Pha kinh tế.** Nền kinh tế đi theo vòng Phục hồi → Tăng trưởng nóng → Đỉnh chu kỳ → Suy thoái → Phục hồi. Mỗi ngày có một xác suất chuyển pha; riêng Đỉnh chu kỳ có thể bùng lại thành Tăng trưởng nóng thay vì đi xuống. Pha không báo trước khi đổi." },
        { table: { head: ["Pha", "Doanh thu và sản lượng lô", "Giá đất mỗi ngày", "Khách quầy trà sữa"], rows: phaseRows() } },
        { table: { head: ["Pha", "Mỗi ngày có thể chuyển sang", "Kéo dài trung bình", "Tăng trưởng (năm) hiển thị"], rows: transitionRows() } },
        { p: `**Thời tiết.** Mỗi ngày bốc thăm một kiểu thời tiết, không phụ thuộc hôm qua. Thời tiết nhân sản lượng các lô đất theo địa hình và khí hậu của lô (cộng dồn, nhưng hệ số không thấp hơn ${pct(minWeather, 0)}), và đăng tin kéo giá trung bình một số nguyên liệu trên [Sàn Nguyên Liệu](san-nguyen-lieu) trong ngày đó.` },
        { table: { head: ["Thời tiết", "Khả năng", "Sản lượng lô", "Tin trên Sàn (giá trung bình)"], rows: weatherRows() } },
        { p: `**Cầu từng ngành.** Mỗi ngành trong ${INDUSTRY_COUNT} ngành có một mức cầu quanh 100%. Cầu cao thì lô dịch vụ của ngành thu nhiều xu hơn và hàng do ngành làm ra có giá tham chiếu cao hơn.` },
        { table: { head: ["Luật", "Con số"], rows: [
          ["Kéo về 100%", `mỗi ngày phần chênh so với 100% còn lại ${pct(MACRO.demand.keep, 0)}, cộng một bước ngẫu nhiên cỡ ±${pct(MACRO.demand.noise, 0)}`],
          ["Cú sốc cầu", `mỗi ngành mỗi ngày có ${pct(MACRO.demand.shockChance, 0)} khả năng bị sốc, tăng hoặc giảm ${pct(MACRO.demand.shockMin, 0)}–${pct(MACRO.demand.shockMax, 0)}`],
          ["Giới hạn", `${pct(MACRO.demand.min, 0)} đến ${pct(MACRO.demand.max, 0)}`],
          ["Cú sốc phai bớt một nửa sau", `khoảng ${num(halfLife, 0)} ngày`],
        ] } },
        { list: [
          `Với ${INDUSTRY_COUNT} ngành, trung bình mỗi ngày có khoảng ${num(INDUSTRY_COUNT * MACRO.demand.shockChance, 0)} ngành gặp cú sốc. Báo đăng tin "Cầu ngành ... tăng vọt / sụt giảm ...%". Ngành đang tạm đóng (công nghiệp nặng) vẫn có cầu và vẫn có tin.`,
          `Cú sốc của ngành dịch vụ có hàng trên Sàn (${serviceWithGoods.map((i) => `${i.icon} ${i.name}`).join(", ")}) kéo giá trung bình các hàng đó trong ngày bằng **${pct(MACRO.demand.newsShare, 0)}** con số trên tin: cầu Thủy hải sản tăng 16% thì giá cá được kéo lên 8%.`,
          "Cú sốc của ngành sản xuất và ngành chiến lược chỉ có tin, không kéo giá trên Sàn Nguyên Liệu. Với ngành sản xuất, mức cầu mới làm giá tham chiếu hàng của ngành đổi theo.",
        ] },
        { p: `**Chỉ số giá đất.** Bắt đầu ở 1. Mỗi ngày chỉ số nhân thêm (1 + độ trôi), với độ trôi = mức của pha (bảng pha ở trên) − (lãi suất cơ bản − ${pct(MACRO.land.neutralRate)}) × ${num(MACRO.land.rateWeight)} + một bước ngẫu nhiên cỡ ±${pct(MACRO.land.noise)}. Chỉ số luôn nằm trong khoảng **${num(MACRO.land.min, 1)} đến ${num(MACRO.land.max, 1)}**.` },
        { list: [
          `**Lãi suất kéo giá đất**: lãi suất cơ bản của [Ngân hàng](ngan-hang) (mặc định ${pct(BANK.defaultRate)}/ngày, Ngân hàng Trung ương chỉnh trong khoảng ${pct(rateLow, 2)}–${pct(rateHigh)}/ngày). Mỗi 0,1 điểm lãi suất trên mức ${pct(MACRO.land.neutralRate)} bớt ${pct(landPerRate)} độ trôi giá đất mỗi ngày; dưới mức đó thì cộng thêm.`,
          "**Lô còn trống**: giá Sở Nhà Đất bán = giá gốc của lô × hệ số khan hiếm (đất bán càng nhiều càng đắt) × chỉ số giá đất hôm nay.",
          "**Lô đã mua**: giá trị = giá đã mua × phần tăng giá riêng của lô theo tháng × (chỉ số hôm nay ÷ chỉ số lúc mua).",
          `Bán lại cho Sở Nhà Đất được **${pct(CLAN.land.resaleRate, 0)}** giá trị hiện tại (xem [Sở Nhà Đất và sản xuất](so-nha-dat)).`,
        ] },
        { p: `**Tăng trưởng (năm).** Con số trên tab Vĩ mô = mức của pha (bảng chuyển pha ở trên) cộng một bước ngẫu nhiên cỡ ±${pct(MACRO.gdpNoise)}. Con số này chỉ để đọc tình hình, không làm thay đổi tiền của ai.` },
      ],
    },
    {
      id: "tac-dong",
      title: "Mỗi chỉ số chạm vào đâu",
      blocks: [
        { table: { head: ["Chỉ số", "Chạm vào", "Cách tính"], rows: [
          ["Pha", "Lô dịch vụ của gia tộc", "Doanh thu nhân hệ số của pha"],
          ["Pha", "Lô sản xuất của gia tộc", "Sản lượng nhân hệ số của pha, **và** giá tham chiếu hàng công nghiệp cũng nhân hệ số đó"],
          ["Pha", "[Quầy trà sữa](quay-tra-sua)", "Lượng khách muốn mua cộng thêm (hoặc bớt) phần % của pha, cả ngày"],
          ["Pha, lãi suất", "Giá đất", "Chỉ số giá đất trôi mỗi ngày như trên"],
          ["Thời tiết", "Mọi lô đang chạy", "Sản lượng nhân hệ số thời tiết theo địa hình, khí hậu"],
          ["Thời tiết", "[Sàn Nguyên Liệu](san-nguyen-lieu)", "Tin trong ngày kéo giá trung bình của vài nguyên liệu; giá trên Sàn dịch dần về đó"],
          ["Cầu ngành", "Lô dịch vụ của ngành đó", "Doanh thu nhân mức cầu"],
          ["Cầu ngành", "Hàng công nghiệp do ngành đó làm ra", "Giá tham chiếu = giá gốc × cầu × hệ số pha; từ đó ra giá NPC thu mua, giá nhập khẩu, khung giá sàn công nghiệp và giá Siêu thị trả gia tộc"],
          ["Cầu ngành", "Sàn Nguyên Liệu", `Cú sốc của ngành dịch vụ kéo giá hàng của ngành bằng ${pct(MACRO.demand.newsShare, 0)} cú sốc`],
          ["Giá tham chiếu", "[Siêu thị](sieu-thi)", "Giá Suất ăn gia tộc và Bộ chăm sóc gia tộc theo giá tham chiếu hôm nay của Thực phẩm chế biến và Thuốc"],
        ] } },
        { p: `Doanh thu một đêm của một lô dịch vụ = giá gốc của lô × ${pct(CLAN.land.yieldRate)} × (1 + tốc độ của lô) × độ hợp đất × thời tiết × pha × cầu × cạnh tranh × cấp gia tộc × công trình. Lô chỉ có doanh thu khi công trình đã hoàn chỉnh.` },
        { p: `**Ví dụ minh họa công thức.** Lô **${PLOT.code}** (${zones[PLOT.zone].name}, ${climates[PLOT.climate].name}, giá gốc ${num(PLOT.basePrice)} xu) làm ${industries.fishery.icon} Thủy hải sản; gia tộc cấp 3, công trình 10 mảnh, chưa gia tộc nào khác cùng ngành. Cùng lô ấy ở hai bộ chỉ số khác nhau:` },
        { table: { head: ["Hệ số", `${phaseName(good_.phase)}, ${weathers[good_.weather].name}, cầu ${pct(good_.demand, 0)}`, `${phaseName(bad.phase)}, ${weathers[bad.weather].name}, cầu ${pct(bad.demand, 0)}`], rows: [
          [`Doanh thu gốc (giá lô × ${pct(CLAN.land.yieldRate)})`, `${num(GOOD.factors.base)} xu`, `${num(BAD.factors.base)} xu`],
          ["Tốc độ lô × hợp đất × cấp × công trình", x(GOOD.factors.prod * GOOD.factors.env * GOOD.factors.level * GOOD.factors.building), x(BAD.factors.prod * BAD.factors.env * BAD.factors.level * BAD.factors.building)],
          ["Thời tiết", x(GOOD.factors.weather), x(BAD.factors.weather)],
          ["Pha", x(GOOD.factors.phase), x(BAD.factors.phase)],
          ["Cầu ngành", x(GOOD.factors.demand), x(BAD.factors.demand)],
          ["**Doanh thu đêm đó**", `**${num(GOOD.revenue)} xu**`, `**${num(BAD.revenue)} xu**`],
          [`Sau thuế ${pct(TAX, 0)} (gia tộc một ngành)`, `${num(Math.round(GOOD.revenue * (1 - TAX)))} xu`, `${num(Math.round(BAD.revenue * (1 - TAX)))} xu`],
        ] } },
        { p: "Ở tab **🗺️ Bản đồ đất**, bấm một lô rồi chọn **Xem trước với ngành** để thấy doanh thu ước tính theo các chỉ số của hôm nay." },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { list: [
          `**Pha đổi không báo trước.** Suy thoái nhân doanh thu, sản lượng và giá tham chiếu hàng công nghiệp với ×${num(phases.recession.factor, 2)}, kéo dài trung bình khoảng ${num(recessionDays, 1)} ngày, và bớt ${pct(Math.abs(phases.recession.traffic), 0)} khách quầy trà sữa.`,
          `**Thời tiết xấu** có thể kéo sản lượng một lô xuống tới ${pct(minWeather, 0)}. Lô trên biển và ven biển chịu ${weathers.storm.icon} ${weathers.storm.name} nặng nhất.`,
          `**Cầu sụt** có thể xuống tới ${pct(MACRO.demand.min, 0)}, làm doanh thu lô dịch vụ và giá hàng của ngành giảm theo.`,
          "**Phí duy trì gia tộc không đổi theo pha**: ngày xấu thu ít hơn nhưng vẫn trả đủ phí (xem [Gia tộc](gia-toc)).",
          `**Giá đất có thể giảm**: chỉ số xuống được tới ${num(MACRO.land.min, 1)}, và lãi suất cao kéo giá đất xuống mỗi ngày. Bán lại chỉ được ${pct(CLAN.land.resaleRate, 0)} giá trị, nên giá trị lô phải tăng khoảng ${pct(resaleBreakEven, 1)} so với giá mua mới hòa vốn.`,
          "**Ban quản lý có thể ép** pha kinh tế hoặc thời tiết cho các ngày tới; khi đó tin thời tiết và lượng khách theo pha của ngày đó được thay theo.",
        ] },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { tip: "Bảng chuyển pha cho biết mỗi pha kéo dài trung bình bao lâu. Biểu đồ 14 ngày cho biết pha hiện tại đã kéo dài bao lâu rồi." },
        { tip: "Cú sốc cầu phai dần mỗi ngày. Con số cầu hôm nay và con số tuần sau thường không giống nhau." },
        { tip: "Tin thời tiết lên Báo từ đầu ngày, còn giá trên Sàn thì dịch dần. Ai đọc Báo sớm thấy trước hướng đi của giá." },
        { tip: "Lãi suất cơ bản của Ngân hàng và chỉ số giá đất có liên quan với nhau. Theo dõi cả hai cùng lúc." },
      ],
    },
  ],
};
