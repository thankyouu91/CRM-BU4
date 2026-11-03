---
tags: [petfarm, may-chu, module, cho-phien]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/bazaar.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module bazaar

> [!summary]
> `petdex/server/bazaar.js` (186 dòng): Chợ Phiên, nơi người chơi bày bán cho nhau đồ Siêu thị, trang phục có cấp và món tự nấu với giá tự đặt trong khoảng cho phép quanh giá tham chiếu. Luật: [[Chợ Phiên]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `listForSale(userId, { kind, ref, price }, now)` | `bazaar.js:74-117` | Tài khoản đủ `minAccountDays`; tối đa `maxListings` tin; giá trong `band` × giá tham chiếu; lấy hàng ra khỏi túi/tủ/bếp; phí đăng tin (`chargeFee`, tối thiểu 1 xu); tin sống `hours` (món ăn: tới lúc hư) |
| `buyListing(userId, listingId, now)` | `bazaar.js:119-141` | Không mua tin của mình; đồ dùng mãi mãi chỉ mua nếu chưa có; người mua trả đủ (sổ `bazaar_buy`), người bán nhận giá trừ phí bán (`bazaar_sale`) + `tradeBonus`; một nửa phí vào ngân sách; đánh dấu `sold` có điều kiện |
| `cancelListing(userId, listingId, now)` | `bazaar.js:143-151` | Gỡ tin, hàng về lại (phí không hoàn) |
| `expireListings(now)` | `bazaar.js:154-161` | Nửa đêm: tin hết hạn trả hàng về người bán |
| `bazaarView(userId, now)` | `bazaar.js:163-186` | 200 tin mở, 10 tin đã bán/hết hạn của mình, 10 món đã mua, đồ có thể bán (trang phục, vật phẩm, món ăn) kèm giá tham chiếu |

## Ba loại tin
| `kind` | `ref` | Giá tham chiếu | Lấy ra | Trả lại / giao |
|---|---|---|---|---|
| `item` | mã món (không phải trang phục) | `indexedPrice(item.price)` | `takeItem`; hết món thì `unequipItem` | `addItem` |
| `gear` | id bản `gear` (chuỗi) | `indexedPrice(price) × TIER_VALUE[tier]` | `setGearListed(true)` (gỡ khỏi bé) | `setGearListed(false)` / `transferGear` |
| `dish` | mã công thức (lưu cả `quality`, `made_at`) | `dishValue(recipe, quality, priceIndex)` | `takeDish` | `giveDish` (món đã hư thì mất) |

## Bảng
`listings`, `dishes`, `inventory`, `gear`, `pet_wear`, `ledger`, `accounts.treasury`.

## Ai gọi
`routes-production.js`, `scheduler.closeDay`.

## Lưu ý
- Hộp trang phục chưa mở không bày bán được ("Mở hộp trước rồi hẵng bày bán nhé.").
- Phí bán: người bán chịu toàn bộ phí (`price - fee`), ngân sách nhận một nửa, nửa kia bị hủy.

## Liên quan
- [[Chợ Phiên]] · [[Module gear]] · [[Module farm]] · [[Module ledger]]
