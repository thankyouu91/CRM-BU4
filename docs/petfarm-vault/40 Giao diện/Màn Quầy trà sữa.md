---
tags: [petfarm, giao-dien, man-hinh, quay-tra-sua, doanh-nghiep]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/business.js, public/ta-tua/game/js/charts.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Quầy trà sữa

> [!summary]
> Màn `#business` (tòa 🧋 trên bản đồ, cần `unlocks.business` = 4): chọn địa điểm và khai trương quầy, sau đó quản lý thực đơn nháp, kho nguyên liệu, lịch trực của bé, tin tuyển người làm thuê, quảng cáo, nâng cấp và báo cáo 7 ngày có biểu đồ. Luật ở [[Quầy trà sữa]].

## Khóa cấp

"🔒 Chưa đủ cấp mở quầy · Có một bé đạt cấp n là xin được giấy phép kinh doanh." (`public/ta-tua/game/js/views/business.js:16-21`). Máy chủ chặn ở `petdex/server/routes-community.js:26`.

## Chưa có quầy: khai trương

- Lưới địa điểm (`rules.locations`): icon, tên, "Giấy phép n 🪙", "Thuê n 🪙/ngày", "Khách qua ~n/giờ". Giá đã nhân `economy.priceIndex` ngay ở client (`business.js:25-38`).
- Form tên quầy 2–24 ký tự (gợi ý "Trà Sữa Rái Cá"), nút "Khai trương" → `POST /business/open {name, location}` (`business.js:39-42`, `business.js:212`).
- Ghi chú "Quầy dùng nguyên liệu trong kho của bạn (mua ở Sàn) và chỉ bán khi có bé trực. Nợ tiền thuê {unpaidLimit} đêm liền thì quầy đóng cửa." (`business.js:43`).
- Địa điểm mặc định `alley`, lưu ở biến module `setupLocation`.

## Đã có quầy

| Khối | Nội dung | Nút / API | Nguồn |
|---|---|---|---|
| Đầu quầy | tên, địa điểm, tiền thuê, "nợ tiền thuê n đêm" (đỏ); huy hiệu "🟢 Đang bán" / "⚪ Chưa có bé trực"; 4 ô Hôm nay (ly), Doanh thu, Khách bỏ đi, Uy tín (`★` × `round(rep×2)` + số 2 chữ số) | | `business.js:73-87` |
| 📋 Thực đơn | mỗi dòng: `<select>` công thức, ô giá, "tham chiếu · vốn · lời", "đủ cho n ly" (đỏ dưới 5), "Bỏ"; "＋ Thêm món (n/slots)"; "Lưu thực đơn" (chỉ bật khi có nháp), "Hủy thay đổi"; "Giá thấp hơn tham chiếu thì đông khách, cao quá 30% thì mất uy tín." | "Lưu thực đơn" → `POST /business/menu {menu}` | `business.js:47-65`, `business.js:89-95`, `business.js:178-181` |
| 🏚️ Nguyên liệu trong kho | các mặt hàng thực đơn đang dùng, số phần (đỏ dưới 10) | "📈 Mua thêm ở Sàn" → [[Màn Sàn]] | `business.js:97-102` |
| 👩‍🍳 Trực quầy | danh sách ca trực (bé nhà mình hoặc "của X · n 🪙/giờ", đếm ngược, "sắp vào"); mỗi bé rảnh có nút 1/2/4 giờ (chữ cố định ở client); form tuyển: Lương/giờ (`wageMin`–`wageMax`, mặc định 15), Số người (1–`maxStaffSlots`), "Đang tuyển"; "Lương được trừ khỏi ví bạn ngay khi bé người khác vào ca." | trực → `POST /jobs/start {petId, hours, businessId}`; "Lưu tin tuyển" → `POST /business/jobs {wage, slots, open}` | `business.js:104-123`, `business.js:182-184`, `business.js:213-215` |
| 📣 Quảng cáo & nâng cấp | "+{promoBoost×100}% khách trong {promoHours} giờ · còn …", nút giá; mỗi nâng cấp "cấp a/max" + giá hoặc "Tối đa" | `POST /business/promote`; `POST /business/upgrade {key}` | `business.js:125-136`, `business.js:185-188` |
| 📊 7 ngày gần nhất | `barChart` doanh thu (xanh `#58b98d`) và chi phí (vốn + thuê + lương + thuế, đỏ `#ef8a7a`); bảng Ngày, Ly, Doanh thu, Vốn, Thuê, Lương, Thuế, Lãi; rỗng: "Chưa có số liệu. Cho bé trực quầy để bắt đầu bán." | "Đóng cửa quầy" (`confirm('Đóng cửa quầy? Giấy phép sẽ không được hoàn lại.')`) → `POST /business/close` | `business.js:138-151`, `business.js:189-190` |

## Thực đơn nháp

`draftMenu` là bản sao thực đơn chỉ có ở client (biến module, sống qua các lần vẽ lại). Mọi thay đổi (`change` trên select/giá, thêm, bỏ) tạo nháp và chỉ gửi lên máy chủ khi bấm Lưu. Đổi công thức thì giá đặt lại về giá tham chiếu `ref`. "Thêm món" chọn công thức đầu tiên chưa có trong thực đơn (`business.js:6`, `business.js:163-177`, `business.js:194-207`).

## Làm mới

Interval 1 giây cập nhật đếm ngược ca trực, ca nào hết thì `ctx.refresh()` (`business.js:222-228`). API mở màn: `GET /business` (`business.js:218`).

## Liên quan
- [[Quầy trà sữa]], [[Thuê bé làm việc]], [[Thuế doanh nghiệp]], [[Sàn Nguyên Liệu]]
- [[Màn Việc làm]] (tin tuyển hiện ở đó), [[Màn Sàn]], [[Biểu đồ]], [[Nhiệm vụ ngày]] (quầy bán 20 ly)
