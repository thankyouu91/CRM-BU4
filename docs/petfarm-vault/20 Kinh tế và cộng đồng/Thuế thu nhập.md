---
tags: [petfarm, kinh-te, thue, thue-thu-nhap]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/town.js, petdex/server/rules/town.js, petdex/server/market.js, petdex/server/ledger.js, petdex/server/business.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Thuế, Income tax]
---
# Thuế thu nhập

> [!summary]
> Thuế lũy tiến theo **ngày** trên thu nhập chịu thuế của từng người chơi, thu tự động lúc nửa đêm thẳng từ ví, thiếu thì ghi nợ thuế. Một nửa tiền thuế vào [[Ngân sách thị trấn]], nửa kia bị hủy. Ngoài ra [[Quầy trà sữa]] còn chịu **thuế doanh thu 3%** thu ngay khi bán. Gia tộc chịu [[Thuế doanh nghiệp]] riêng.

## Bậc thuế (`BRACKETS`, `petdex/server/rules/town.js:4`)

| Thu nhập chịu thuế trong ngày | Thuế suất phần trong bậc |
|---|---|
| 0–300 xu | 0% |
| 300–1.000 xu | 5% |
| 1.000–3.000 xu | 10% |
| trên 3.000 xu | 15% |

`incomeTax(taxable, cut) = floor(Σ phần trong bậc × max(0, suất − cut))` (`petdex/server/rules/town.js:7-15`). `cut` = 0,02 khi [[Đề xuất Giảm thuế]] đang chạy (đọc ở 0h của ngày tính thuế) (`petdex/server/town.js:57,133`).

> [!example] Ngày kiếm 2.000 xu chịu thuế
> 300 × 0 + 700 × 5% + 1.000 × 10% = 35 + 100 = **135 xu**. Có Giảm thuế: 700 × 3% + 1.000 × 8% = 101 xu.

## Thu nhập chịu thuế (`settleTaxes`, `petdex/server/town.js:130-150`)

| Phần | Lấy từ | Nguồn |
|---|---|---|
| `salary` | tổng dòng sổ cái `salary` trong ngày (lương nghề, tiền boa, lương làm thuê ở quầy/xưởng) | `petdex/server/town.js:22-24` |
| `interest` | lãi tiết kiệm, lãi kỳ hạn | `petdex/server/town.js:22-24` |
| `toll_income` | phí gia công nhận được | `petdex/server/town.js:22-24` |
| `business` | `max(0, Σ doanh thu − giá vốn − thuê − lương − thuế doanh thu)` của quầy trong ngày | `petdex/server/town.js:26-28,138` |
| `trading` | `max(0, Σ lãi/lỗ đã chốt)` trong bảng `gains`: bán trên Sàn (cả khớp lệnh chờ) và bán theo hợp đồng, theo giá vốn từng lô | `petdex/server/town.js:25,139`, `petdex/server/market.js:122-125,171,263`, `petdex/server/contracts.js:169` |

**Không** chịu thuế: quà ngày, nhiệm vụ, mini-game, thưởng lên cấp, Chợ Phiên, bán món cho quán ăn, cổ tức gia tộc, trợ cấp, thưởng dự án Hội, bồi thường hợp đồng.

## Cách thu
- Người phải tính = ai có dòng sổ cái trong ngày, hoặc đang nợ thuế, hoặc có quầy có số liệu ngày đó, hoặc có lãi chốt (`petdex/server/town.js:29-33`).
- `due = thuế hôm nay + nợ cũ`; trả `min(due, ví)` qua `chargeTax` (50% vào ngân sách), phần thiếu lưu `users.tax_due` (`petdex/server/town.js:142-146`, `petdex/server/ledger.js:82-87`).
- Ghi `tax_days` (thu nhập, thuế, đã trả, chi tiết JSON) để [[Tòa thị chính]] hiện 7 ngày gần nhất (`petdex/server/town.js:147,166`).

## Thuế doanh thu quầy
- 3% doanh thu mỗi ngày của quầy, thu ngay khi tính bù bán hàng, trừ vào ví chủ quầy qua `chargeTax` (`petdex/server/rules/business.js:31`, `petdex/server/business.js:142-146`). Khoản này cũng được trừ khi tính lợi nhuận quầy chịu thuế thu nhập.

## Trường hợp đặc biệt
- Lỗ giao dịch trong ngày bù trừ lãi giao dịch cùng ngày (cộng dồn `gains`), nhưng không bù sang lương hay sang ngày khác.
- Thuế được tính sau quầy, xưởng, hợp đồng, ngân hàng, khoản vay trong cùng đêm, nên lãi nửa đêm và hàng giao nửa đêm được tính vào ngày vừa đóng (`petdex/server/scheduler.js:28-37`).
- Nợ thuế không có lãi phạt và không ảnh hưởng [[Điểm tín dụng]].

## Liên quan
- [[Ngân sách thị trấn]] · [[Tòa thị chính]] · [[Thuế doanh nghiệp]] · [[Sổ cái]] · [[Module town]] · [[Module rules-town]] · [[MOC Kinh tế và cộng đồng]]
