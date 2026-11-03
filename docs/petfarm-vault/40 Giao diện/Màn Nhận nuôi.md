---
tags: [petfarm, giao-dien, man-hinh, nhan-nuoi, trung]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/app.js, public/ta-tua/game/js/shared/pets.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Nhận nuôi

> [!summary]
> Màn chọn loài và đặt tên để nhận một bé sơ sinh, kèm bảng [[Trứng ngũ hành]] để ấp và cho nở. Nó không có hash riêng: [[Màn Nhà]] tự vẽ màn này khi người chơi chưa có bé nào hoặc khi `state.adopting = true` (bấm "➕ Nhận nuôi thêm" hay nút trứng). Mã ở `renderAdopt` và `eggPanel` trong `app.js`.

## Khi nào hiện

| Trường hợp | Tiêu đề | Phụ đề | Nguồn |
|---|---|---|---|
| Lần đầu (chưa có bé) | "Chào mừng tới Petdex Park!" | "Chọn một bé để bắt đầu. Bé đầu tiên miễn phí 💝" | `public/ta-tua/game/js/app.js:755-756` |
| Nuôi thêm | "Nhận nuôi thêm một bé" + nút "← Quay lại" (`data-act="cancel-adopt"`) | "Phí nhận nuôi {rules.adoptCost} 🪙 · mỗi người tối đa {rules.maxPets} bé" | `app.js:756-758` |
| Hết ô | hộp `life-warn` "Đã hết ô nuôi (tối đa n, tính cả trứng đang ấp [và ô tưởng niệm])" + nút mở lại ô tưởng niệm | | `app.js:761-762` |
| Máy chủ chưa có loài nào | "Công viên chưa có loài thú nào", hướng dẫn `npx petdex@latest install boba` và `npm run import-pets` (thông điệp cho nhà phát triển) | | `app.js:741-748` |

Phí và số ô do máy chủ trả trong `catalog.rules` (giá trị hiện tại: xem [[Loài và độ hiếm]] và [[Tài khoản người chơi]]). `go()` sang màn khác luôn đặt lại `state.adopting = false` (`app.js:201-206`).

## Bộ lọc hành và lưới loài

- Hàng nút "🐾 Tất cả" + 5 hành (`data-adopt-el`), lưu ở `state.adoptElement` (`app.js:763-766`, `app.js:1207-1210`).
- Dòng giải thích: chọn một hành thì in `temper. perk.` của hành đó; lần đầu nhắc "Loài hiếm chỉ nở từ trứng ngũ hành, mua ở Siêu thị khi bé lên cấp 3" (`app.js:767-768`).
- Chỉ loài `adoptable` mới có thẻ (`app.js:735`). Mỗi thẻ `species-card` có màu viền `--el` theo hành, chip hành, nhãn "🧋 Linh vật" hoặc "Khách mời Petdex", mô tả. Bấm thẻ chỉ đổi lớp `selected` tại chỗ, không vẽ lại (`app.js:1217-1221`).
- Hình mỗi loài là `createPetFigure(s, s.rig ? 0.8 : 0.62, {}, { stage: 'baby', ageScale: 1 })`, tức luôn vẽ dáng sơ sinh vì nhận nuôi là nhận bé mới sinh (`app.js:784-790`). Xem [[Sprite và bảng hình]].
- Form `#adopt-form`: ô tên (tối đa 16 ký tự, placeholder lấy tên loài), nút "Nhận nuôi 🏡" hoặc "Nhận nuôi · {adoptCost} 🪙". Gửi `POST /pets {name, species}`; xong thì chọn bé mới nhất làm `state.petId` và quay về Nhà với hiệu ứng vẫy tay + tim (`app.js:1242-1251`).

## Bảng trứng ngũ hành (chỉ khi nuôi thêm)

| Thẻ | Nội dung | API |
|---|---|---|
| Trứng trong túi | ảnh trứng `itemIcon(i,4)`, "trong túi · ×qty", nút "Ấp trứng" (khóa khi đủ ô: `pets + eggs >= maxPets`) | `POST /eggs/incubate {itemId}` |
| Trứng đang ấp | "nở sau {countdown}" | |
| Trứng đã nở được (`e.ready`) | form ô "Tên bé" + "🐣 Cho nở" | `POST /eggs/:id/hatch {name}` |
| Không có trứng | "Chưa có quả trứng nào." + nút "Mua trứng" (Siêu thị lọc `egg`) | |

Câu giải thích lấy số từ `EGG` và `EGG_ODDS` trong mã dùng chung: cần bé cấp `EGG.minLevel` = 3, ấp `EGG.hours` = 24 giờ, tỷ lệ 75% Thường, 20% Hiếm, 4% Quý, 1% Huyền thoại (`public/ta-tua/game/js/shared/pets.js:335-336`, `app.js:700-731`). Luật đầy đủ: [[Trứng ngũ hành]], [[Loài và độ hiếm]].

## Liên quan
- [[Màn Nhà]], [[Màn Siêu thị]], [[App shell]]
- [[Loài và độ hiếm]], [[Linh vật Boba]], [[Ngũ hành]], [[Trứng ngũ hành]], [[Vòng đời và Đồi Sao]]
- [[API người chơi]]
