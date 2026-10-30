---
tags: [petfarm, luat-choi, tinh-cach]
aliases: [Traits, Nét tính cách]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/production.js, petdex/server/game.js, petdex/server/eggs.js, petdex/server/care.js, petdex/server/business.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Tính cách

> [!summary]
> Mỗi bé khi nhận nuôi hoặc nở ra được bốc 1 hoặc 2 nét tính cách (50/50), cố định suốt đời. Sáu nét chỉnh nhẹ tốc độ đói, lương, niềm vui khi chơi, năng lượng, khách ở quầy và tốc độ học. Tính cách hiện thành chip ở màn Nhà, di chuột xem mô tả.

## Con số
| Nét | Mã | Mô tả trong game | Áp dụng thật trong code | Nguồn |
|---|---|---|---|---|
| 🍙 [[Tính cách Tham ăn\|Tham ăn]] | `glutton` | No bụng giảm nhanh 20%, đồ ăn cho thêm 30% XP. | No bụng tụt ×1,2; XP **đồ ăn** (không phải đồ chăm sóc) ×1,3 | `petdex/server/rules/production.js:31`, `petdex/server/game.js:164,264` |
| 💼 [[Tính cách Chăm chỉ\|Chăm chỉ]] | `diligent` | +10% lương ca làm. | `payFactor` +0,1 (5 nghề) | `petdex/server/rules/production.js:32,49` |
| 🎈 [[Tính cách Ham chơi\|Ham chơi]] | `playful` | Chơi đùa được thêm 50% vui vẻ. | Vui khi chơi đùa ×1,5 | `petdex/server/rules/production.js:33`, `petdex/server/game.js:274` |
| 😴 [[Tính cách Ngủ nướng\|Ngủ nướng]] | `sleepy` | Năng lượng hồi nhanh hơn 20%, lương −5%. | hồi NL ×1,2; `payFactor` −0,05 | `petdex/server/rules/production.js:34,49`, `petdex/server/game.js:174` |
| ✨ [[Tính cách Có duyên\|Có duyên]] | `charming` | +5 Duyên dáng ban đầu, khách ở quầy +10% khi bé trực. | +5 Duyên dáng lúc tạo bé; quầy +10% khách | `petdex/server/rules/production.js:35`, `petdex/server/eggs.js:25`, `petdex/server/business.js:108` |
| 📚 [[Tính cách Mọt sách\|Mọt sách]] | `bookworm` | Học ở trường được thêm 25% điểm kỹ năng. | điểm học thô ×1,25 | `petdex/server/rules/production.js:36`, `petdex/server/care.js:135` |

## Công thức bốc
```
nét 1 = đều trong 6 nét
50%: chỉ 1 nét;  50%: thêm nét 2 = đều trong 5 nét còn lại
```
(`rollTraits`, `petdex/server/rules/production.js:40-46`.) Xác suất có một nét cụ thể = 1/6 + 1/2 × 5/6 × 1/5 = 25%.

Hệ số lương do tính cách: `payFactor = 1 + 0,1·Chăm chỉ − 0,05·Ngủ nướng` (`petdex/server/rules/production.js:49`), nhân vào lương ca nghề ([[Việc làm]]). Bé vừa Chăm chỉ vừa Ngủ nướng: ×1,05.

## Trường hợp đặc biệt
- Tính cách không đổi được và không thừa kế qua kỷ vật; được lưu lên bia Đồi Sao (`petdex/server/lifecycle.js:77-78`).
- Chăm chỉ/Ngủ nướng không áp cho ca trực quầy, đứng máy (lương do chủ đặt).

## Liên quan
- [[Tính cách Tham ăn]] · [[Tính cách Chăm chỉ]] · [[Tính cách Ham chơi]] · [[Tính cách Ngủ nướng]] · [[Tính cách Có duyên]] · [[Tính cách Mọt sách]]
- [[Chỉ số của bé]] · [[Việc làm]] · [[Trường học]] · [[Quầy trà sữa]]
