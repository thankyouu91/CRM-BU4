---
tags: [petfarm, may-chu, module, api]
loai: api
trang-thai: dang-chay
nguon: [petdex/server/routes-production.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module routes-production

> [!summary]
> `petdex/server/routes-production.js` (156 dòng): API "giai đoạn 2": tắm và phòng khám, trường học, vườn, bếp, khu công nghiệp, hợp đồng cung ứng, Chợ Phiên, tín dụng. Mọi route cần đăng nhập (`use(auth)`, dòng 20).

## Exports
| Tên | Dòng |
|---|---|
| `productionApi` | `routes-production.js:19` |

## Hàm phụ
`uid(req)`, `str(v)`, `petOf(req)` (đọc `petId` từ body hoặc query, dòng 22-24), `plotOf(req)` (ô 0-99, dòng 50), `factoryOf(req)` (dòng 86), `contractOf(req)` (dòng 113).

## Route (36)
Xem [[API người chơi]] mục "Sản xuất". Chặn cấp: lớp học 2, gieo hạt 2, nấu 3, xây xưởng 6, gửi gia công 2 (dùng `UNLOCKS.market` với nhãn "Gia công"), đề xuất và nhận hợp đồng 6, bày bán và mua ở Chợ Phiên 4. Vay kiểm `settings.advancedFinance` (dòng 151) rồi `credit.borrow` kiểm `users.advanced`.

## Lưu ý
- `/kitchen/cook` chuyển `inputs` thành `{ chuỗi: số }` trước khi gọi `cook` (dòng 72-74).
- `/school` không có `petId` thì dùng bé chính, không có bé thì "Bạn chưa có bé nào." (dòng 39-40).

## Liên quan
- [[Module care]] · [[Module farm]] · [[Module factory]] · [[Module contracts]] · [[Module bazaar]] · [[Module credit]] · [[API người chơi]]
