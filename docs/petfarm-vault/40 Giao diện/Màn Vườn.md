---
tags: [petfarm, giao-dien, man-hinh, vuon]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/garden.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Vườn

> [!summary]
> Màn `#garden` (tòa 🌱, cần `unlocks.garden` = 2): ruộng các ô đất với cây lớn dần theo thời gian thật, bắt sâu, thu hoạch vào kho Sàn, mở thêm ô; khối tưới hộ vườn bạn bè; sổ tay giống cây. Luật ở [[Vườn]].

## Khóa cấp

"🔒 Vườn chưa mở · Có một bé đạt cấp n là được nhận đất trồng trọt." (`public/ta-tua/game/js/views/garden.js:16-21`). Máy chủ: `petdex/server/routes-production.js:57`.

## Ô đất (`plotTile`)

| Trạng thái | Hiển thị | Nút (vườn mình) | Nút (vườn bạn) |
|---|---|---|---|
| Trống | 🟫 "Ô n" | "🌱 Gieo hạt" → hộp chọn giống | "Đang để trống" |
| Đang lớn | 🌱 (< 34% thời gian), 🌿 (34–66%), icon cây (≥ 67%); tên; thanh tiến độ; "còn …"; huy hiệu "💧 Đã tưới +x%" (tooltip số lượt), "🐛 Có sâu −y%"; "Dự kiến a–b phần" | "🐛 Bắt sâu" nếu có sâu | "💧 Tưới hộ", hoặc "💧 Bạn đã tưới ô này", hoặc "Hết lượt tưới hôm nay" |
| Chín | icon cây, "✨ Chín rồi!" | "🧺 Thu hoạch" | "Chín rồi, chờ chủ vườn thu" |

Nguồn `garden.js:43-91`. Sản lượng dự kiến ở client: `round(yield × (watered ? 1 + waterBonus : 1) × (pests ? 1 − pestLoss : 1))`, tối thiểu 1 (`garden.js:36-40`).

## Các khối

| Khối | Nội dung | Nguồn |
|---|---|---|
| 🌾 Ruộng nhà mình | số ô, huy hiệu "🧺 n ô chín", "🐛 n ô có sâu"; lưới ô; ô "➕ Mở thêm ô đất · giá" (giá = `nextPlotCost × priceIndex`, ẩn khi tối đa); ghi chú "Thu hoạch xong, nông sản vào thẳng **kho ở Sàn** (1 lô = n phần). Kho đầy thì phần dư bị bỏ…" + nút "📈 Xem kho ở Sàn" | `garden.js:142-168` |
| 🤝 Tưới hộ bạn bè | "Mỗi ô bạn tưới được thêm x% sản lượng; bạn nhận +n 🪙 và bé chính +m XP."; "💧 Tưới giúp còn a/b lần hôm nay"; chip mỗi bạn "🏡 tên"; khung "🏡 Vườn của X" + "Đóng", "Có n ô đang chờ bạn tưới."; không có bạn: nút "👥 Tìm bạn" → [[Màn Bạn bè]] | `garden.js:105-140` |
| 📖 Sổ tay nhà nông | mỗi giống: icon, tên, "⏱ n giờ · 📦 a–b phần → mặt hàng", giá hạt; "Sâu có thể xuất hiện giữa vụ: bắt kịp thì không mất gì, để nguyên thì mất x% sản lượng." | `garden.js:93-103`, `garden.js:170-174` |

## Hộp chọn giống

`openModal` "Gieo hạt ở ô n": mỗi giống ghi "n giờ · thu a–b phần (x–y lô)", "thành {mặt hàng}", giá hạt; giống thiếu xu bị khóa và ghi "thiếu xu". Bấm đóng hộp rồi `POST /garden/plant {plot, crop}` (`garden.js:178-201`).

> [!info] Ai nhân chỉ số giá
> Hai giá trên màn được nhân [[Chỉ số giá]] ở hai nơi khác nhau: giá hạt đã được máy chủ nhân sẵn trong `GET /garden` (`crops[].seed = indexedPrice(c.seed)`, `petdex/server/farm.js:69`) nên client hiển thị nguyên `c.seed` (`garden.js:101`, `garden.js:192`); còn `nextPlotCost` máy chủ trả giá gốc (`farm.js:68`) nên client tự nhân `priceIndex` (`garden.js:144`), khớp với lúc trừ tiền `indexedPrice(cost)` ở `farm.js:152`.

## API

| Hành động | API | Nguồn |
|---|---|---|
| Tải | `GET /garden` và `GET /friends` song song | `garden.js:250` |
| Mở vườn bạn | `GET /garden?owner=<id>` | `garden.js:206`, `garden.js:256` |
| Gieo | `POST /garden/plant {plot, crop}` | `garden.js:198` |
| Bắt sâu | `POST /garden/pests {plot}` | `garden.js:226` |
| Thu hoạch | `POST /garden/harvest {plot}` | `garden.js:227` |
| Mở ô | `confirm('Mở thêm ô đất thứ n với giá x xu?')` rồi `POST /garden/expand` | `garden.js:228-229` |
| Tưới hộ | `POST /garden/water {owner, plot}` | `garden.js:244-245` |

## Làm mới

Mỗi giây cập nhật đếm ngược và thanh. Tải lại toàn bộ khi có ô vừa chín (tối đa một lần mỗi 15 giây, chống lặp khi đồng hồ máy lệch) hoặc mỗi 60 giây để thấy sâu mới và lượt tưới của bạn; chỉ khi không mở hộp thoại và tab đang hiện (`garden.js:269-292`). Bạn đang xem (`friendId`) giữ qua các lần vẽ, tự bỏ nếu người đó không còn là bạn (`garden.js:252`).

## Liên quan
- [[Vườn]], [[Kho Sàn]], [[Bạn bè]], [[Mặt hàng nguyên liệu]]
- [[Màn Sàn]], [[Màn Bếp]], [[Màn Bạn bè]]
