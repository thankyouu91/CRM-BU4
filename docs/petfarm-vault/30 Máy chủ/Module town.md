---
tags: [petfarm, may-chu, module, thi-tran]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/town.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module town

> [!summary]
> `petdex/server/town.js` (170 dòng): Tòa thị chính: ngân sách, thuế thu nhập lũy tiến mỗi đêm, bỏ phiếu đề xuất chi tiêu theo tuần, hiệu ứng thị trấn đang chạy, trợ cấp tân thủ. Luật: [[Tòa thị chính]], [[Thuế thu nhập]], [[Ngân sách thị trấn]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `weekKey(day)` | `town.js:42-45` | Ngày thứ Hai của tuần chứa `day` |
| `effectsAt(at)`, `effectsBetween(from, to)` | `town.js:47-48` | Hiệu ứng `town_effects` đang chạy |
| `trafficBonus(effects, location, at)` | `town.js:51-55` | Tổng `value` hiệu ứng `traffic` áp cho vị trí quầy |
| `taxCut(at)` | `town.js:57` | Tổng điểm giảm thuế |
| `stipendAmount(at)` | `town.js:59-62` | `max(STIPEND.amount, hiệu ứng stipend)` |
| `payStipend(userId, now)` | `town.js:65-73` | Trong `STIPEND.days` ngày đầu: trả từ ngân sách (nếu còn), sổ `stipend` |
| `ensureProposals(week, rand)` | `town.js:75-78` | Bốc 3 đề xuất nếu tuần chưa có |
| `vote(userId, option, now)` | `town.js:80-93` | Bầu/đổi phiếu trong tuần |
| `closeWeek(week, now, rand)` | `town.js:107-127` | Chủ nhật: đề xuất thắng (`winner`) được chi nếu ngân sách đủ (`town_spend`), áp `town_effects` (và tin giá nếu `kind = 'news'`), đăng tin, mở phiên tuần sau |
| `settleTaxes(day, now)` | `town.js:130-150` | Thuế ngày: `salary + interest + toll_income` (ledger trong ngày) + lãi quầy dương (`business_days`) + lãi giao dịch dương (`gains`); `incomeTax(taxable, cut)`; cộng nợ cũ; trả bằng xu đang có (`chargeTax`), phần thiếu thành `tax_due`; ghi `tax_days` |
| `townView(userId, now)` | `town.js:152-170` | Ngân sách, dòng tiền 7 ngày, đề xuất, phiếu của mình, hiệu ứng, lịch sử, thuế 7 ngày, nợ thuế, trợ cấp |

## Bảng
`town_effects`, `proposals`, `votes`, `news`, `tax_days`, `users.tax_due`, `ledger`, `business_days`, `businesses`, `gains`, `accounts.treasury`.

## Ai gọi
`routes-community.js`, `routes.js` (`payStipend` trong `/daily`), `business.js` (`effectsBetween`, `trafficBonus`), `social.js` và `clans.js` (`weekKey`), `scheduler.js`.

## Lưu ý
- Đề xuất thắng nhưng ngân sách thiếu: `unfunded`, có tin báo, không chi.
- Danh sách người phải tính thuế là UNION của 4 nguồn (`town.js:29-33`), nên cả người không hoạt động mà còn nợ thuế cũng được thu.
- Thuế ngày D chỉ thấy dòng ledger trước 00:00 ngày D+1; lãi tiết kiệm của đêm quyết toán rơi sang ngày sau ([[Quyết toán nửa đêm]]).

## Liên quan
- [[Module rules-town]] · [[Module ledger]] · [[Quyết toán nửa đêm]]
