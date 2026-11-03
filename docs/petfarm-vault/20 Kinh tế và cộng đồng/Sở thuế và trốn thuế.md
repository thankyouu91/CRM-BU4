---
tags: [petfarm, kinh-te, thue, clan, so-thue]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/clans.js, petdex/server/internal.js, app/(app)/ta-tua/quan-ly/clans.tsx, public/ta-tua/game/js/views/clans.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Sở thuế, Tax evasion, Trốn thuế]
---
# Sở thuế và trốn thuế

> [!summary]
> Cơ chế "tự khai" của [[Thuế doanh nghiệp]]: tộc trưởng chọn tỉ lệ doanh thu khai báo 0–100%. Khai thiếu thì đêm đó đóng ít thuế hơn, nhưng **mỗi đêm khai thiếu thành một hồ sơ** mà người chơi không thấy; quản trị viên (vai Sở thuế) xem ở [[Quản trị Clan]] và quyết định truy thu kèm tiền phạt hoặc bỏ qua. Đây là một trò chơi rủi ro có chủ ý giữa người chơi và người vận hành.

## Phía người chơi
- Tab "🧾 Thuế" có ô "Tỷ lệ doanh thu gia tộc khai báo với Sở thuế mỗi đêm. Gia tộc tự chịu trách nhiệm về tờ khai của mình." và nút "Nộp tờ khai" (chỉ tộc trưởng) (`public/ta-tua/game/js/views/clans.js:542-546`).
- `POST /clans/declare {ratio}` (0–1), lưu làm tròn 2 số; lỗi "Tỉ lệ khai báo phải từ 0 đến 100%." hoặc "Chỉ tộc trưởng mới được khai báo thuế." (`petdex/server/routes-clans.js:34`, `petdex/server/clans.js:398-406,267-271`).
- Màn hình không báo có hồ sơ; gia tộc chỉ biết khi quỹ bị trừ dòng "Sở thuế truy thu" (`corp_tax_collect`).

## Phía Sở thuế (quản trị)
- Mỗi đêm có `evaded > 0`: `tax_evasion (clan_id, day, revenue, declared, rate, evaded, status 'open')` (thay thế nếu cùng ngày) và `adminLog('Sở thuế', 'tax_evasion', …)` (`petdex/server/clans.js:656-660`).
- Bảng quản trị liệt kê 100 hồ sơ, hồ sơ mở trước; ô "Tiền phạt (%)" mặc định 50, nhập 0–500 (`petdex/server/clans.js:167-169,735`, `app/(app)/ta-tua/quan-ly/clans.tsx:197-215`).
- `POST /admin/clans/evasion/:id/collect|dismiss` (`petdex/server/internal.js:600-603`):
  - **Truy thu**: `due = round(evaded × (1 + phạt))`, phạt kẹp 0–5 (0–500%); `collected = min(due, quỹ hiện có)`; chuyển **100%** về ngân sách (khác thuế thường chỉ 50%) (`petdex/server/clans.js:750-767`).
  - **Bỏ qua**: đóng hồ sơ, thu 0.
- Hồ sơ đã xử lý báo "Hồ sơ đã xử lý rồi." (`petdex/server/clans.js:754`).

## Trường hợp đặc biệt
- Quỹ không đủ thì chỉ thu được tới hết quỹ, phần còn lại **không** thành nợ (`petdex/server/clans.js:760`).
- Hồ sơ không tự hết hạn; gia tộc giải tán vẫn còn hồ sơ nhưng quỹ đã về 0.
- Khai 0% cả tháng thì hoàn thuế cuối tháng cũng bằng 0.

## Liên quan
- [[Thuế doanh nghiệp]] · [[Clan]] · [[Quản trị Clan]] · [[Nhật ký quản trị]] · [[Ngân sách thị trấn]] · [[MOC Kinh tế và cộng đồng]]
