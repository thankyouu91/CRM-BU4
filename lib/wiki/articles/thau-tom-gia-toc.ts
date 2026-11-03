import type { WikiArticle } from "../types";
import { PLAYER_CAP, SHARES } from "@/public/ta-tua/game/js/shared/clan-shares.js";

// Thâu tóm gia tộc qua cổ phần (petdex/server/clan-shares.js: kiểm soát, bổ nhiệm, sáp nhập, công bố, Sở Công Thương).
// Mọi con số đọc thẳng từ public/ta-tua/game/js/shared/clan-shares.js; tests/petfarm-wiki-sync-clan-shares.test.ts đối chiếu với code của game.

const pct = (x: number) => `${String(+(x * 100).toFixed(2)).replace(".", ",")}%`;
const num = (n: number) => n.toLocaleString("vi-VN");
const control = Math.floor(SHARES.total * SHARES.control);
const disclose = Math.floor(SHARES.total * SHARES.disclose);

export const article: WikiArticle = {
  slug: "thau-tom-gia-toc",
  title: "Thâu tóm gia tộc",
  category: "kinh-te",
  emoji: "🏴",
  summary: `Gia tộc nắm trên ${pct(SHARES.control)} cổ phần của một gia tộc đã lên sàn thì có quyền kiểm soát: bổ nhiệm tộc trưởng hoặc sáp nhập đất. Người bị nhắm có thể mua lại cổ phần để phòng thủ; Sở Công Thương chặn thâu tóm gây độc quyền.`,
  keywords: ["thâu tóm", "thâu tóm thù địch", "kiểm soát", "sáp nhập", "bổ nhiệm tộc trưởng", "mua lại", "công bố sở hữu", "chống độc quyền", "cổ phần"],
  related: ["co-phan-gia-toc", "so-cong-thuong", "gia-toc", "dau-truong"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: `Khi một gia tộc đã [lên sàn](co-phan-gia-toc), gia tộc khác có thể dùng **quỹ gia tộc** mua dần cổ phần của nó trên sàn. Người chơi chỉ được giữ tối đa ${pct(SHARES.playerCap)} một gia tộc, nên chỉ **gia tộc** mới gom đủ để nắm quyền.` },
        { p: "Đây là con đường giành đất và ngành bằng tiền, bên cạnh [Đấu trường](dau-truong) giành bằng sức mạnh." },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { table: { head: ["Mốc", "Điều xảy ra"], rows: [
          [`Trên ${pct(SHARES.disclose)} (${num(disclose)} cổ phần)`, "Báo đăng tin công bố sở hữu (cả người chơi, gia tộc và ngân hàng). Xuống lại dưới mốc rồi vượt lần nữa thì đăng lại"],
          [`Trên ${pct(SHARES.control)} (${num(control)} cổ phần)`, "Gia tộc trở thành **cổ đông kiểm soát**, báo đăng tin. Mất mốc này là mất quyền"],
        ] } },
        { p: "**Quyền của cổ đông kiểm soát** (tộc trưởng gia tộc kiểm soát bấm):" },
        { list: [
          "**Bổ nhiệm tộc trưởng:** chọn một thành viên của gia tộc bị kiểm soát (không phải người từng bị phế truất ở đó) làm tộc trưởng; tộc trưởng cũ về làm thành viên.",
          "**Sáp nhập đất:** chuyển các lô của gia tộc bị kiểm soát (kèm công trình, và ngành của lô) về gia tộc mình, trong giới hạn số lô theo cấp. Lô ngành chiến lược và lô đang thế chấp ở ngân hàng gia tộc không chuyển.",
        ] },
        { p: `**Sở Công Thương:** lệnh mua đưa gia tộc vượt mốc ${pct(SHARES.control)} bị chặn nếu gộp đất hai bên sẽ chiếm trên **${pct(SHARES.antitrustShare)} số lô của một ngành**. Lúc sáp nhập, luật này được kiểm tra lại.` },
        { table: { head: ["Cách phòng thủ", "Cách hoạt động"], rows: [
          ["Mua lại", "Gia tộc mua cổ phiếu của chính mình bằng quỹ; cổ phần tự giữ không bán cho ai trừ khi gia tộc bán ra, nên lượng cổ phần trôi nổi ít đi"],
          ["Thành viên giữ cổ phần", `Phần lớn cổ phần nằm trong tay thành viên (chia lúc lên sàn). Họ không bán thì gia tộc ngoài khó gom đủ ${num(control)}`],
          ["Biên giá ngày", `Giá chỉ dao động ±${pct(SHARES.band)} mỗi ngày nên không ai gom nhanh được trong một ngày`],
          ["Theo dõi tin công bố", `Mốc ${pct(SHARES.disclose)} báo trước rằng có người đang gom`],
        ] } },
        { p: `Trần ${num(PLAYER_CAP)} cổ phần mỗi người chơi áp dụng cho từng tài khoản; gia tộc mua bằng quỹ không có trần này.` },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { list: [
          "**Bên thâu tóm:** gom càng nhiều thì giá càng lên, phí trả mỗi lệnh; có thể tiêu nhiều quỹ mà vẫn không qua được mốc kiểm soát nếu thành viên bên kia không bán.",
          "**Bên bị thâu tóm:** mất quyền chọn tộc trưởng, và đất có thể bị sáp nhập đi.",
          "**Cổ đông nhỏ:** sau sáp nhập, gia tộc còn ít đất hơn nên giá trị sổ sách và cổ tức có thể giảm.",
        ] },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { list: [
          "Ai đang giữ cổ phần của gia tộc bạn? Danh sách cổ đông lớn trả lời câu hỏi đó trước khi báo kịp đăng.",
          "Một gia tộc giàu đất nhưng giá cổ phiếu thấp hơn sổ sách là món hời cho ai đó.",
          "Sở Công Thương nhìn vào ngành của các lô, không nhìn vào số cổ phần.",
        ] },
      ],
    },
  ],
};
