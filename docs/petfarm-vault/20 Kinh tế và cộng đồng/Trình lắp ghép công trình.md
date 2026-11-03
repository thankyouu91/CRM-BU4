---
tags: [petfarm, kinh-te, clan, cong-trinh, xay-dung]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/clans.js, public/ta-tua/game/js/shared/clan.js, petdex/server/clans.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🏗️ Xây dựng, Building editor, Xưởng lắp ghép]
---
# Trình lắp ghép công trình

> [!summary]
> Tab "🏗️ Xây dựng" của [[Màn Clan]]: tộc trưởng hoặc trưởng lão chọn lô của gia tộc, đặt tối đa 20 mảnh từ [[Mẫu công trình]] lên khung 24 × 20 ô, đổi màu, lật, sắp lớp, rồi lưu. Máy chủ chỉ thu **phần giá vượt quá số đã chi cho lô đó**, nên sửa lại công trình không mất tiền cũ. Lô chỉ sinh doanh thu khi công trình hoàn chỉnh (≥ 3 mảnh, có móng nền).

## Thao tác (`public/ta-tua/game/js/views/clans.js:380-460,640-700`)
- Chọn lô trong danh sách lô của gia tộc; chưa có lô: "Gia tộc cần mua ít nhất một lô đất trước khi xây công trình."
- Chọn họ mảnh (20 nút), chọn mảnh (hiện kích thước và giá), chạm vào khung để đặt; chọn lớp đã đặt để đổi màu.
- Danh sách lớp: ▲ đưa ra sau, ▼ đưa lên trước, ⇋ lật ngang, ✕ bỏ mảnh; "lớp sau đè lớp trước".
- Mẫu sẵn: **Nhà phố**, **Nhà máy**, **Tháp văn phòng**; "Hoàn tác" (tải lại bản đã lưu), "Xóa hết" (`public/ta-tua/game/js/views/clans.js:361-380,434-436`).
- Dòng trạng thái: "✅ Đủ điều kiện vận hành · +X% sản lượng" hoặc "⚠️ Cần ≥ 3 mảnh và có móng nền"; dưới cùng "Tổng giá mảnh … · đã chi cho lô … · cần thêm …".

## Máy chủ (`saveDesign`, `petdex/server/clans.js:474-490`)
1. Quyền tộc trưởng hoặc trưởng lão, lô thuộc gia tộc.
2. `cleanDesign` kiểm: mảng ≤ 20 phần tử, mã mảnh có thật, `x`, `y` nguyên trong khung (`x + w ≤ 24`, `y + h ≤ 20`), màu `#rrggbb`, chuẩn hóa `flip` (`public/ta-tua/game/js/shared/clan.js:510-525`). Lỗi trả đúng thông báo: "Mỗi công trình ghép tối đa 20 mảnh.", "Mảnh thứ N không có trong bộ mẫu.", "X nằm ngoài khung lắp ghép.", "Màu của X không hợp lệ."
3. `cost = Σ giá mảnh`; `extra = max(0, cost − design_spent)` trừ quỹ (`clan_build`, hủy 100%); `design_spent = max(cũ, cost)`.
4. Báo "🏗️ Đã lưu công trình lô … (chi X xu)." kèm nhắc nếu chưa đủ điều kiện.

## Trường hợp đặc biệt
- Các mảnh **được phép chồng lên nhau** (không kiểm va chạm).
- Bớt mảnh không hoàn tiền; `design_spent` chỉ tăng. Bán lại lô thì `design_spent` về 0 (`petdex/server/clans.js:150`).
- Công trình được vẽ lại trên [[Bản đồ đất]] cho mọi người xem (`designSvg`, `public/ta-tua/game/js/shared/clan.js:491-504`).

## Liên quan
- [[Mẫu công trình]] · [[Clan]] · [[Bản đồ đất]] · [[Màn Clan]] · [[MOC Kinh tế và cộng đồng]]
