---
tags: [petfarm, kinh-te, chi-so-gia, lam-phat]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/bank.js, petdex/server/rules/bank.js, petdex/server/rules/market.js, petdex/server/rules/business.js, petdex/server/rules/production.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Price index, priceIndex]
---
# Chỉ số giá

> [!summary]
> Hệ số `priceIndex` (khởi đầu 1) do [[Ngân hàng Trung ương]] đặt mỗi tuần. Hầu hết giá do NPC thu (Siêu thị, phòng khám, học phí, hạt giống, giấy phép, tiền thuê, xây xưởng...) bằng **giá gốc × chỉ số giá**, và giá trung bình hàng thô trên Sàn cũng nhân theo. Nó là công cụ hút xu: xu tăng quá nhanh thì giá NPC lên. Các khoản thưởng (quà ngày, lương, nhiệm vụ) **không** nhân chỉ số, nên chỉ số cao làm người chơi "nghèo đi" theo giá thực.

## Công thức
- `indexedPrice(base) = max(1, round(base × priceIndex))` (`petdex/server/bank.js:40`).
- Cập nhật tuần: `priceIndex × (1 + 0,3 × clamp(growth − 0,1, −0,05, 0,15))`, tức −1,5% đến +4,5% mỗi tuần (`petdex/server/rules/bank.js:31-37`).

## Nhân chỉ số giá

| Khoản | Nguồn |
|---|---|
| [[Siêu thị]] (mua đồ) | `petdex/server/routes.js:296,309` |
| Khám, chữa, phí [[Bảo hiểm sức khỏe]] | `petdex/server/care.js:41-53,88` |
| Học phí [[Trường học]] | `petdex/server/care.js:111,130` |
| Mở lại ô tưởng niệm | `petdex/server/lifecycle.js:53` |
| Hạt giống, mở rộng [[Vườn]] | `petdex/server/farm.js:69,81,152` |
| Giấy phép, thuê, nâng cấp, quảng cáo [[Quầy trà sữa]] | `petdex/server/business.js:171-172,210,221,307,328` |
| Giá tham chiếu và giá vốn món quầy (`refPrice`, `unitCost`) | `petdex/server/rules/business.js:40-46` |
| Giá trị món [[Bếp]] (`dishValue`), giá bán quán ăn | `petdex/server/rules/production.js:133-136`, `petdex/server/farm.js:252` |
| Xây, nâng cấp, thuê đất xưởng | `petdex/server/factory.js:151,163,301` |
| Giá tham chiếu [[Chợ Phiên]] (đồ siêu thị, trang phục, món nấu) | `petdex/server/bazaar.js:86,92,97` |
| Giá trung bình hàng **thô** trên Sàn | `petdex/server/rules/market.js:68`, `petdex/server/market.js:334-342` |
| Giá trị đồ trong túi trong tài sản ròng (50% giá shop) | `petdex/server/wallet.js:26` |

## Không nhân chỉ số giá

| Khoản | Nguồn |
|---|---|
| Nhận nuôi 200 xu | `petdex/server/routes.js:179` |
| Nâng cấp [[Kho Sàn]] 1.500 / 6.000 | `petdex/server/market.js:143` |
| Lập [[Hội]] 2.000, nâng cấp Hội | `petdex/server/social.js:223,281-284` |
| Mọi khoản của [[Clan]] (lập 3.000, bồi thường ngành, đất, công trình, phí duy trì) | `petdex/server/clans.js:286,386,444,483,663` |
| Đề xuất [[Tòa thị chính]] | `petdex/server/town.js:115-117` |
| Lương thuê bé 8–80/giờ, phí gia công 0–100/mẻ | `petdex/server/rules/business.js:35-36`, `petdex/server/rules/production.js:147` |
| Mọi khoản thưởng: quà ngày, nhiệm vụ, mini-game, lương nghề, thưởng lên cấp, trợ cấp | `petdex/server/rules/town.js:48-81` |
| Hàng **chế biến** trên Sàn (bám giá đầu vào, gián tiếp có theo) | `petdex/server/rules/market.js:69-75` |

## Hiển thị
- `GET /me` trả `economy: { priceIndex, baseRate }` (`petdex/server/service.js:23,42`); [[Màn Ngân hàng]] hiện chỉ số và lịch sử 12 tuần (`petdex/server/bank.js:100-123`).

## Liên quan
- [[Ngân hàng Trung ương]] · [[Dòng xu trong game]] · [[Sàn Nguyên Liệu]] · [[MOC Kinh tế và cộng đồng]]
