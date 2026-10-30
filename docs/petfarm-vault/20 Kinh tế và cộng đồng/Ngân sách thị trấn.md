---
tags: [petfarm, kinh-te, ngan-sach, treasury]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/ledger.js, petdex/server/town.js, petdex/server/rules/town.js, petdex/server/migrate.js, petdex/server/clans.js, petdex/server/social.js, petdex/server/credit.js, petdex/server/bazaar.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Treasury, Ngân sách]
---
# Ngân sách thị trấn

> [!summary]
> Tài khoản chung `treasury` trong bảng `accounts`, khởi đầu bằng quỹ 5.000 xu. Nhận một phần mọi phí và thuế, chi cho trợ cấp tân thủ, thưởng dự án Hội, hoàn thuế gia tộc và đề xuất thắng phiếu ở [[Tòa thị chính]]. Ngân sách không bao giờ âm: mọi khoản chi đều kiểm số dư trước. Không được tính vào lượng xu của [[Ngân hàng Trung ương]].

## Thu

| Khoản | Tỉ lệ vào ngân sách | Nguồn |
|---|---|---|
| Quỹ khởi tạo (migration `treasury_seed_v1`) | 5.000 xu một lần | `petdex/server/rules/town.js:18`, `petdex/server/migrate.js:35-37` |
| Phí Sàn, phí đăng tin Chợ Phiên (`chargeFee`) | 50% | `petdex/server/ledger.js:132-137` |
| Phí bán Chợ Phiên 5% | 50% | `petdex/server/bazaar.js:133-134` |
| Thuế thu nhập, thuế doanh thu quầy (`chargeTax`) | 50% | `petdex/server/ledger.js:82-87` |
| Lãi vay, phí giải ngân, phí trễ | 50% | `petdex/server/credit.js:121-126` |
| Lập gia tộc | 50% | `petdex/server/clans.js:288` |
| Bồi thường thâu tóm ngành | 50% | `petdex/server/clans.js:389` |
| Mua đất | 20% (`land.treasuryShare`) | `petdex/server/clans.js:446` |
| Thuế doanh nghiệp | 50% | `petdex/server/clans.js:654` |
| Phí duy trì gia tộc | 50% | `petdex/server/clans.js:666` |
| Quỹ gia tộc giải tán | 100% | `petdex/server/clans.js:310-314` |
| Sở thuế truy thu | 100% | `petdex/server/clans.js:761-764` |

Không vào ngân sách: Siêu thị, tiền thuê, giấy phép, xây xưởng, lập Hội, công trình gia tộc... (bị hủy hẳn, xem [[Dòng xu trong game]]).

## Chi

| Khoản | Mức | Điều kiện | Nguồn |
|---|---|---|---|
| Trợ cấp tân thủ | 30 xu/ngày (50 khi có Quỹ chào tân thủ), 7 ngày đầu, khi bấm [[Quà ngày]] | trả `min(mức, ngân sách)` | `petdex/server/town.js:59-73` |
| Thưởng dự án Hội | 40–50 xu × số thành viên | dừng khi ngân sách < thưởng | `petdex/server/social.js:308-315` |
| Hoàn thuế doanh nghiệp | 15% thuế tháng | `min(hoàn, ngân sách)` | `petdex/server/clans.js:682-686` |
| Đề xuất thắng phiếu tuần | 1.000–3.000 | đủ tiền mới chi | `petdex/server/town.js:113-120` |

## Xem ở đâu
- [[Tòa thị chính]] hiện số dư và dòng tiền ngân sách 7 ngày theo `kind` (`treasuryFlow`, `petdex/server/town.js:37-38,155-158`).
- Bảng quản trị hiện số dư (`petdex/server/internal.js:370`, `petdex/server/clans.js:736`).

## Liên quan
- [[Tòa thị chính]] · [[Thuế thu nhập]] · [[Thuế doanh nghiệp]] · [[Dòng xu trong game]] · [[Sổ cái]] · [[MOC Kinh tế và cộng đồng]]
