---
tags: [petfarm, may-chu, module, tin-dung]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/credit.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module credit

> [!summary]
> `petdex/server/credit.js` (231 dòng): điểm tín dụng (mọi người chơi, 300-850) và vay trả góp theo ngày (chế độ Tài chính nâng cao). Luật: [[Điểm tín dụng]], [[Tín dụng và vay]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `addCredit(userId, delta, reason, now)` | `credit.js:31-39` | Kẹp 300-850, ghi `credit_events` với phần thay đổi thực tế |
| `creditView(userId, now)` | `credit.js:71-103` | Điểm, hạng, hạng kế, 12 sự kiện, hạn mức (0 nếu bị chặn), lãi, kỳ hạn, phí, khoản vay với kỳ trả hôm nay, lịch sử 5 khoản đã trả |
| `borrow(userId, amount, termDays, now)` | `credit.js:105-118` | Tối thiểu 50, kỳ hạn trong `LOANS.terms`, không bị chặn, trong hạn mức; giải ngân (sổ `loan_in`, tạo xu mới), phí giải ngân |
| `repay(userId, loanId, amount, now)` | `credit.js:158-173` | Trả trước từ ví: phí và lãi còn nợ trước, rồi gốc |
| `settleLoansDay(day)` | `credit.js:192-228` | Nửa đêm: khoản vỡ nợ bị thu 30% thu nhập trong ngày; khoản thường trừ kỳ trả góp từ ví rồi tiết kiệm; đủ +5 điểm; thiếu cộng phí trễ 1%, -20 điểm, trễ 7 kỳ là vỡ nợ (-100, cấm vay 14 ngày) |
| `debtOf(userId)` | `credit.js:231` | Tổng `remaining + fees` |

Nội bộ: `MIN_LOAN = 50`, `MAX_LOANS = 2` (dòng 9-10); `incomeBetween` (dòng 42-44); `blockedReason` (dòng 49-56): chưa bật nâng cao, tài khoản < `minAccountDays`, đang bị cấm, có khoản trễ, đủ 2 khoản; `terms` (dòng 58-69); `chargeLoanCost` (một nửa lãi/phí vào ngân sách, dòng 121-126); `pay` (dòng 132-155); `finish` (tất toán +30 điểm trừ khi từng vỡ nợ, dòng 176-186).

## Bảng
`loans`, `credit_events`, `users.credit`, `users.loan_ban_until`, `bank_accounts`, `ledger`.

## Ai gọi
`routes-production.js` (route tín dụng); `addCredit` được `business`, `factory` (bị đóng cửa), `contracts` (giao đủ, phá hợp đồng) dùng; `scheduler.closeDay`; `wallet` (`debtOf`).

## Lưu ý
- `repay` yêu cầu ví có đủ `want` dù hàm `pay` có khả năng lấy từ tiết kiệm (chỉ khi `useSavings` ở quyết toán).
- Trả gốc (`loan_repay`) là xu bị hủy; lãi/phí một nửa vào ngân sách, một nửa bị hủy.

## Liên quan
- [[Module rules-production]] · [[Quyết toán nửa đêm]] · [[Module bank]]
