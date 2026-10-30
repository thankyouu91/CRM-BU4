---
tags: [petfarm, may-chu, module, luat, san]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/market.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module rules-market

> [!summary]
> `petdex/server/rules/market.js` (126 dòng): luật thuần của Sàn Nguyên Liệu: định nghĩa 10 mặt hàng, tham số thị trường, mô hình giá (giá trung bình + bước Ornstein-Uhlenbeck), báo giá NPC, phí, tác động giá và sinh tin. Diễn giải: [[Sàn Nguyên Liệu]], [[Mặt hàng nguyên liệu]], [[Tin tức thị trường]].

## Exports
| Tên | Dòng | Nội dung |
|---|---|---|
| `LOT` | `rules/market.js:5` | 10 phần = 1 lô |
| `COMMODITIES` | `rules/market.js:7-18` | 6 hàng thô (`tea_leaf`, `milk`, `cassava`, `cane`, `strawberry`, `fish`) và 4 hàng chế biến (`dried_tea`, `pearl`, `sugar`, `condensed`) với `base`, `vol`, `shelfDays`, `inputs` |
| `MARKET` | `rules/market.js:20-38` | `tickMs` 10 phút, `theta` 0,35, `spread` 0,01, `fee` 0,01, `liquidity` 200, `processedDepth` 3, `band` 0,15, `matchBand` 0,2, `npcDailyLots` 40, `newsPerDay` 0,8, `newsLeadMs` 30 phút, `maxOrderLots` 100, `warehouse` 3 cấp |
| `HEADLINES` | `rules/market.js:41-52` | Tiêu đề tin tăng/giảm mỗi hàng |
| `RAW_FIRST` | `rules/market.js:54-55` | Thứ tự xử lý: hàng thô trước để hàng chế biến dùng giá thô mới |
| `gaussian(rand)` | `rules/market.js:57-60` | Box-Muller |
| `meanPrice(id, { prices, drift, index, news })` | `rules/market.js:66-76` | Thô: `base × index × drift × news`; chế biến: `base × (chi phí đầu vào hiện tại / gốc) × news` |
| `stepPrice(id, price, mean, dtMs, z)` | `rules/market.js:79-84` | `price + theta (mean - price) dt + vol × price × sqrt(dt) × z`, sàn `0,25 × base` |
| `stepDrift(drift, dtMs, z)` | `rules/market.js:87-91` | Bước ngẫu nhiên log, kéo về 1, kẹp 0,8-1,25 |
| `quote(price)` | `rules/market.js:93` | `bid = price × 0,99`, `ask = price × 1,01` |
| `impact(price, lots, side, depth)` | `rules/market.js:96` | `price × (1 ± lots/depth)` |
| `fillPrice(quotePrice, lots, side, depth)` | `rules/market.js:99` | Nửa tác động |
| `depthOf(id)` | `rules/market.js:102` | `liquidity × 3` với hàng chế biến |
| `tradeFee(amount)` | `rules/market.js:104` | `max(1, round(amount × 0,01))` khi > 0 |
| `amountFor(qty, pricePerLot)` | `rules/market.js:107` | `round(qty / 10 × price)` |
| `inBand(limit, price, band)` | `rules/market.js:109` | |
| `shelfLife(id, from)` | `rules/market.js:111` | null với hàng không hư |
| `rollNews(id, now, rand)` | `rules/market.js:114-126` | Hướng 50/50, độ mạnh 20-40%, có hiệu lực sau 30 phút, kéo dài 6-24 giờ |

## Ai dùng
`market.js`, `business` (qua `rules/business`), `factory`, `contracts`, `minigames`, `social`, `macro` (`gaussian`), `scheduler` (`MARKET.tickMs`), `routes.js`, `rules/production.js`.

## Lưu ý
Import `DAY` từ `../game.js` (dòng 2) tạo vòng import với `game.js` qua `rules/production.js`; chỉ đọc `DAY` trong thân hàm ([[Module game]]).

## Liên quan
- [[Module market]] · [[Nhịp mỗi phút]] · [[Kho Sàn]]
