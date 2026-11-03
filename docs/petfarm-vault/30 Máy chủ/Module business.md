---
tags: [petfarm, may-chu, module, quay-tra-sua]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/business.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module business

> [!summary]
> `petdex/server/business.js` (345 dòng): quầy trà sữa. Bán hàng được **mô phỏng bù theo từng giờ** từ `sim_at` tới hiện tại (khi chủ mở màn quầy, đổi thực đơn, hoặc lúc nửa đêm): chỉ bán khi có bé trực, khách chia theo độ hấp dẫn giá, giới hạn bởi công suất và nguyên liệu trong kho của chủ. Luật: [[Quầy trà sữa]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `businessOf(userId)` | `business.js:61` | Quầy đang mở (menu, upgrades đã parse) |
| `simulate(biz, to, rand)` | `business.js:76-154` | Xem dưới; trả `{ cups, revenue }` |
| `syncBusiness(userId, now, rand)` | `business.js:157-162` | Mô phỏng quầy của người chơi tới `now` |
| `openBusiness(userId, { name, location }, now)` | `business.js:164-178` | Tên 2-24 ký tự, mỗi người một quầy; giấy phép `license × chỉ số giá` (sổ `license`); thực đơn mặc định trà sữa trân châu |
| `setMenu(userId, menu, now)` | `business.js:180-200` | Số món <= `menuSlots`; giá 1 tới 3 × giá tham chiếu |
| `buyUpgrade(userId, key, now)` | `business.js:202-215` | `counter`, `menu`, `decor` (sổ `biz_upgrade`) |
| `promote(userId, now)` | `business.js:217-227` | Quảng cáo cộng dồn thời gian (sổ `marketing`) |
| `setJobPost(userId, { wage, slots, open }, now)` | `business.js:229-239` | Lương 8-80, 1-3 người |
| `closeBusiness(userId, now)` | `business.js:241-249` | Mô phỏng nốt rồi đóng; giấy phép không hoàn |
| `openJobs(userId, now)` | `business.js:252-256` | Tin tuyển của quầy người khác còn chỗ |
| `shiftTerms(userId, businessId, now)` | `business.js:259-267` | Cho `jobs.startShift`: quầy mình lương 0 |
| `recordWages(businessId, amount, now)` | `business.js:270` | Cộng `business_days.wages` |
| `businessView(userId, now)` | `business.js:272-319` | Đồng bộ rồi trả quầy, thực đơn (giá vốn, tồn), ca trực, báo cáo 7 ngày (có `profit`) |
| `settleBusinessDay(day, rand)` | `business.js:322-345` | Nửa đêm: mô phỏng tới 00:00, thu tiền thuê; nợ `unpaidLimit` đêm thì đóng, `CREDIT.evicted`, đăng tin |

## Mô phỏng một giờ
- Ca trực trùng giờ đó (`q.duty`, dòng 37-39); công suất = tổng `staffCapacity(craft, counter) × phần giờ trực`.
- Khách muốn mua = `customersPerHour({ location, hourVN, reputation, decor, promo, bonus, menuAppeal }) × giờ phủ × ngẫu nhiên 0,85-1,15`; `bonus` gồm hiệu ứng thị trấn `traffic`, Biển hiệu Hội, bé `charming` (+10%), bé hành Thủy.
- Chia theo `appeal(price, ref)` từng món, làm tròn ngẫu nhiên, giới hạn bởi nguyên liệu và công suất.
- Uy tín đổi mỗi giờ (`nextReputation`).
- Cuối: lấy nguyên liệu khỏi kho, ghi `business_days`, doanh thu (sổ `business_income`) và thuế doanh thu 3% (`chargeTax`), nhiệm vụ `serve`.

## Bảng
`businesses`, `business_days`, `job_posts`, `shifts`, `pets`, `pet_skills`, `guild_members`, `guilds`, `lots`, `news`, `ledger`, `town_effects`.

## Ai gọi
`routes-community.js`, `jobs.js`, `scheduler.closeDay`.

## Lưu ý
- Quầy không trực thì không bán và không tự trôi thời gian ngoài `sim_at` (vẫn tiến `sim_at`).
- Lương nhân viên đã trả lúc nhận ca (giữ trước), nên mô phỏng không trừ lương.

## Liên quan
- [[Quầy trà sữa]] · [[Module rules-business]] · [[Module jobs]] · [[Thuê bé làm việc]]
