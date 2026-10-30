---
tags: [petfarm, may-chu, module, trang-phuc]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/gear.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module gear

> [!summary]
> `petdex/server/gear.js` (223 dòng): trang phục có cấp. Mỗi món người chơi sở hữu là một dòng bảng `gear` (cấp + dòng chỉ số JSON). Module tạo/quay đồ, mở hộp kín, đeo theo giới hạn số món, chuyển chủ khi bán, cấu hình quay đồ do quản trị chỉnh và "thưởng giao dịch". Luật quay ở `public/ta-tua/game/js/shared/gear.js`; ý nghĩa ở [[Trang phục]], [[Cấp trang phục]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `gearConfig()` | `gear.js:31-41` | Đọc `meta.gear_config` (cache RAM), chuẩn hóa bằng `normalizeGearConfig`; lỗi thì dùng mặc định |
| `setGearConfig(input)` | `gear.js:42-52` | Chuẩn hóa (lỗi -> `GameError`), lưu `meta`, cập nhật cache |
| `isWearable(itemId)` | `gear.js:55` | `ITEMS[id].type === 'accessory'` |
| `createGear(ownerId, itemId, { tier, affixes, source, luck, shop, rand }, now)` | `gear.js:62-79` | Ba cách: dòng chỉ số tự nhập (`cleanAffixes`), hộp Siêu thị (`rollShopGear`, `sealed = 1`), quay thường (`rollGear` theo cấp hoặc quay cả cấp) |
| `createRandomGear(ownerId, opts, now)` | `gear.js:82-85` | Món ngẫu nhiên trong mọi trang phục |
| `getGear(id)` | `gear.js:87` | Kèm `affixes` đã parse |
| `listGear(ownerId, { includeListed, reveal })` | `gear.js:90-92` | Tủ đồ kèm `wornBy`; bỏ món đang bày bán trừ khi `includeListed` |
| `describeGear(g, { reveal })` | `gear.js:95-132` | Hộp kín (chưa `reveal`) giấu cấp và dòng: `tierName: 'Hộp chưa mở'` |
| `wornGear(petId)` | `gear.js:135-142` | Đồ đang đeo theo khe kèm cấp, dòng |
| `openGear(userId, gearId)` | `gear.js:145-151` | Bỏ `sealed` |
| `wearLimitOf(pet)` | `gear.js:154` | `wearLimit(level, rarity)` của `shared/pets.js` |
| `equipGear(userId, pet, gearId)` | `gear.js:157-172` | Không cho món đang bán/hộp kín; đổi trong cùng khe không tính thêm; gỡ món khỏi bé khác rồi `setWear` |
| `updateGear(id, { tier, affixes })` | `gear.js:175-187` | Quản trị sửa |
| `deleteGear(id)` | `gear.js:190-193` | Gỡ khỏi bé, xóa |
| `transferGear(id, newOwnerId)` | `gear.js:196-199` | Chợ Phiên: gỡ khỏi bé, đổi chủ, bỏ `listed` |
| `setGearListed(id, listed)` | `gear.js:201-204` | Bày bán thì gỡ khỏi bé |
| `userBonus(userId)` | `gear.js:209-212` | Tổng % của **bé chính** (dùng cho việc cả người chơi: mua, giao dịch, nấu) |
| `tradeBonus(userId, amount, memo, now)` | `gear.js:218-223` | `floor(amount × trade% / 100)` thành dòng sổ `gear_trade` riêng |

## Bảng
`gear`, `pet_wear`, `meta` (`gear_config`), `ledger` (qua `post`).

## Ai gọi
`routes.js` (mua, đeo, mở hộp, catalog), `internal.js` (cấu hình, tặng/sửa/xóa), `minigames.js` (rớt đồ), `gifts.js`, `bazaar.js`, `market.js` và `farm.js` (`tradeBonus`), `migrate.js`, `service.js`.

## Lưu ý
- Cache `cached` ở mức module: chỉ đúng vì chỉ có một Durable Object; sửa `meta.gear_config` bằng tay trong DB sẽ không có tác dụng tới khi isolate khởi động lại.
- `tradeBonus` cộng **thêm** xu mới (in tiền) chứ không trích từ người mua.

## Liên quan
- [[Trang phục]] · [[Cấp trang phục]] · [[Module bazaar]] · [[Quản trị trang phục và mã quà]] · [[Migration]]
