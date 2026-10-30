---
tags: [petfarm, giao-dien, man-hinh, cho-phien]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/bazaar.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Chợ Phiên

> [!summary]
> Chợ giữa người chơi (`#bazaar`, tòa 🛒 trên bản đồ nhưng tiêu đề màn dùng 🏮, cần `unlocks.bazaar` = 4). Ba tab: 🛍️ Mua (lọc loại, sắp xếp), 🏷️ Bán (bày đồ trong túi, trang phục có cấp, món tự nấu với giá tự đặt trong biên), 🧾 Lịch sử. Luật ở [[Chợ Phiên]].

## Khóa cấp

"🔒 Chợ Phiên chưa họp · Có một bé đạt cấp n là vào chợ mua bán được." (`public/ta-tua/game/js/views/bazaar.js:23-27`). Máy chủ: `petdex/server/routes-production.js:138,142`. Đầu màn có nút "🍳 Bếp" và "🛍️ Cửa hàng" (`bazaar.js:18-19`).

## Tab Mua

- Chip loại: Tất cả, Đồ ăn, Chăm sóc, Đồ chơi, Phụ kiện, Món nấu (`TYPES`); sắp xếp: Mới nhất, Giá hời (tỷ lệ giá/tham chiếu tăng dần), Sắp hết hạn (`SORTS`) (`bazaar.js:8-9`, `bazaar.js:77-89`).
- Thẻ tin: icon, tên, phẩm chất món nấu, chip cấp trang phục, loại, các dòng chỉ số, "Người bán **X**" hoặc "Tin của bạn", "⏳ còn …", "🦠 hư sau …"; giá và "n% giá tham chiếu" (xanh khi ≤ 100%) (`bazaar.js:58-75`).
- Nút: "Gỡ tin" (tin của mình), "Đã có" (đồ chơi dùng mãi đã có), "Thiếu xu", hoặc "Mua". Giá trên 150% tham chiếu thì hỏi lại "X đang bán n 🪙, bằng p% giá tham chiếu (r 🪙). Vẫn mua?" (`bazaar.js:51-56`, `bazaar.js:239-244`).
- Rỗng: "Chợ đang vắng, chưa ai bày hàng." / "Chưa có món nào thuộc loại này." + "Quay lại sau nhé!".

## Tab Bán

| Khối | Nội dung | Nguồn |
|---|---|---|
| Thông báo tuổi tài khoản | "⏳ Tài khoản cần đủ n ngày tuổi mới bày bán được, mở lúc {giờ ngày} (còn …). Trong lúc chờ bạn vẫn mua được." | `bazaar.js:130-133` |
| 🏷️ Đang bày (n/max) | tin đang mở, giá, % tham chiếu, đếm ngược, "Gỡ tin"; đủ chỗ: "Bạn đang bày đủ n món…" | `bazaar.js:134-149` |
| 🎒 Đồ trong túi | dòng bán "×qty"; ghi chú "Bé đang đeo món này, bày bán sẽ tháo ra." hoặc "Đây là món cuối cùng của bạn." | `bazaar.js:100-104`, `bazaar.js:150-154` |
| 🎀 Trang phục | mỗi bản trang phục một dòng, chip cấp + dòng chỉ số, cảnh báo đang đeo | `bazaar.js:97-99`, `bazaar.js:155-159` |
| 🍲 Món tự nấu | phẩm chất, "🦠 Hư sau … · tin hết hạn cùng lúc món hư" | `bazaar.js:105-107`, `bazaar.js:160-164` |

Mỗi dòng bán là một form: "Tham chiếu n 🪙 · cho phép lo–hi", ô giá (mặc định giá tham chiếu), nút "Bày bán" (khóa khi chưa được bán hoặc đã đủ tin), dòng tính "Phí đăng a 🪙 · bán được bạn nhận **b 🪙**" hoặc lỗi "Giá phải từ lo đến hi xu." (`bazaar.js:91-126`). Giá đang gõ lưu trong `drafts[kind:ref]` (biến module) nên không mất khi vẽ lại.

Công thức client: `band = refPrice × rules.band`, `listFee = max(1, round(p × listFee))`, `saleFee = max(1, round(p × saleFee))`, tiền nhận = `p − saleFee` (`bazaar.js:35-37`).

## Tab Lịch sử

"💰 Tin của bạn đã đóng" (đã bán cho ai và nhận bao nhiêu, "Hết hạn, món đã về túi", "Đã gỡ tin") và "🛍️ Bạn đã mua" (`bazaar.js:167-191`).

## Khối luật (`<details>` "❓ Luật chợ")

Biên giá theo tham chiếu, phí đăng không hoàn, phí bán, tin còn `rules.hours` giờ, tối đa `maxListings` tin, tài khoản cần `minAccountDays` ngày, đồ chơi chỉ mua khi chưa có, trang phục giữ nguyên cấp với giá tham chiếu "Xanh lam ×1, Xanh lục ×2, Vàng ×4, Đỏ ×8 giá cửa hàng" (khớp `TIER_VALUE` ở `public/ta-tua/game/js/shared/gear.js:15`), và dòng "Thu nhập giao dịch" của bé chính cộng thêm % khi bán (`bazaar.js:193-207`).

## API

| Hành động | API | Nguồn |
|---|---|---|
| Tải | `GET /bazaar` (quy tắc ghi đè `catalog.bazaar` bằng `d.rules`) | `bazaar.js:214-220` |
| Bày bán | `POST /bazaar/list {kind: 'item'|'gear'|'dish', ref, price}` | `bazaar.js:260-269` |
| Mua | `POST /bazaar/:id/buy` | `bazaar.js:244` |
| Gỡ tin | `confirm('Gỡ tin X? Món về lại túi, phí đăng tin n 🪙 không được hoàn.')` rồi `POST /bazaar/:id/cancel` | `bazaar.js:245-249` |

Làm mới: đồng hồ 1 giây; poll 60 giây **chỉ ở tab Mua**, khi tab trình duyệt hiện và không gõ ô nhập (`bazaar.js:271-281`).

> [!warning] Lệch tài liệu
> Biểu tượng tòa trên bản đồ là 🛒 (`public/ta-tua/game/js/views/map.js:21`) còn tiêu đề màn và nút ở Bếp dùng 🏮 (`bazaar.js:18`, `public/ta-tua/game/js/views/kitchen.js:185`). Câu báo tuổi tài khoản trong mã ("… ngày tuổi mới bày bán được", ngay sau là "mở lúc") có dấu gạch dài (`bazaar.js:131`).

## Liên quan
- [[Chợ Phiên]], [[Trang phục]], [[Cấp trang phục]], [[Bếp]], [[Siêu thị]]
- [[Màn Bếp]], [[Màn Siêu thị]], [[Màn Túi đồ]]
