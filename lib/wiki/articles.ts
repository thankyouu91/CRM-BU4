import { playUrl } from "@/lib/petdex-public";
import {
  GEAR, HIDDEN_DISHES, MASCOT, RANKS, SLOT_ORDER, SPECIES_COUNT, WEARABLE_COUNT,
  careerRows, classRows, cropRows, dishRows, elementRows, fishRows, foodRows, formRows, guildProjectRows,
  promotionRows, questRows, rarityRows, relationRows, setRows, slotName, speciesRows, stageRows, tierRows, toyRows, wearRows,
} from "./game-data";
import type { WikiArticle } from "./types";
import { article as A_tai_chinh } from "./articles/tai-chinh";
import { article as A_ngan_hang } from "./articles/ngan-hang";
import { article as A_tin_dung } from "./articles/tin-dung";
import { article as A_vay_ngang_hang } from "./articles/vay-ngang-hang";
import { article as A_hui } from "./articles/hui";
import { article as A_ngan_hang_gia_toc } from "./articles/ngan-hang-gia-toc";
import { article as A_vay_the_chap } from "./articles/vay-the-chap";
import { article as A_co_phan_gia_toc } from "./articles/co-phan-gia-toc";
import { article as A_thau_tom_gia_toc } from "./articles/thau-tom-gia-toc";
import { article as A_trai_phieu } from "./articles/trai-phieu";
import { article as A_lai_suat_co_ban } from "./articles/lai-suat-co-ban";
import { article as A_thue_toa_thi_chinh } from "./articles/thue-toa-thi-chinh";
import { article as A_gia_toc } from "./articles/gia-toc";
import { article as A_kinh_te_vi_mo } from "./articles/kinh-te-vi-mo";
import { article as A_so_cong_thuong } from "./articles/so-cong-thuong";
import { article as A_vat_pham_thiet_yeu } from "./articles/vat-pham-thiet-yeu";
import { article as A_lo_ren } from "./articles/lo-ren";
import { article as A_dau_truong } from "./articles/dau-truong";
import { article as A_san_nguyen_lieu } from "./articles/san-nguyen-lieu";
import { article as A_quay_tra_sua } from "./articles/quay-tra-sua";
import { article as A_cho_phien } from "./articles/cho-phien";
import { article as A_khu_cong_nghiep } from "./articles/khu-cong-nghiep";
import { article as A_so_nha_dat } from "./articles/so-nha-dat";
import { CLAN, UNLOCKS } from "./rules";
import { PARK } from "./rules-business";
import { isTaxed } from "./articles/money";
import { SCHOOL } from "@/petdex/server/rules/production.js";
import { DAILY_XP, EGG, LIFE_STAGES, UPKEEP } from "@/public/ta-tua/game/js/shared/pets.js";
import { DEFAULT_GEAR_CONFIG, TIERS, nextTier } from "@/public/ta-tua/game/js/shared/gear.js";
import { LEGEND_ID, MASCOT_ID, elementPets, formPets, legendaryPets, stagePets, unlockRows } from "./game-data";

// The wiki's articles, in reading order (the order of the side menu and of "previous / next").
// Numbers in prose were checked against petdex/server and the game's shared modules; tables come
// from lib/wiki/game-data.ts, which reads them from the game's rules. When a rule changes, fix
// the sentence here too.

/** How fast each age stage learns at school, e.g. "Sơ sinh ×1,3, ..." (from the game's life stages). */
const schoolByStage = () =>
  (LIFE_STAGES as { name: string; rules: { school: number } }[]).map((s) => `${s.name} ${s.rules.school ? `×${String(s.rules.school).replace(".", ",")}` : "chưa học được"}`).join(", ");

/** Nightly growth for the cap-do XP table (DAILY_XP in the game's shared/pets.js). */
const DAILY_XP_TEXT = `${Math.round(DAILY_XP.share * 100)}% XP cần lên cấp kế (ít nhất ${DAILY_XP.min}), ${DAILY_XP.weakFactor === 0.5 ? "một nửa" : `chỉ ${Math.round(DAILY_XP.weakFactor * 100)}%`} nếu Sức khỏe dưới ${DAILY_XP.weakBelow}`;

/** Forge upgrade odds, e.g. "Xanh lam → Xanh lục 30%, ..." (forge defaults in shared/gear.js). */
const UPGRADE_ODDS = Object.entries(DEFAULT_GEAR_CONFIG.forge.upgradeChance as Record<string, number>)
  .map(([t, pct]) => `${(TIERS as Record<string, { name: string }>)[t].name} → ${(TIERS as Record<string, { name: string }>)[nextTier(t) as string].name} ${String(pct).replace(".", ",")}%`).join(", ");

/** Accessory groups as the Siêu thị and Túi đồ show them (GEAR_GROUPS in public/ta-tua/game/js/app.js). */
const GEAR_GROUPS: Record<string, string> = {
  head: "🎩 Đội đầu", face: "👓 Đeo mặt", neck: "🧣 Đeo cổ", back: "🦋 Cánh & áo choàng", charm: "🏮 Cầm tay & bùa",
};
const GEAR_GROUP_TEXT = "**Đội đầu** (mũ, nơ, vương miện, hào quang), **Đeo mặt** (kính, mặt nạ), **Đeo cổ** (khăn, vòng, cà vạt, huy chương), **Cánh & áo choàng** (cánh, áo choàng, ba lô) và **Cầm tay & bùa** (đèn lồng, quạt, sáo, bùa may)";

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
    related: ["tai-khoan", "moi-ngay", "cham-soc", "cap-do", "ban-be"],
    sections: [
      {
        id: "vao-game",
        title: "Vào game",
        blocks: [
          { p: `**Pet Farm** (*Có làm mới có ăn*) chạy ngay trên trình duyệt, cả điện thoại lẫn máy tính, không cần cài gì. Trang chơi là **${playUrl().replace("https://", "")}**.` },
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
          { p: "Màn **Phố** là bản đồ: chạm vào tòa nhà nào là vào tòa nhà đó. Thanh trên cùng có Phố, Nhà, Túi đồ, Ví, Bạn bè, Công viên, **💬 Chat**, nút quà ngày, số xu, **📬 Hộp thư** và tên của bạn. Chat và hộp thư xem ở [Bạn bè](ban-be#tro-chuyen)." },
          { img: { src: "/petfarm/map.webp", alt: "Bản đồ Phố Trân Châu với nhà, siêu thị, việc làm, ngân hàng, Sàn Nguyên Liệu, trường học, phòng khám, công viên, bếp, vườn và chợ phiên", width: 1600, height: 961 } },
          { table: { head: ["Khu", "Để làm gì", "Mở ở cấp"], rows: [
            ["Nhà", "Cho ăn, tắm, chơi đùa, mặc đồ, chọn bé chính", 1],
            ["Siêu thị", "Mua đồ ăn, đồ chăm sóc, đồ chơi, phụ kiện, trứng", 1],
            ["Việc làm", "Nhận ca làm để kiếm lương", 1],
            ["Khu vui chơi", "Mini-game kiếm xu và nguyên liệu", 1],
            ["Phòng khám", "Khám, chữa bệnh, mua bảo hiểm", 1],
            ["Công viên", "Gặp người chơi khác, biểu cảm, vuốt ve bé", 1],
            ["Báo Trân Châu", "Tin thị trường, thông báo của Ban quản lý", 1],
            ["Lò rèn, Tiệm vật liệu", "Sửa, nâng cấp trang phục; mua vật liệu rèn. Xem [Lò rèn](lo-ren)", 1],
            ["Trường học", "Học thêm kỹ năng", UNLOCKS.school],
            ["Sàn Nguyên Liệu, Vườn", "Buôn nguyên liệu, trồng cây", UNLOCKS.market],
            ["Ngân hàng, Tòa thị chính, Bếp", "Gửi tiết kiệm, bỏ phiếu, nấu món", UNLOCKS.bank],
            ["Quầy trà sữa, Chợ Phiên", "Mở quầy bán trà sữa, bán đồ cho người chơi khác", UNLOCKS.business],
            ["Gia tộc, Sở Nhà Đất và Đấu trường", "Làm ăn chung, mua đất, vào ngành, thách đấu gia tộc khác", CLAN.unlockLevel],
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
          { tip: "Tin tức và thông báo của Ban quản lý ở **📰 Báo Trân Châu** trên bản đồ phố. Thông báo mới bật lên một lần khi bạn mở game." },
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
          { p: "Mã quà do đội ngũ Pet Farm phát trong các dịp sự kiện, dạng như **ABCD-EFGH** (không phân biệt chữ hoa, chữ thường)." },
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
            ["Đồ ăn, đồ chăm sóc", "4–30 tùy món (đồ NPC bị giảm XP khi thị trấn tự chủ, xem [Vật phẩm thiết yếu](vat-pham-thiet-yeu))"],
            ["Nhiệm vụ ngày", "10 mỗi nhiệm vụ"],
            ["Đi học", 5],
            ["Vuốt ve ở công viên", 5],
            ["Tưới hộ vườn bạn", 5],
            ["Nấu ăn", 4],
            ["Một ván mini-game", 3],
            ["Tắm, khám bệnh", 2],
            ["Tự lớn mỗi đêm, kể cả khi bạn không vào game", `${DAILY_XP_TEXT}. Xem [Tính cách, tuổi và vòng đời](tinh-cach-tuoi#tu-lon)`],
          ] } },
          { p: "XP được nhân thêm: **+10%** vào ngày hành của bé vượng (xem [Ngũ hành](ngu-hanh)), và theo tuổi: Sơ sinh ×1,5, Nhí nhố ×1,25, Thiếu niên ×1,1, Lão làng ×0,7. Đồ ăn hợp mệnh cho thêm 20% XP." },
        ],
      },
      {
        id: "mo-khoa",
        title: "Bảng mở khóa",
        blocks: [
          { p: "Các khu mở theo **cấp của bé cao nhất** trong nhà:" },
          { table: { head: ["Cấp", "Mở thêm"], rows: unlockRows({ 1: ["[Lò rèn và Tiệm vật liệu](lo-ren)"], [EGG.minLevel]: ["mua trứng ngũ hành"], [CLAN.unlockLevel]: ["[Gia tộc và Sở Nhà Đất](gia-toc)", "[Đấu trường](dau-truong)"] }) } },
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
            "**Tin tức, thông báo xem ở đâu?** Ở **📰 Báo Trân Châu** trên bản đồ phố. Thông báo của Ban quản lý được ghim ở đầu báo, cái mới nhất mở sẵn; thông báo mới còn bật lên một lần khi bạn mở game.",
            "**Nhắn riêng cho bạn ở đâu?** Mở tab **💬 Chat**, thẻ ✉️ Tin nhắn riêng, tìm theo tên người chơi. Muốn gửi thư thì dùng **📬 Hộp thư**. Xem [Bạn bè](ban-be#tro-chuyen).",
          ] },
        ],
      },
      {
        id: "nuoi-be",
        title: "Nuôi bé",
        blocks: [
          { list: [
            "**Không vào game thì bé có sao không?** Bé vẫn đói, buồn, bẩn dần theo giờ thật; để lâu sức khỏe tụt dưới 40 thì dễ ốm. Bù lại bé vẫn tự lớn thêm một ít XP mỗi đêm. Ghé mỗi ngày cho ăn và tắm là đủ. Xem [Chăm sóc bé](cham-soc).",
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
    related: ["sieu-thi", "tinh-cach-tuoi", "ngu-hanh", "vat-pham-thiet-yeu"],
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
            ["Cho ăn", "Một món đồ ăn trong Túi đồ", "Theo món, xem [Siêu thị](sieu-thi). Không cho ăn được khi No bụng từ 97. Đồ ăn NPC có hạn mức mỗi ngày và bớt XP khi thị trấn tự chủ, xem [Vật phẩm thiết yếu](vat-pham-thiet-yeu)."],
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
    keywords: ["tính cách", "tuổi", "già", "chết", "mất", "đồi sao", "kỷ vật", "tưởng niệm", "tuổi thọ", "thâm niên", "thả bé", "xóa bé"],
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
      {
        id: "tha-be",
        title: "Thả bé",
        blocks: [
          { p: "Ở màn **🏠 Nhà**, dưới các nút chăm sóc có liên kết **🕊️ Thả bé**: gõ đúng tên bé để xác nhận, bé rời bạn mãi mãi." },
          { list: [
            "Khác với bé mất: **không** lên Đồi Sao, **không** để lại kỷ vật, ô được trả lại ngay (không thành ô tưởng niệm).",
            "Trang phục bé đang đeo về **tủ đồ**; lương ca đã làm mà chưa nhận được trả nốt. Bé là thú chính thì bé kế tiếp lên thay.",
            "Không thả được **bé duy nhất**, bé **đang bận** (đi làm, đi học, đang tắm) hay bé đang **đứng máy ngành chiến lược** của gia tộc.",
            "Thả rồi thì không lấy lại được: kỹ năng, cấp và tính cách của bé mất hẳn.",
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
    summary: `${WEARABLE_COUNT} món đồ đeo ở 5 khe, 4 cấp Xanh lam, Xanh lục, Vàng, Đỏ, các dòng chỉ số, hộp kín ở Siêu thị, số món đeo theo cấp, đồ hỏng, sửa và nâng cấp ở Lò rèn.`,
    keywords: ["đồ", "gear", "phụ kiện", "đồ đeo", "cấp đồ", "đỏ", "vàng", "hộp", "may mắn", "bùa", "khe"],
    related: ["ngu-hanh", "sieu-thi", "mini-game", "cho-phien", "lo-ren", "dau-truong"],
    sections: [
      {
        id: "khe",
        title: "Khe và số món được đeo",
        blocks: [
          { p: `Có 5 khe: ${SLOT_ORDER.map(slotName).join(", ")}. Mỗi khe đeo một món. Món Bùa lơ lửng bên hông bé.` },
          { p: `Trong Siêu thị và Túi đồ, phụ kiện chia theo nhóm ${GEAR_GROUP_TEXT}; bấm hàng nút trên cùng để nhảy tới nhóm.` },
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
            ["[Lò rèn](lo-ren): nâng cấp một món lên cấp kế", `Xanh lục, Vàng, Đỏ (${UPGRADE_ODDS})`],
          ] } },
          { steps: [
            "Mua hộp ở Siêu thị (nút **🎁 Mua hộp**).",
            "Vào **Túi đồ**, bấm **🎁 Mở hộp** để biết cấp và các dòng.",
            "Mở hộp xong mới đeo hoặc bày bán được.",
          ] },
          { p: "Trước khi mua, mỗi món cho biết **các loại chỉ số có thể ra**: hai loại theo hành và một loại theo khe. Hộp Siêu thị (Xanh lam, Xanh lục) chỉ ra dòng trong nhóm này; đồ Vàng, Đỏ có thêm loại ngoài nhóm. Cấp và % vẫn chỉ biết khi mở hộp." },
          { warn: "Muốn đồ Vàng, Đỏ thì chơi mini-game đều đặn, săn mã quà, mua ở Chợ Phiên hoặc thử **nâng cấp ở [Lò rèn](lo-ren)** (tốn nhiều xu và vật liệu, tỉ lệ thấp). Món đang bày bán hoặc đấu giá ở Chợ Phiên bị tháo ra và không đeo được." },
        ],
      },
      {
        id: "do-hong",
        title: "Đồ hỏng",
        blocks: [
          { p: "Sau một trận ở [Đấu trường](dau-truong), **mọi món đang đeo trên mọi bé** của người ra sân hỏng hẳn. Món hỏng vẫn đeo trên bé nhưng không cộng dòng chỉ số và không tính vào bộ đồ theo hành, cho tới khi sửa xong ở [Lò rèn](lo-ren)." },
          { warn: "Đồ hỏng hoặc đang sửa ở Lò rèn không bày bán hay đấu giá được ở Chợ Phiên. Bán nhanh cho Siêu thị thì chỉ được mức thấp nhất." },
        ],
      },
      {
        id: "ban-do",
        title: "Bán đồ không cần nữa",
        blocks: [
          { table: { head: ["Cách bán", "Thu về"], rows: [
            ["**Bán nhanh** cho Siêu thị (nút 💰 trong Túi đồ)", "10–40% giá trị món (giá shop × hệ số cấp), dòng chỉ số quay càng cao trong biên độ của cấp càng được nhiều; hộp chưa mở 10% giá shop; **đồ hỏng** cũng chỉ được mức thấp nhất (10% giá trị món)"],
            ["Bày bán ở [Chợ Phiên](cho-phien)", "Giá tự đặt 50–300% tham chiếu, trừ phí"],
            ["Đấu giá ở [Chợ Phiên](cho-phien#chuc-nang)", "Giá người chơi trả, trừ phí"],
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
  A_lo_ren,
  {
    slug: "sieu-thi",
    title: "Siêu thị",
    category: "nuoi-be",
    emoji: "🏪",
    summary: "Giá, hiệu quả và cấp mở của mọi món: đồ ăn, đồ chăm sóc, đồ chơi, trứng và phụ kiện theo từng nhóm; hạn mức đồ NPC và hàng gia tộc.",
    keywords: ["mua", "giá", "đồ ăn", "thức ăn", "đồ chơi", "vitamin", "sushi", "bánh", "phụ kiện", "shop"],
    related: ["cham-soc", "trang-phuc", "cac-loai", "vat-pham-thiet-yeu"],
    sections: [
      {
        id: "do-an",
        title: "Đồ ăn và đồ chăm sóc",
        blocks: [
          { p: "Dùng là hết. Mỗi lần mua tối đa 20 món. Đồ ăn, đồ chăm sóc NPC có **hạn mức mỗi ngày** và XP giảm dần khi thị trấn tự chủ; hàng gia tộc (Suất ăn gia tộc, Bộ chăm sóc gia tộc, hạng Thường / Ngon / Tuyệt hảo) chỉ có khi Siêu thị còn hàng. Bảng dưới chỉ ghi đồ NPC; hàng gia tộc tính giá theo giá tham chiếu hôm nay, xem [Vật phẩm thiết yếu](vat-pham-thiet-yeu)." },
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
          { p: `Trong Siêu thị, phụ kiện chia theo nhóm ${GEAR_GROUP_TEXT}; bấm nút trên cùng để nhảy tới nhóm. Mỗi nhóm xếp theo cấp mở rồi theo giá.` },
          ...SLOT_ORDER.map((s) => ({ table: { head: [GEAR_GROUPS[s] ?? slotName(s), "Hành", "Giá", "Cấp"], rows: wearRows(s) } })),
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
    related: ["trang-phuc", "san-nguyen-lieu", "lo-ren"],
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
          ...(isTaxed("minigame") ? [{ p: "Xu thưởng mini-game là **thu nhập chịu thuế**, cộng với lương và các khoản khác trong ngày. Xem [Thuế và Tòa thị chính](thue-toa-thi-chinh)." }] : []),
        ],
      },
      {
        id: "rot-do",
        title: "Rớt vật liệu và trang phục",
        blocks: [
          { list: [
            `Mỗi ván có **${GEAR.materialChance}%** rớt thêm **${GEAR.materialQty[0]}–${GEAR.materialQty[1]} lô** một nguyên liệu thô ngẫu nhiên vào kho Sàn. Vật liệu này còn dùng để sửa và nâng cấp trang phục ở [Lò rèn](lo-ren).`,
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
  A_san_nguyen_lieu,
  A_tai_chinh,
  A_ngan_hang,
  A_tin_dung,
  A_vay_ngang_hang,
  A_hui,
  A_quay_tra_sua,
  A_cho_phien,
  A_khu_cong_nghiep,
  A_ngan_hang_gia_toc,
  A_vay_the_chap,
  A_co_phan_gia_toc,
  A_thau_tom_gia_toc,
  A_trai_phieu,
  A_lai_suat_co_ban,
  A_thue_toa_thi_chinh,

  // ------------------------------------------------------------------ Cộng đồng
  A_gia_toc,
  A_so_nha_dat,
  A_kinh_te_vi_mo,
  A_so_cong_thuong,
  A_vat_pham_thiet_yeu,
  {
    slug: "ban-be",
    title: "Bạn bè",
    category: "cong-dong",
    emoji: "💌",
    summary: "Kết bạn, thăm nhà, thả tim, tặng quà, tưới vườn cho nhau, trò chuyện ở tab Chat và gửi thư.",
    keywords: ["kết bạn", "bạn", "thả tim", "tặng quà", "thăm nhà", "chat", "trò chuyện", "tin nhắn", "nhắn riêng", "hộp thư", "thư", "chặn"],
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
      {
        id: "tro-chuyen",
        title: "Trò chuyện và hộp thư",
        blocks: [
          { p: "Bấm tab **💬 Chat** trên thanh trên cùng. Có ba thẻ:" },
          { table: { head: ["Thẻ", "Ai đọc", "Giữ tin"], rows: [
            ["🌐 Kênh chung", "Cả thị trấn", "7 ngày"],
            ["🏯 Gia tộc", "Thành viên gia tộc của bạn", "60 ngày"],
            ["✉️ Tin nhắn riêng", "Hai người, tìm người theo tên", "60 ngày"],
          ] } },
          { list: [
            "Mỗi tin tối đa **300 ký tự**, hai tin cách nhau ít nhất **2,5 giây**.",
            "Tài khoản mới tạo phải chờ **1 giờ** mới nói được ở kênh chung.",
            "Tab Chat có **chấm đỏ** khi có tin gia tộc hoặc tin nhắn riêng chưa đọc.",
            "**🚫 Chặn** một người thì tin của họ bị ẩn, họ không nhắn riêng hay gửi thư cho bạn được nữa.",
          ] },
          { p: "Bấm **📬 Hộp thư** ở góc trên để đọc và viết thư:" },
          { list: [
            "Thư gửi người chơi khác: tiêu đề tối đa **80 ký tự**, nội dung **2.000 ký tự**; mỗi 30 giây một thư, tối đa **20 thư** trong 24 giờ. Thư giữa người chơi không gửi kèm xu được.",
            "Ban quản lý có thể gửi thư cho riêng bạn hoặc cả thị trấn, có khi kèm xu: bấm **Nhận** (mỗi thư một lần) rồi mới xoá được thư.",
            "Thư đã đọc, không còn quà chưa nhận và quá 60 ngày thì tự xoá.",
          ] },
          { tip: "Công viên không còn khung chat: muốn nói chuyện với người đang ở công viên thì mở tab **💬 Chat**." },
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
          { p: "Cả Hội góp nguyên liệu (tính theo lô) để xây công trình cho công viên chung. Xong thì Hội được danh vọng và từng thành viên lần lượt nhận xu từ ngân sách thị trấn. Ngân sách cạn giữa chừng thì những người chưa tới lượt không được thưởng; chỉ người được trả mới nhận thư báo." },
          { table: { head: ["Dự án", "Cần", "Danh vọng", "Thưởng mỗi người"], rows: guildProjectRows() } },
        ],
      },
    ],
  },
  A_dau_truong,
  {
    slug: "cong-vien",
    title: "Công viên",
    category: "cong-dong",
    emoji: "🌳",
    summary: `Dắt bé chính đi dạo trong các kênh tối đa ${PARK.channelCap} người, biểu cảm, vuốt ve và tặng đồ ăn cho bé người khác, kể cả bé của người đang vắng.`,
    keywords: ["công viên", "biểu cảm", "vuốt ve", "gặp gỡ", "online", "vẫy tay", "kênh", "đổi kênh", "cư dân", "tặng quà"],
    related: ["ban-be", "hoi", "gia-toc"],
    sections: [
      {
        id: "o-cong-vien",
        title: "Ở công viên",
        blocks: [
          { img: { src: "/petfarm/park.webp", alt: "Công viên với nhiều bé của người chơi quanh đài phun nước", width: 1400, height: 841 } },
          { list: [
            "Bạn dắt **bé chính** ra công viên; chọn bé chính ở Nhà bằng nút **⭐ Chọn thú chính**. Mỗi người chỉ dắt một bé: mở công viên ở thẻ khác thì thẻ cũ bị thoát ra.",
            "Công viên rộng hơn màn hình; khung nhìn đi theo bé của bạn. Nút **?** dưới công viên nhắc cách chơi.",
            "Bấm nút biểu cảm vẫy tay, nhảy, xoay. Muốn trò chuyện thì mở tab **💬 Chat**, xem [Bạn bè](ban-be#tro-chuyen).",
            `**Vuốt ve** bé khác: cả hai bé +${PARK.cuddleHappiness} Vui vẻ và +${PARK.cuddleXp} XP, người vuốt thêm ${PARK.cuddleCoins} xu. Mỗi cặp bé chờ ${PARK.cuddleCooldownSec} giây giữa hai lần.`,
            "**Tặng** đồ ăn hoặc đồ chăm sóc trong túi của bạn cho người khác ngay tại chỗ: món đó chuyển vào Túi đồ của họ.",
          ] },
        ],
      },
      {
        id: "kenh",
        title: "Kênh",
        blocks: [
          { list: [
            `Công viên chia thành nhiều **kênh** (Kênh 1, Kênh 2, ...), mỗi kênh tối đa **${PARK.channelCap} người đang online**, nhiều nhất ${PARK.maxChannels} kênh.`,
            "Khi vào, bạn được xếp vào kênh còn chỗ có nhiều bạn bè và người cùng [gia tộc](gia-toc) nhất; không có ai quen thì vào kênh số nhỏ nhất còn chỗ. Rớt mạng rồi vào lại thì về kênh cũ nếu kênh đó còn chỗ.",
            "Bảng chọn kênh ở góc công viên ghi số người mỗi kênh; đổi sang kênh khác nếu kênh đó chưa đầy.",
            "Bạn chỉ thấy, vuốt ve và tặng quà cho bé trong cùng kênh.",
            `Mỗi kênh còn có tới **${PARK.residentsPerChannel} cư dân**: bé chính của những người đang vắng, đứng ở một chỗ cố định. Vuốt ve và tặng quà cho cư dân được như với bé đang online. Bạn rời công viên thì bé của bạn ở lại kênh vừa chơi làm cư dân.`,
          ] },
          { tip: "Nhiệm vụ *Vuốt ve một bé ở công viên* xuất hiện thường xuyên, và cư dân lúc nào cũng có sẵn trong kênh." },
        ],
      },
    ],
  },
];
