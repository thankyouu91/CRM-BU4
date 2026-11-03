---
tags: [petfarm, giao-dien, man-hinh, sieu-thi]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/app.js, public/ta-tua/game/js/shared/gear.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Siêu thị

> [!summary]
> Cửa hàng NPC (`#shop`, tòa 🏪 trên bản đồ) bán đồ ăn, đồ chăm sóc, đồ chơi, phụ kiện (hộp kín) và trứng. Giá hiển thị đã nhân chỉ số giá của [[Ngân hàng Trung ương]]. Mã ở `renderShop` trong `app.js`; luật và bảng giá ở [[Siêu thị]] và [[Đồ ăn và đồ chăm sóc]].

## Bố cục

- `viewHead('🏪 Siêu thị', …)` với nút "← Về phố". Phụ đề giải thích: đồ ăn/chăm sóc dùng là hết, đồ chơi mua một lần dùng mãi, phụ kiện là hộp kín 1–2 dòng +% ngẫu nhiên kèm tỷ lệ thật (`tierOdds()`, ví dụ "1 dòng 68% · 2 dòng 32%"), "May mắn của bé chính giúp ra 2 dòng", và câu chỉ số giá nếu lệch khỏi 1 quá 0,1%: "Giá đang cao/thấp hơn gốc n% theo chỉ số giá của Ngân hàng Trung ương" (`public/ta-tua/game/js/app.js:796-800`, `app.js:823-828`).
- Hàng lọc: Tất cả, Đồ ăn, Chăm sóc, Đồ chơi, Phụ kiện, Trứng (`TYPE_ORDER`, `app.js:76`, `app.js:829-832`). Bộ lọc nhớ ở `state.shopFilter`; các màn khác mở thẳng bộ lọc bằng `go('shop', type)` hoặc `data-filter`.
- Lưới thẻ `item-card`, sắp theo loại rồi giá gốc (`app.js:806-808`).

## Thẻ món hàng

| Phần | Nội dung | Nguồn |
|---|---|---|
| Huy hiệu "Có n" | món tiêu hao đang có | `app.js:839` |
| Ảnh | `itemIcon(item)` (pixel art, xem [[Hình vật phẩm]]) | `app.js:840` |
| Nhãn loại | "Loại · Khe · Hành" | `app.js:841` |
| Hiệu quả | `effectText(item)`: "🍙 +n ❤️ +n ⭐ +n XP", "Khi chơi: 💖 +n ⭐ +n XP", "Ấp 24 giờ thì nở", hoặc vị trí đeo | `public/ta-tua/game/js/ui.js:11-20` |
| "Đang có n món" | với phụ kiện đã có bản trang phục | `app.js:845` |
| Giá | `priceOf(item) = max(1, round(price × economy.priceIndex))` | `app.js:119` |

### Vùng nút mua (`buyArea`)

| Trường hợp | Hiển thị | API |
|---|---|---|
| `item.minLevel` > cấp bé cao nhất | "🔒 Cần Lv n" (thẻ có lớp `locked`) | |
| Phụ kiện | "🎁 Mua hộp" (khóa nếu thiếu xu) | `POST /shop/buy {itemId, qty: 1}` |
| Đồ chơi/trứng đã có | "✓ Đã có" | |
| Đồ tiêu hao | "×5" (khóa nếu thiếu 5 lần giá) + "Mua" | `POST /shop/buy {itemId, qty}` |
| Khác | "Mua" | `POST /shop/buy` |

Nguồn: `app.js:810-821`, `app.js:1215`.

> [!info] Cấp khóa dựa trên bé cao nhất
> `bestLevel()` là cấp lớn nhất trong các bé của người chơi (`app.js:116`), cùng quy tắc với `requireLevel` ở máy chủ. Xem [[Mở khóa theo cấp]].

> [!warning] Lệch tài liệu
> Nút "✓ Đã có" áp cho mọi món không tiêu hao (đồ chơi **và trứng**), nên khi đang giữ một quả trứng trong túi thì không thấy nút mua trứng cùng hành nữa (`app.js:816`). Có thể là chủ ý (một quả mỗi hành) nhưng cần đối chiếu với luật ở [[Trứng ngũ hành]].

## Tỷ lệ hộp trang phục

`tierOdds()` đọc `catalog.gear.odds` và chỉ tính các cấp trong `SHOP_TIERS = ['blue','green']` (`public/ta-tua/game/js/shared/gear.js:143`); Xanh lam 1 dòng, Xanh lục 2 dòng (`gear.js:7-10`). Hộp mua về hiện là "Hộp chưa mở" ở [[Màn Túi đồ]] và hộp thoại Trang phục ở [[Màn Nhà]].

## Liên quan
- [[Siêu thị]], [[Đồ ăn và đồ chăm sóc]], [[Trang phục]], [[Cấp trang phục]], [[Trứng ngũ hành]], [[Chỉ số giá]]
- [[Màn Túi đồ]], [[Màn Nhà]], [[Hình vật phẩm]], [[App shell]]
