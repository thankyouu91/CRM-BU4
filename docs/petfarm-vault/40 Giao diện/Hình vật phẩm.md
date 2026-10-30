---
tags: [petfarm, giao-dien, render, vat-pham]
loai: ma-nguon
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/itemart.js, public/ta-tua/game/js/rig.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Hình vật phẩm

> [!summary]
> `itemart.js` vẽ biểu tượng pixel cho đồ trong [[Màn Siêu thị]], [[Màn Túi đồ]], hộp thoại chọn đồ ở [[Màn Nhà]] và bảng trứng ở [[Màn Nhận nuôi]]. Đồ ăn, đồ chăm sóc, đồ chơi và trứng là bản đồ ký tự riêng; đồ đeo dùng chính hình vẽ lên người thú (`wearImage` của `rig.js`), nên hình trong túi và hình trên người khớp nhau. Món chưa có hình thì quay về emoji.

## Danh sách hình

| Nhóm | id có hình | Nguồn |
|---|---|---|
| Đồ ăn | `boba`, `fish`, `onigiri`, `sushi`, `cake`, `juice` | `public/ta-tua/game/js/itemart.js:7-29` |
| Chăm sóc | `bath`, `vitamin` | `itemart.js:30-37` |
| Đồ chơi | `ball`, `yarn`, `kite` | `itemart.js:38-48` |
| Trứng ngũ hành | `egg_kim`, `egg_moc`, `egg_thuy`, `egg_hoa`, `egg_tho`: cùng dáng trứng 9×10, vỏ theo `EGG_SHELL`, đốm theo màu hành `ELEMENTS[el].color` | `itemart.js:51-54` |
| Đồ đeo | mọi id khác: `wearImage(id)` từ [[Bộ khung thú]] | `itemart.js:63` |

Mọi hình dùng viền `OUTLINE` `#2e1d14` (`bitmap(rows, palette, OUTLINE)`), xem [[Vẽ pixel]].

## API

| Hàm | Trả về | Nguồn |
|---|---|---|
| `itemArt(id)` | `{url, w, h}` ở độ phân giải gốc (lưu đệm), hoặc `null` | `itemart.js:58-67` |
| `itemIcon(item, px = 4)` | chuỗi `<img class="px-icon" width=w×px height=h×px>`, hoặc `item.icon` (emoji) nếu không có hình | `itemart.js:70-74` |

Hộp thoại chọn dùng `px = 3`, bảng trứng dùng `px = 4`, thẻ cửa hàng dùng mặc định (`public/ta-tua/game/js/app.js:585`, `app.js:707`, `app.js:840`).

> [!info] Chỗ chưa dùng pixel
> Hộp thoại tặng quà ở [[Màn Bạn bè]], thẻ Chợ Phiên và một số danh sách vẫn in emoji `item.icon` trực tiếp, không qua `itemIcon` (`public/ta-tua/game/js/views/community.js:103`, `views/bazaar.js:61`).

## Liên quan
- [[Vẽ pixel]], [[Bộ khung thú]], [[Siêu thị]], [[Trang phục]], [[Trứng ngũ hành]]
