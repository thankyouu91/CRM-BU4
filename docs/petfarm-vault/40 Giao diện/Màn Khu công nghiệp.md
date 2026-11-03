---
tags: [petfarm, giao-dien, man-hinh, khu-cong-nghiep, xuong]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/factory.js, public/ta-tua/game/css/production-a.css, public/ta-tua/game/css/production-b.css]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Khu công nghiệp

> [!summary]
> Màn `#factory` (tòa 🏭): hai tầng mở khóa trong cùng một màn. Từ cấp `unlocks.market` (= 2) người chơi gửi nguyên liệu nhờ xưởng người khác gia công; từ cấp `unlocks.factory` (= 6) mới tự xây xưởng, cho bé đứng máy, nhận gia công thuê, tuyển công nhân và xem báo cáo 7 ngày. Luật ở [[Khu công nghiệp]].

## Khóa cấp

| Cấp bé cao nhất | Thấy gì | Nguồn |
|---|---|---|
| dưới `unlocks.market` | "🔒 Khu công nghiệp chưa mở · Có một bé đạt cấp 2 là gửi hàng gia công được, cấp 6 là tự xây xưởng." | `public/ta-tua/game/js/views/factory.js:31-35` |
| từ `market` tới dưới `factory` | khối Xây xưởng chỉ có "🔒 Có một bé đạt cấp n là xây được xưởng. Trong lúc chờ, bạn vẫn gửi hàng nhờ xưởng người khác gia công được ở bên dưới." | `factory.js:36`, `factory.js:192` |
| từ `factory` | đầy đủ | |

Máy chủ: `UNLOCKS.factory` ở `petdex/server/routes-production.js:90`, gia công dùng `UNLOCKS.market` ở `routes-production.js:104`. Đầu màn có thêm 2 nút "📜 Hợp đồng" → [[Màn Hợp đồng]] và "📈 Sàn" → [[Màn Sàn]] (`factory.js:23-27`).

## Các khối

| Khối | Nội dung | Nguồn |
|---|---|---|
| ❓ Xưởng chạy thế nào? | `<details>` gập/mở (nhớ trạng thái ở `ui.help`): xưởng chỉ chạy khi có bé đứng máy; công suất "(gốc + perLevel × cấp) mẻ/giờ, thêm tới skillBoost% theo Sức mạnh và Khéo tay của bé giỏi nhất"; đơn gia công thuê làm trước; tiền thuê đất trừ mỗi đêm, nợ `unpaidLimit` đêm thì bị đóng và mất `credit.evicted` điểm tín dụng; gợi ý ký hợp đồng cung ứng | `factory.js:58-69`, `factory.js:294-296` |
| Thẻ xưởng | icon, tên, "cấp n" (hiển thị `level + 1`), công thức "a lô X → b lô Y", "🟢 Đang chạy" / "⚪ Đang nghỉ"; cảnh báo nợ thuê; 4 ô Công suất `rate–floor(rate×(1+skillBoost))` mẻ/giờ, Kho đủ cho n mẻ, Hôm nay n mẻ, Thuê đất/đêm; "Hết X trong kho: mua thêm ở Sàn hoặc ký hợp đồng…" | `factory.js:100-126` |
| 🧑‍🏭 Đứng máy | danh sách bé đang/sắp đứng máy (bé nhà mình / của ai, đếm ngược), nút "Cho bé đứng máy" → [[Màn Việc làm]]; rỗng: "Chưa có bé nào đứng máy, xưởng đang nghỉ." | `factory.js:71-77`, `factory.js:128-131` |
| ⬆️ Nâng cấp | "Lên cấp n: +perLevel mẻ/giờ" + giá, hoặc "Tối đa" | `factory.js:133-139` |
| 🤝 Nhận gia công thuê | form Phí/mẻ (0–`maxTollFee`), "Đang nhận", "Lưu"; hàng đợi đơn khách: tên, "done/batches mẻ · phí/mẻ", thanh | `factory.js:79-86`, `factory.js:141-150` |
| 📋 Tuyển công nhân | form Lương/giờ (`wageMin`–`wageMax` của quầy, mặc định 8–80 nếu catalog thiếu), Số người 1–3, "Đang tuyển", "Lưu tin" | `factory.js:17-18`, `factory.js:152-161` |
| 📊 7 ngày gần nhất | `barChart` cao 100 px: thu gia công (xanh) và thuê đất + lương (đỏ); bảng Ngày, Mẻ nhà, Mẻ thuê, Thu GC, Thuê, Lương | `factory.js:88-98`, `factory.js:271-274` |
| Đóng xưởng | link đỏ, khóa khi còn đơn gia công ("Còn đơn gia công đang chờ") | `factory.js:167` |
| 🏗️ Xây xưởng mới (n/max) | mỗi loại xưởng: công thức, Công suất, Thuê đất (`landRent × priceIndex`), "Lời gộp/mẻ ≈ ±n 🪙" (theo giá gốc × chỉ số giá), "Kho đủ cho n mẻ", nút "Xây · giá"; ghi chú lời gộp chưa trừ thuê và lương | `factory.js:52-55`, `factory.js:171-197` |
| 🔁 Gia công thuê | giải thích (nguyên liệu rời kho ngay, phí giữ trước, hủy thì nhận lại phần chưa làm), lưu ý "📦 Nhớ chừa chỗ trống trong kho Sàn…"; "Đơn của bạn" (thanh tiến độ, phí còn giữ, "Hủy"); "Xưởng đang nhận gia công" (tên, cấp, chủ, công thức, phí/mẻ, nút "Gửi hàng"/"Đóng") | `factory.js:215-263` |

### Form gửi hàng gia công

Mở dưới một xưởng (`ui.orderFor`): ô Số mẻ 1–100, chip 1/5/10 mẻ và "Hết hàng trong kho (n)"; khung xem trước liệt kê "Cần n lô X · kho m lô" (đỏ khi thiếu), "🪙 Phí giữ trước n × phí", "📦 Nhận về kho …"; nút "Gửi nguyên liệu" chỉ bật khi đủ hàng và xu. Gõ số mẻ chỉ cập nhật khung xem trước (`factory.js:199-213`, `factory.js:286-292`, `factory.js:325-330`).

## API

| Hành động | API | Xác nhận | Nguồn |
|---|---|---|---|
| Tải | `GET /factory` | | `factory.js:279` |
| Xây | `POST /factory/build {kind}` | "Xây X với giá n 🪙? Tiền xây không được hoàn lại, mỗi đêm trừ tiền thuê đất." | `factory.js:302-304` |
| Nâng cấp | `POST /factory/:id/upgrade` | | `factory.js:306` |
| Đóng | `POST /factory/:id/close` | "Đóng X? Tiền xây và nâng cấp không được hoàn lại." | `factory.js:307-309` |
| Cài gia công | `POST /factory/:id/toll {fee, open}` | | `factory.js:336-337` |
| Tin tuyển | `POST /factory/:id/jobs {wage, slots, open}` | | `factory.js:338-341` |
| Gửi đơn | `POST /factory/:id/order {batches}` | | `factory.js:342-345` |
| Hủy đơn | `POST /factory/orders/:id/cancel` | "Hủy đơn gia công? Bạn nhận lại nguyên liệu và phí của n mẻ chưa làm." | `factory.js:320-321` |

## Làm mới

- Đồng hồ 1 giây cho mọi `[data-until]`; mốc có `data-reload` (ca đứng máy) chạm 0 thì tải lại, tối đa một lần mỗi 15 giây.
- Poll 60 giây khi tab hiện và con trỏ không ở ô nhập của màn.
- `todayKey()` lấy ngày theo giờ Việt Nam (UTC+7) để khớp số liệu "Hôm nay" (`factory.js:11`, `factory.js:349-369`).

> [!warning] Lệch tài liệu
> Ô "Số người" của tin tuyển công nhân giới hạn cứng `max="3"` (`factory.js:156`), trong khi [[Màn Quầy trà sữa]] đọc `rules.maxStaffSlots`. Nếu máy chủ đổi số chỗ cho xưởng, giao diện không theo. Câu cảnh báo nợ thuê đất trong mã có dùng dấu gạch dài (`factory.js:119`), khác quy ước chữ của phần còn lại.

## Liên quan
- [[Khu công nghiệp]], [[Hợp đồng cung ứng]], [[Thuê bé làm việc]], [[Điểm tín dụng]], [[Kho Sàn]]
- [[Màn Việc làm]], [[Màn Hợp đồng]], [[Màn Sàn]], [[Biểu đồ]]
