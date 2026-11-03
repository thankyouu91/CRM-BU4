import type { WikiArticle } from "../types";
import { UNLOCKS } from "../rules";
import { PLAYER_CAP, SHARES, SHARE_IPO_MAX, SHARE_POOL, buyCost, sellProceeds, tradeFee } from "@/public/ta-tua/game/js/shared/clan-shares.js";
import { FINANCE_TAX } from "@/public/ta-tua/game/js/shared/clan-bonds.js";

// Cổ phần gia tộc: IPO, sàn giá theo cung cầu, cổ tức, vay ký quỹ (petdex/server/clan-shares.js).
// Mọi con số đọc thẳng từ public/ta-tua/game/js/shared/clan-shares.js; tests/petfarm-wiki-sync-clan-shares.test.ts đối chiếu với code của game.

const xu = (n: number) => `${n.toLocaleString("vi-VN")} xu`;
const pct = (x: number) => `${String(+(x * 100).toFixed(2)).replace(".", ",")}%`;
const num = (n: number) => n.toLocaleString("vi-VN");

// Ví dụ quỹ khớp lệnh ngay sau IPO giá 2.000: 100 cổ phần và 200.000 xu.
const EX = { price: 2_000 };
const exCoins = SHARE_POOL * EX.price;
const buy3 = buyCost(exCoins, SHARE_POOL, 3);
const after3 = (exCoins + buy3) / (SHARE_POOL - 3);
const sell3 = sellProceeds(exCoins, SHARE_POOL, 3);
const members = SHARES.total - SHARE_IPO_MAX - SHARE_POOL;

export const article: WikiArticle = {
  slug: "co-phan-gia-toc",
  title: "Cổ phần và sàn cổ phiếu gia tộc",
  category: "kinh-te",
  emoji: "📈",
  summary: `Mỗi gia tộc có ${num(SHARES.total)} cổ phần. Lên sàn thì bán tối đa ${pct(SHARES.ipoMax)} cho người chơi; sau đó giá chạy theo cung cầu trong biên ±${pct(SHARES.band)} mỗi ngày, cổ đông nhận cổ tức khi gia tộc có lãi.`,
  keywords: ["cổ phần", "cổ phiếu", "IPO", "lên sàn", "cổ tức", "quỹ khớp lệnh", "biên độ", "ký quỹ", "margin", "giải chấp", "bảo lãnh", "mua lại", "phí môi giới"],
  related: ["thau-tom-gia-toc", "ngan-hang-gia-toc", "gia-toc", "so-cong-thuong"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: `Gia tộc có thể **lên sàn** để huy động xu từ người chơi: bán một phần cổ phần, đổi lại người mua được chia **cổ tức** khi gia tộc làm ăn có lãi và có thể bán lại cổ phần cho người khác. Mua bán ở màn **🏦 Ngân hàng → 📈 Sàn cổ phiếu gia tộc** từ **cấp ${UNLOCKS.bank}**.` },
        { p: "Sàn không có sổ lệnh: mọi lệnh khớp với **quỹ khớp lệnh** của từng gia tộc. Mua làm giá tăng, bán làm giá giảm; giá do cung cầu của chính người chơi tạo ra." },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { table: { head: ["Việc", "Ai làm", "Con số"], rows: [
          ["Lên sàn (IPO)", "Tộc trưởng", `Bán ${pct(SHARES.ipoMin)}–${pct(SHARES.ipoMax)} (tối đa ${SHARE_IPO_MAX} cổ phần) với giá cố định ${num(SHARES.ipoBand[0]).replace(".", ",")}–${num(SHARES.ipoBand[1])} lần giá trị sổ sách; mở bán ${SHARES.subscribeHours} giờ. Chỉ lên sàn một lần`],
          ["Giá trị sổ sách", "", `(Quỹ gia tộc + giá trị các lô đất) / ${num(SHARES.total)}`],
          ["Quỹ khớp lệnh", "Gia tộc góp lúc lên sàn", `${SHARE_POOL} cổ phần cùng ${SHARE_POOL} × giá IPO xu từ quỹ gia tộc`],
          ["Phần của thành viên", "Tự động lúc lên sàn", `Cổ phần còn lại (ví dụ IPO ${SHARE_IPO_MAX}: ${members} cổ phần) chia cho thành viên theo số xu đã góp quỹ`],
          ["Mua IPO", "Người chơi", `Giá IPO; tiền vào quỹ gia tộc, trừ ${pct(SHARES.underwriteFee)} phí bảo lãnh cho gia tộc nắm Ngân hàng nhà nước`],
          ["Bảo lãnh", "Ngân hàng gia tộc", `Hết ${SHARES.subscribeHours} giờ, phần chưa bán được ngân hàng mua với ${pct(SHARES.underwritePrice)} giá IPO (nếu ngân hàng đủ tiền mặt); không thì gia tộc tự giữ`],
          ["Mua / bán trên sàn", "Người chơi; tộc trưởng bằng quỹ", `Phí ${pct(SHARES.fee)} mỗi lệnh cho gia tộc nắm Ngân hàng nhà nước. Lệnh làm giá vượt ±${pct(SHARES.band)} so với giá đầu ngày bị từ chối`],
          ["Trần sở hữu", "Mỗi người chơi", `Tối đa ${PLAYER_CAP} cổ phần (${pct(SHARES.playerCap)}) của một gia tộc (phần được chia lúc lên sàn không tính vào trần, nhưng không mua thêm được khi đã vượt)`],
          ["Mua lại", "Tộc trưởng", "Mua cổ phiếu của chính gia tộc bằng quỹ: thành cổ phần tự giữ, không nhận cổ tức, có thể bán ra lại"],
          ["Cổ tức", "Tộc trưởng", `Chia đều theo cổ phần cho người chơi, gia tộc khác và ngân hàng đang giữ. Tổng cổ tức trong 7 ngày không vượt lợi nhuận 7 ngày (doanh thu − thuế − phí duy trì). Người chơi bị khấu ${pct(FINANCE_TAX.rate)} thuế lợi nhuận tài chính. Gia tộc còn nợ [trái chủ](trai-phieu) thì không chia được`],
        ] } },
        { p: `**Giá theo quỹ khớp lệnh:** quỹ giữ tích số (xu × cổ phần) không đổi. Ví dụ quỹ có ${SHARE_POOL} cổ phần và ${xu(exCoins)} (giá ${xu(EX.price)}): mua 3 cổ phần trả ${xu(buy3)} + ${xu(tradeFee(buy3))} phí, giá lên ${xu(Math.round(after3))}; bán 3 cổ phần thì nhận ${xu(sell3)} trừ ${xu(tradeFee(sell3))} phí. Lệnh càng lớn so với quỹ thì giá càng chạy xa.` },
        { p: `**Vay ký quỹ:** khi có ngân hàng gia tộc đang mở, người chơi có thể vay tới **${pct(SHARES.margin.maxLtv)}** giá trị lệnh mua, lãi mỗi ngày bằng lãi cho vay của ngân hàng (cộng vào nợ lúc nửa đêm). Cổ phần mua được bị **cầm cố**, không bán được tới khi trả hết nợ. Giá trị cổ phần cầm cố (theo giá bán vào quỹ) xuống dưới **${pct(SHARES.margin.maintenance)}** số nợ thì bị **bán giải chấp**: bán hết vào quỹ (không theo biên ngày), trả ngân hàng trước, phần dư về ví.` },
        { p: `**Công bố sở hữu:** ai nắm trên ${pct(SHARES.disclose)} cổ phần một gia tộc thì lên báo. Gia tộc nắm trên ${pct(SHARES.control)} có quyền kiểm soát, xem [Thâu tóm gia tộc](thau-tom-gia-toc).` },
        { p: "**Gia tộc giải tán:** cổ phiếu rời sàn và không còn giá trị; quỹ khớp lệnh về quỹ gia tộc (rồi cùng quỹ về ngân sách); khoản ký quỹ trên cổ phiếu đó mất trắng cho ngân hàng." },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { list: [
          "**Thanh khoản mỏng:** quỹ khớp lệnh nhỏ nên bán nhiều trong một ngày có thể chạm biên; có lúc phải chia lệnh ra nhiều ngày.",
          "**Cổ tức không bắt buộc:** tộc trưởng quyết định có chia hay không; gia tộc lỗ thì không chia được.",
          "**Vay ký quỹ khuếch đại cả lỗ:** giá giảm và lãi cộng dồn có thể làm bạn bị bán giải chấp đúng lúc giá thấp.",
          "**Gia tộc giải tán** là mất trắng cổ phần.",
        ] },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { list: [
          "So giá trên sàn với giá trị sổ sách và lịch sử cổ tức, đừng chỉ nhìn giá đang tăng.",
          "Phí trả hai lần (mua và bán), nên lướt sóng nhỏ thường không lời như tưởng.",
          "Biên ngày bảo vệ cả người mua lẫn người bán: nghĩ xem ai cần bán gấp hơn bạn.",
        ] },
      ],
    },
  ],
};
