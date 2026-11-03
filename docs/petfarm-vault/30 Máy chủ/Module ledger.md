---
tags: [petfarm, may-chu, module, so-cai, kinh-te]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/ledger.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module ledger

> [!summary]
> `petdex/server/ledger.js` (137 dòng): **sổ cái, nơi duy nhất được phép thay đổi xu**. Mỗi lần đổi số dư ghi một dòng `ledger` kèm `balance_after` để đối soát. Danh mục loại giao dịch `KINDS` quyết định cái gì là thu nhập, chi tiêu hay chỉ chuyển túi. Ý nghĩa kinh tế: [[Sổ cái]], [[Dòng xu trong game]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `KINDS` | `ledger.js:6-79` | 71 loại (21 income, 29 expense, 21 transfer), mỗi loại `{ group: 'income' \| 'expense' \| 'transfer', label }` |
| `post({ userId, account = 'wallet', delta, kind, memo, now })` | `ledger.js:111-129` | Ghi một biến động; trả số dư mới |
| `chargeTax(userId, amount, memo, now)` | `ledger.js:82-87` | Trừ người chơi (sổ `tax`), một nửa (làm tròn xuống) vào `treasury`, nửa kia bị hủy |
| `chargeFee(userId, amount, memo, now)` | `ledger.js:132-137` | Như trên với sổ `fee` |
| `treasuryBalance()` | `ledger.js:89` | Số dư `accounts.treasury` |

## `post` hoạt động thế nào

| `account` | Cập nhật | Âm thì |
|---|---|---|
| `'wallet'` (mặc định) | `users.coins += delta` chỉ khi kết quả >= 0 | `GameError('Không đủ xu.')` |
| `'savings'` | Tạo `bank_accounts` nếu chưa có, `savings += delta` khi >= 0 | `GameError('Tài khoản tiết kiệm không đủ tiền.')` |
| khác (`treasury`, `guild:<id>`, `clan:<id>`, `contract:<id>`, `toll:<id>`) | Upsert `accounts.balance += delta` | **Không chặn âm**: nơi gọi phải tự kiểm (vd. `clans.clanSpend`, `social.upgradeGuild`) |

Kiểm tra lập trình: `delta` phải là số nguyên (`Error`), `kind` phải có trong `KINDS` (`Error`), `delta = 0` thì không ghi gì và trả `null` (`ledger.js:112-114`). Luôn gọi bên trong transaction của nơi dùng.

## Nhóm loại sổ
- **income** (tính báo cáo thu, thuế lương/lãi lấy một phần): `daily`, `play`, `level`, `cuddle`, `salary`, `minigame`, `market_sell`, `gear_trade`, `gift_code`, `interest`, `business_income`, `stipend`, `quest`, `guild_reward`, `garden_help`, `kitchen_sale`, `toll_income`, `contract_sell`, `contract_comp`, `bazaar_sale`, `clan_dividend`.
- **expense**: `shop`, `adopt`, `market_buy`, `fee`, `warehouse`, `license`, `rent`, `wage`, `biz_upgrade`, `marketing`, `tax`, `guild_create`, `guild_donation`, `clinic`, `insurance`, `school`, `seeds`, `garden_expand`, `factory_build`, `factory_upgrade`, `toll_fee`, `contract_buy`, `contract_penalty`, `bazaar_buy`, `loan_interest`, `loan_fee`, `slot_reopen`, `clan_create`, `clan_donation`.
- **transfer** (không tính thu chi): `opening`, `savings_in/out`, `deposit_open/close`, `escrow_lock/release`, `town_spend`, `guild_upgrade`, `loan_in`, `loan_repay`, `town_seed`, `admin`, và các loại chỉ dùng trên tài khoản gia tộc/ngân sách: `clan_comp`, `clan_land`, `clan_build`, `clan_revenue`, `clan_upkeep`, `corp_tax`, `corp_tax_refund`, `corp_tax_collect`.

## Bảng
`ledger`, `users.coins`, `bank_accounts.savings`, `accounts`.

## Ai gọi
22 module; test "sổ cái khớp từng xu" kiểm toán mọi số dư bằng tổng `delta` ([[Kiểm thử petdex]]).

## Lưu ý
- Thêm loại mới: thêm vào `KINDS` trước, nếu không `post` ném lỗi 500.
- `wallet.report` chỉ tính `income`/`expense`; `credit.incomeBetween` chỉ tính dòng `wallet` dương nhóm `income` để xét hạn mức vay.
- `post` với `userId = null` và `account = 'wallet'` sẽ thất bại ("Không đủ xu.") vì không có dòng user nào khớp.

## Liên quan
- [[Sổ cái]] · [[Dòng xu trong game]] · [[Ngân sách thị trấn]] · [[Module wallet]] · [[Lược đồ cơ sở dữ liệu]]
