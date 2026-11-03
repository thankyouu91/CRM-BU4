---
tags: [petfarm, giao-dien, man-hinh, tui-do, trang-phuc]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/app.js, public/ta-tua/game/js/shared/gear.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Túi đồ

> [!summary]
> Tab 🎒 Túi đồ (`#bag`): tủ trang phục (mỗi món một bản có cấp và dòng chỉ số riêng, kể cả hộp kín chưa mở) và lưới đồ dùng (đồ ăn, chăm sóc, đồ chơi, trứng). Mọi nút dùng/đeo áp cho bé đang chọn ở thanh đổi bé. Mã ở `gearShelf` và `renderBag` trong `app.js`.

## Bố cục

| Vùng | Nội dung | Nguồn |
|---|---|---|
| Đầu màn | "🎒 Túi đồ", "Đang dùng đồ cho **{bé}**. Đổi bé ở bên dưới." (hoặc "Nhận nuôi một bé để dùng đồ nhé."), nút "🛍️ Mua thêm" → [[Màn Siêu thị]] | `public/ta-tua/game/js/app.js:910-917` |
| Thanh đổi bé | `petSwitcher(pet, {withAdopt:false})`, không có nút nhận nuôi | `app.js:918` |
| 🎀 Trang phục | tiêu đề kèm "n món · {bé} đeo x/{wearLimit} món"; lưới thẻ `gear-card` | `app.js:855-891` |
| 🧺 Đồ dùng | lưới thẻ đồ không phải phụ kiện, sắp theo loại rồi giá | `app.js:890`, `app.js:895-897`, `app.js:920-932` |
| Rỗng | "Túi đồ trống trơn", nút "Tới cửa hàng" | `app.js:933-939` |

## Tủ trang phục

Thứ tự: hộp kín lên đầu, rồi cấp cao trước, rồi id mới trước (`app.js:856`).

| Loại thẻ | Hiển thị | Nút | API |
|---|---|---|---|
| Hộp kín (`sealed`) | 🎁, "Khe · hành", "{tên} Hộp chưa mở", "Bên trong có 1–2 dòng +% ngẫu nhiên. Mở ra mới biết là dòng nào." | "🎁 Mở hộp" (vàng) | `POST /gear/:id/open` |
| Món đang đeo ở bé đang chọn | huy hiệu "Đang đeo · {bé}", chip cấp (`tier-<tier>` đổi màu viền), danh sách dòng affix có tooltip mô tả | "Tháo ra" | `POST /pets/:id/equip {slot}` |
| Món khác | như trên | "Đeo cho {bé}" (bạc hà) | `POST /pets/:id/equip {gearId}` |

Nguồn: `app.js:858-888`, `app.js:1216`, `app.js:1225-1226`. Mở hộp chạy hiệu ứng `sparkleFx('jump')` (chỉ thấy khi có `homeStage`, tức ở Nhà).

## Đồ dùng

| Loại | Nút | API |
|---|---|---|
| Đồ ăn / chăm sóc (huy hiệu "×qty") | "Cho {bé} dùng" | `POST /pets/:id/use {itemId}` |
| Đồ chơi | "Chơi cùng {bé}" | `POST /pets/:id/play {toyId}` |
| Trứng | "Ấp trứng" | `POST /eggs/incubate {itemId}` |

Nguồn: `app.js:899-908`, `app.js:1206`, `app.js:1223-1224`.

> [!warning] Mã thừa
> Nhánh cuối của `useButton` ("Tháo ra" / "Đeo cho" với `data-equip`, `app.js:905-907`) không bao giờ chạy vì danh sách `owned` đã loại phụ kiện (`app.js:896`), và trình xử lý click cũng không có nhánh `data-equip`. Đây là dấu vết của hệ trang phục cũ trước khi có bản trang phục có cấp.

## Liên quan
- [[Trang phục]], [[Cấp trang phục]], [[Bộ đồ ngũ hành]], [[Đồ ăn và đồ chăm sóc]], [[Trứng ngũ hành]]
- [[Màn Nhà]] (hộp thoại Trang phục cùng dữ liệu), [[Màn Siêu thị]], [[Hình vật phẩm]], [[App shell]]
