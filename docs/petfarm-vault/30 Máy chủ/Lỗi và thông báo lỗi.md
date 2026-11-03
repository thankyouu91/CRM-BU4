---
tags: [petfarm, may-chu, loi, api]
loai: api
trang-thai: dang-chay
nguon: [petdex/server/game.js, petdex/server/routes.js, petdex/server/internal.js, petdex/server/router.js, petdex/server/http.js, petdex/server/ledger.js, petdex/server/playground.js, petdex/server/index.js, petdex/server/durable.js, worker.ts]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Lỗi và thông báo lỗi

> [!summary]
> Máy chủ phân biệt hai loại lỗi: `GameError` (lỗi do người chơi: thiếu xu, bé mệt, sai tham số), được trả **nguyên văn tiếng Việt** cho client, và mọi lỗi khác (lỗi lập trình), bị giấu sau một thông báo chung và log ra console. Có 330 chỗ `throw new GameError(...)` trong `petdex/server/`; note này gom cơ chế ánh xạ mã HTTP và các thông báo chính.

## `GameError`
`export class GameError extends Error {}` ở `petdex/server/game.js:138`. Không có mã lỗi máy đọc được: client chỉ hiển thị `error`. Ngoại lệ duy nhất có mã là `reason` của API nội bộ (`no_password`, `no_proof`).

## Ánh xạ sang HTTP

| Tình huống | Mã | Thân | Nguồn |
|---|---|---|---|
| `GameError` ở API người chơi | 400 | `{ error: message }` | `routes.js:323` |
| `err.type === 'entity.parse.failed'` | 400 | "Dữ liệu gửi lên không hợp lệ." (thực tế không tới được, xem [[Router]]) | `routes.js:324` |
| Lỗi khác ở API người chơi | 500 | "Máy chủ gặp sự cố, thử lại sau nhé." | `routes.js:325-326` |
| Không khớp route | 404 | "Không tìm thấy." | `routes.js:320`, `internal.js:608`, `router.js:169`, `durable.js:66` |
| Body > 16 KB | 413 | "Dữ liệu gửi lên quá lớn." | `router.js:112`, `166` |
| Body không phải JSON | 400 | "Chỉ nhận JSON." / "JSON không hợp lệ." | `router.js:114-118`, `166` |
| Thiếu/hết token | 401 | "Phiên đăng nhập đã hết, hãy đăng nhập lại." | `http.js:9` |
| Tài khoản bị khóa | 403 | "Tài khoản này đã bị quản trị viên khóa." | `http.js:10` |
| `GameError` ở API nội bộ | 400 | `{ error }` | `internal.js:611` |
| Lỗi khác ở API nội bộ | 500 | "Máy chủ game gặp sự cố." | `internal.js:612-613` |
| Đăng nhập tên đã có nhưng chưa có mật khẩu | 409 | `{ error: 'Tài khoản này chưa có mật khẩu.', reason: 'no_password' }` | `internal.js:174-176` |
| Không chứng minh được sở hữu tài khoản | 409 | `{ error, reason: 'no_proof' }` | `internal.js:212-214` |
| Node: gọi `/internal` sai khóa | 403 | "Chỉ WorkHub mới gọi được." | `index.js:97-100` |
| Node: lỗi không bắt | 500 | "Máy chủ gặp sự cố, thử lại sau nhé." | `index.js:104-108` |
| Node: file tĩnh/đường lạ | 404 | "Không tìm thấy." (text) | `index.js:80-83` |
| DO: `/ws` không phải upgrade | 426 | "Cần WebSocket." | `durable.js:57` |
| Worker thiếu binding `PETDEX` | 503 | "Pet Town chưa được bật trên máy chủ này." | `worker.ts:33` |

## Lỗi qua WebSocket
| Tình huống | Tin | Nguồn |
|---|---|---|
| Token sai/bị khóa lúc bắt tay | `['connect_error', { message: 'Bạn cần đăng nhập.' }]` rồi đóng | `playground.js:100`, `hub.js:89` |
| `GameError` trong handler | `['pg:error', { message }]` | `playground.js:112` |
| Lỗi khác | `['pg:error', { message: 'Có lỗi xảy ra.' }]` + log | `playground.js:111-112` |

## Lỗi không phải GameError cố ý
`ledger.post()` ném `Error` thường (thành 500) khi lập trình sai: "Số xu phải là số nguyên: ..." và "Loại giao dịch lạ: ..." (`ledger.js:112-113`). Gặp 500 sau khi thêm luật mới thì kiểm tra hai lỗi này đầu tiên: mọi `delta` phải là số nguyên và `kind` phải có trong `KINDS`.

Một số nơi **dịch** lỗi sổ cái thành thông báo dễ hiểu: "Chủ xưởng/Chủ quầy không đủ tiền trả lương lúc này." khi `post()` trên ví chủ ném "Không đủ xu." (`jobs.js:119-124`, `134-139`). Nơi khác cố ý không bắt để lỗi tràn ra: ví dụ `placeOrder` mua mà thiếu xu sẽ hiện "Không đủ xu.".

## Thông báo người chơi hay gặp

| Nhóm | Thông báo (rút gọn) | Nguồn |
|---|---|---|
| Xu và đồ | "Không đủ xu." · "Tài khoản tiết kiệm không đủ tiền." · "Bạn không có đủ món này." | `ledger.js:117`, `121`, `db.js:757` |
| Chung | "`<nhãn>` không hợp lệ." · "Không tìm thấy thú cưng này." | `http.js:27`, `service.js:56` |
| Mở khóa | "`<Khu>` mở khi có một bé đạt cấp `<n>`." · "Cần một bé đạt cấp `<n>` để mua món này." | `routes-economy.js:24`, `routes.js:294`, `308` |
| Chăm bé | "`<tên>` no căng bụng rồi!" · "`<tên>` mệt quá, để bé nghỉ chút đã." · "`<tên>` đói quá, không chơi nổi." · "`<tên>` đang `<bệnh>`, đưa bé đi khám rồi hẵng `<việc>`." · "`<tên>` đang bận, xong việc rồi tắm nhé." | `game.js:197-272` |
| Nhận nuôi | "Tên thú cưng dài 1–16 ký tự." · "Loài thú này chưa được cài vào công viên." · "`<loài>` là loài hiếm, chưa nhận nuôi trực tiếp được." · "Đã hết ô nuôi (tối đa 4, tính cả trứng đang ấp và ô tưởng niệm)." | `routes.js:44`, `173-178` |
| Ca làm | "Ca làm chỉ có 1, 2 hoặc 4 giờ." · "Hôm nay `<tên>` chỉ làm thêm được `<h>` giờ nữa (tuổi này làm tối đa `<m>` giờ/ngày)." · "`<tên>` cần `<n>` năng lượng cho ca `<h>` giờ." · "Ca làm chưa xong." · "Ca này đã nhận lương rồi." | `rules/careers.js:60-69`, `jobs.js:162-164` |
| Sàn | "Giá đặt phải nằm trong khoảng `<lo>`–`<hi>` xu/lô." · "Kho đầy rồi: nâng cấp kho hoặc bán bớt hàng." · "Kho chỉ còn `<x>` lô `<hàng>`." · "Hôm nay đã hết hạn mức giao dịch với NPC cho mặt hàng này." · "Khối lượng từ 0,1 đến 100 lô." | `market.js:94-274` |
| Ngân hàng | "Kỳ hạn chỉ có 3, 7 hoặc 14 ngày." · "Gửi kỳ hạn tối thiểu 100 🪙." | `bank.js:68-69` |
| Vay | "Bật chế độ tài chính nâng cao (cấp 8) để vay." · "Bạn đang bị cấm vay vì từng vỡ nợ." · "Hạn mức hiện tại của bạn là `<n>` xu." · "Máy chủ này đã tắt chế độ Tài chính nâng cao." | `credit.js:50-55`, `111`, `routes-production.js:151` |
| Trang phục | "`<tên>` (cấp `<n>`) chỉ đeo được `<k>` món cùng lúc..." · "Mở hộp trước rồi hẵng đeo nhé." · "Món này đang bày bán ở Chợ Phiên." | `gear.js:160-167` |
| Mã quà | "Mã quà không đúng." · "Bạn đã nhận quà của mã này rồi." · "Mã quà này đã hết lượt." · "Bạn nhập mã nhiều quá, thử lại sau một phút nhé." | `gifts.js:220-258` |
| Mini-game | "Không tìm thấy ván chơi." · "Ván này đã kết thúc rồi." · lý do từ `judge()` của luật chung | `minigames.js:87-92` |
| Gia tộc | "Bạn chưa ở gia tộc nào." · "Chỉ tộc trưởng mới được `<việc>`." · "Quỹ gia tộc không đủ: cần `<x>` xu, quỹ còn `<y>` xu." · "Mỗi gia tộc thâu tóm tối đa 3 ngành." | `clans.js:191`, `263`, `269`, `383` |
| Công viên | "Bạn chưa vào công viên." · "Đợi `<n>` giây nữa rồi vuốt ve `<tên>` tiếp nhé." · "Từ từ thôi, nói chậm lại nào!" · "Tặng quà chậm thôi nào!" | `playground.js:118-232` |
| Đăng ký gốc | "Máy chủ này đăng nhập qua WorkHub, không tự tạo tài khoản." | `routes.js:104`, `119` |

## Số lượng `throw new GameError` theo file
`internal.js` 42 · `clans.js` 33 · `social.js` 27 · `gifts.js` 26 · `farm.js` 24 · `routes.js` 20 · `business.js` 15 · `bazaar.js` 15 · `factory.js` 14 · `market.js` 13 · `gear.js` 13 · `contracts.js` 13 · `rules/careers.js` 8 · `playground.js` 8 · `game.js` 7 · `credit.js` 7 · `minigames.js` 6 · `eggs.js` 6 · `care.js` 6 · `quests.js` 5 · `jobs.js` 5 · `bank.js` 4 · `town.js` 2 · `routes-production.js` 2 · `routes-economy.js` 2 · `ledger.js` 2 · `service.js`, `routes-community.js`, `lifecycle.js`, `http.js`, `db.js` mỗi file 1. Tổng 330.

## Liên quan
- [[Module game]] · [[Module routes]] · [[Module internal]] · [[Module http]] · [[Module ledger]]
- [[API người chơi]] · [[API nội bộ]] · [[Giao thức công viên]]
