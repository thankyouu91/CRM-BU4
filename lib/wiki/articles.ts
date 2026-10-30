import { playUrl } from "@/lib/petdex-public";
import {
  GEAR, HIDDEN_DISHES, MASCOT, RANKS, SLOT_ORDER, SPECIES_COUNT, WEARABLE_COUNT,
  careerRows, classRows, commodityRows, creditTierRows, cropRows, dishRows, elementRows, factoryRows, fishRows, foodRows, formRows, guildProjectRows,
  locationRows, promotionRows, proposalRows, questRows, rarityRows, recipeRows, relationRows, setRows, slotName, speciesRows, stageRows, tierRows, toyRows, wearRows,
} from "./game-data";
import type { WikiArticle } from "./types";

/** Bảng thuế lũy tiến lấy thẳng từ luật game. */
function taxRows(): string[][] {
  const vnd = (n: number) => n.toLocaleString("vi-VN");
  let prev = 0;
  return (BRACKETS as [number, number][]).map(([cap, rate]) => {
    const row = [cap === Infinity ? `Trên ${vnd(prev)} xu` : `${vnd(prev)}–${vnd(cap)} xu`, `${Math.round(rate * 100)}%`];
    prev = cap;
    return row;
  });
}
import { CLAN, UNLOCKS } from "./rules";
import { BAZAAR, LOANS, SCHOOL } from "@/petdex/server/rules/production.js";
import { MARKET } from "@/petdex/server/rules/market.js";
import { DAILY_XP, EGG, LIFE_STAGES, UPKEEP } from "@/public/ta-tua/game/js/shared/pets.js";
import { BRACKETS } from "@/petdex/server/rules/town.js";
import {
  COMMODITY_COUNT, DESIGN_RULES, GOODS_COUNT, INDUSTRIAL_MARKET, INDUSTRY_COUNT, LAND_RULES, LEGEND_ID, MASCOT_ID, SERVICE_COUNT,
  clanLevelRows, climateNames, elementPets, formPets, freshnessRows, industryRows, legendaryPets, phaseRows, sectorRows, stagePets, unlockRows, weatherRows, zoneRows,
} from "./game-data";

// The wiki's articles, in reading order (the order of the side menu and of "previous / next").
// Numbers in prose were checked against petdex/server and the game's shared modules; tables come
// from lib/wiki/game-data.ts, which reads them from the game's rules. When a rule changes, fix
// the sentence here too.

/** How fast each age stage learns at school, e.g. "Sơ sinh ×1,3, ..." (from the game's life stages). */
const schoolByStage = () =>
  (LIFE_STAGES as { name: string; rules: { school: number } }[]).map((s) => `${s.name} ${s.rules.school ? `×${String(s.rules.school).replace(".", ",")}` : "chưa học được"}`).join(", ");

const PRICE_NOTE = "Giá trong bảng là **giá gốc**. Mỗi Chủ nhật Ngân hàng Trung ương đặt lại chỉ số giá, nên giá thật trong game có thể cao hoặc thấp hơn một chút.";

export const ARTICLES: WikiArticle[] = [
  // ------------------------------------------------------------------ Bắt đầu
  {
    slug: "bat-dau",
    title: "Bắt đầu chơi",
    category: "bat-dau",
    emoji: "🌱",
    summary: "Tạo tài khoản, nhận nuôi bé đầu tiên miễn phí và làm quen với Phố Trân Châu trong 10 phút.",
    keywords: ["tân thủ", "người mới", "đăng ký", "tạo tài khoản", "nhận nuôi"],
    related: ["tai-khoan", "moi-ngay", "cham-soc", "cap-do"],
    sections: [
      {
        id: "vao-game",
        title: "Vào game",
        blocks: [
          { p: `Petfarm chạy ngay trên trình duyệt, cả điện thoại lẫn máy tính, không cần cài gì. Trang chơi là **${playUrl().replace("https://", "")}**.` },
          {
            steps: [
              "Mở trang chơi, chọn **Tạo tài khoản**.",
              "Đặt tên đăng nhập 3–20 ký tự (chữ không dấu, số hoặc dấu gạch dưới) và mật khẩu từ 6 ký tự.",
              "Vào phố là có ngay **150 xu chào mừng**.",
              "Lần sau chỉ cần **Đăng nhập** bằng tên và mật khẩu, trên máy nào cũng được.",
            ],
          },
          { tip: "Được bạn gửi **link mời**? Mở link, điền tên là chơi được ngay. Sau đó nên đặt mật khẩu để không mất tài khoản, xem [Tài khoản và mã quà](tai-khoan)." },
        ],
      },
      {
        id: "nhan-nuoi",
        title: "Nhận nuôi bé đầu tiên",
        blocks: [
          { pets: [{ id: MASCOT_ID, label: "Boba", sub: "linh vật" }, ...elementPets()] },
          { p: "Bé đầu tiên **miễn phí**. Ở màn nhận nuôi bạn chọn một loài độ hiếm Thường hoặc linh vật **Boba** (bé rái cá ôm cốc trà sữa), rồi đặt tên cho bé (1–16 ký tự)." },
          { list: [
            "Mỗi loài thuộc một hành trong **ngũ hành** (Kim, Mộc, Thủy, Hỏa, Thổ). Hành quyết định bé giỏi gì, hợp đồ ăn và trang phục nào. Xem [Ngũ hành](ngu-hanh).",
            "Mỗi bé có 1 hoặc 2 **tính cách** ngẫu nhiên như Chăm chỉ (+10% lương) hay Mọt sách (học nhanh hơn). Xem [Tính cách, tuổi và vòng đời](tinh-cach-tuoi).",
            "Nuôi được tối đa **4 bé**. Từ bé thứ hai mỗi bé tốn **200 xu**. Loài Hiếm, Quý, Huyền thoại chỉ nở từ trứng, xem [Các loài và trứng](cac-loai).",
          ] },
        ],
      },
      {
        id: "ban-do",
        title: "Bản đồ phố",
        blocks: [
          { p: "Màn **Phố** là bản đồ: chạm vào tòa nhà nào là vào tòa nhà đó. Thanh trên cùng có Phố, Nhà, Túi đồ, Ví, Bạn bè, Công viên, nút quà ngày, số xu và tên của bạn." },
          { img: { src: "/petfarm/map.webp", alt: "Bản đồ Phố Trân Châu với nhà, siêu thị, việc làm, ngân hàng, Sàn Nguyên Liệu, trường học, phòng khám, công viên, bếp, vườn và chợ phiên", width: 1600, height: 961 } },
          { table: { head: ["Khu", "Để làm gì", "Mở ở cấp"], rows: [
            ["Nhà", "Cho ăn, tắm, chơi đùa, mặc đồ, chọn bé chính", 1],
            ["Siêu thị", "Mua đồ ăn, đồ chăm sóc, đồ chơi, phụ kiện, trứng", 1],
            ["Việc làm", "Nhận ca làm để kiếm lương", 1],
            ["Khu vui chơi", "Mini-game kiếm xu và nguyên liệu", 1],
            ["Phòng khám", "Khám, chữa bệnh, mua bảo hiểm", 1],
            ["Công viên", "Gặp người chơi khác, chat, vuốt ve bé", 1],
            ["Trường học", "Học thêm kỹ năng", UNLOCKS.school],
            ["Sàn Nguyên Liệu, Vườn", "Buôn nguyên liệu, trồng cây", UNLOCKS.market],
            ["Ngân hàng, Tòa thị chính, Bếp", "Gửi tiết kiệm, bỏ phiếu, nấu món", UNLOCKS.bank],
            ["Quầy trà sữa, Chợ Phiên", "Mở quầy bán trà sữa, bán đồ cho người chơi khác", UNLOCKS.business],
            ["Gia tộc và Sở Nhà Đất", "Làm ăn chung, mua đất, vào ngành", CLAN.unlockLevel],
            ["Khu công nghiệp", `Gia công thuê (cấp 2), xây xưởng riêng (cấp ${UNLOCKS.factory})`, `2 / ${UNLOCKS.factory}`],
          ] } },
          { p: "Cấp ở đây là **cấp của bé cao nhất** trong nhà. Bảng đầy đủ ở [Cấp độ và mở khóa](cap-do)." },
        ],
      },
      {
        id: "ngay-dau",
        title: "Ngày đầu nên làm gì",
        blocks: [
          { steps: [
            "Bấm **🎁 Nhận quà ngày** trên thanh trên (60 xu ngày đầu, tăng dần theo chuỗi ngày).",
            "Mở **📜 Nhiệm vụ hôm nay** ở màn Phố: 3 nhiệm vụ dễ, làm đủ được thêm rương 50 xu.",
            "Ở Nhà: cho bé ăn, tắm (miễn phí), chơi đùa. Giữ các chỉ số trên 20 để bé không ốm.",
            "Vào **Việc làm**, nhận ca 1–2 giờ ở nghề hợp kỹ năng của bé. Bé sơ sinh chỉ làm được 2 giờ/ngày.",
            "Chơi vài ván mini-game ở **Khu vui chơi** khi chờ ca làm.",
            "Ghé **Công viên** vuốt ve bé của người khác: cả hai bé vui hơn, bạn được 3 xu.",
          ] },
          { warn: "Bé sống theo **giờ thật**: không vào game thì bé vẫn đói dần, buồn dần, bẩn dần. Ghé thăm mỗi ngày là đủ để bé khỏe." },
        ],
      },
    ],
  },
  {
    slug: "tai-khoan",
    title: "Tài khoản và mã quà",
    category: "bat-dau",
    emoji: "🔑",
    summary: "Đăng nhập, đặt và đổi mật khẩu, nhập mã quà, link mời và cách lấy lại tài khoản.",
    keywords: ["mật khẩu", "đăng nhập", "giftcode", "gift code", "code", "link mời", "quên mật khẩu", "đăng xuất"],
    related: ["bat-dau", "moi-ngay"],
    sections: [
      {
        id: "cach-vao",
        title: "Các cách vào game",
        blocks: [
          { table: { head: ["Cách", "Bạn cần", "Ghi chú"], rows: [
            ["Tài khoản tên + mật khẩu", "Tên 3–20 ký tự, mật khẩu 6–72 ký tự", "Cách chính. Đăng nhập trên máy nào cũng được."],
            ["Link mời", "Chỉ cần điền tên (2–40 ký tự)", "Trình duyệt nhớ phiên chơi. Nên đặt mật khẩu ngay."],
            ["Tài khoản WorkHub", "Nhân viên đăng nhập một lần", "Chơi bằng tài khoản công ty."],
          ] } },
          { p: "Cách nào cũng nhận **150 xu chào mừng** một lần." },
        ],
      },
      {
        id: "menu-tai-khoan",
        title: "Menu tài khoản",
        blocks: [
          { p: "Bấm vào **tên của bạn (👤)** ở góc trên để mở menu tài khoản. Ở đây có:" },
          { list: [
            "**🎁 Nhập mã quà**: nhập mã rồi bấm *Nhận quà*.",
            "**🔑 Đặt mật khẩu / Đổi mật khẩu**: mật khẩu mới từ 6 ký tự, nhập lại để xác nhận. Đổi xong, các máy khác đang đăng nhập bị đăng xuất.",
            "**🚪 Đăng xuất**.",
          ] },
        ],
      },
      {
        id: "ma-qua",
        title: "Mã quà",
        blocks: [
          { p: "Mã quà do đội ngũ Petfarm phát trong các dịp sự kiện, dạng như **ABCD-EFGH** (không phân biệt chữ hoa, chữ thường)." },
          { list: [
            "Mỗi người nhận **một lần** cho mỗi mã. Mã có thể giới hạn tổng số lượt, có hạn dùng hoặc bị thu hồi.",
            "Quà gồm phần **luôn nhận** (xu và các món đồ) và có thể có phần **tự chọn 1 trong 2–6 món**.",
            "Với mã có phần tự chọn: bấm *Nhận quà* thì game hiện các lựa chọn. **Chưa có gì bị tính** cho tới khi bạn bấm chọn một món, lúc đó bạn nhận cả phần luôn nhận lẫn món đã chọn.",
            "Một số món là **quà ngẫu nhiên** trong một nhóm (đồ ăn, đồ chăm sóc, đồ chơi, trứng ngũ hành, trang phục), hoặc **hợp mệnh bé chính**: cùng hành hoặc hành tương sinh với bé chính của bạn. Chưa có bé chính thì game quay ngẫu nhiên.",
          ] },
          { tip: "Trước khi nhập mã có quà hợp mệnh, hãy **chọn đúng bé chính** ở Nhà (⭐ Chọn thú chính) để quà hợp với bé bạn muốn nuôi lớn." },
          { warn: "Nhập sai quá **10 lần trong một phút** thì phải chờ một lúc mới nhập tiếp." },
        ],
      },
      {
        id: "lay-lai",
        title: "Tài khoản cũ chưa có mật khẩu, quên mật khẩu",
        blocks: [
          { list: [
            "Nếu bạn vào bằng link mời hoặc WorkHub và chưa có mật khẩu, game sẽ nhắc bạn đặt tên đăng nhập và mật khẩu. Bé, xu và mọi thứ giữ nguyên.",
            "Đăng nhập bằng tên chưa có mật khẩu sẽ báo *Tài khoản này chưa có mật khẩu* kèm nút **Tạo mật khẩu**. Nút này chỉ dùng được trên trình duyệt còn giữ phiên chơi của chính tài khoản đó.",
            "Quên mật khẩu hoặc đổi máy: nhờ quản trị viên tạo **link đặt mật khẩu**. Link dùng một lần, hết hạn sau 24 giờ; đặt xong thì mọi phiên cũ bị đăng xuất.",
          ] },
        ],
      },
    ],
  },
  {
    slug: "moi-ngay",
    title: "Quà ngày và nhiệm vụ",
    category: "bat-dau",
    emoji: "🎁",
    summary: "Quà đăng nhập theo chuỗi, trợ cấp tân thủ 7 ngày đầu và 3 nhiệm vụ mỗi ngày kèm rương 50 xu.",
    keywords: ["điểm danh", "chuỗi", "streak", "nhiệm vụ", "rương", "trợ cấp", "daily"],
    related: ["bat-dau", "cap-do"],
    sections: [
      {
        id: "qua-ngay",
        title: "Quà ngày",
        blocks: [
          { p: "Khi có quà, thanh trên hiện nút **🎁 Nhận quà ngày · 🔥chuỗi**. Mỗi ngày nhận một lần; ngày mới bắt đầu lúc **0 giờ theo giờ Việt Nam**." },
          { table: { head: ["Ngày liên tiếp", "1", "2", "3", "4", "5", "6", "7 trở đi"], rows: [["Xu nhận được", 60, 70, 80, 90, 100, 110, 120]] } },
          { warn: "Bỏ lỡ một ngày thì chuỗi quay về ngày 1." },
        ],
      },
      {
        id: "tro-cap",
        title: "Trợ cấp tân thủ",
        blocks: [
          { p: "Trong **7 ngày đầu** kể từ lúc tạo tài khoản, mỗi lần nhận quà ngày bạn được thêm **30 xu** trợ cấp. Tiền này lấy từ ngân sách thị trấn, nên khi ngân sách cạn thì tạm không có. Khi phố bỏ phiếu chọn *Quỹ chào tân thủ*, trợ cấp tăng lên 50 xu/ngày trong một tuần." },
        ],
      },
      {
        id: "nhiem-vu",
        title: "Nhiệm vụ hôm nay",
        blocks: [
          { p: "Mở **📜 Nhiệm vụ hôm nay** ở màn Phố. Mỗi ngày có **3 nhiệm vụ**, chọn theo cấp và những gì bạn làm được. Mỗi nhiệm vụ xong cho xu và **+10 XP** cho bé chính; xong cả 3 thì mở **🎁 Rương nhiệm vụ +50 xu**." },
          { table: { head: ["Nhiệm vụ", "Thưởng (xu)", "Điều kiện"], rows: questRows() } },
        ],
      },
    ],
  },
  {
    slug: "cap-do",
    title: "Cấp độ và mở khóa",
    category: "bat-dau",
    emoji: "⭐",
    summary: `XP lên cấp, xu thưởng mỗi cấp, những khu mở ra ở cấp ${[...new Set([...Object.values(UNLOCKS), CLAN.unlockLevel])].sort((a, b) => a - b).join(", ")} và dáng mới của bé mỗi 10 cấp.`,
    keywords: ["level", "lên cấp", "XP", "kinh nghiệm", "unlock", "dáng", "tiến hóa"],
    related: ["bat-dau", "trang-phuc", "viec-lam"],
    sections: [
      {
        id: "xp",
        title: "XP và lên cấp",
        blocks: [
          { p: "Mỗi bé có cấp riêng. XP cần để lên cấp kế là **80 + (cấp hiện tại − 1) × 40**, và mỗi lần lên cấp L bạn được **20 + L × 10 xu**." },
          { table: { head: ["Lên cấp", "XP cần", "XP cộng dồn", "Thưởng xu"], rows: [
            ["1 → 2", 80, 80, 40], ["2 → 3", 120, 200, 50], ["3 → 4", 160, 360, 60], ["4 → 5", 200, 560, 70],
            ["5 → 6", 240, 800, 80], ["6 → 7", 280, 1080, 90], ["7 → 8", 320, 1400, 100], ["8 → 9", 360, 1760, 110], ["9 → 10", 400, 2160, 120],
          ] } },
        ],
      },
      {
        id: "nguon-xp",
        title: "Kiếm XP ở đâu",
        blocks: [
          { table: { head: ["Hoạt động", "XP"], rows: [
            ["Ca làm", "4 XP mỗi giờ"],
            ["Chơi đùa ở Nhà", "10 (+4 đến +10 nếu có đồ chơi)"],
            ["Đồ ăn, đồ chăm sóc", "4–30 tùy món"],
            ["Nhiệm vụ ngày", "10 mỗi nhiệm vụ"],
            ["Đi học", 5],
            ["Vuốt ve ở công viên", 5],
            ["Tưới hộ vườn bạn", 5],
            ["Nấu ăn", 4],
            ["Một ván mini-game", 3],
            ["Tắm, khám bệnh", 2],
          ] } },
          { p: "XP được nhân thêm: **+10%** vào ngày hành của bé vượng (xem [Ngũ hành](ngu-hanh)), và theo tuổi: Sơ sinh ×1,5, Nhí nhố ×1,25, Thiếu niên ×1,1, Lão làng ×0,7. Đồ ăn hợp mệnh cho thêm 20% XP." },
        ],
      },
      {
        id: "mo-khoa",
        title: "Bảng mở khóa",
        blocks: [
          { p: "Các khu mở theo **cấp của bé cao nhất** trong nhà:" },
          { table: { head: ["Cấp", "Mở thêm"], rows: unlockRows({ [EGG.minLevel]: ["mua trứng ngũ hành"], [CLAN.unlockLevel]: ["[Gia tộc và Sở Nhà Đất](gia-toc)"] }) } },
          { p: "Một số món trong Siêu thị cũng cần cấp tối thiểu, xem [Siêu thị](sieu-thi)." },
        ],
      },
      {
        id: "dang-theo-cap",
        title: "Dáng mới mỗi 10 cấp",
        blocks: [
          { p: "Cứ 10 cấp bé đổi dáng một lần, cộng thêm với dáng theo tuổi. Dáng chỉ để ngắm, không đổi chỉ số." },
          { table: { head: ["Từ cấp", "Dáng", "Trông thế nào"], rows: formRows() } },
          { pets: formPets(LEGEND_ID) },
          { p: "Từ **cấp 30** bé đeo được thêm một món trang phục, xem [Trang phục](trang-phuc)." },
        ],
      },
    ],
  },
  {
    slug: "hoi-dap",
    title: "Hỏi đáp nhanh",
    category: "bat-dau",
    emoji: "💬",
    summary: "Những câu người chơi hay hỏi nhất: phí, điện thoại, bé ốm, hết xu, mất tài khoản.",
    keywords: ["FAQ", "câu hỏi", "lỗi", "hỗ trợ"],
    related: ["bat-dau", "tai-khoan", "cham-soc"],
    sections: [
      {
        id: "chung",
        title: "Chung",
        blocks: [
          { list: [
            "**Chơi có mất phí không?** Không. Mọi thứ trong game mua bằng xu kiếm trong game.",
            "**Chơi trên điện thoại được không?** Được, ngay trên trình duyệt. Đăng nhập cùng tài khoản thì bé và xu đi theo bạn.",
            "**Một ngày trong game dài bao lâu?** Bằng một ngày thật, tính theo giờ Việt Nam. Quà ngày, nhiệm vụ, hành vượng, hạn mức mini-game đều làm mới lúc 0 giờ. Mỗi ngày thật bé lớn thêm 1 tuần tuổi.",
            "**Giá trong game sao khác wiki?** Wiki ghi giá gốc. Ngân hàng Trung ương chỉnh chỉ số giá mỗi Chủ nhật nên giá thật có thể lệch một chút.",
          ] },
        ],
      },
      {
        id: "nuoi-be",
        title: "Nuôi bé",
        blocks: [
          { list: [
            "**Không vào game thì bé có sao không?** Bé vẫn đói, buồn, bẩn dần theo giờ thật; để lâu sức khỏe tụt dưới 40 thì dễ ốm. Ghé mỗi ngày cho ăn và tắm là đủ. Xem [Chăm sóc bé](cham-soc).",
            "**Bé ốm thì làm sao?** Đưa bé tới Phòng khám chữa (120 hoặc 200 xu). Bé ốm không đi làm, đi học, chơi mini-game hay vào bếp được.",
            "**Bé có chết không?** Bé sống khoảng 80–130 tuần tuổi (khoảng 3–4 tháng thật). Chăm tốt thì sống lâu hơn. Xem [Tính cách, tuổi và vòng đời](tinh-cach-tuoi).",
            `**Làm sao có loài hiếm?** Mua trứng ngũ hành (${EGG.price} xu, từ cấp ${EGG.minLevel}) và ấp ${EGG.hours} giờ. Xem [Các loài và trứng](cac-loai).`,
          ] },
        ],
      },
      {
        id: "xu",
        title: "Xu",
        blocks: [
          { list: [
            "**Hết xu thì làm sao?** Nhận quà ngày, làm nhiệm vụ, cho bé đi làm và chơi mini-game. Tắm ở nhà miễn phí nên không cần mua đồ tắm.",
            "**Cách kiếm xu nhanh nhất lúc đầu?** Ca làm 4 giờ ở nghề hợp kỹ năng, cộng mini-game (tối đa 100 xu/ngày) và rương nhiệm vụ. Xem [Việc làm](viec-lam).",
            `**Để xu ở đâu cho an toàn và có lãi?** Ngân hàng, từ cấp ${UNLOCKS.bank}. Xem [Ngân hàng](ngan-hang).`,
          ] },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ Nuôi bé
  {
    slug: "cham-soc",
    title: "Chăm sóc bé",
    category: "nuoi-be",
    emoji: "🛁",
    summary: "Năm chỉ số No bụng, Vui vẻ, Năng lượng, Sạch sẽ, Sức khỏe; cho ăn, tắm, chơi đùa; ốm, phòng khám và bảo hiểm.",
    keywords: ["đói", "ăn", "tắm", "ốm", "bệnh", "phòng khám", "bảo hiểm", "sức khỏe", "chỉ số"],
    related: ["sieu-thi", "tinh-cach-tuoi", "ngu-hanh"],
    sections: [
      {
        id: "chi-so",
        title: "Năm chỉ số",
        blocks: [
          { p: "Mỗi chỉ số chạy từ 0 đến 100 và thay đổi theo giờ thật, kể cả khi bạn không vào game." },
          { img: { src: "/petfarm/room.webp", alt: "Bé đội mũ quý ông, đeo kính tròn và cánh thiên thần trong phòng", width: 1000, height: 739 } },
          { table: { head: ["Chỉ số", "Khi bé rảnh", "Khi bé đi làm, đi học", "Lưu ý"], rows: [
            ["🍙 No bụng", "−8 mỗi giờ", "−12 mỗi giờ", "Đói khi dưới 20. Tham ăn tụt nhanh hơn 20%."],
            ["💖 Vui vẻ", "−4 mỗi giờ", "−4 mỗi giờ", "Tụt gấp đôi khi đói, nhanh hơn nữa khi ốm."],
            ["⚡ Năng lượng", "+12 mỗi giờ", "−10 mỗi giờ", "Đi làm cần 10 năng lượng mỗi giờ ca."],
            ["🫧 Sạch sẽ", "−5 mỗi giờ", "−5 mỗi giờ", "Bẩn khi dưới 20."],
            ["❤️ Sức khỏe", "+1 mỗi giờ khi no và sạch", "", "−1 mỗi giờ khi đói hoặc bẩn. Dưới 40 thì dễ ốm."],
          ] } },
          { p: "Hành và tuổi của bé làm các con số này nhanh hoặc chậm hơn: bé Thổ ít đói, bé Kim ít bẩn, bé Thủy vui lâu, bé Mộc hồi sức khỏe nhanh, bé Hỏa hồi năng lượng nhanh nhưng mau đói. Xem [Ngũ hành](ngu-hanh)." },
        ],
      },
      {
        id: "o-nha",
        title: "Chăm ở Nhà",
        blocks: [
          { table: { head: ["Nút", "Tốn", "Được"], rows: [
            ["🛁 Tắm", "Miễn phí, bé bận 15 phút", "Sạch sẽ lên 100, Vui vẻ +5, +2 XP"],
            ["🎾 Chơi đùa", "15 năng lượng, 5 No bụng, 5 Sạch sẽ (cần No bụng từ 10)", "Vui vẻ +12, +10 XP, +4 xu; có đồ chơi thì thêm vui và XP"],
            ["Cho ăn", "Một món đồ ăn trong Túi đồ", "Theo món, xem [Siêu thị](sieu-thi). Không cho ăn được khi No bụng từ 97."],
          ] } },
          { tip: "Tắm ở nhà **miễn phí**. Món *Tắm bong bóng* ở Siêu thị chỉ đáng mua khi cần thêm Vui vẻ và Năng lượng." },
          { tip: "Đồ ăn **hợp mệnh** (cùng hành hoặc hành sinh ra hành của bé) cho thêm **20% XP**." },
        ],
      },
      {
        id: "om",
        title: "Ốm và Phòng khám",
        blocks: [
          { p: "Khi Sức khỏe **dưới 40**, mỗi giờ bé có 3% khả năng ốm, và mỗi nửa đêm còn một lần bốc 50%. Bé sơ sinh và bé già dễ ốm gấp đôi; bé Thổ ít ốm hơn." },
          { table: { head: ["Dịch vụ", "Giá", "Hiệu quả"], rows: [
            ["Khám tổng quát (bé khỏe)", "60 xu", "Sức khỏe +15, +2 XP"],
            ["Chữa 🤧 Cảm lạnh", "120 xu", "Khỏi bệnh, Sức khỏe +30"],
            ["Chữa 🤢 Đau bụng", "200 xu", "Khỏi bệnh, Sức khỏe +30"],
            ["Bảo hiểm Cơ bản", "8 xu/ngày", "Trả 50% viện phí"],
            ["Bảo hiểm Toàn diện", "20 xu/ngày", "Trả 90% viện phí"],
          ] } },
          { warn: "Bé ốm **không đi làm, đi học, chơi mini-game hay vào bếp** được cho tới khi chữa. Phí bảo hiểm trừ lúc nửa đêm; ví không đủ tiền thì gói tự hủy." },
          { p: PRICE_NOTE },
        ],
      },
    ],
  },
  {
    slug: "ngu-hanh",
    title: "Ngũ hành",
    category: "nuoi-be",
    emoji: "☯️",
    summary: "Kim, Mộc, Thủy, Hỏa, Thổ: sở trường của từng hành, hành vượng mỗi ngày, đồ hợp mệnh và kỵ mệnh.",
    keywords: ["kim", "mộc", "thủy", "hỏa", "thổ", "hành", "mệnh", "tương sinh", "tương khắc", "vượng"],
    related: ["cac-loai", "trang-phuc", "cham-soc"],
    sections: [
      {
        id: "nam-hanh",
        title: "Năm hành",
        blocks: [
          { p: "Mỗi loài thuộc một hành. Hành quyết định kỹ năng nào lên nhanh, chỉ số nào hao chậm và bé có lợi thế làm ăn gì." },
          { table: { head: ["Hành", "Kỹ năng lên nhanh", "Lợi thế", "Tính khí"], rows: elementRows() } },
          { list: [
            "**Kim**: bé đứng máy ở xưởng chạy thêm 10% mẻ; vào bếp tính như có thêm 15 Khéo tay.",
            "**Mộc**: bé chính hành Mộc giúp vườn thu thêm 15%.",
            "**Thủy**: bé trực quầy trà sữa kéo thêm 5% khách.",
            "**Hỏa**: nghề Bốc vác được thêm 5% lương.",
            "**Thổ**: tuổi thọ dài thêm 8 tuần.",
          ] },
        ],
      },
      {
        id: "hanh-vuong",
        title: "Hành vượng mỗi ngày",
        blocks: [
          { p: "Mỗi ngày một hành **vượng**, theo vòng **Mộc → Hỏa → Thổ → Kim → Thủy**, đổi lúc 0 giờ. Màn Phố ghi *Vận khí hôm nay: hành X vượng*. Bé đúng hành được **+10% XP và +10% lương ca làm** trong ngày đó." },
          { tip: "Có nhiều bé khác hành? Ngày hành nào vượng thì ưu tiên cho bé hành đó đi ca dài." },
        ],
      },
      {
        id: "hop-menh",
        title: "Hợp mệnh và kỵ mệnh",
        blocks: [
          { p: "Tương sinh: Kim sinh Thủy, Thủy sinh Mộc, Mộc sinh Hỏa, Hỏa sinh Thổ, Thổ sinh Kim. Tương khắc: Kim khắc Mộc, Mộc khắc Thổ, Thủy khắc Hỏa, Hỏa khắc Kim, Thổ khắc Thủy." },
          { table: { head: ["Bé hành", "Đồ tương sinh (+10%)", "Đồ cùng hành (+5%)", "Đồ kỵ mệnh (−5%)"], rows: relationRows() } },
          { list: [
            "**Trang phục**: mỗi món cộng hoặc trừ % trên vào **tốc độ lên kỹ năng**, cộng dồn, cả bộ tối đa **+30%**.",
            "**Bộ đồ cùng hành** (tính cả 5 khe, kể cả Bùa): **3 món** +3% lương ca làm, **4 món** +5%, **5 món** +8%. Bé dưới cấp 30 đeo 3 món vẫn gom được bộ 3 món.",
            "**Đồ ăn** tương sinh hoặc cùng hành: +20% XP.",
          ] },
        ],
      },
    ],
  },
  {
    slug: "cac-loai",
    title: "Các loài và trứng",
    category: "nuoi-be",
    emoji: "🥚",
    summary: `${SPECIES_COUNT} loài thú theo ngũ hành và 4 độ hiếm, linh vật Boba, trứng ngũ hành và tỉ lệ nở.`,
    keywords: ["loài", "pet", "hiếm", "huyền thoại", "trứng", "ấp", "nở", "boba", "thanh long", "bạch hổ"],
    related: ["ngu-hanh", "tinh-cach-tuoi"],
    sections: [
      {
        id: "do-hiem",
        title: "Độ hiếm",
        blocks: [
          { table: { head: ["Độ hiếm", "Tổng kỹ năng khởi đầu", "Tuổi thọ thêm"], rows: rarityRows() } },
          { p: "Bé Huyền thoại còn **đeo thêm 1 món** trang phục (tối đa 5, đủ cả khe Bùa)." },
          { pets: legendaryPets() },
          { p: "Xem từng loài, mọi giai đoạn và mọi dáng ở [Thư viện các bé](thu-vien-be)." },
        ],
      },
      {
        id: "danh-sach",
        title: "Danh sách loài",
        blocks: [
          { table: { head: ["Hành", "★ Thường", "★★ Hiếm", "★★★ Quý", "★★★★ Huyền thoại"], rows: speciesRows() } },
          { p: `Thêm linh vật **${MASCOT.name}**: bé rái cá ôm cốc trà sữa, hành Thủy, độ hiếm Thường, nhận nuôi được ngay.` },
          { p: "Nhận nuôi trực tiếp chỉ có loài **Thường** và Boba. Loài Hiếm trở lên chỉ nở từ trứng." },
        ],
      },
      {
        id: "trung",
        title: "Trứng ngũ hành",
        blocks: [
          { table: { head: ["Giá", "Mở ở cấp", "Thời gian ấp", "Tỉ lệ nở"], rows: [["600 xu", 3, "24 giờ", "Thường 75% · Hiếm 20% · Quý 4% · Huyền thoại 1%"]] } },
          { list: [
            "Mỗi hành một loại trứng (Trứng Kim, Trứng Mộc...), mua ở Siêu thị. Trứng nở ra một loài của đúng hành đó.",
            "Trứng đang ấp **chiếm một ô nuôi** (tối đa 4 ô).",
            "Loài được bốc ngay lúc bắt đầu ấp, không đổi được.",
          ] },
          { tip: "Muốn bé Huyền thoại thì phải kiên nhẫn: mỗi quả chỉ 1%. Cứ nuôi tốt các bé Thường trong lúc chờ." },
        ],
      },
    ],
  },
  {
    slug: "thu-vien-be",
    title: "Thư viện các bé",
    category: "nuoi-be",
    emoji: "🖼️",
    summary: "Hình mọi loài vẽ bằng chính bộ vẽ của game: lọc theo hành và độ hiếm, xem từng bé qua sáu giai đoạn tuổi và sáu dáng theo cấp.",
    keywords: ["hình", "ảnh", "pet", "loài", "huyền thoại", "giai đoạn", "dáng", "tiến hóa", "bộ sưu tập"],
    related: ["cac-loai", "tinh-cach-tuoi", "cap-do", "ngu-hanh"],
    sections: [
      {
        id: "huyen-thoai",
        title: "Năm bé huyền thoại",
        blocks: [
          { p: "Mỗi hành có một bé Huyền thoại, chỉ nở từ trứng ngũ hành với tỉ lệ 1%. Bé Huyền thoại có hào quang vàng, kỹ năng khởi đầu cao nhất, sống lâu hơn và đeo thêm một món trang phục. Dưới đây là các bé ở dáng **Thần thái** (cấp 50):" },
          { pets: legendaryPets(50) },
        ],
      },
      {
        id: "lon-len",
        title: "Lớn lên theo tuổi",
        blocks: [
          { p: "Mỗi ngày thật bé lớn thêm một tuần tuổi. Qua mỗi giai đoạn, dáng người đổi theo: sơ sinh đầu to mắt to, lão làng chống gậy. Xem luật của từng giai đoạn ở [Tính cách, tuổi và vòng đời](tinh-cach-tuoi)." },
          { pets: stagePets(LEGEND_ID) },
        ],
      },
      {
        id: "dang",
        title: "Dáng theo cấp",
        blocks: [
          { p: "Cứ 10 cấp bé đổi dáng một lần: lớn người hơn, có vạch màu hành ở thái dương, vằn hông, vòng linh khí dưới chân, đốm sáng bay quanh, và tới cấp 50 thì ánh vàng. Xem [Cấp độ và mở khóa](cap-do)." },
          { pets: formPets(MASCOT_ID) },
        ],
      },
      {
        id: "tat-ca",
        title: "Tất cả các loài",
        blocks: [
          { tip: "Hình được vẽ ngay trong trình duyệt bằng đúng bộ vẽ của game, nên luôn giống hệt trong game và tự cập nhật khi game thêm loài hay đổi hình." },
          { petGallery: true },
        ],
      },
    ],
  },
  {
    slug: "tinh-cach-tuoi",
    title: "Tính cách, tuổi và vòng đời",
    category: "nuoi-be",
    emoji: "🌠",
    summary: "Sáu tính cách, sáu giai đoạn tuổi, lương thâm niên, tuổi thọ, Đồi Sao và kỷ vật cho bé sau.",
    keywords: ["tính cách", "tuổi", "già", "chết", "mất", "đồi sao", "kỷ vật", "tưởng niệm", "tuổi thọ", "thâm niên"],
    related: ["cham-soc", "viec-lam", "cac-loai"],
    sections: [
      {
        id: "tinh-cach",
        title: "Tính cách",
        blocks: [
          { p: "Mỗi bé có 1 hoặc 2 nét tính cách ngẫu nhiên khi nhận nuôi hoặc nở." },
          { table: { head: ["Tính cách", "Tác dụng"], rows: [
            ["🍙 Tham ăn", "No bụng tụt nhanh hơn 20%; đồ ăn cho thêm 30% XP"],
            ["💼 Chăm chỉ", "+10% lương ca làm"],
            ["🎈 Ham chơi", "Chơi đùa được thêm 50% Vui vẻ"],
            ["😴 Ngủ nướng", "Năng lượng hồi nhanh hơn 20%; lương −5%"],
            ["✨ Có duyên", "+5 Duyên dáng ban đầu; trực quầy kéo thêm 10% khách"],
            ["📚 Mọt sách", "Học ở trường được thêm 25% điểm kỹ năng"],
          ] } },
        ],
      },
      {
        id: "tuoi",
        title: "Sáu giai đoạn tuổi",
        blocks: [
          { p: "**1 ngày thật = 1 tuần tuổi.** Mỗi giai đoạn có dáng vẽ riêng và luật riêng." },
          { pets: stagePets(MASCOT_ID) },
          { table: { head: ["Giai đoạn", "Từ tuần", "Giờ làm tối đa/ngày", "Lương", "XP", "Đặc điểm"], rows: stageRows() } },
          { p: "Từ **Trưởng thành**, bé có **lương thâm niên**: +1% cho mỗi 10 giờ đã làm ở nghề đó, tối đa +30%." },
        ],
      },
      {
        id: "tu-lon",
        title: "Bé tự lớn và phí chăm nuôi",
        blocks: [
          { p: `Mỗi đêm lúc quyết toán, mọi bé còn sống tự được cộng **${DAILY_XP.share * 100}%** số XP cần để lên cấp hiện tại (ít nhất ${DAILY_XP.min} XP), kể cả khi bạn không vào game. Bé yếu (sức khỏe dưới ${DAILY_XP.weakBelow}) chỉ được một nửa. Đủ XP thì bé lên cấp và bạn nhận xu thưởng lên cấp như thường.` },
          { p: `Nuôi bé cũng tốn **phí chăm nuôi** mỗi ngày: (${UPKEEP.base} + ${UPKEEP.perLevel} × cấp) xu mỗi bé, nhân chỉ số giá của Ngân hàng Trung ương. Cả ngày không quá **${UPKEEP.incomeShare * 100}% thu nhập hôm đó** của bạn (tối thiểu ${UPKEEP.base} xu mỗi bé), và chỉ tính khi bạn có vào game trong ${UPKEEP.activeDays} ngày qua. Ví không đủ thì trừ phần đang có, không ghi nợ.` },
          { tip: "Phí chăm nuôi giữ cho lượng xu trong thị trấn không phình nhanh hơn hàng hóa, nhờ vậy giá cả và tiền tiết kiệm của bạn giữ được giá trị." },
        ],
      },
      {
        id: "tuoi-tho",
        title: "Tuổi thọ",
        blocks: [
          { p: "Tuổi thọ gốc là **90 tuần**, cộng thêm theo độ hiếm (Hiếm +4, Quý +8, Huyền thoại +12), bé Thổ +8, và theo cách chăm: sức khỏe trung bình cả đời cao thì sống lâu hơn tới **+20 tuần**, chăm kém thì ngắn đi tới **10 tuần**. Tổng lại khoảng **80–130 tuần**." },
          { p: "Khi bé chỉ còn **7 tuần** trở xuống, game báo trước để bạn chuẩn bị." },
        ],
      },
      {
        id: "doi-sao",
        title: "Đồi Sao và kỷ vật",
        blocks: [
          { list: [
            "Bé mất thì lên **🌠 Đồi Sao** (xem ở Bảng vàng, thẻ Đồi Sao) và có tin trên Báo. Lương ca đang dở được trả nốt.",
            "Bé để lại **kỷ vật**: bé kế tiếp (nhận nuôi hoặc nở) được **+5** vào kỹ năng sở trường của bé cũ.",
            "Ô của bé thành **ô tưởng niệm**, mở lại tốn **3.000 xu**.",
            "Nếu đó là **bé cuối cùng**, ô không bị khóa và bạn được **một trứng miễn phí** cùng hành, nở sau 3 ngày.",
          ] },
        ],
      },
    ],
  },
  {
    slug: "trang-phuc",
    title: "Trang phục",
    category: "nuoi-be",
    emoji: "🎀",
    summary: `${WEARABLE_COUNT} món đồ đeo ở 5 khe, 4 cấp Xanh lam, Xanh lục, Vàng, Đỏ, các dòng chỉ số, hộp kín ở Siêu thị và số món đeo theo cấp.`,
    keywords: ["đồ", "gear", "phụ kiện", "đồ đeo", "cấp đồ", "đỏ", "vàng", "hộp", "may mắn", "bùa", "khe"],
    related: ["ngu-hanh", "sieu-thi", "mini-game", "cho-phien"],
    sections: [
      {
        id: "khe",
        title: "Khe và số món được đeo",
        blocks: [
          { p: `Có 5 khe: ${SLOT_ORDER.map(slotName).join(", ")}. Mỗi khe đeo một món. Món Bùa lơ lửng bên hông bé.` },
          { table: { head: ["Bé", "Số món đeo cùng lúc"], rows: [["Dưới cấp 30", 3], ["Từ cấp 30", 4], ["Bé Huyền thoại", "Thêm 1 (tối đa 5)"]] } },
          { img: { src: "/petfarm/gear.webp", alt: "Túi đồ với bốn món trang phục cấp Đỏ, Vàng, Xanh lục và Xanh lam cùng các dòng chỉ số", width: 1600, height: 425 } },
        ],
      },
      {
        id: "cap-do",
        title: "Bốn cấp đồ",
        blocks: [
          { p: "Mỗi món bạn sở hữu là một bản riêng, có cấp và từ 1 đến 4 dòng chỉ số. Mỗi loại chỉ số xuất hiện tối đa một dòng trên một món." },
          { table: { head: ["Cấp", "Số dòng", "Tỉ lệ ra", "Mỗi dòng", "Giá tham chiếu ở Chợ Phiên"], rows: tierRows() } },
          { table: { head: ["Dòng chỉ số", "Tác dụng"], rows: [
            ["💼 Thu nhập ca làm", "Lương các ca làm nghề tăng thêm"],
            ["📈 Chỉ số", "Kỹ năng lên nhanh hơn; đồ ăn, đồ chăm sóc, chơi đùa và tắm hồi nhiều hơn"],
            ["🏮 Thu nhập giao dịch", "Thưởng thêm khi bán ở Chợ Phiên, trên Sàn và bán món cho quán ăn"],
            ["🍀 May mắn", "Nấu dễ ra món ngon, mini-game dễ rớt vật liệu và trang phục, mua hộp dễ ra 2 dòng"],
          ] } },
          { p: "Các dòng của đồ đang đeo **cộng dồn** cho bé, có giảm dần: mỗi loại tính đủ tới **25%**, phần vượt chỉ tính **một nửa**, tối đa **60%**. Ví dụ 4 món Đỏ cộng thô 60% thì bé nhận 25 + 35 ÷ 2 = **42,5%**. Việc chung của cả nhà (mua đồ, giao dịch, nấu ăn) dùng chỉ số của **bé chính**." },
        ],
      },
      {
        id: "nguon",
        title: "Có đồ từ đâu",
        blocks: [
          { table: { head: ["Nguồn", "Cấp có thể ra"], rows: [
            ["Siêu thị: mỗi lần mua là một **hộp kín**", "Xanh lam (1 dòng) hoặc Xanh lục (2 dòng), khoảng 68% : 32%; May mắn giúp ra 2 dòng, món yêu cầu cấp càng cao (cứ 10 cấp) càng dễ ra 2 dòng"],
            [`Mini-game: mỗi ván ${GEAR.gearDropChance}% rớt một món`, "Mọi cấp, theo tỉ lệ ở bảng trên"],
            ["Mã quà", "Tùy mã"],
            ["Chợ Phiên: mua lại của người chơi khác", "Mọi cấp"],
          ] } },
          { steps: [
            "Mua hộp ở Siêu thị (nút **🎁 Mua hộp**).",
            "Vào **Túi đồ**, bấm **🎁 Mở hộp** để biết cấp và các dòng.",
            "Mở hộp xong mới đeo hoặc bày bán được.",
          ] },
          { p: "Trước khi mua, mỗi món cho biết **các loại chỉ số có thể ra**: hai loại theo hành và một loại theo khe. Hộp Siêu thị (Xanh lam, Xanh lục) chỉ ra dòng trong nhóm này; đồ Vàng, Đỏ có thêm loại ngoài nhóm. Cấp và % vẫn chỉ biết khi mở hộp." },
          { warn: "Không có chế tạo hay nâng cấp đồ. Muốn đồ Vàng, Đỏ thì chơi mini-game đều đặn, săn mã quà hoặc mua ở Chợ Phiên. Món đang bày bán hoặc đấu giá ở Chợ Phiên bị tháo ra và không đeo được." },
        ],
      },
      {
        id: "ban-do",
        title: "Bán đồ không cần nữa",
        blocks: [
          { table: { head: ["Cách bán", "Thu về"], rows: [
            ["**Bán nhanh** cho Siêu thị (nút 💰 trong Túi đồ)", "10–40% giá trị món (giá shop × hệ số cấp), dòng chỉ số quay càng cao trong biên độ của cấp càng được nhiều; hộp chưa mở 10% giá shop"],
            ["Bày bán ở [Chợ Phiên](cho-phien)", "Giá tự đặt 50–300% tham chiếu, trừ phí"],
            ["Đấu giá ở [Chợ Phiên](cho-phien#dau-gia)", "Giá người chơi trả, trừ phí"],
          ] } },
          { p: "Bán nhanh là mất món ngay và không có thưởng Thu nhập giao dịch." },
        ],
      },
      {
        id: "bo-do",
        title: "Bộ đồ theo hành",
        blocks: [
          { p: "Mỗi hành đều có món cho cả 5 khe, nên hành nào cũng gom được bộ 3, 4 hay 5 món (+3%, +5%, +8% lương, xem [Ngũ hành](ngu-hanh))." },
          { table: { head: ["Hành", "Đầu", "Mặt", "Cổ", "Lưng", "Bùa"], rows: setRows() } },
        ],
      },
    ],
  },
  {
    slug: "sieu-thi",
    title: "Siêu thị",
    category: "nuoi-be",
    emoji: "🏪",
    summary: "Giá, hiệu quả và cấp mở của mọi món: đồ ăn, đồ chăm sóc, đồ chơi, trứng và phụ kiện theo từng khe.",
    keywords: ["mua", "giá", "đồ ăn", "thức ăn", "đồ chơi", "vitamin", "sushi", "bánh", "phụ kiện", "shop"],
    related: ["cham-soc", "trang-phuc", "cac-loai"],
    sections: [
      {
        id: "do-an",
        title: "Đồ ăn và đồ chăm sóc",
        blocks: [
          { p: "Dùng là hết. Mỗi lần mua tối đa 20 món." },
          { table: { head: ["Món", "Loại", "Hành", "Giá", "Hiệu quả", "XP", "Cấp"], rows: foodRows() } },
          { p: PRICE_NOTE },
        ],
      },
      {
        id: "do-choi",
        title: "Đồ chơi",
        blocks: [
          { p: "Mua một lần, dùng mãi. Khi **Chơi đùa** ở Nhà, chọn đồ chơi để bé chơi cùng." },
          { table: { head: ["Món", "Giá", "Thêm khi chơi", "Cấp"], rows: toyRows() } },
        ],
      },
      {
        id: "phu-kien",
        title: "Phụ kiện",
        blocks: [
          { p: "Mỗi lần mua là một hộp kín 1–2 dòng chỉ số, xem [Trang phục](trang-phuc). Cột Cấp là cấp tối thiểu: cần một bé đạt cấp đó mới mua được." },
          ...SLOT_ORDER.map((s) => ({ table: { head: [slotName(s), "Hành", "Giá", "Cấp"], rows: wearRows(s) } })),
        ],
      },
      {
        id: "trung",
        title: "Trứng",
        blocks: [{ p: `Trứng Kim, Mộc, Thủy, Hỏa, Thổ: ${EGG.price} xu, từ cấp ${EGG.minLevel}, ấp ${EGG.hours} giờ. Xem [Các loài và trứng](cac-loai).` }],
      },
    ],
  },

  // ------------------------------------------------------------------ Kiếm xu
  {
    slug: "viec-lam",
    title: "Việc làm và kỹ năng",
    category: "kiem-xu",
    emoji: "💼",
    summary: "Năm nghề, năm bậc, công thức tính lương, điều kiện lên bậc và cách tăng 5 kỹ năng của bé.",
    keywords: ["đi làm", "lương", "nghề", "ca làm", "lên bậc", "thăng chức", "kỹ năng", "pha chế", "giao hàng", "bốc vác", "gia sư", "ca sĩ"],
    related: ["truong-hoc", "tinh-cach-tuoi", "ngu-hanh"],
    sections: [
      {
        id: "ky-nang",
        title: "Năm kỹ năng",
        blocks: [
          { p: "💪 Sức mạnh, 🏃 Nhanh nhẹn, 🧠 Thông minh, ✨ Duyên dáng, 🖐️ Khéo tay, mỗi kỹ năng từ 0 đến 100. Kỹ năng khởi đầu tùy loài và độ hiếm. Kỹ năng tăng khi làm nghề, đi học, chơi mini-game; **càng cao càng lên chậm**." },
        ],
      },
      {
        id: "nghe",
        title: "Năm nghề",
        blocks: [
          { p: `Mỗi nghề có 5 bậc: ${RANKS.join(" → ")}. Lương dưới đây là lương gốc mỗi giờ theo từng bậc.` },
          { table: { head: ["Nghề", "Kỹ năng chính", "Lương/giờ (bậc 1 → 5)", "Ghi chú"], rows: careerRows() } },
        ],
      },
      {
        id: "ca-lam",
        title: "Ca làm",
        blocks: [
          { list: [
            "Chọn ca **1, 2 hoặc 4 giờ thật**. Bé bận suốt ca, xong ca bấm nhận lương.",
            "Tối đa **8 giờ/ngày** (Sơ sinh và Nhí nhố 2 giờ, Thiếu niên và Lão làng 4 giờ).",
            "Cần **10 năng lượng mỗi giờ** ca và No bụng từ 15. Bé ốm không đi làm được.",
            "Mỗi giờ làm: kỹ năng chính +0,6 điểm (giảm dần khi đã cao), +4 XP.",
          ] },
        ],
      },
      {
        id: "luong",
        title: "Cách tính lương",
        blocks: [
          { p: "**Lương gốc = lương bậc × (0,8 + kỹ năng chính ÷ 200) × số giờ.** Ví dụ Pha chế bậc 1 (14 xu), Khéo tay 40, ca 4 giờ: 14 × 1,0 × 4 = 56 xu." },
          { p: "Lương gốc còn được nhân với:" },
          { list: [
            "Tuổi: Sơ sinh 50%, Nhí nhố 60%, Thiếu niên 85%; Trưởng thành trở đi có thêm thâm niên tới +30%.",
            "Tính cách: Chăm chỉ +10%, Ngủ nướng −5%.",
            "Hành vượng hôm nay +10%; bộ trang phục cùng hành 3/4/5 món +3/5/8%; bé Hỏa làm Bốc vác +5%.",
            "Dòng **Thu nhập ca làm** trên trang phục; Văn phòng Hội +3% mỗi cấp.",
          ] },
          { p: "Lương là thu nhập chịu thuế, xem [Thuế và Tòa thị chính](thue-toa-thi-chinh)." },
        ],
      },
      {
        id: "len-bac",
        title: "Lên bậc",
        blocks: [
          { table: { head: ["Lên bậc", "Giờ đã làm ở nghề", "Kỹ năng chính tối thiểu"], rows: promotionRows() } },
          { tip: "Chọn nghề theo kỹ năng mạnh nhất của bé, rồi cho bé đi [học](truong-hoc) kỹ năng đó để đủ điều kiện lên bậc sớm." },
          { p: "Ngoài 5 nghề, bé còn có thể trực [quầy trà sữa](quay-tra-sua) hoặc đứng máy ở [xưởng](khu-cong-nghiep), cho nhà mình hoặc làm thuê cho người khác (8–80 xu/giờ tùy chủ trả)." },
        ],
      },
    ],
  },
  {
    slug: "truong-hoc",
    title: "Trường học",
    category: "kiem-xu",
    emoji: "🏫",
    summary: "Năm lớp học 30 phút giúp tăng 2–4 điểm kỹ năng, mỗi môn 3 buổi một ngày.",
    keywords: ["học", "lớp", "trường", "kỹ năng", "mọt sách"],
    related: ["viec-lam", "tinh-cach-tuoi"],
    sections: [
      {
        id: "lop-hoc",
        title: "Lớp học",
        blocks: [
          { p: `Mở ở **cấp ${UNLOCKS.school}**. Mỗi buổi học **${SCHOOL.minutes} phút**, tốn **${SCHOOL.energy} năng lượng**, cho **+${SCHOOL.gain[0]} đến +${SCHOOL.gain[1]}** điểm vào kỹ năng của lớp và +5 XP. Mỗi môn học tối đa **${SCHOOL.perSkillPerDay} buổi một ngày**.` },
          { table: { head: ["Lớp", "Kỹ năng", "Học phí"], rows: classRows() } },
          { list: [
            `Tốc độ học theo tuổi: ${schoolByStage()}.`,
            "Tính cách **Mọt sách** học được thêm 25%.",
            "Bé ốm không đi học được.",
          ] },
          { p: PRICE_NOTE },
        ],
      },
    ],
  },
  {
    slug: "mini-game",
    title: "Mini-game",
    category: "kiem-xu",
    emoji: "🎣",
    summary: "Câu cá, Hứng trân châu, Ghép hình nhớ: cách chơi, cách tính xu, giới hạn mỗi ngày, rớt vật liệu và trang phục.",
    keywords: ["câu cá", "trân châu", "ghép hình", "trò chơi", "game", "rớt đồ", "drop"],
    related: ["trang-phuc", "san-nguyen-lieu"],
    sections: [
      {
        id: "tro-choi",
        title: "Ba trò chơi",
        blocks: [
          { p: "Vào **🎮 Khu vui chơi & Hồ câu**. Mỗi ván tốn **5 năng lượng**, cho **+3 XP** và tăng kỹ năng." },
          { table: { head: ["Trò", "Thời gian", "Cách chơi", "Kỹ năng"], rows: [
            ["🎣 Câu cá", "40 giây", "Bấm khi phao nằm trong vùng xanh. Cá hiếm có vùng xanh hẹp hơn và chạy nhanh hơn.", "Nhanh nhẹn"],
            ["🧋 Hứng trân châu", "30 giây", "Trân châu +1 điểm, trân châu vàng +5, đá lạnh −3. Xu = điểm × 0,5; cứ 4 viên trân châu được 1 phần Trân châu.", "Nhanh nhẹn"],
            ["🧩 Ghép hình nhớ", "60 giây", "Lật 16 thẻ tìm 8 cặp. Xu = số cặp × 3, thêm 12 xu nếu xong trong 12 lượt, 6 xu nếu trong 16 lượt.", "Thông minh"],
          ] } },
          { table: { head: ["Cá", "Phần cá", "Xu"], rows: fishRows() } },
        ],
      },
      {
        id: "gioi-han",
        title: "Giới hạn mỗi ngày",
        blocks: [
          { p: "Mỗi ngày tính thưởng tối đa **100 xu**, **10 phần cá** (1 lô) và **20 phần trân châu** (2 lô). Vượt mức vẫn chơi được, lấy XP và kỹ năng, nhưng không nhận thêm xu và nguyên liệu." },
        ],
      },
      {
        id: "rot-do",
        title: "Rớt vật liệu và trang phục",
        blocks: [
          { list: [
            `Mỗi ván có **${GEAR.materialChance}%** rớt thêm **${GEAR.materialQty[0]}–${GEAR.materialQty[1]} lô** một nguyên liệu thô ngẫu nhiên vào kho Sàn.`,
            `Mỗi ván có **${GEAR.gearDropChance}%** rớt **một món trang phục** ngẫu nhiên, cấp nào cũng có thể ra.`,
            "Dòng **🍀 May mắn** trên trang phục của bé làm cả hai tỉ lệ này cao hơn.",
          ] },
          { tip: "Mini-game là nguồn đồ **Vàng** và **Đỏ** chính cho người không mua bán. Chơi mỗi ngày dù đã chạm mốc 100 xu." },
        ],
      },
    ],
  },
  {
    slug: "vuon",
    title: "Vườn",
    category: "kiem-xu",
    emoji: "🌱",
    summary: "Bốn loại cây, thời gian lớn, sản lượng, mua thêm ô, nhờ bạn tưới và bắt sâu.",
    keywords: ["trồng", "cây", "chè", "dâu", "mía", "sắn", "tưới", "sâu", "thu hoạch"],
    related: ["san-nguyen-lieu", "bep", "ban-be"],
    sections: [
      {
        id: "cay",
        title: "Cây trồng",
        blocks: [
          { p: `Mở ở **cấp ${UNLOCKS.garden}**. Thu hoạch xong, nông sản vào thẳng kho Sàn (1 lô = 10 phần) để bán, nấu hoặc đưa vào xưởng.` },
          { table: { head: ["Cây", "Thời gian", "Hạt giống", "Sản lượng", "Vào kho"], rows: cropRows() } },
        ],
      },
      {
        id: "o-vuon",
        title: "Ô vườn",
        blocks: [{ p: "Có sẵn **4 ô**. Mua thêm ô thứ 5 đến thứ 9 với giá 300, 800, 2.000, 5.000, 9.000 xu; tối đa 9 ô." }],
      },
      {
        id: "tuoi-sau",
        title: "Tưới hộ và bắt sâu",
        blocks: [
          { list: [
            "**Chỉ bạn bè tưới hộ được**, bạn không tự tưới vườn mình. Ô được tưới cho thêm **20%** sản lượng; người tưới được 2 xu và 5 XP, tối đa 10 ô mỗi ngày.",
            "Khoảng 25% vụ có **sâu**. Không bắt thì mất 30% sản lượng.",
            "Bé chính hành **Mộc** giúp vườn thu thêm 15%.",
          ] },
          { tip: "Kết bạn với vài người chơi chăm và tưới vườn cho nhau mỗi ngày: ai cũng có thêm 20% nông sản và vài xu." },
        ],
      },
    ],
  },
  {
    slug: "bep",
    title: "Bếp",
    category: "kiem-xu",
    emoji: "🍳",
    summary: "Nấu món từ nguyên liệu trong kho, ba mức chất lượng, món ẩn và cách bán món cho quán ăn.",
    keywords: ["nấu", "món", "công thức", "món ẩn", "chất lượng", "tuyệt hảo"],
    related: ["vuon", "san-nguyen-lieu", "cho-phien"],
    sections: [
      {
        id: "mon",
        title: "Món nấu",
        blocks: [
          { p: `Mở ở **cấp ${UNLOCKS.kitchen}**. Mỗi lần nấu tốn **5 năng lượng**, +4 XP, dùng nguyên liệu (tính theo phần) trong kho Sàn.` },
          { table: { head: ["Món", "Hành", "Nguyên liệu (phần)", "Ăn được"], rows: dishRows() } },
          { p: `Ngoài ra còn **${HIDDEN_DISHES} món ẩn**. Không có công thức sẵn: vào **🧪 Thử công thức**, tự ghép đúng nguyên liệu là khám phá được món.` },
        ],
      },
      {
        id: "chat-luong",
        title: "Chất lượng",
        blocks: [
          { table: { head: ["Chất lượng", "Hiệu quả và giá trị"], rows: [["Thường", "×1"], ["Ngon", "×1,2"], ["Tuyệt hảo", "×1,5"]] } },
          { p: "Bé càng **Khéo tay** càng dễ ra món ngon. Bé **Kim** nấu như có thêm 15 Khéo tay; dòng **May mắn** trên trang phục cũng giúp." },
        ],
      },
      {
        id: "dung-mon",
        title: "Dùng món",
        blocks: [
          { list: [
            "Món để được **3 ngày**.",
            "Cho bé ăn: hồi chỉ số như bảng trên và +8 XP × chất lượng (hợp mệnh thêm 20%).",
            "Bán cho quán ăn: được **60%** giá trị món.",
            "Bày bán ở [Chợ Phiên](cho-phien) cho người chơi khác.",
          ] },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ Làm ăn
  {
    slug: "san-nguyen-lieu",
    title: "Sàn Nguyên Liệu",
    category: "kinh-te",
    emoji: "📈",
    summary: `${COMMODITY_COUNT} mặt hàng, giá chạy mỗi ${MARKET.tickMs / 60_000} phút, tin tức, phí ${MARKET.fee * 100}%, lệnh giới hạn, kho, độ tươi và sổ lãi lỗ.`,
    keywords: ["sàn", "chợ", "giá", "mua bán", "lô", "lệnh", "kho", "đầu cơ", "nguyên liệu"],
    related: ["vuon", "khu-cong-nghiep", "quay-tra-sua"],
    sections: [
      {
        id: "mat-hang",
        title: "Mặt hàng",
        blocks: [
          { p: `Mở ở **cấp ${UNLOCKS.market}**. Giá niêm yết theo **lô** (1 lô = 10 phần).` },
          { img: { src: "/petfarm/market.webp", alt: "Sàn Nguyên Liệu: bảng giá các mặt hàng và biểu đồ giá sữa tươi trong 24 giờ", width: 1600, height: 1075 } },
          { table: { head: ["Mặt hàng", "Loại", "Giá gốc/lô", "Hạn dùng", "Làm từ"], rows: commodityRows() } },
          { warn: "Lô quá hạn dùng tự mất. Đừng ôm nhiều lá trà, cá hay sữa tươi nếu chưa định dùng." },
        ],
      },
      {
        id: "gia",
        title: "Giá và tin tức",
        blocks: [
          { list: [
            `Giá chạy mỗi **${MARKET.tickMs / 60_000} phút** và luôn bị kéo dần về mức trung bình của mặt hàng.`,
            `Giá niêm yết gồm **${100 - MARKET.playerWeight * 100}% luật thị trường** và **${MARKET.playerWeight * 100}% lực mua bán của người chơi**: mỗi lệnh mua bán với hệ thống dồn thêm "áp lực" lên giá, áp lực tự phai dần (giảm một nửa sau ${MARKET.pressureHalfLifeMs / 3_600_000} giờ).`,
            "Mỗi mặt hàng thô có một **pha thị trường ẩn** (ổn định, tăng nóng, lao dốc, hỗn loạn), đổi bất chợt. Bạn chỉ đoán được qua biểu đồ.",
            `Thỉnh thoảng có **sốt giá hoặc sập giá** đột ngột ${MARKET.jumpMin * 100}–${MARKET.jumpMax * 100}%, kèm tin ⚡ trên Báo.`,
            `**Tin tức** (khoảng ${String(MARKET.newsPerDay).replace(".", ",")} tin mỗi ngày cho một mặt hàng) được báo trước ${MARKET.newsLeadMs / 60_000} phút rồi làm giá dịch chuyển trong vài giờ.`,
            `Giá không vượt quá ${MARKET.ceiling} lần giá gốc.`,
          ] },
        ],
      },
      {
        id: "do-tuoi",
        title: "Độ tươi của hàng",
        blocks: [
          { p: "Hàng có hạn dùng (lá trà, sữa, dâu, cá, thịt, xoài, trân châu, sữa đặc) mất dần độ tươi. Hệ thống mua hàng kém tươi rẻ hơn:" },
          { table: { head: ["Độ tươi", "Khi đã dùng", "Hệ thống trả"], rows: freshnessRows() } },
          { warn: "Hết hạn dùng thì lô hàng hư và tự mất." },
        ],
      },
      {
        id: "lai-lo",
        title: "Sổ lãi lỗ",
        blocks: [
          { list: [
            "Mỗi mặt hàng trong kho ghi **giá vốn trung bình** mỗi lô (đã tính phí), số tiền nếu bán ngay và **lãi lỗ chưa chốt**.",
            "Mỗi lần bán báo lãi hoặc lỗ so với giá vốn. **Sổ lãi lỗ** tổng hợp vốn đang nằm trong kho, lãi lỗ đã chốt hôm nay và 7 ngày, tỉ lệ lần bán có lãi và các lệnh khớp gần nhất.",
          ] },
        ],
      },
      {
        id: "giao-dich",
        title: "Mua bán",
        blocks: [
          { table: { head: ["Luật", "Con số"], rows: [
            ["Chênh mua, bán với hệ thống", `±${MARKET.spread * 100}%`],
            ["Phí giao dịch", "1% (tối thiểu 1 xu)"],
            ["Hạn mức với hệ thống", `${MARKET.npcDailyLots} lô mỗi mặt hàng, mỗi chiều, mỗi ngày`],
            ["Một lệnh", "0,1 đến 100 lô"],
            ["Lệnh giới hạn", "Giá trong khoảng ±15% giá hiện tại; khớp với lệnh của người chơi khác trước; chưa khớp thì chờ tới hết ngày"],
            ["Kho", "200 lô miễn phí → 500 lô (1.500 xu) → 2.000 lô (6.000 xu)"],
          ] } },
          { p: "Lãi khi bán (so với giá vốn từng lô) là thu nhập chịu thuế. Dòng **Thu nhập giao dịch** trên trang phục cho thêm xu mỗi lần bán." },
        ],
      },
    ],
  },
  {
    slug: "ngan-hang",
    title: "Ngân hàng",
    category: "kinh-te",
    emoji: "🏦",
    summary: "Tiết kiệm có lãi theo giờ, gửi kỳ hạn 3, 7, 14 ngày và cách Ngân hàng Trung ương điều chỉnh giá và lãi.",
    keywords: ["tiết kiệm", "lãi", "gửi tiền", "kỳ hạn", "ngân hàng trung ương", "lạm phát", "chỉ số giá"],
    related: ["tin-dung", "thue-toa-thi-chinh"],
    sections: [
      {
        id: "tiet-kiem",
        title: "Tiết kiệm",
        blocks: [
          { p: `**🏦 Ngân hàng Trân Châu** mở ở **cấp ${UNLOCKS.bank}**.` },
          { list: [
            "**Không kỳ hạn**: lãi tính theo giờ, cộng vào lúc nửa đêm. Chỉ **10.000 xu đầu** được tính lãi.",
            "Lãi suất cơ bản ban đầu **0,3%/ngày**; Ngân hàng Trung ương chỉnh trong khoảng 0,05–0,5%/ngày.",
            "**Có kỳ hạn** 3, 7 hoặc 14 ngày: lãi cơ bản cộng thêm 0,1, 0,2 hoặc 0,3 điểm %/ngày, chốt lúc gửi. Tối thiểu 100 xu. Đến hạn tự tất toán lúc nửa đêm.",
          ] },
          { warn: "Rút kỳ hạn trước hạn thì chỉ nhận lại gốc, mất toàn bộ lãi." },
        ],
      },
      {
        id: "nhtw",
        title: "Ngân hàng Trung ương",
        blocks: [
          { p: "Họp mỗi **nửa đêm cuối Chủ nhật**. Ngân hàng đo lượng xu bình quân của người chơi: nếu xu tăng nhanh hơn **10%/tuần**, chỉ số giá (giá Siêu thị, phí dịch vụ) tăng, có thể tới +4,5% một tuần, và lãi tiết kiệm giảm. Nếu xu co lại thì ngược lại." },
          { tip: "Thấy tin lãi giảm? Gửi kỳ hạn trước buổi họp để chốt lãi cũ." },
        ],
      },
    ],
  },
  {
    slug: "tin-dung",
    title: "Tín dụng và vay",
    category: "kinh-te",
    emoji: "💳",
    summary: `Điểm tín dụng 300–850, bốn hạng, vay trả góp từ cấp ${UNLOCKS.advanced}, hạn mức, phí và hậu quả khi trễ hạn.`,
    keywords: ["vay", "nợ", "tín dụng", "điểm tín dụng", "trả góp", "nợ xấu", "tài chính nâng cao"],
    related: ["ngan-hang", "khu-cong-nghiep"],
    sections: [
      {
        id: "diem",
        title: "Điểm tín dụng",
        blocks: [
          { p: "Ai cũng có điểm tín dụng, bắt đầu **500**, trong khoảng **300–850**." },
          { table: { head: ["Việc", "Điểm"], rows: [
            ["Trả góp đúng hạn", "+5"], ["Tất toán khoản vay", "+30"], ["Mỗi đêm giao đủ hợp đồng cung ứng", "+3"],
            ["Trễ một kỳ", "−20"], ["Phá hợp đồng", "−30"], ["Quầy hoặc xưởng bị đóng vì nợ thuê", "−40"], ["Vỡ nợ", "−100"],
          ] } },
          { table: { head: ["Hạng", "Điểm", "Hạn mức tối đa", "Phụ phí lãi"], rows: creditTierRows() } },
        ],
      },
      {
        id: "vay",
        title: "Vay trả góp",
        blocks: [
          { list: [
            `Cần bé đạt **cấp ${UNLOCKS.advanced}** để bật **Tài chính nâng cao**, tài khoản từ ${LOANS.minAccountDays} ngày tuổi, không có khoản đang trễ.`,
            "Tối đa **2 khoản** cùng lúc, mỗi khoản từ 50 xu, kỳ hạn **3, 7 hoặc 14 ngày**.",
            "Hạn mức = nhỏ hơn giữa hạn mức của hạng và (3 × thu nhập trung bình 7 ngày + 50% tiết kiệm), trừ dư nợ.",
            "Lãi = lãi cơ bản + phụ phí hạng (+ phụ phí lạm phát khi xu tăng nhanh). Phí giải ngân 2%.",
            "Mỗi kỳ tự trừ lúc nửa đêm, dùng cả tiền tiết kiệm.",
          ] },
          { warn: "Trễ kỳ thì mất phí 1% mỗi kỳ. Trễ **7 kỳ** là vỡ nợ: cấm vay 14 ngày và ngân hàng giữ 30% thu nhập mỗi ngày tới khi hết nợ." },
        ],
      },
    ],
  },
  {
    slug: "quay-tra-sua",
    title: "Quầy trà sữa",
    category: "kinh-te",
    emoji: "🧋",
    summary: "Ba vị trí, giấy phép và tiền thuê, sáu món, cách tính khách, bé trực, nâng cấp và uy tín.",
    keywords: ["kinh doanh", "quầy", "trà sữa", "bán hàng", "khách", "uy tín", "thuê", "quảng cáo"],
    related: ["san-nguyen-lieu", "khu-cong-nghiep", "hoi"],
    sections: [
      {
        id: "vi-tri",
        title: "Vị trí",
        blocks: [
          { p: `Mở ở **cấp ${UNLOCKS.business}**, mỗi người **một quầy**.` },
          { table: { head: ["Vị trí", "Giấy phép", "Thuê mỗi đêm", "Lượng khách gốc", "Quảng cáo 6 giờ"], rows: locationRows() } },
          { warn: "Tiền thuê trừ mỗi đêm. Nợ **3 đêm liền** thì quầy bị đóng và mất 40 điểm tín dụng." },
        ],
      },
      {
        id: "thuc-don",
        title: "Thực đơn",
        blocks: [
          { p: "Mỗi ly dùng nguyên liệu (tính theo phần) trong kho Sàn của chủ quầy. Giá bán đặt được từ 1 xu tới 3 lần giá tham chiếu." },
          { table: { head: ["Món", "Nguyên liệu mỗi ly", "Giá tham chiếu"], rows: recipeRows() } },
          { table: { head: ["Nâng cấp", "Tác dụng", "Giá các cấp"], rows: [
            ["Thêm món", "Thực đơn bắt đầu 2 món, mỗi cấp +1 (tối đa 6)", "500 / 1.000 / 2.000 / 4.000"],
            ["Quầy pha rộng hơn", "+4 ly mỗi giờ", "800 / 2.000"],
            ["Trang trí quầy", "+10% khách", "1.000 / 3.000"],
          ] } },
        ],
      },
      {
        id: "khach",
        title: "Khách và bé trực",
        blocks: [
          { list: [
            "Quầy **chỉ bán khi có bé trực**: bé nhà mình (không lương) hoặc thuê bé người khác (8–80 xu/giờ, trả trước, tối đa 3 người).",
            "Mỗi bé trực pha được 7 + Khéo tay ÷ 10 ly/giờ, cộng 4 ly mỗi cấp *Quầy pha rộng hơn*.",
            "Khách đông hơn vào **giờ cao điểm** 11–13 giờ và 17–21 giờ (×1,5), vắng từ 23 giờ tới 6 giờ.",
            "Khách tăng nhờ uy tín, trang trí, quảng cáo (+50%), đề xuất của Tòa thị chính, Biển hiệu Hội, bé **Có duyên** (+10%) và bé **Thủy** (+5%).",
            "Giá càng rẻ so với giá tham chiếu thì càng hút khách.",
          ] },
          { p: "**Uy tín** giảm khi hết hàng hoặc bán đắt hơn 1,3 lần giá tham chiếu, tăng dần khi bán từ 1,1 lần trở xuống. Doanh thu chịu thuế 3%, lợi nhuận tính vào thu nhập chịu thuế." },
          { tip: "Nhập nguyên liệu đủ cho giờ cao điểm. Hết hàng giữa giờ đông khách vừa mất doanh thu vừa mất uy tín." },
        ],
      },
    ],
  },
  {
    slug: "cho-phien",
    title: "Chợ Phiên",
    category: "kinh-te",
    emoji: "🏮",
    summary: "Bán đồ Siêu thị, trang phục (kể cả hộp chưa mở) và món tự nấu cho người chơi khác, đấu giá trang phục: giá, phí, điều kiện.",
    keywords: ["chợ", "bán đồ", "mua đồ", "trao đổi", "người chơi", "phiên", "đấu giá", "trả giá", "hộp"],
    related: ["trang-phuc", "bep", "san-nguyen-lieu"],
    sections: [
      {
        id: "luat",
        title: "Luật Chợ Phiên",
        blocks: [
          { p: `Mở ở **cấp ${UNLOCKS.bazaar}**. Ở đây người chơi bày bán cho nhau.` },
          { table: { head: ["Luật", "Con số"], rows: [
            ["Bán được", "Đồ Siêu thị trong túi, trang phục (đã mở hoặc còn nguyên hộp), món tự nấu"],
            ["Giá", "50–300% giá tham chiếu (trang phục: giá shop × 1, 2, 4 hoặc 8 theo cấp; hộp chưa mở tính ×1)"],
            ["Phí đăng tin", "1%"],
            ["Phí khi bán được", "5% (người bán trả)"],
            ["Thời hạn tin", "48 giờ (món nấu không quá hạn dùng của món)"],
            ["Điều kiện bày bán", `Tài khoản từ ${BAZAAR.minAccountDays === 1 ? "24 giờ" : `${BAZAAR.minAccountDays} ngày`} tuổi, tối đa ${BAZAAR.maxListings} tin cùng lúc; mua thì được ngay từ đầu`],
          ] } },
          { p: "Hộp trang phục chưa mở bán nguyên hộp: người mua chỉ thấy các loại chỉ số món đó có thể ra, cấp và % chỉ lộ khi mở." },
          { p: "Dòng **Thu nhập giao dịch** trên trang phục của bé chính cho thêm xu mỗi lần bán được." },
        ],
      },
      {
        id: "dau-gia",
        title: "Đấu giá trang phục",
        blocks: [
          { p: "Trang phục không cần nữa có thể đem **đấu giá** ở tab 🔨 Đấu giá: đặt giá khởi điểm và thời hạn, ai trả cao nhất khi hết giờ thì được món." },
          { table: { head: ["Luật", "Con số"], rows: [
            ["Giá khởi điểm", "10–300% giá tham chiếu"],
            ["Thời hạn", "6, 12 hoặc 24 giờ"],
            ["Bước giá", "Cao hơn giá đang dẫn ít nhất 5% (tối thiểu 1 xu)"],
            ["Xu khi trả giá", "Bị giữ lại; có người trả cao hơn thì hoàn ngay"],
            ["Trả giá sát giờ", "Trong 5 phút cuối thì phiên kéo dài thêm 5 phút"],
            ["Phí", "1% giá khởi điểm khi mở phiên, 5% giá chốt khi bán được"],
            ["Giới hạn", "Tối đa 5 phiên cùng lúc; chưa ai trả giá thì hủy được"],
          ] } },
          { p: "Hết giờ mà không ai trả giá thì món về lại tủ đồ." },
        ],
      },
    ],
  },
  {
    slug: "khu-cong-nghiep",
    title: "Khu công nghiệp và hợp đồng",
    category: "kinh-te",
    emoji: "🏭",
    summary: "Bốn loại xưởng biến hàng thô thành hàng chế biến, gia công thuê, công nhân và hợp đồng cung ứng.",
    keywords: ["xưởng", "nhà máy", "gia công", "sản xuất", "hợp đồng", "cung ứng", "công nhân"],
    related: ["san-nguyen-lieu", "tin-dung", "quay-tra-sua"],
    sections: [
      {
        id: "xuong",
        title: "Xưởng",
        blocks: [
          { p: `Xây xưởng từ **cấp ${UNLOCKS.factory}**, tối đa **2 xưởng** mỗi người.` },
          { table: { head: ["Xưởng", "Mỗi mẻ", "Mẻ/giờ ở cấp 1", "Giá xây"], rows: factoryRows() } },
          { list: [
            "Nâng cấp 2.000, 4.000, 8.000 xu; mỗi cấp thêm 3 mẻ/giờ.",
            "Xưởng **chỉ chạy khi có bé đứng máy**: bé nhà mình hoặc công nhân thuê (8–80 xu/giờ, 1–3 người). Bé càng giỏi Sức mạnh và Khéo tay, xưởng càng nhanh (tới +30%); bé **Kim** thêm 10%.",
            "Thuê đất **50 xu mỗi đêm**. Nợ 3 đêm liền thì xưởng bị đóng, mất 40 điểm tín dụng.",
          ] },
        ],
      },
      {
        id: "gia-cong",
        title: "Gia công thuê",
        blocks: [
          { p: "Chủ xưởng đặt phí 0–100 xu mỗi mẻ. Người khác từ **cấp 2** gửi hàng thô tới gia công (1–100 mẻ một đơn). Đơn thuê được làm trước hàng của chủ. Phí gia công là thu nhập chịu thuế của chủ xưởng." },
          { tip: `Chưa đủ cấp ${UNLOCKS.factory} để xây xưởng? Mua hàng thô rẻ trên Sàn hoặc thu từ vườn, gửi gia công ở xưởng người khác rồi bán hàng chế biến.` },
        ],
      },
      {
        id: "hop-dong",
        title: "Hợp đồng cung ứng",
        blocks: [
          { p: `Mở ở **cấp ${UNLOCKS.contracts}**: hai người chơi thỏa thuận giao một mặt hàng đều đặn mỗi đêm với giá cố định.` },
          { list: [
            "Giao **1–20 lô mỗi đêm**, trong **3–14 ngày**, giá chốt **50–200%** giá Sàn hiện tại. Tối đa 5 hợp đồng đang mở; đề xuất hết hạn sau 48 giờ.",
            "Ký quỹ: bên mua giữ tiền một ngày, bên bán giữ 20% tổng giá trị.",
            "Giao thiếu: bồi thường phần chênh giá thị trường (nếu giá đã lên) cộng 10% giá trị phần thiếu.",
            "Phá hợp đồng: bên kia nhận 10% giá trị phần còn lại, bên phá mất 30 điểm tín dụng. Mỗi đêm giao đủ, cả hai được +3 điểm.",
          ] },
        ],
      },
    ],
  },
  {
    slug: "thue-toa-thi-chinh",
    title: "Thuế và Tòa thị chính",
    category: "kinh-te",
    emoji: "🏛️",
    summary: "Thuế thu nhập lũy tiến theo ngày, ngân sách thị trấn và bỏ phiếu chọn đề xuất chi tiêu mỗi tuần.",
    keywords: ["thuế", "ngân sách", "bỏ phiếu", "đề xuất", "tòa thị chính", "lễ hội"],
    related: ["ngan-hang", "quay-tra-sua", "moi-ngay"],
    sections: [
      {
        id: "thue",
        title: "Thuế thu nhập",
        blocks: [
          { p: "Thuế tính theo thu nhập chịu thuế **trong ngày**, thu lúc nửa đêm, lũy tiến từng bậc:" },
          { table: { head: ["Phần thu nhập trong ngày", "Thuế suất"], rows: taxRows() } },
          { list: [
            "Thu nhập chịu thuế: lương, tiền thưởng mini-game, lãi ngân hàng, phí gia công nhận được, lợi nhuận quầy, lãi khi bán hàng trên Sàn (so với giá vốn).",
            "Thiếu tiền nộp thì ghi nợ thuế. Quầy trà sữa còn chịu thêm 3% thuế doanh thu.",
            "Một nửa mọi khoản thuế và phí đi vào **ngân sách thị trấn**, dùng cho trợ cấp tân thủ, dự án Hội và các đề xuất.",
          ] },
          { tip: `Người chơi kiếm dưới ${BRACKETS[0][0]} xu một ngày không phải nộp thuế.` },
        ],
      },
      {
        id: "bo-phieu",
        title: "Bỏ phiếu",
        blocks: [
          { p: `Từ **cấp ${UNLOCKS.townhall}**. Mỗi tuần (thứ Hai tới hết Chủ nhật) Tòa thị chính đưa ra **3 trong 6** đề xuất. Mỗi người một phiếu, đổi được. Đề xuất nhiều phiếu nhất thắng (hòa thì chọn cái rẻ hơn) và chỉ được làm khi ngân sách đủ tiền.` },
          { table: { head: ["Đề xuất", "Chi phí", "Tác dụng"], rows: proposalRows() } },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ Cộng đồng
  {
    slug: "gia-toc",
    title: "Gia tộc",
    category: "kinh-te",
    emoji: "🏯",
    summary: `Lập hoặc vào gia tộc từ cấp ${CLAN.unlockLevel}: góp quỹ, lên cấp gia tộc, thâu tóm tới 3 ngành, chia cổ tức và nộp thuế doanh nghiệp.`,
    keywords: ["clan", "gia tộc", "tộc trưởng", "trưởng lão", "quỹ", "cổ tức", "ngành", "thâu tóm", "thuế doanh nghiệp"],
    related: ["so-nha-dat", "kinh-te-vi-mo", "hoi", "thue-toa-thi-chinh"],
    sections: [
      {
        id: "lap",
        title: "Lập và gia nhập",
        blocks: [
          { list: [
            `Mở khi có một bé đạt **cấp ${CLAN.unlockLevel}**. Vào màn **🏯 Gia tộc & Sở Nhà Đất** trên bản đồ phố.`,
            `**Lập gia tộc** tốn **${CLAN.createCost.toLocaleString("vi-VN")} xu**: đặt tên, chọn huy hiệu và màu. Một nửa số tiền vào ngân sách thị trấn.`,
            "Mỗi người chỉ ở **một gia tộc**. Gia nhập tự do tới khi gia tộc đủ người.",
            "Vai trò: 👑 **Tộc trưởng** làm mọi việc; 🎖️ **Trưởng lão** mua đất, chọn ngành cho lô, lắp công trình; thành viên góp quỹ.",
            "Tộc trưởng rời thì trưởng lão (rồi người góp nhiều nhất) lên thay. Người cuối cùng rời thì gia tộc giải tán và đất trả về Sở Nhà Đất.",
          ] },
        ],
      },
      {
        id: "quy",
        title: "Quỹ và cấp gia tộc",
        blocks: [
          { list: [
            "Thành viên **góp quỹ** từ 10 xu; cứ 10 xu góp được 1 XP cho gia tộc.",
            `Mỗi tuần mỗi thành viên nên góp **${CLAN.donationQuotaPerLevel} × cấp gia tộc** xu. Phần góp thiếu làm gia tộc mất XP vào đêm Chủ nhật.`,
            `Mỗi đêm gia tộc trả **phí duy trì** ${CLAN.upkeepPerLevel} × cấp + ${CLAN.upkeepPerPlot} × số lô đất. Quỹ không đủ thì không trừ tiền mà mất XP.`,
            "Doanh thu sau thuế mỗi đêm cũng cộng XP (1 XP cho mỗi 100 xu).",
            "Tộc trưởng **chia cổ tức** từ quỹ, chia đều cho mọi thành viên.",
          ] },
          { table: { head: ["Cấp", "XP cần", "Thành viên tối đa", "Lô đất tối đa", "Số ngành", "Sản lượng thêm"], rows: clanLevelRows() } },
        ],
      },
      {
        id: "nganh",
        title: "Thâu tóm ngành",
        blocks: [
          { p: `Gia tộc chỉ làm ăn trên đất bằng những **ngành** đã thâu tóm. Có ${INDUSTRY_COUNT} ngành chia theo khối (các ngành na ná nhau đã được gộp, nhà máy gộp có nhiều dây chuyền để chọn):` },
          { table: { head: ["Khối", "Các ngành"], rows: sectorRows() } },
          { list: [
            `Ngành thứ 1, 2, 3 cần gia tộc đạt cấp ${CLAN.industryLevels.join(", ")}.`,
            `Thâu tóm phải trả **bồi thường thị trường** của ngành (xem bảng ở [Sở Nhà Đất và sản xuất](so-nha-dat)); từ ngành thứ hai trả gấp **${CLAN.expandMultiplier} lần**.`,
            "Nhiều gia tộc cùng một ngành thì ai cũng thu ít hơn vì phải chia khách.",
          ] },
        ],
      },
      {
        id: "thue",
        title: "Thuế doanh nghiệp",
        blocks: [
          { table: { head: ["Số ngành", "Thuế suất trên doanh thu"], rows: [1, 2, 3].map((n) => [n, `${Math.round((CLAN.baseTax + CLAN.extraTaxPerIndustry * (n - 1)) * 100)}%`]) } },
          { list: [
            "Thuế tính trên doanh thu mỗi đêm, trừ thẳng vào quỹ; một nửa vào ngân sách thị trấn.",
            `Cuối mỗi tháng gia tộc được **hoàn ${CLAN.refundRate * 100}%** số thuế đã nộp trong tháng (nếu ngân sách còn tiền).`,
            "Gia tộc tự khai phần doanh thu chịu thuế, mặc định 100%.",
          ] },
          { warn: "Khai thiếu doanh thu là trốn thuế. Sở thuế ghi lại phần khai thiếu và có thể truy thu kèm phạt. Phần hoàn thuế cuối tháng cũng tính trên số thuế thật sự đã nộp." },
        ],
      },
    ],
  },
  {
    slug: "so-nha-dat",
    title: "Sở Nhà Đất và sản xuất",
    category: "kinh-te",
    emoji: "🗺️",
    summary: `${LAND_RULES.count} lô đất có địa hình và khí hậu riêng, công trình lắp ghép, chuỗi sản xuất từ mỏ tới nhà máy, kho gia tộc và sàn công nghiệp.`,
    keywords: ["đất", "lô đất", "bản đồ", "sở nhà đất", "công trình", "khai thác", "nhà máy", "điện", "kho", "sàn công nghiệp", "nhập khẩu"],
    related: ["gia-toc", "kinh-te-vi-mo"],
    sections: [
      {
        id: "dat",
        title: "Mua đất",
        blocks: [
          { list: [
            `Bản đồ có **${LAND_RULES.count} lô**. Giá một lô từ khoảng ${LAND_RULES.minPrice.toLocaleString("vi-VN")} tới ${LAND_RULES.maxPrice.toLocaleString("vi-VN")} xu tùy vị trí, trung tâm đắt nhất.`,
            "Tộc trưởng hoặc trưởng lão mua bằng **quỹ gia tộc**, tối đa theo cấp gia tộc. Đất càng ít lô trống càng đắt; giá đất còn chạy theo kinh tế vĩ mô.",
            `${CLAN.land.treasuryShare * 100}% tiền mua đất vào ngân sách thị trấn, phần còn lại biến mất khỏi nền kinh tế.`,
            "Giá trị lô tăng dần theo thời gian (mỗi lô có % tăng giá riêng) và theo chỉ số giá đất.",
            `Bán lại cho Sở Nhà Đất được **${CLAN.land.resaleRate * 100}%** giá trị hiện tại; công trình trên lô bị dỡ.`,
          ] },
          { table: { head: ["Địa hình", "Đặc điểm"], rows: zoneRows() } },
          { p: `Mỗi lô còn có một kiểu khí hậu: ${climateNames()}. Ngành nào hợp địa hình và khí hậu của lô thì thu nhiều hơn.` },
        ],
      },
      {
        id: "cong-trinh",
        title: "Công trình",
        blocks: [
          { p: `Mỗi lô lắp được một công trình từ các mảnh ghép (tối đa ${DESIGN_RULES.maxPieces} mảnh). Công trình hoàn chỉnh cần ít nhất ${DESIGN_RULES.minPieces} mảnh và có móng nền; công trình hoàn chỉnh cho thêm tới 10% doanh thu của lô. Đổi ngành của lô không mất công trình.` },
        ],
      },
      {
        id: "dich-vu",
        title: `Ngành dịch vụ (${SERVICE_COUNT} ngành)`,
        blocks: [
          { p: "Ngành dịch vụ thu **xu** mỗi đêm theo giá trị lô, độ hợp địa hình và khí hậu, thời tiết, pha kinh tế, nhu cầu của ngành và số gia tộc cùng ngành." },
          { table: { head: ["Ngành", "Bồi thường thị trường", "Hợp đất nào nhất"], rows: industryRows("service") } },
        ],
      },
      {
        id: "san-xuat",
        title: "Chuỗi sản xuất",
        blocks: [
          { p: `Các ngành sản xuất làm ra **hàng hóa** (${GOODS_COUNT} loại) thay vì xu. Mỗi đêm các lô của gia tộc chạy lần lượt từ đầu chuỗi tới cuối chuỗi: khai thác, phát điện, rồi nhà máy, giới hạn bởi hàng trong kho và điện.` },
          { steps: [
            "**Khai thác**: mỗi lô có mỏ cố định theo địa hình và khí hậu (khoáng sản ở đồi núi, gỗ và cao su ở rừng, nông sản và gia súc ở đồng bằng, ven sông; muối, silic, dầu ven biển; dầu khí trên biển).",
            "**Năng lượng**: chọn loại nhà máy điện cho từng lô (than, khí, thủy điện, mặt trời, gió, hạt nhân); điện chạy nhà máy của gia tộc.",
            "**Công nghiệp nhẹ, nặng**: mỗi ngành một công thức biến nguyên liệu thành hàng giá trị cao hơn.",
            "Nguyên liệu gia tộc cần dùng được giữ trong **kho gia tộc**; điện thừa và hàng khác bán cho hệ thống theo giá vĩ mô của ngày.",
          ] },
          { table: { head: ["Khai thác", "Bồi thường", "Làm gì"], rows: industryRows("raw") } },
          { table: { head: ["Năng lượng", "Bồi thường", "Nhà máy chọn được"], rows: industryRows("energy") } },
          { table: { head: ["Công nghiệp nhẹ", "Bồi thường", "Công thức mỗi mẻ"], rows: industryRows("light") } },
          { table: { head: ["Công nghiệp nặng", "Bồi thường", "Công thức mỗi mẻ"], rows: industryRows("heavy") } },
        ],
      },
      {
        id: "kho-san",
        title: "Kho gia tộc và sàn công nghiệp",
        blocks: [
          { table: { head: ["Luật", "Con số"], rows: [
            ["Sức chứa kho", `${INDUSTRIAL_MARKET.warehouseBase.toLocaleString("vi-VN")} + ${INDUSTRIAL_MARKET.warehousePerLevel} × cấp gia tộc (đơn vị hàng, không tính điện)`],
            ["Bán ngay cho hệ thống", `${INDUSTRIAL_MARKET.npcBuy * 100}% giá tham chiếu của ngày`],
            ["Nhập khẩu từ hệ thống", `${INDUSTRIAL_MARKET.importMarkup * 100}% giá tham chiếu`],
            ["Đăng bán trên sàn chung", `${INDUSTRIAL_MARKET.band[0] * 100}–${INDUSTRIAL_MARKET.band[1] * 100}% giá tham chiếu, phí ${INDUSTRIAL_MARKET.fee * 100}%, tin còn ${INDUSTRIAL_MARKET.listingDays} ngày, tối đa ${INDUSTRIAL_MARKET.maxListings} tin`],
          ] } },
          { p: "Tiền bán hàng tính vào doanh thu chịu [thuế doanh nghiệp](gia-toc) cùng đêm." },
        ],
      },
    ],
  },
  {
    slug: "kinh-te-vi-mo",
    title: "Kinh tế vĩ mô",
    category: "kinh-te",
    emoji: "🌦️",
    summary: "Pha kinh tế và thời tiết đổi mỗi ngày, làm doanh thu gia tộc, giá đất và giá một số hàng trên Sàn lên xuống.",
    keywords: ["vĩ mô", "pha", "suy thoái", "tăng trưởng", "thời tiết", "bão", "giá đất", "chu kỳ"],
    related: ["gia-toc", "so-nha-dat", "san-nguyen-lieu", "ngan-hang"],
    sections: [
      {
        id: "pha",
        title: "Pha kinh tế",
        blocks: [
          { p: "Nền kinh tế của phố đi theo chu kỳ: Phục hồi → Tăng trưởng nóng → Đỉnh chu kỳ → Suy thoái → Phục hồi. Mỗi đêm có một xác suất nhỏ chuyển sang pha kế tiếp." },
          { table: { head: ["Pha", "Doanh thu gia tộc", "Giá đất mỗi ngày", "Khách"], rows: phaseRows() } },
        ],
      },
      {
        id: "thoi-tiet",
        title: "Thời tiết",
        blocks: [
          { p: "Mỗi ngày có một kiểu thời tiết. Thời tiết làm sản lượng các lô tăng hoặc giảm theo địa hình và khí hậu, và đẩy giá một số nguyên liệu trên [Sàn](san-nguyen-lieu)." },
          { table: { head: ["Thời tiết", "Sản lượng lô", "Giá trên Sàn"], rows: weatherRows() } },
          { tip: "Ngày Bão biển, các lô trên biển và ven biển thu ít hẳn đi, còn giá cá tươi trên Sàn tăng: đó là lúc người có cá trong kho nên bán." },
        ],
      },
      {
        id: "nhu-cau",
        title: "Nhu cầu từng ngành",
        blocks: [
          { p: "Mỗi ngành có một mức **nhu cầu** trôi dần theo ngày. Nhu cầu cao thì doanh thu của ngành dịch vụ và giá thu mua hàng của ngành sản xuất đều cao hơn. Màn Gia tộc hiện pha, thời tiết và nhu cầu hôm nay." },
        ],
      },
    ],
  },
  {
    slug: "ban-be",
    title: "Bạn bè",
    category: "cong-dong",
    emoji: "💌",
    summary: "Kết bạn, thăm nhà, thả tim, tặng quà và tưới vườn cho nhau.",
    keywords: ["kết bạn", "bạn", "thả tim", "tặng quà", "thăm nhà"],
    related: ["hoi", "cong-vien", "vuon"],
    sections: [
      {
        id: "ket-ban",
        title: "Kết bạn",
        blocks: [
          { p: "Vào **👥 Bạn bè & Hội**, gửi lời mời theo tên. Người kia đồng ý là thành bạn. Tối đa **100 bạn**." },
          { table: { head: ["Việc", "Giới hạn", "Được gì"], rows: [
            ["Thăm nhà", "Chỉ nhà bạn bè", "Ngắm bé và nhà của bạn"],
            ["Thả tim", "1 lần mỗi bạn mỗi ngày", "Bé chính của bạn +5 Vui vẻ; tính cho nhiệm vụ ngày"],
            ["Tặng quà", "5 món mỗi ngày, chỉ đồ ăn và đồ chăm sóc", "Món vào túi của bạn"],
            ["Tưới vườn", "10 ô mỗi ngày", "Vườn bạn +20% sản lượng; bạn được 2 xu, 5 XP"],
          ] } },
        ],
      },
    ],
  },
  {
    slug: "hoi",
    title: "Hội",
    category: "cong-dong",
    emoji: "👥",
    summary: "Lập hoặc vào Hội, quỹ chung, Văn phòng và Biển hiệu tăng lương và khách, dự án tuần.",
    keywords: ["guild", "bang", "hội", "quỹ", "văn phòng", "biển hiệu", "dự án"],
    related: ["ban-be", "quay-tra-sua", "viec-lam"],
    sections: [
      {
        id: "lap-hoi",
        title: "Lập và vào Hội",
        blocks: [
          { list: [
            `Vào Hội có sẵn từ cấp 1. **Lập Hội** cần cấp ${UNLOCKS.guild} và **2.000 xu**, tên 3–20 ký tự, chọn một trong 10 biểu tượng.`,
            "Mỗi Hội tối đa **20 thành viên**.",
            "Thành viên góp xu vào **quỹ Hội**; chỉ trưởng Hội tiêu quỹ.",
            "Trưởng Hội rời thì người kế tiếp lên thay. Hội không còn ai thì giải tán, quỹ mất.",
          ] },
        ],
      },
      {
        id: "nang-cap",
        title: "Nâng cấp Hội",
        blocks: [
          { table: { head: ["Công trình", "Tác dụng mỗi cấp", "Giá các cấp"], rows: [
            ["Văn phòng Hội", "+3% lương ca làm cho mọi thành viên", "3.000 / 8.000 / 20.000"],
            ["Biển hiệu Hội", "+5% khách cho quầy của thành viên", "2.500 / 7.000 / 18.000"],
          ] } },
        ],
      },
      {
        id: "du-an",
        title: "Dự án tuần",
        blocks: [
          { p: "Cả Hội góp nguyên liệu (tính theo lô) để xây công trình cho công viên chung. Xong thì Hội được danh vọng và mỗi thành viên nhận xu từ ngân sách thị trấn." },
          { table: { head: ["Dự án", "Cần", "Danh vọng", "Thưởng mỗi người"], rows: guildProjectRows() } },
        ],
      },
    ],
  },
  {
    slug: "cong-vien",
    title: "Công viên",
    category: "cong-dong",
    emoji: "🌳",
    summary: "Dắt bé chính đi dạo, chat, biểu cảm, vuốt ve và tặng đồ ăn cho bé người khác.",
    keywords: ["công viên", "chat", "vuốt ve", "gặp gỡ", "online", "vẫy tay"],
    related: ["ban-be", "hoi"],
    sections: [
      {
        id: "o-cong-vien",
        title: "Ở công viên",
        blocks: [
          { img: { src: "/petfarm/park.webp", alt: "Công viên với nhiều bé của người chơi quanh đài phun nước", width: 1400, height: 841 } },
          { list: [
            "Bạn dắt **bé chính** ra công viên; chọn bé chính ở Nhà bằng nút **⭐ Chọn thú chính**.",
            "Chat tối đa 120 ký tự mỗi tin; biểu cảm vẫy tay, nhảy, xoay.",
            "**Vuốt ve** bé khác: cả hai bé +6 Vui vẻ và +5 XP, người vuốt thêm 3 xu. Mỗi cặp chờ 30 giây giữa hai lần.",
            "Tặng đồ ăn, đồ chăm sóc ngay tại chỗ cho bé người khác.",
          ] },
          { tip: "Nhiệm vụ *Vuốt ve một bé ở công viên* xuất hiện thường xuyên. Ghé công viên lúc đông người là xong trong một phút." },
        ],
      },
    ],
  },
];
