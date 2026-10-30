---
tags: [petfarm, may-chu, module, websocket]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/hub.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module hub

> [!summary]
> `petdex/server/hub.js` (157 dòng): hub thời gian thực giả lập API socket.io trên WebSocket thuần. Mô tả đầy đủ ở [[Hub WebSocket]]; giao thức nghiệp vụ ở [[Giao thức công viên]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `createHub()` | `hub.js:10-135` | Trả `hub` với `use`, `on('connection')`, `to(target).emit`, `sockets.sockets`, và các hàm transport `connect(transport, auth)`, `message(socket, text)`, `closed(socket)`, `parseAuth(text)` |
| `bindWebSocket(hub, ws)` | `hub.js:141-157` | Gắn một WebSocket (`ws` của Node hoặc `WebSocketPair` của Workers): khung đầu là `auth`, sau đó là sự kiện; `close`/`error` gọi `hub.closed` |

Cấu trúc trong: `sockets` Map id -> socket, `rooms` Map room -> Set id (dòng 11-12); `newId()` dòng 8.

## Ai dùng
`durable.js:9`, `31`, `61`; `index.js:13`, `48`, `115`; `playground.attachPlayground(io)` nhận hub làm `io`.

## Lưu ý
- Không lưu trạng thái vào DB; mọi thứ mất khi isolate khởi động lại.
- `socket.to(room)` loại trừ chính socket gửi, còn `hub.to(room)` gửi cho tất cả.

## Liên quan
- [[Hub WebSocket]] · [[Module playground]] · [[Socket phía trình duyệt]]
