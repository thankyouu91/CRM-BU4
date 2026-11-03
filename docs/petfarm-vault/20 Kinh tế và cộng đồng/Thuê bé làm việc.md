---
tags: [petfarm, kinh-te, thue-be, viec-lam, nhan-vien]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/jobs.js, petdex/server/business.js, petdex/server/factory.js, petdex/server/rules/business.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Làm thuê, Tuyển nhân viên, Công nhân thuê]
---
# Thuê bé làm việc

> [!summary]
> Thị trường lao động giữa người chơi: chủ [[Quầy trà sữa]] và chủ xưởng ở [[Khu công nghiệp]] đăng tin tuyển (lương 8–80 xu/giờ, 1–3 người); người chơi khác cho bé nhận ca ở Trung tâm [[Việc làm]]. Lương được **giữ trước từ ví chủ** ngay khi nhận ca và trả cho người làm thuê khi xong ca. Bé nhà mình đứng quầy/máy thì không lương nhưng vẫn lên kỹ năng và XP.

## Cách hoạt động
1. **Đăng tin**: `POST /business/jobs` hoặc `POST /factory/:id/jobs` với `{ wage, slots, open }`; lương 8–80, 1–3 người (`petdex/server/business.js:229-239`, `petdex/server/factory.js:181-189`, `petdex/server/rules/business.js:35-37`).
2. **Danh sách việc**: chỉ tin đang mở, quầy/xưởng chưa đóng, không phải của mình, còn chỗ (`hired` = số ca của người khác còn chưa kết thúc), sắp theo lương giảm dần (`petdex/server/business.js:44-48,252-256`, `petdex/server/factory.js:36-40,240-244`).
3. **Nhận ca** (`startShift` với `businessId` hoặc `factoryId`): kiểm tra như ca thường (`checkShift` với nghề `shop` hoặc `factory`: giờ tối đa theo tuổi, bé rảnh, đủ sức…); tính `pay = wage × giờ` và trừ ví chủ ngay (`wage`, ghi vào `business_days.wages` / `factory_days.wages`). Chủ thiếu tiền: "Chủ quầy không đủ tiền trả lương lúc này." / "Chủ xưởng không đủ tiền trả lương lúc này." (`petdex/server/jobs.js:97-157`).
4. Trong ca, bé được tính vào công suất quầy (Khéo tay) hoặc vào số mẻ xưởng (bé có Sức mạnh + Khéo tay cao nhất quyết định) ([[Quầy trà sữa]], [[Khu công nghiệp]]).
5. **Nhận lương**: khi ca kết thúc, `claimShift` trả `pay` vào ví người làm (`salary`, chịu [[Thuế thu nhập]]), bé lên **Khéo tay** (quầy) hoặc **Sức mạnh** (xưởng) theo `SKILL_PER_HOUR × giờ` và XP theo `XP_PER_HOUR × giờ`; không thăng bậc nghề (`petdex/server/jobs.js:159-224`).

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Lương mỗi giờ | 8–80 xu (không nhân chỉ số giá) | `petdex/server/rules/business.js:35-36` |
| Số người tuyển | 1–3 mỗi quầy/xưởng | `petdex/server/rules/business.js:37`, `petdex/server/factory.js:183` |
| Lương ca bé nhà mình | 0 | `petdex/server/business.js:262`, `petdex/server/factory.js:251` |
| Kỹ năng lên khi trực quầy / đứng máy | Khéo tay / Sức mạnh | `petdex/server/jobs.js:198,214` |

## Trường hợp đặc biệt
- Lương làm thuê **không** nhân các thưởng nghề (Văn phòng Hội, tính cách, ngũ hành, thâm niên): đó là giá chủ đặt (`petdex/server/jobs.js:116-145`).
- Quầy/xưởng đóng cửa giữa ca: tiền đã giữ vẫn trả cho người làm khi xong ca (ca đã tạo).
- Lương ca thuê chưa nhận vẫn tính vào lượng xu của [[Ngân hàng Trung ương]] (`petdex/server/bank.js:28`).
- Đóng quầy hoặc xưởng tự đóng tin tuyển (`petdex/server/business.js:246`, `petdex/server/factory.js:235`).
- Bé đứng quầy mang tính cách **Có duyên** hoặc hành **Thủy** tăng khách cho quầy dù là bé thuê.

## Liên quan
- [[Việc làm]] · [[Quầy trà sữa]] · [[Khu công nghiệp]] · [[Kỹ năng]] · [[Module jobs]] · [[MOC Kinh tế và cộng đồng]]
