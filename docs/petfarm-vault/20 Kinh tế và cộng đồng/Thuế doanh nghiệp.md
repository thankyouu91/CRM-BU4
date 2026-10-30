---
tags: [petfarm, kinh-te, thue, thue-doanh-nghiep, clan]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/clans.js, petdex/server/ledger.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Corporate tax, corp_tax, 🧾 Thuế gia tộc]
---
# Thuế doanh nghiệp

> [!summary]
> Thuế đánh trên doanh thu đất mỗi đêm của [[Clan|gia tộc]]: **35%** cho gia tộc một ngành, **+5 điểm** cho mỗi ngành thêm (tối đa 45% với 3 ngành). Thuế tính trên phần doanh thu **gia tộc tự khai báo** (0–100%), phần khai thiếu được Sở thuế ghi hồ sơ âm thầm. Cuối tháng gia tộc được **hoàn 15%** số thuế đã đóng trong tháng (nếu ngân sách còn tiền). Một nửa thuế vào [[Ngân sách thị trấn]].

## Con số

| Thông số | Mặc định | Quản trị chỉnh trong | Nguồn |
|---|---|---|---|
| Thuế suất cơ bản (`baseTax`) | 35% | 0–90% | `petdex/server/clans.js:25,64` |
| Cộng thêm mỗi ngành từ ngành thứ 2 (`extraTaxPerIndustry`) | +5 điểm % | 0–30% | `petdex/server/clans.js:26,65` |
| Hoàn thuế cuối tháng (`refundRate`) | 15% thuế đã đóng trong tháng | 0–100% | `petdex/server/clans.js:27,66` |
| Phần thuế vào ngân sách | 50% | cố định | `petdex/server/clans.js:654` |
| Tỉ lệ khai báo mặc định của gia tộc mới | 100% | gia tộc tự đặt 0–100% | `petdex/server/db.js:570`, `petdex/server/clans.js:398-406` |

| Số ngành | Thuế suất |
|---|---|
| 0 hoặc 1 | 35% |
| 2 | 40% |
| 3 | 45% |

`taxRate(n) = round4(baseTax + extra × max(0, n − 1))` (`petdex/server/clans.js:200`); khi quyết toán dùng `max(1, số ngành)` (`petdex/server/clans.js:647`).

## Quyết toán mỗi đêm (`settleClansDay`, `petdex/server/clans.js:627-691`)
1. `revenue` = tổng doanh thu các lô đang làm ngành (xem [[Bản đồ đất]]).
2. `declared = round(revenue × declare_ratio)`, `tax = round(declared × rate)`.
3. Có doanh thu thì: cộng `revenue` vào quỹ (`clan_revenue`), trừ `tax` (`corp_tax`), chuyển `tax/2` vào ngân sách.
4. `evaded = round((revenue − declared) × rate)`; nếu > 0 thì ghi hồ sơ `tax_evasion` và nhật ký quản trị "Sở thuế" (`petdex/server/clans.js:656-660`). Xem [[Sở thuế và trốn thuế]].
5. XP gia tộc + `floor((revenue − tax) / 100)` (`petdex/server/clans.js:661`).
6. Ghi `clan_days` (doanh thu, khai báo, thuế suất, thuế, phí duy trì) cho tab "🧾 Thuế" của [[Màn Clan]] (14 ngày) (`petdex/server/clans.js:672,551`).

## Hoàn thuế cuối tháng
- Khi ngày vừa đóng là ngày cuối tháng (`nextDay(day)` là ngày 01): `refund = min(floor(thuế tháng × 15%), ngân sách)`, chỉ một lần mỗi tháng nhờ `INSERT OR IGNORE` vào `clan_tax_refunds`, rồi chuyển từ ngân sách về quỹ (`corp_tax_refund`) (`petdex/server/clans.js:636,679-687`).
- Hoàn tính trên thuế **đã đóng** (sau khai báo), nên khai thiếu cũng làm hoàn ít đi.

## Ví dụ
> [!example] Gia tộc 2 ngành, doanh thu đêm 20.000 xu, khai 100%
> Thuế 40% = 8.000 (4.000 vào ngân sách, 4.000 bị hủy). Quỹ nhận ròng 12.000, XP +120. Cả tháng 30 đêm như vậy: thuế 240.000, hoàn 36.000.

## Liên quan
- [[Clan]] · [[Sở thuế và trốn thuế]] · [[Bản đồ đất]] · [[Ngân sách thị trấn]] · [[Thuế thu nhập]] · [[Module clans]] · [[MOC Kinh tế và cộng đồng]]
