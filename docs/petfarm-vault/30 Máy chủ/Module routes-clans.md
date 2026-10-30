---
tags: [petfarm, may-chu, module, api, clan]
loai: api
trang-thai: dang-chay
nguon: [petdex/server/routes-clans.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module routes-clans

> [!summary]
> `petdex/server/routes-clans.js` (47 dòng): API Gia tộc, Sở Nhà Đất (bản đồ 200 lô, xem trước, mua bán, chọn ngành, lắp ghép công trình) và bản tin vĩ mô.

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `clanApi` | `routes-clans.js:12-15` | `auth` gắn theo tiền tố `/clans`, `/land`, `/macro` (khác ba router kia gắn ở gốc) |

## Route (17)
Xem [[API người chơi]] mục "Gia tộc". Lập và gia nhập gia tộc chặn bằng `clanConfig().unlockLevel` (mặc định 4, quản trị chỉnh được) qua hàm `unlock` (dòng 18). `/clans/donate` yêu cầu `amount >= 10` ngay ở route (dòng 30). `/macro` trả `{ today: macroToday(), history: macroHistory(today, 14) }` (dòng 44-47).

## Lưu ý
- Quyền tộc trưởng/trưởng lão nằm trong `clans.js` (`mustRole`), route không kiểm.
- `/land/:id/preview` truyền `req.params.id` thô (chuỗi) cho `plotPreview`, hàm tự `Number()`.

## Liên quan
- [[Module clans]] · [[Module macro]] · [[Clan]] · [[Bản đồ đất]] · [[Kinh tế vĩ mô]] · [[API người chơi]]
