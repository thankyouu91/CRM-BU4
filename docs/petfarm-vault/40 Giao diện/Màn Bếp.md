---
tags: [petfarm, giao-dien, man-hinh, bep]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/kitchen.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Bếp

> [!summary]
> Màn `#kitchen` (tòa 🍳, cần `unlocks.kitchen` = 3): thẻ đầu bếp (luôn là [[Thú chính]]), công thức đã biết, phòng thử ghép nguyên liệu để tìm món ẩn, và tủ món đã nấu có đồng hồ hạn dùng (cho bé ăn, bán cho quán, sang Chợ Phiên). Luật ở [[Bếp]].

## Khóa cấp

"🔒 Bếp chưa mở · Có một bé đạt cấp n là được vào bếp nấu nướng." (`public/ta-tua/game/js/views/kitchen.js:24-29`). Máy chủ: `petdex/server/routes-production.js:71`.

## Các khối

| Khối | Nội dung | Nguồn |
|---|---|---|
| 👩‍🍳 Đầu bếp hôm nay | tên bé chính, Lv, "⚡ n/100 · {Khéo tay} n", nút "Đổi bé chính" → [[Màn Nhà]]; giải thích mỗi lần nấu tốn `rules.energy` ⚡, Khéo tay cao dễ ra phẩm chất cao (`rules.quality[1..2]` với hệ số ×); link "Trường học"; lý do chặn (ốm: kèm link "Tới phòng khám"; thiếu năng lượng). Chưa có bé: "Chưa có bé nào làm đầu bếp." + "🏠 Nhận nuôi một bé" | `kitchen.js:47-79` |
| 📒 Công thức đã biết | nút "📈 Mua nguyên liệu ở Sàn"; "Nguyên liệu tính bằng phần (có/cần)…"; thẻ công thức: icon, tên, "✨ Món bí mật" nếu là món ẩn đã khám phá, danh sách nguyên liệu `có/cần` (đỏ nếu thiếu), hiệu quả, "Giá tham chiếu ~n 🪙 (loại {phẩm chất thường})", "Đủ nấu n lần" / "Thiếu nguyên liệu", nút "🍳 Nấu" | `kitchen.js:81-103`, `kitchen.js:168-175` |
| 🧪 Thử công thức | "Còn **n** món ẩn chưa khám phá…" hoặc "Bạn đã khám phá hết các món ẩn rồi, giỏi quá!", "Ghép sai thì **không mất nguyên liệu**, cứ thử thoải mái."; mỗi mặt hàng có trong kho: nút − / số / ＋ (tối đa `MIX_MAX = 9` phần và không quá số đang có); nút "🧪 Nấu thử (n phần)", "Làm lại". Kho trống: "🌱 Ra vườn", "📈 Tới Sàn" | `kitchen.js:12`, `kitchen.js:105-141` |
| 🍱 Tủ món đã nấu | mỗi món: icon, tên, huy hiệu phẩm chất (lớp `q0..q2`), hiệu quả đã nhân hệ số, "⏳ Hư sau … · tham chiếu n 🪙" (lớp `is-soon` khi còn dưới 6 giờ), nút "🍽️ Cho bé ăn", "💰 Bán cho quán · n 🪙"; ghi chú "Món nấu để được n ngày rồi hư. Quán ăn đầu phố mua lại bằng x% giá tham chiếu."; "🏮 Tới Chợ Phiên" | `kitchen.js:13`, `kitchen.js:143-160`, `kitchen.js:177-187` |

Biểu tượng hiệu quả riêng của màn: `EFFECTS` (🍙 No bụng, 💖 Vui vẻ, ⚡ Năng lượng, ❤️ Sức khỏe, 🫧 Sạch sẽ) (`kitchen.js:5-11`). Món chưa rõ công thức hiện "🍽️ Món bí ẩn" (`kitchen.js:44`).

## Cho bé ăn

Nhà chỉ có 1 bé thì gửi ngay. Nhiều bé thì mở hộp "Cho bé nào ăn {món}?", bé chính đứng đầu (⭐ · bé chính), mỗi dòng ghi 🍙 💖 ⚡ và cảnh báo "no căng bụng rồi" khi no bụng ≥ 97 và món có tác dụng no (`kitchen.js:196-221`).

## API

| Hành động | API | Nguồn |
|---|---|---|
| Tải | `GET /kitchen` | `kitchen.js:248` |
| Nấu theo công thức | `POST /kitchen/cook {recipe}` | `kitchen.js:228` |
| Nấu thử | `POST /kitchen/cook {inputs: {mặt hàng: phần}}`; thành công thì xóa phần ghép | `kitchen.js:236-239` |
| Cho ăn | `POST /kitchen/dishes/:id/eat {petId}` | `kitchen.js:200`, `kitchen.js:218` |
| Bán cho quán | `POST /kitchen/dishes/:id/sell` | `kitchen.js:243` |

Phần ghép thử (`mix`) là biến module nên còn nguyên khi quay lại màn; mỗi lần vẽ, phần ghép tự cắt về số đang có trong kho (`kitchen.js:15`, `kitchen.js:108-112`). Bấm ± chỉ vẽ lại khung thử (`redrawLab`), không vẽ cả màn.

## Làm mới

Mỗi giây cập nhật hạn dùng; có món vừa hư thì tải lại tủ (không khi đang mở hộp thoại, tối đa một lần mỗi 15 giây) (`kitchen.js:255-269`).

## Liên quan
- [[Bếp]], [[Kỹ năng]], [[Đồ ăn và đồ chăm sóc]], [[Chợ Phiên]], [[Kho Sàn]]
- [[Màn Vườn]], [[Màn Sàn]], [[Màn Chợ Phiên]], [[Màn Trường học]], [[Màn Nhà]]
