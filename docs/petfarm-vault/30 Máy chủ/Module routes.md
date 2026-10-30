---
tags: [petfarm, may-chu, module, api]
loai: api
trang-thai: dang-chay
nguon: [petdex/server/routes.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module routes

> [!summary]
> `petdex/server/routes.js` (327 dòng) tạo router gốc `api` của game: route công khai (`/catalog`, đăng ký gốc, bảng xếp hạng), route lõi về tài khoản, thú, trứng, đồ đeo, mã quà, Siêu thị; rồi gắn bốn router con và hai handler cuối (404, lỗi). Danh mục route ở [[API người chơi]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `api` | `routes.js:40` | `Router()` được `durable.js` và `index.js` phục vụ dưới `/api` |

## Hàm nội bộ
| Tên | Dòng | Việc |
|---|---|---|
| `cleanPetName(raw)` | `routes.js:42-46` | Gộp khoảng trắng, 1-16 ký tự |
| `findItem(itemId)` | `routes.js:48-52` | Dùng `Object.hasOwn` để chặn `__proto__`... |
| `requireOwned(userId, item)` | `routes.js:54-56` | Đồ chơi phải có trong túi |
| `issueSession(res, userId)` | `routes.js:58-61` | Trả `{ token, ...snapshot }` |

## Thứ tự gắn
1. Route công khai và route có `auth` riêng (dòng 65-313).
2. `api.use(economyApi)`, `communityApi`, `productionApi`, `clanApi` (dòng 315-318).
3. `api.use('/{*rest}', 404)` (dòng 320).
4. Error handler 4 tham số (dòng 322-327).

## Điểm đáng chú ý trong handler
- `/daily` (dòng 151-168): chuỗi ngày tăng nếu `nextDay(daily_day) === today`, thưởng `dailyReward(streak)`, cộng trợ cấp tân thủ `payStipend`; ghi `users.last_daily_at, daily_day, streak`.
- `/pets` (dòng 170-184): kiểm ô trống `slotsOf().free`, bé thứ hai trở đi trừ `RULES.adoptCost` (sổ `adopt`), `createPet` (tính cách, kỹ năng, kỷ vật).
- `/shop/buy` (dòng 286-313): giá nhân chỉ số giá (`indexedPrice`); trang phục mỗi lần một hộp kín `createGear(..., { shop: true, luck: userBonus().luck + gradeLuck(minLevel) })`; đồ không tiêu hao chỉ mua một lần.
- `/pets/:id/use` (dòng 211-229): lấy món trong túi và `mutatePet` trong cùng transaction; đồ ăn báo nhiệm vụ `feed`.
- `/catalog` (dòng 65-101): gửi giá gốc; client tự nhân `economy.priceIndex` từ `/me` để khớp giá server thu.

## Sự kiện
`bus.emit('pet:changed')` sau nhận nuôi, nở trứng, đổi bé chính, đeo/tháo, mở hộp, nhập mã quà. Nhiệm vụ: `track(...,'feed')`, `track(...,'play')`.

## Liên quan
- [[API người chơi]] · [[Router]] · [[Module http]] · [[Module service]]
- [[Siêu thị]] · [[Quà ngày]] · [[Trứng ngũ hành]] · [[Mã quà]] · [[Trang phục]] · [[Bảng vàng]]
