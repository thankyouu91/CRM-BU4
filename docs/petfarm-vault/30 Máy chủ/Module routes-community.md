---
tags: [petfarm, may-chu, module, api]
loai: api
trang-thai: dang-chay
nguon: [petdex/server/routes-community.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module routes-community

> [!summary]
> `petdex/server/routes-community.js` (84 dòng): API quầy trà sữa, Tòa thị chính, bạn bè, Hội và nhiệm vụ ngày. Mọi route cần đăng nhập (`use(auth)`, dòng 17).

## Exports
| Tên | Dòng |
|---|---|
| `communityApi` | `routes-community.js:16` |

## Route (25)
Xem [[API người chơi]] mục "Cộng đồng". Chặn cấp: mở quầy (`UNLOCKS.business` 4, dòng 26), bỏ phiếu (`townhall` 3, dòng 45), lập Hội (`guild` 3, dòng 65). Gia nhập Hội không chặn cấp.

## Lưu ý
- `/quests/:slot/claim` tự kiểm `Number.isInteger(slot)` ("Nhiệm vụ không hợp lệ.", dòng 81-82) vì `slot` có thể âm (`-1` là rương) nên không dùng `intField`.
- `/friends/request` nhận **tên** người chơi (`username`), còn các route khác nhận id.

## Liên quan
- [[Module business]] · [[Module town]] · [[Module social]] · [[Module quests]] · [[API người chơi]]
