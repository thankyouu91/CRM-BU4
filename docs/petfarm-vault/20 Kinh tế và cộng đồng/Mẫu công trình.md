---
tags: [petfarm, kinh-te, clan, cong-trinh, mau]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Bộ mẫu lắp ghép, 200 mẫu, Pieces]
---
# Mẫu công trình

> [!summary]
> Bộ 200 mảnh lắp ghép (20 họ × 10 biến thể I–X) để [[Clan|gia tộc]] dựng công trình trên lô đất trong [[Trình lắp ghép công trình]]. Mỗi mảnh có kích thước tính bằng ô (khung 24 × 20 ô, mỗi ô 10 đơn vị SVG) và giá `round(150 + 40 × rộng × cao, 10)` xu, trả bằng quỹ gia tộc. Mảnh vẽ bằng SVG thủ tục, màu tùy chọn.

## Luật chung (`DESIGN`, `PIECES`, `public/ta-tua/game/js/shared/clan.js:192,473-476`)
| Thông số | Giá trị |
|---|---|
| Khung lắp ghép | 24 cột × 20 hàng ô |
| Số mảnh tối đa mỗi công trình | 20 |
| Tối thiểu để vận hành | 3 mảnh, trong đó có ít nhất 1 **Móng nền** (`designComplete`, dòng 531) |
| Thưởng sản lượng | +0,5% mỗi mảnh, tối đa +10% (20 mảnh), chỉ khi hoàn chỉnh (`designBonus`, dòng 534) |
| Giá mảnh | `round(150 + 40 × w × h, 10)`: rẻ nhất 190 (1×1), đắt nhất 2.550 (Mái dốc 12×5) |
| Bảng màu nhanh | 16 màu (`PALETTE`, dòng 193) hoặc màu tự chọn `#rrggbb` |
| Mã mảnh | `<họ>-<1..10>`, ví dụ `tower-3` |

## 20 họ mảnh (`FAMILIES`, `public/ta-tua/game/js/shared/clan.js:214-464`)

| Họ | Mã | Kích thước 10 biến thể (rộng×cao) | Giá (xu) |
|---|---|---|---|
| 🧱 Móng nền | `base` | 4×1, 6×1, 8×1, 10×1, 12×1, 4×2, 6×2, 8×2, 10×2, 12×2 | 310–1.110 |
| 🧱 Tường gạch | `wall_brick` | 2×2, 3×3, 4×3, 4×4, 5×4, 6×4, 6×5, 8×4, 8×6, 3×6 | 310–2.070 |
| 🪟 Tường kính | `wall_glass` | như tường gạch | 310–2.070 |
| 🔲 Cửa sổ vuông | `window_sq` | 1×1, 2×2, 2×1, 1×2, 3×2, 2×3, 3×3, 2×2, 3×2, 4×3 | 190–630 |
| 🪟 Cửa sổ vòm | `window_arch` | 1×2, 2×2, 2×3, 3×3, 1×3, 2×4, 3×4, 4×4, 4×5, 2×2 | 230–950 |
| 🚪 Cửa ra vào | `door` | 1×2, 2×2, 2×3, 3×3, 2×2, 3×2, 4×3, 2×4, 3×4, 4×4 | 230–790 |
| 🔺 Mái dốc | `roof_gable` | 4×2, 5×2, 6×3, 7×3, 8×4, 9×4, 10×5, 12×5, 6×5, 8×6 | 470–2.550 |
| ▬ Mái bằng & sân thượng | `roof_flat` | như móng nền | 310–1.110 |
| 🕌 Mái vòm | `dome` | 2×1, 3×2, 4×2, 5×3, 6×3, 7×4, 8×4, 3×3, 4×4, 6×5 (VIII–X: mái củ hành) | 230–1.430 |
| 🗼 Tháp | `tower` | 2×6, 2×8, 3×6, 3×8, 3×10, 4×8, 4×10, 2×10, 3×12, 4×12 | 630–2.070 |
| 🏭 Ống khói | `chimney` | 1×2, 1×3, 1×4, 2×3, 2×4, 2×5, 1×5, 2×6, 3×6, 3×8 | 230–1.110 |
| 🌉 Ban công | `balcony` | 2×1, 3×1, 4×1, 5×1, 6×1, 2×2, 3×2, 4×2, 5×2, 6×2 | 230–630 |
| 🏛️ Cột | `column` | 1×3, 1×4, 1×5, 1×6, 2×4, 2×6, 1×8, 2×8, 2×10, 3×10 | 270–1.350 |
| 🪧 Biển hiệu | `sign` | 3×1, 4×1, 5×1, 6×1, 8×1, 3×2, 4×2, 5×2, 6×2, 8×2 | 270–790 |
| ⛱️ Mái hiên sọc | `awning` | 2×1, 3×1, 4×1, 5×1, 6×1, 8×1, 3×2, 4×2, 6×2, 8×2 | 230–790 |
| 🌳 Cây xanh | `tree` | 1×2, 2×2, 2×3, 3×3, 3×4, 2×4, 3×5, 4×5, 4×6, 5×7 | 230–1.550 |
| 🏮 Đèn | `lamp` | 1×2, 1×3, 1×4, 2×2, 2×3, 2×4, 1×5, 2×5, 3×3, 3×4 | 230–630 |
| 🛢️ Bồn chứa & silo | `silo` | 2×3, 2×4, 3×4, 3×5, 4×5, 4×6, 2×6, 3×7, 5×6, 6×6 | 390–1.590 |
| 🚩 Cột cờ & ăng-ten | `mast` | 1×3, 1×4, 2×3, 2×4, 2×5, 3×4, 3×5, 1×6, 3×6, 4×6 | 270–1.110 |
| ⭐ Trang trí | `ornament` | 1×1, 2×2, 3×3, 1×1, 2×2, 3×3, 2×2, 3×3, 2×2, 4×4 | 190–790 |

> [!tip] Công trình rẻ nhất vận hành được
> Móng nền I (310) + 2 mảnh 1×1 (190 + 190) = 690 xu, thưởng +1,5%. Thêm mảnh rẻ tới 20 mảnh tốn thêm khoảng 3.230 xu cho +10% sản lượng.

## Liên quan
- [[Trình lắp ghép công trình]] · [[Clan]] · [[Bản đồ đất]] · [[Màn Clan]] · [[MOC Kinh tế và cộng đồng]]
