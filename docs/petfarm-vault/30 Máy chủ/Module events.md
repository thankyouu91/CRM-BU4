---
tags: [petfarm, may-chu, module, su-kien]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/events.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module events

> [!summary]
> `petdex/server/events.js` (6 dòng): một `EventEmitter` dùng chung (`bus`) để module nào cũng báo "thú cưng của người chơi X vừa đổi" mà không tạo vòng import với `playground.js`.

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `bus` | `events.js:5-6` | `new EventEmitter()`, `setMaxListeners(50)` |

## Sự kiện
| Tên | Payload | Phát bởi | Nghe bởi |
|---|---|---|---|
| `pet:changed` | `userId` | `service.mutatePet` (`service.js:79`), `routes.js` (nhận nuôi, nở trứng, đổi bé chính, đeo/tháo, mở hộp, nhập mã quà), `lifecycle.passAway` (`lifecycle.js:84`), `internal.js` (tặng/sửa/xóa trang phục, tặng/sửa thú) | `playground.js:78-84`: cập nhật thẻ người online, hoặc phát `pg:player`/`pg:left` cho cư dân |

`service.js:13` re-export `bus` để code cũ `import { bus } from './service.js'` vẫn chạy.

## Lưu ý
- Đây là sự kiện **đồng bộ trong tiến trình**; không lưu, không đi qua mạng.
- `mutatePet` phát sự kiện **sau** khi transaction commit (`service.js:79`), tránh phát cho thay đổi bị rollback; các chỗ khác cũng phát sau `store.transaction(...)`.

## Liên quan
- [[Module playground]] · [[Module service]] · [[Giao thức công viên]]
