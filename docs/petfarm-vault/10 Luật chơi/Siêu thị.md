---
tags: [petfarm, luat-choi, sieu-thi]
aliases: [Shop, Cửa hàng, Siêu thị NPC]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/game.js, petdex/server/routes.js, petdex/server/bank.js, public/ta-tua/game/js/app.js, public/ta-tua/game/js/ui.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Siêu thị

> [!summary]
> 🏪 Siêu thị là cửa hàng NPC bán 5 nhóm hàng: Đồ ăn, Chăm sóc, Đồ chơi, Phụ kiện (trang phục, bán dạng [[Hộp kín Siêu thị|hộp kín]]) và Trứng. Giá niêm yết là giá gốc nhân [[Chỉ số giá]] của [[Ngân hàng Trung ương]]. Đây là nơi tiêu xu chính cho việc chăm bé và là nguồn duy nhất của [[Trứng ngũ hành]].

## Cách hoạt động
- Danh mục `CATALOG` → `ITEMS` (`petdex/server/game.js:40-132`); client tải qua `GET /catalog` (giá gốc, `petdex/server/routes.js:65-101`).
- Mua: `POST /shop/buy {itemId, qty}` (`petdex/server/routes.js:286-313`).
- Giá thực trả: `indexedPrice(giá) = max(1, round(giá × chỉ số giá))` (`petdex/server/bank.js:40`), ghi sổ loại `shop`. Client hiển thị bằng cùng công thức (`priceOf`, `public/ta-tua/game/js/app.js:120`) và ghi chú "Giá đang cao/thấp hơn gốc N% theo chỉ số giá…" khi chỉ số lệch 1 (`public/ta-tua/game/js/app.js:823-826`).
- Bộ lọc: Tất cả, Đồ ăn, Chăm sóc, Đồ chơi, Phụ kiện, Trứng (`TYPE_ORDER`, `public/ta-tua/game/js/app.js:76`; nhãn `TYPE_LABELS`, `public/ta-tua/game/js/ui.js:8`).

## Con số: luật mua
| Luật | Giá trị | Lời báo | Nguồn |
|---|---|---|---|
| Số lượng mỗi lần | 1–20 (nút "×5" cho đồ dùng một lần) | "Số lượng không hợp lệ." | `petdex/server/routes.js:289`, `public/ta-tua/game/js/app.js:817-818` |
| Đồ chơi, trứng | chỉ mua khi chưa có trong túi, mỗi lần 1 | "Bạn đã có <món> rồi, món này dùng mãi mãi." | `petdex/server/routes.js:305-306` |
| Trang phục | mỗi lần 1 hộp | "Trang phục mua từng món một." | `petdex/server/routes.js:292` |
| Cấp yêu cầu | theo bé cao nhất | "Cần một bé đạt cấp N để mua món này." | `petdex/server/routes.js:293-294,307-308` |
| Thiếu xu | | lỗi từ sổ cái | [[Sổ cái]] |

## Danh mục (trừ trang phục)
| Món | Mã | Nhóm | Hành | Giá gốc | Hiệu quả | XP | Cấp |
|---|---|---|---|---|---|---|---|
| 🧋 Trà sữa trân châu | `boba` | Đồ ăn | Mộc | 12 | No +20, Vui +6 | 6 | 1 |
| 🐟 Cá tươi | `fish` | Đồ ăn | Thủy | 18 | No +32 | 8 | 1 |
| 🍙 Cơm nắm | `onigiri` | Đồ ăn | Thổ | 25 | No +45, NL +5 | 10 | 1 |
| 🍣 Khay sushi | `sushi` | Đồ ăn | Thủy | 45 | No +60, Vui +12 | 18 | 3 |
| 🍰 Bánh kem dâu | `cake` | Đồ ăn | Hỏa | 70 | No +30, Vui +35 | 30 | 5 |
| 🧃 Nước tăng lực | `juice` | Chăm sóc | Kim | 30 | NL +40 | 4 | 1 |
| 🛁 Tắm bong bóng | `bath` | Chăm sóc | Thủy | 35 | Vui +25, NL +10, Sạch +60 | 8 | 1 |
| 💊 Vitamin tổng hợp | `vitamin` | Chăm sóc | Kim | 55 | No +15, Vui +15, NL +25, Sức khỏe +15 | 12 | 4 |
| ⚽ Bóng nảy | `ball` | Đồ chơi | | 60 | mỗi lần chơi Vui +8, +4 XP | | 1 |
| 🧶 Cuộn len | `yarn` | Đồ chơi | | 90 | mỗi lần chơi Vui +12, +6 XP | | 2 |
| 🪁 Diều giấy | `kite` | Đồ chơi | | 180 | mỗi lần chơi Vui +18, +10 XP | | 6 |
| 🥚 Trứng Kim/Mộc/Thủy/Hỏa/Thổ | `egg_<hành>` | Trứng | theo tên | 600 | ấp 24 giờ ra một bé của hành đó | | 3 |

Nguồn: `petdex/server/game.js:41-53,117-122`. Chi tiết dùng: [[Đồ ăn và đồ chăm sóc]], [[Trứng ngũ hành]].

Trang phục: 55 món, giá 60–900 xu, cấp 1–40 ([[Danh mục trang phục]]); mua là [[Hộp kín Siêu thị]].

## Trường hợp đặc biệt
- Mô tả từng món (`desc`) hiện trong thẻ hàng, ví dụ Trà sữa "Món khoái khẩu của mọi bé rái cá." (`petdex/server/game.js:41`).
- Đồ chơi không bị hao mòn, mua một lần dùng mãi; chọn đồ chơi khi bấm Chơi đùa.
- Món đã mua có thể tặng bạn (đồ ăn, chăm sóc), bán ở [[Chợ Phiên]], hoặc cho bé ăn; Siêu thị không mua lại.
- Header màn: "🏪 Siêu thị · Đồ ăn và đồ chăm sóc dùng là hết. Đồ chơi mua một lần, dùng mãi. Phụ kiện mỗi lần mua là một hộp kín có 1–2 dòng +% ngẫu nhiên…" (`public/ta-tua/game/js/app.js:828`).

## Liên quan
- [[Đồ ăn và đồ chăm sóc]] · [[Hộp kín Siêu thị]] · [[Danh mục trang phục]] · [[Trứng ngũ hành]] · [[Chỉ số giá]] · [[Màn Siêu thị]] · [[Dòng xu trong game]]
