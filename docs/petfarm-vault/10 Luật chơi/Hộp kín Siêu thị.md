---
tags: [petfarm, luat-choi, trang-phuc, sieu-thi]
aliases: [Hộp kín, Sealed box, Mở hộp, Mua hộp]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/routes.js, petdex/server/gear.js, public/ta-tua/game/js/shared/gear.js, public/ta-tua/game/js/app.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Hộp kín Siêu thị

> [!summary]
> Mua [[Trang phục]] ở [[Siêu thị]] không nhận ngay món có chỉ số mà nhận một **hộp kín**: cấp (Xanh lam 1 dòng hoặc Xanh lục 2 dòng) và các dòng đã được quay lúc mua nhưng bị giấu tới khi người chơi bấm "🎁 Mở hộp" trong Túi đồ. Hộp chưa mở không đeo và không bày bán được.

## Cách hoạt động
1. `POST /shop/buy {itemId}` với món loại `accessory`: chỉ mua **từng món một** ("Trang phục mua từng món một."), cần một bé đạt cấp yêu cầu, trừ `indexedPrice(giá)` xu (`petdex/server/routes.js:291-303`).
2. `createGear(..., { shop: true, luck })` quay bằng `rollShopGear` rồi lưu với `sealed = 1` (`petdex/server/gear.js:62-79`).
3. Lời báo: "Đã mua hộp <món> 🎁 Mở hộp trong Túi đồ để xem các dòng chỉ số." (`petdex/server/routes.js:301`).
4. Trong tủ đồ, hộp hiện "Hộp chưa mở · Mở hộp để xem 1–2 dòng chỉ số" (`public/ta-tua/game/js/app.js:663-664`); máy chủ giấu cấp và dòng (`describeGear`, `petdex/server/gear.js:95-115`).
5. `POST /gear/:id/open` lộ kết quả: "Mở hộp <món>: cấp <cấp> · <các dòng>" (`petdex/server/routes.js:269-277`, `openGear` ở `petdex/server/gear.js:145-151`); mở lại báo "Hộp này đã mở rồi."

## Công thức
```
May mắn quay hộp = %May mắn của Thú chính + gradeLuck(minLevel)
gradeLuck(minLevel) = floor(minLevel / 10) × 10
trọng số: Xanh lam = odds.blue (60), Xanh lục = odds.green (28) × (1 + May mắn/100); Vàng, Đỏ = 0
```
(`petdex/server/routes.js:297`, `public/ta-tua/game/js/shared/gear.js:48,143-150`.)

## Con số
| May mắn tổng | Tỉ lệ Xanh lục (2 dòng) |
|---|---|
| 0 | 31,8% |
| 10 (món cấp 10–19, không đồ May mắn) | 33,9% |
| 20 (món cấp 20–29) | 35,9% |
| 30 (món cấp 30–39) | 37,8% |
| 40 (món cấp 40) | 39,5% |
| 60 (trần đồ May mắn) | 42,7% |
| 100 (60 + món cấp 40) | 48,3% |

(Tính bằng `rollTier`.) Màn Siêu thị hiện tỉ lệ cơ bản "1 dòng 68,2% · 2 dòng 31,8%" (`tierOdds`, `public/ta-tua/game/js/app.js:796-801`).

## Trường hợp đặc biệt
- Kết quả đã chốt lúc mua: đổi [[Thú chính]] hay đeo đồ May mắn sau khi mua không làm hộp tốt hơn.
- Quản trị viên xem được bên trong hộp (`reveal`, `petdex/server/gear.js:90-95`).
- Nếu cấu hình đặt tỉ lệ Xanh lam và Xanh lục cùng bằng 0, hộp luôn ra Xanh lam (`public/ta-tua/game/js/shared/gear.js:148`).

## Liên quan
- [[Siêu thị]] · [[Trang phục]] · [[Cấp trang phục]] · [[Dòng chỉ số trang phục]] · [[Danh mục trang phục]]
