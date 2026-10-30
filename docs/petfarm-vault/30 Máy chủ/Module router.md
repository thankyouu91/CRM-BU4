---
tags: [petfarm, may-chu, module, http]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/router.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module router

> [!summary]
> `petdex/server/router.js` (172 dòng): router kiểu Express viết tay, không phụ thuộc `node:http`, chạy trên Node và Workers. Cách duyệt layer và các bẫy ở [[Router]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `Router()` | `router.js:35-99` | Trả `{ get, post, use, handle }`; chỉ hỗ trợ GET, POST và `use` |
| `buildRequest({ method, url, headers, text, ip, prefix })` | `router.js:104-123` | Request rút gọn; parse JSON, giới hạn 16 KB |
| `buildResponse()` | `router.js:126-157` | `{ res, done }`; `res.send` chỉ có tác dụng lần đầu (`finished`) |
| `handleFetch(router, request, { prefix, ip })` | `router.js:160-172` | Chạy router với Fetch API `Request`, trả `Response` |

Hàm nội bộ: `compile(path, prefix)` (dòng 7-23), `match(layer, req)` (dòng 25-33); hằng `CATCH_ALL = /\{\*\w+\}/` (dòng 5), `BODY_LIMIT = 16 * 1024` (dòng 101).

## Ai dùng
`routes.js`, `routes-*.js`, `internal.js` tạo `Router()`; `durable.js` và `index.js` gọi `handleFetch`.

## Lưu ý
- Không có PUT/DELETE/PATCH: mọi thao tác ghi là POST (vd. `/bazaar/:id/cancel`).
- Header phản hồi lưu bằng chữ thường; `content-type` mặc định `text/plain; charset=utf-8` khi `send`, JSON khi `json`.
- `handleFetch` không có `try/catch` quanh `router.handle`: lỗi không ai bắt sẽ làm request trên DO thất bại với lỗi runtime.

## Liên quan
- [[Router]] · [[Module http]] · [[API người chơi]] · [[API nội bộ]] · [[Kiểm thử petdex]]
