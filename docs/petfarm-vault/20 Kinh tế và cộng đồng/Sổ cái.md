---
tags: [petfarm, kinh-te, so-cai, ledger]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/ledger.js, petdex/server/wallet.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Ledger, Sao kê]
---
# Sổ cái

> [!summary]
> Bảng `ledger` là **nơi duy nhất được phép làm thay đổi xu**: mọi khoản cộng/trừ ví, tiết kiệm, ngân sách, quỹ Hội, quỹ gia tộc, ký quỹ đều qua hàm `post()`, ghi một dòng kèm số dư sau giao dịch. Mỗi dòng có `kind` thuộc một trong 3 nhóm (thu, chi, chuyển) để [[Ví và tài sản ròng]] làm báo cáo thu chi, và để [[Thuế thu nhập]], [[Tín dụng và vay]], [[Ngân hàng Trung ương]] đọc lại.

## Hàm `post` (`petdex/server/ledger.js:111-129`)
- Tham số: `userId`, `account` (`wallet` mặc định, `savings`, hoặc tài khoản chung như `treasury`, `guild:<id>`, `clan:<id>`, `contract:<id>`, `toll:<id>`), `delta` (số nguyên), `kind`, `memo`, `now`.
- Ném lỗi lập trình nếu `delta` không nguyên hoặc `kind` lạ; `delta = 0` thì bỏ qua.
- Ví và tiết kiệm cập nhật có điều kiện `số dư + delta >= 0`; không được thì ném "Không đủ xu." / "Tài khoản tiết kiệm không đủ tiền." (người chơi thấy). Tài khoản chung dùng `accounts (id, balance)` và **không** tự kiểm âm (nơi gọi phải kiểm trước).
- Ghi `ledger (user_id, account, delta, balance_after, kind, memo, created_at)`.
- Phải gọi bên trong `transaction` của nơi dùng để lỗi giữa chừng hoàn tác hết.

## Hàm phụ
| Hàm | Việc | Nguồn |
|---|---|---|
| `chargeFee(userId, amount, memo)` | trừ phí `fee`, `floor(amount/2)` vào ngân sách | `petdex/server/ledger.js:132-137` |
| `chargeTax(userId, amount, memo)` | trừ `tax`, `floor(amount/2)` vào ngân sách | `petdex/server/ledger.js:82-87` |
| `treasuryBalance()` | số dư `treasury` | `petdex/server/ledger.js:89` |

## Danh mục `kind` (`KINDS`, `petdex/server/ledger.js:6-79`)

| Nhóm | Các `kind` (nhãn hiển thị) |
|---|---|
| **income** (thu) | `daily` Quà ngày · `play` Chơi với bé · `level` Thưởng lên cấp · `cuddle` Bạn bè công viên · `salary` Lương · `minigame` Mini-game · `market_sell` Bán trên Sàn · `gear_trade` Thưởng giao dịch (trang phục) · `gift_code` Mã quà · `interest` Lãi ngân hàng · `business_income` Doanh thu quầy · `stipend` Trợ cấp tân thủ · `quest` Nhiệm vụ · `guild_reward` Thưởng dự án Hội · `garden_help` Tưới vườn giúp bạn · `kitchen_sale` Bán món ăn · `toll_income` Thu phí gia công · `contract_sell` Bán theo hợp đồng · `contract_comp` Nhận bồi thường · `bazaar_sale` Bán ở Chợ Phiên · `clan_dividend` Cổ tức gia tộc |
| **expense** (chi) | `shop` Siêu thị · `adopt` Nhận nuôi · `market_buy` Mua trên Sàn · `fee` Phí giao dịch · `warehouse` Nâng cấp kho · `license` Giấy phép quầy · `rent` Thuê mặt bằng · `wage` Trả lương nhân viên · `biz_upgrade` Nâng cấp quầy · `marketing` Quảng cáo · `tax` Thuế · `guild_create` Lập Hội · `guild_donation` Góp quỹ Hội · `clinic` Phòng khám · `insurance` Bảo hiểm · `school` Học phí · `seeds` Hạt giống · `garden_expand` Mở rộng vườn · `factory_build` Xây xưởng · `factory_upgrade` Nâng cấp xưởng · `toll_fee` Phí gia công · `contract_buy` Mua theo hợp đồng · `contract_penalty` Bồi thường hợp đồng · `bazaar_buy` Mua ở Chợ Phiên · `loan_interest` Lãi vay · `loan_fee` Phí vay · `slot_reopen` Mở lại ô tưởng niệm · `clan_create` Lập gia tộc · `clan_donation` Góp quỹ gia tộc |
| **transfer** (chuyển, không vào báo cáo) | `opening` Số dư ban đầu · `savings_in`/`savings_out` · `deposit_open`/`deposit_close` · `escrow_lock`/`escrow_release` · `town_spend` Chi ngân sách · `guild_upgrade` Chi quỹ Hội · `loan_in` Giải ngân · `loan_repay` Trả gốc vay · `town_seed` Quỹ khởi tạo · `admin` Quản trị viên điều chỉnh · `clan_comp` · `clan_land` · `clan_build` · `clan_revenue` · `clan_upkeep` · `corp_tax` · `corp_tax_refund` · `corp_tax_collect` |

> [!info] Vì sao quà chào mừng là "transfer"
> `opening` (150 xu) và `loan_in` thuộc nhóm chuyển nên không làm phồng "thu nhập" trong báo cáo ví và trong hạn mức vay (hạn mức tính từ nhóm `income`, `petdex/server/credit.js:42-44`).

## Đọc sổ
- Sao kê: `GET /wallet/ledger?kind=&before=` trang 40 dòng, mới nhất trước, lọc theo `kind` (`petdex/server/wallet.js:69-75`, `petdex/server/routes-economy.js:119-122`).
- Báo cáo thu chi 7 hoặc 30 ngày: xem [[Ví và tài sản ròng]].
- Đối soát: [[Mô phỏng kinh tế]] kiểm `users.coins` = tổng `delta` ví trong sổ cho mọi người (`petdex/scripts/simulate-economy.js:258-261`).

## Liên quan
- [[Dòng xu trong game]] · [[Ví và tài sản ròng]] · [[Ngân sách thị trấn]] · [[Module ledger]] · [[Lược đồ cơ sở dữ liệu]] · [[MOC Kinh tế và cộng đồng]]
