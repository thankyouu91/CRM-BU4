---
tags: [petfarm, may-chu, module, cong-vien, websocket]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/playground.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module playground

> [!summary]
> `petdex/server/playground.js` (245 dòng): toàn bộ logic công viên thời gian thực: vào/ra, di chuyển, chat, biểu cảm, vuốt ve, tặng quà, và "cư dân" (bé của người đang vắng vẫn đứng trong công viên). Giao thức ở [[Giao thức công viên]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `WORLD` | `playground.js:6` | `{ width: 1000, height: 600, minX: 50, maxX: 950, minY: 318, maxY: 585 }` |
| `parkUsers` | `playground.js:17` | `Set` userId đang online ở công viên |
| `MAX_RESIDENTS` | `playground.js:37` | 50 cư dân vắng chủ tối đa |
| `attachPlayground(io)` | `playground.js:63-245` | Gắn middleware xác thực, handler `connection`, nghe `bus 'pet:changed'` |

## Hằng và hàm nội bộ
`ROOM = 'park'`, `CUDDLE_COOLDOWN_MS = 30_000`, `CHAT_GAP_MS = 1_000`, `GIFT_GAP_MS = 2_000`, `EMOTES = wave, jump, spin` (dòng 8-12). `petCard(row)` (dòng 19-32), `view(p)` (dòng 34), `residentId(userId) = 'r' + userId` (dòng 38), `homeSpot(userId)` mulberry32 (dòng 42-52), `residentOf(userId)` (dòng 55-61). Trong `attachPlayground`: `players` Map socketId -> người (dòng 64), `lastCuddle` Map `"petA>petB"` -> thời điểm, tự dọn khi > 5.000 khóa (dòng 65, 203-205), `refresh`, `leave`, `self`, `other`.

## Bảng và sổ cái
Đọc `users`, `pets` (qua `db`). Vuốt ve: `mutatePet` cho cả hai bé, bé chủ động +3 xu sổ `cuddle` (dòng 208-210). Tặng quà: `takeItem`/`addItem` trong transaction (dòng 233-236). Nhiệm vụ `cuddle`.

## Ai dùng
`durable.js:32`, `index.js:49`; `parkUsers` được `social.js` và `internal.js` đọc.

## Lưu ý
- Trạng thái (`players`, `lastCuddle`, `lastChat`, `lastGift`) chỉ ở RAM.
- Một người một bé: `pg:join` từ tab mới đá tab cũ (`pg:kicked`).
- Cư dân lấy từ `residentUsers(50)` theo `last_seen_at`, nên người lâu không vào sẽ "rời" công viên.
- Vuốt ve bé cư dân vẫn cộng XP/vui cho bé vắng chủ và gửi `me:changed` vào id cư dân (không ai nhận).

## Liên quan
- [[Giao thức công viên]] · [[Hub WebSocket]] · [[Module events]] · [[Công viên]]
