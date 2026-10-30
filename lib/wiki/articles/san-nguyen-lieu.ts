import type { WikiArticle } from "../types";
import { UNLOCKS } from "../rules";
import { COMMODITY_COUNT, commodityRows, freshnessRows } from "../game-data";
import { num, pct } from "./money";
import { LOT, MARKET, REGIMES, fillPrice, townNpcLots } from "@/petdex/server/rules/market.js";

// Sàn Nguyên Liệu (petdex/server/market.js). Mọi con số đọc từ luật thuần petdex/server/rules/market.js.

type Regime = { name: string; trend: number; vol: number; weight: number };
const M = MARKET as typeof MARKET & Record<string, number>;
const regimes = Object.values(REGIMES as Record<string, Regime>);
const minutes = (ms: number) => ms / 60_000;
const hours = (ms: number) => ms / 3_600_000;
const signed = (x: number) => (x ? `${x > 0 ? "+" : "−"}${pct(Math.abs(x), 0)}/ngày` : "Không");
const warehouse = MARKET.warehouse as { lots: number; price: number }[];

// Ví dụ trượt giá (số trung tính): mua 20 lô hàng thô với hệ thống khi giá chào là 100 xu/lô.
const EX = { lots: 20, quote: 100 };
const exFill = fillPrice(EX.quote, EX.lots, "buy");

export const article: WikiArticle = {
  slug: "san-nguyen-lieu",
  title: "Sàn Nguyên Liệu",
  category: "kinh-te",
  emoji: "📈",
  summary: `${COMMODITY_COUNT} mặt hàng thô và chế biến, giá chạy mỗi ${minutes(MARKET.tickMs)} phút, lệnh thị trường và lệnh giới hạn, hạn mức với hệ thống, phí ${pct(MARKET.fee, 1)}, kho, độ tươi và sổ lãi lỗ.`,
  keywords: ["sàn", "chợ", "giá", "mua bán", "lô", "lệnh", "lệnh giới hạn", "kho", "đầu cơ", "nguyên liệu", "độ tươi", "hạn mức", "lãi lỗ"],
  related: ["vuon", "khu-cong-nghiep", "quay-tra-sua", "bep", "kinh-te-vi-mo", "thue-toa-thi-chinh"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: "Sàn Nguyên Liệu là chợ hàng hóa của thị trấn: lá trà, sữa, sắn, mía, trái cây, cá, thịt và các hàng chế biến từ chúng. Bạn mua bán với **hệ thống** (giá niêm yết) hoặc với **người chơi khác** (qua lệnh giới hạn). Hàng mua về nằm trong **kho của bạn**, chính là kho mà [Quầy trà sữa](quay-tra-sua), [Khu công nghiệp](khu-cong-nghiep), [Bếp](bep), [Vườn](vuon) và hợp đồng cung ứng dùng chung." },
        { p: `Mở ở **cấp ${UNLOCKS.market}**. Giá niêm yết theo **lô** (1 lô = ${LOT} phần).` },
        { img: { src: "/petfarm/market.webp", alt: "Sàn Nguyên Liệu: bảng giá các mặt hàng và biểu đồ giá sữa tươi trong 24 giờ", width: 1600, height: 1075 } },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { p: "**Mặt hàng.** Giá gốc là mốc mà giá trung bình xoay quanh; hàng chế biến làm từ hàng thô ở xưởng." },
        { table: { head: ["Mặt hàng", "Loại", "Giá gốc/lô", "Hạn dùng", "Làm từ"], rows: commodityRows() } },

        { p: "**Giá chạy thế nào.**" },
        { list: [
          `Giá cập nhật mỗi **${minutes(MARKET.tickMs)} phút** và luôn bị kéo dần về giá trung bình của mặt hàng.`,
          "Giá trung bình của hàng thô = giá gốc × chỉ số giá của Ngân hàng Trung ương × độ trôi dài hạn riêng của mặt hàng × tác động của tin tức. Hàng chế biến thì giá trung bình chạy theo giá hiện tại của nguyên liệu làm ra nó.",
          `Độ trôi dài hạn đi ngẫu nhiên trong khoảng ${num(M.driftMin, 1)}–${num(M.driftMax, 1)} lần.`,
          `Giá niêm yết gồm **${pct(1 - M.playerWeight, 0)} luật thị trường** và **${pct(M.playerWeight, 0)} lực mua bán của người chơi**: mỗi lần khớp với hệ thống dồn thêm "áp lực" lên giá (mua đẩy lên, bán kéo xuống), áp lực tự phai, giảm một nửa sau ${hours(M.pressureHalfLifeMs)} giờ.`,
          `Giá không xuống dưới ${num(M.floor, 2)} lần và không vượt ${num(M.ceiling)} lần giá gốc. Hàng có hạn dùng có giá sàn cao hơn: ${num(M.freshFloor, 1)} lần giá gốc.`,
          "Các ngành của gia tộc đang chạy cũng kéo giá trung bình của một số mặt hàng lên hoặc xuống và làm giá bớt biến động (xem [Gia tộc](gia-toc)).",
        ] },
        { p: `**Pha thị trường ẩn.** Mỗi mặt hàng thô có một pha mà người chơi không thấy, đổi bất chợt, trung bình ${M.regimeHours} giờ một lần:` },
        { table: { head: ["Pha", "Kéo giá trung bình", "Biến động", "Khả năng rơi vào khi đổi pha"], rows: regimes.map((r) => [r.name, signed(r.trend), `×${num(r.vol, 1)}`, pct(r.weight, 0)]) } },
        { list: [
          `**Sốt giá hoặc sập giá**: mỗi mặt hàng thô trung bình ${num(M.jumpsPerDay, 1)} lần mỗi ngày, giá nhảy ${pct(M.jumpMin, 0)}–${pct(M.jumpMax, 0)} tức thì, kèm tin ⚡ trên Báo.`,
          `**Tin tức**: khoảng ${num(M.newsPerDay, 1)} tin mỗi ngày cho một mặt hàng, lên Báo trước ${minutes(M.newsLeadMs)} phút rồi làm giá dịch chuyển trong vài giờ.`,
        ] },

        { p: `**Đặt lệnh.** Mỗi lệnh từ 0,1 tới ${M.maxOrderLots} lô.` },
        { list: [
          `**Lệnh thị trường** khớp ngay. **Lệnh giới hạn** đặt giá trong khoảng ±${pct(M.band, 0)} giá hiện tại; phần chưa khớp nằm chờ tới hết ngày rồi tự hủy. Lệnh mua chờ giữ trước số xu (cả phí), lệnh bán chờ giữ hàng; hủy lệnh thì nhận lại.`,
          `Lệnh khớp trước với lệnh chờ của người chơi khác nếu giá đó tốt hơn giá hệ thống (chỉ những lệnh chờ trong khoảng ±${pct(M.matchBand, 0)} giá hiện tại), phần còn lại khớp với hệ thống.`,
          `Hệ thống bán ở giá niêm yết +${pct(M.spread, 0)} và mua ở −${pct(M.spread, 0)}. Lệnh càng lớn thì giá khớp bình quân càng trượt: tăng hoặc giảm ${pct(M.playerWeight, 0)} × số lô ÷ (2 × độ sâu), độ sâu là ${M.liquidity} lô với hàng thô và gấp ${M.processedDepth} với hàng chế biến.`,
          "Sau mỗi lần giá cập nhật, lệnh chờ nào chạm giá hệ thống thì tự khớp với hệ thống (trong hạn mức).",
          `**Phí giao dịch** ${pct(M.fee, 1)} mỗi lần khớp, tối thiểu 1 xu, cả khi mua lẫn bán.`,
        ] },
        { p: `Ví dụ cách tính trượt giá (số trung tính): mua ${EX.lots} lô hàng thô với hệ thống khi giá chào là ${EX.quote} xu/lô thì giá khớp bình quân là **${num(exFill, 1)} xu/lô**, trước phí.` },

        { p: "**Hạn mức với hệ thống.** Mỗi lệnh khớp với hệ thống lấy phần nhỏ hơn giữa hạn mức của bạn và phần thị trấn còn lại; hết thì chỉ còn khớp được với lệnh của người chơi khác, sang ngày mới mở lại. Bảng giao dịch hiện cả hai hạn mức." },
        { table: { head: ["Hạn mức", "Con số (mỗi mặt hàng, mỗi chiều mua hoặc bán, mỗi ngày)"], rows: [
          ["Của bạn", `${M.npcDailyLots} lô`],
          ["Cả thị trấn", `Lớn hơn giữa ${M.townBaseLots} lô và ${M.townLotsPerTrader} lô × số người đã giao dịch với hệ thống trong 7 ngày; hàng chế biến ×${M.processedDepth} (ví dụ 30 người: ${num(townNpcLots("milk", 30))} lô hàng thô)`],
        ] } },

        { p: "**Kho.** Sức chứa tính cả phần giữ chỗ cho lệnh mua đang chờ. Mở rộng kho trả một lần, giữ mãi." },
        { table: { head: ["Kho", "Giá mở rộng"], rows: warehouse.map((w) => [`${num(w.lots)} lô`, w.price ? `${num(w.price)} xu` : "Có sẵn"]) } },

        { p: "**Độ tươi.** Hàng có hạn dùng mất dần độ tươi theo phần hạn dùng đã trôi qua. Hệ thống mua hàng kém tươi rẻ hơn (lệnh bán chờ cũng khớp với hệ thống theo giá đã ép):" },
        { table: { head: ["Độ tươi", "Khi đã dùng", "Hệ thống trả"], rows: freshnessRows() } },

        { p: "**Sổ lãi lỗ.** Mỗi mặt hàng trong kho ghi **giá vốn trung bình** mỗi lô (đã tính phí), số tiền nếu bán ngay và lãi lỗ chưa chốt. Mỗi lần bán báo lãi hoặc lỗ so với giá vốn; Sổ lãi lỗ tổng hợp vốn đang nằm trong kho, lãi lỗ đã chốt hôm nay và 7 ngày, tỉ lệ lần bán có lãi và các lệnh khớp gần nhất." },
        { p: "**Thuế và thưởng.** Lãi khi bán (so với giá vốn) là thu nhập chịu [thuế thu nhập](thue-toa-thi-chinh). Dòng **Thu nhập giao dịch** trên [trang phục](trang-phuc) cho thêm xu mỗi lần bán." },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { warn: "Lô quá hạn dùng tự mất khỏi kho." },
        { list: [
          `Giá có thể sập ${pct(M.jumpMin, 0)}–${pct(M.jumpMax, 0)} trong một lần cập nhật, và pha ẩn có thể kéo giá trung bình đi xa nhiều ngày.`,
          "Phí và chênh mua bán ăn vào mỗi vòng mua rồi bán lại.",
          "Lệnh lớn trượt giá, và chính lệnh của bạn đẩy giá đi ngược ý mình.",
          "Hạn mức chung của thị trấn có thể cạn trước hạn mức riêng của bạn; khi đó lệnh thị trường không khớp với hệ thống.",
          "Lệnh giới hạn chưa khớp tự hủy lúc hết ngày.",
          "Hàng kém tươi bán cho hệ thống bị ép giá.",
        ] },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { tip: "Tin tức lên Báo trước khi giá chạy. Đọc Báo cùng lúc với biểu đồ." },
        { tip: "Pha thị trường không hiện ra, nhưng biểu đồ để lại dấu vết của nó." },
        { tip: "Hạn dùng là đồng hồ đếm ngược trên mọi lô hàng tươi trong kho. Tính nó vào trước khi mua nhiều." },
      ],
    },
  ],
};
