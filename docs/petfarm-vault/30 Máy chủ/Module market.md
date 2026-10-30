---
tags: [petfarm, may-chu, module, san]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/market.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module market

> [!summary]
> `petdex/server/market.js` (433 dòng): Sàn Nguyên Liệu: giá chạy theo nhịp 10 phút, kho theo lô có hạn dùng và giá vốn, lệnh thị trường/giới hạn, NPC đứng giữa với hạn mức ngày, khớp lệnh giữa người chơi. Kho hàng của module này còn là kho chung cho vườn, bếp, quầy, xưởng, hợp đồng, Hội. Luật: [[Sàn Nguyên Liệu]], [[Kho Sàn]], [[Mặt hàng nguyên liệu]], [[Tin tức thị trường]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `initMarket(now)` | `market.js:61-66` | Tạo `commodity_state` với giá gốc và một điểm lịch sử |
| `currentPrices()` | `market.js:68` | `{ commodity: price }` |
| `capacityOf(user)` | `market.js:72` | `MARKET.warehouse[user.warehouse].lots × LOT` phần |
| `freeSpace(userId)` | `market.js:82-84` | Sức chứa trừ hàng đang giữ trừ chỗ giữ cho lệnh mua đang chờ |
| `addGoods(userId, commodity, qty, now, { expiresAt, allowPartial, cost })` | `market.js:90-99` | Nhập một lô kho; đầy thì lỗi hoặc nhận một phần |
| `recordGain(userId, gain, now)` | `market.js:123-125` | Cộng `gains` của ngày (cơ sở thuế) |
| `stock(userId, now)` | `market.js:128-133` | Bỏ hàng hư rồi tổng theo mặt hàng |
| `removeGoods(userId, commodity, qty, now)` | `market.js:136` | Lấy theo thứ tự sắp hư trước (FEFO), trả `{ expiresAt, cost }` |
| `upgradeWarehouse(userId, now)` | `market.js:138-147` | Sổ `warehouse` |
| `placeOrder(userId, order, now)` | `market.js:205-283` | Xem dưới |
| `cancelOrder(userId, orderId, now)` | `market.js:295-302` | Hoàn ký quỹ/hàng |
| `expireOrders(today, now)` | `market.js:305-309` | Lệnh có `day < today` hết hạn |
| `marketTick(now, rand)` | `market.js:330-349` | Một nhịp giá ([[Nhịp mỗi phút]]) |
| `pruneHistory(before)` | `market.js:351` | |
| `marketView(userId, now)` | `market.js:359-406` | Giá, bid/ask, biến động 24 giờ, sparkline, hàng giữ, hạn mức NPC còn lại, tin (bé có Thông minh >= 60 thấy tin sớm), lệnh, kho, hàng vừa hư |
| `priceHistory(commodity, range, now)` | `market.js:409-420` | `day`: các điểm 24 giờ; `week`: nến giờ 7 ngày |
| `goodsValue(userId)`, `lockedInOrders(userId)` | `market.js:423-433` | Cho tài sản ròng |

## `placeOrder`
1. Kiểm `validateOrder` (mặt hàng, chiều, loại, `qty` 1 phần tới 100 lô, giá giới hạn > 0); giới hạn phải trong ±15% giá.
2. Bán: lấy hàng ra trước (FEFO, có giá vốn); mua: kiểm chỗ trống.
3. Khớp với **lệnh chờ của người khác** nếu giá tốt hơn báo giá NPC và trong biên `matchBand` (±20%); người đặt lệnh chờ được thanh toán qua `settleResting`.
4. Phần còn lại khớp **NPC** trong hạn mức `npcDailyLots` mỗi người/mặt hàng/chiều/ngày, giá khớp bình quân `fillPrice`, giá sau khớp dịch theo `impact`.
5. Thanh toán (sổ `market_buy`/`market_sell`, phí qua `chargeFee`, `tradeBonus`, `recordGain`).
6. Lệnh giới hạn còn dư nằm chờ: mua thì khóa xu (`escrow_lock`), bán thì giữ hàng trong lệnh. Lệnh thị trường còn dư khi bán thì trả hàng về kho.
7. Không khớp được gì với lệnh thị trường: "Hôm nay đã hết hạn mức giao dịch với NPC cho mặt hàng này.".

## Bảng
`commodity_state`, `commodity_prices`, `news`, `lots`, `orders`, `npc_flow`, `gains`, `users.warehouse`, `ledger`.

## Ai gọi
`routes-economy.js`, `scheduler.js`, `business`, `factory`, `farm`, `contracts`, `minigames`, `social`, `wallet`.

## Lưu ý
- Đơn vị: `qty` là **phần**, giá là **xu/lô**; `amountFor(qty, price) = round(qty/10 × price)`.
- Giá vốn lô mua từ NPC/người chơi gồm phí: `(price × (1 + fee)) / LOT` mỗi phần (dòng 258).
- `purge` (bỏ hàng hư) chạy lười mỗi khi đọc kho; không có tác vụ dọn định kỳ.

## Liên quan
- [[Module rules-market]] · [[Nhịp mỗi phút]] · [[Sàn Nguyên Liệu]] · [[Kho Sàn]]
