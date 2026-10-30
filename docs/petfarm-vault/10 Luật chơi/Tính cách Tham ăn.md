---
tags: [petfarm, luat-choi, tinh-cach]
aliases: [Tham ăn]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/production.js, petdex/server/game.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Tính cách Tham ăn

> [!summary]
> 🍙 **Tham ăn** (mã `glutton`): No bụng giảm nhanh 20%, đồ ăn cho thêm 30% XP. Mỗi bé có 25% cơ hội mang nét này ([[Tính cách]]).

## Áp dụng
| Hiệu ứng | Giá trị | Nguồn |
|---|---|---|
| Tốc độ tụt No bụng | ×1,2 (nhân thêm vào hệ số loài và tuổi) | `petdex/server/game.js:164` |
| XP khi ăn **đồ ăn** | ×1,3 (đồ chăm sóc không được) | `petdex/server/game.js:264` |

Ví dụ: Heo Than (hệ số No 1,32) Tham ăn ở tuổi Thanh niên (×1,3) tụt 8 × 1,32 × 1,2 × 1,3 ≈ 16,5 No bụng/giờ khi rảnh.

## Liên quan
- [[Tính cách]] · [[Chỉ số của bé]] · [[Đồ ăn và đồ chăm sóc]]
