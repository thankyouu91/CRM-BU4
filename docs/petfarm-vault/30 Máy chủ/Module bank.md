---
tags: [petfarm, may-chu, module, ngan-hang]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/bank.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module bank

> [!summary]
> `petdex/server/bank.js` (167 dòng): Ngân hàng Trân Châu (tiết kiệm lãi cộng dồn, gửi kỳ hạn) và Ngân hàng Trung ương (họp mỗi Chủ nhật, chỉnh chỉ số giá và lãi suất cơ bản). `economy()` và `indexedPrice()` ở đây được rất nhiều module dùng để nhân giá NPC theo lạm phát. Luật: [[Ngân hàng Trân Châu]], [[Ngân hàng Trung ương]], [[Chỉ số giá]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `economy()` | `bank.js:34-37` | Biên bản `central_bank` mới nhất -> `{ priceIndex (mặc định 1), baseRate (mặc định 0,003), growth, week }` |
| `indexedPrice(base)` | `bank.js:40` | `max(1, round(base × priceIndex))` |
| `moveSavings(userId, action, amount, now)` | `bank.js:51-64` | `deposit`/`withdraw` giữa ví và tiết kiệm (hai dòng sổ `savings_in`/`savings_out`), cộng lãi tới hiện tại trước |
| `openDeposit(userId, amount, term, now)` | `bank.js:66-77` | Kỳ hạn 3/7/14 ngày, tối thiểu 100; lãi = `baseRate + termPremium` chốt lúc gửi |
| `closeDeposit(userId, depositId, now)` | `bank.js:87-98` | Đúng hạn có lãi, rút sớm chỉ gốc |
| `bankView(userId, now)` | `bank.js:100-124` | Số dư, lãi lẻ, trần, kỳ hạn, khoản đang gửi, 12 tuần lịch sử NHTW |
| `bankHoldings(userId, now)` | `bank.js:127-132` | Cho tài sản ròng, không ghi DB |
| `settleBankDay(endTs)` | `bank.js:135-147` | Mọi tài khoản: cộng phần nguyên của lãi lẻ vào tiết kiệm (sổ `interest`); tất toán kỳ hạn đáo hạn |
| `centralBankWeek(week, now)` | `bank.js:150-166` | Đo `moneySupply / người hoạt động 7 ngày`, `growth` so với tuần trước, `policy()` ra chỉ số giá và lãi mới, đăng tin 7 ngày |

Nội bộ: `touch(userId, now)` cộng dồn lãi vào `accrued` (dòng 43-49), `payDeposit` (dòng 79-85).

## Bảng
`bank_accounts`, `deposits`, `central_bank`, `news`; đọc `users`, `orders`, `shifts`, `accounts`, `ledger` (đo cung tiền).

## Ai gọi
16 module dùng `economy`/`indexedPrice`; `routes-economy.js` (route ngân hàng), `scheduler.closeDay`.

## Lưu ý
- `economy()` chạy một truy vấn mỗi lần gọi; `indexedPrice` gọi lặp trong vòng lặp view sẽ nhân truy vấn.
- Lãi tiết kiệm chỉ tính trên phần dưới `BANK.savingsCap` (`rules/bank.js:17`).
- `central_bank.week` là khóa ngày **Chủ nhật** ([[Đồng hồ và ngày giờ game]]).

## Liên quan
- [[Module rules-bank]] · [[Module credit]] · [[Quyết toán nửa đêm]] · [[Kinh tế vĩ mô]]
