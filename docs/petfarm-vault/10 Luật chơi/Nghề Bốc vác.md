---
tags: [petfarm, luat-choi, viec-lam, nghe]
aliases: [Bốc vác, porter]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/careers.js, petdex/server/jobs.js, petdex/server/elements.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Nghề Bốc vác

> [!summary]
> 🏋️ **Bốc vác** (mã `porter`) là một trong 5 nghề ở [[Việc làm]]: "Khuân hàng ở bến cảng." Nghề dùng kỹ năng **Sức mạnh** để tính lương và thăng bậc; mỗi giờ làm cộng 0,6 điểm thô Sức mạnh.

## Con số
| Bậc | Lương gốc/giờ | Kỹ năng Sức mạnh cần để lên bậc này | Lương gốc ca 4 giờ ở mức kỹ năng đó | Ca 4 giờ nếu Sức mạnh = 100 |
|---|---|---|---|---|
| 1 Học việc | 16 | 15 (ví dụ) | 56 | 83 |
| 2 Nhân viên | 22 | 20 | 79 | 114 |
| 3 Lành nghề | 30 | 40 | 120 | 156 |
| 4 Chuyên gia | 40 | 60 | 176 | 208 |
| 5 Bậc thầy | 55 | 80 | 264 | 286 |

Lương gốc = `round(pay[bậc] × (0,8 + kỹ năng/200) × giờ)` (`petdex/server/rules/careers.js:44-47`), trước các hệ số Hội, tính cách, ngũ hành, trang phục, tuổi ([[Việc làm]]). Lên bậc còn cần đủ 16 / 60 / 150 / 300 giờ làm ở nghề này (`petdex/server/rules/careers.js:26-31`). Nguồn dữ liệu nghề: `petdex/server/rules/careers.js:15`.

## Chọn bé
- Hành có hệ số Sức mạnh cao: Hỏa (Sức mạnh ×1,3), Kim, Thổ (×1,15) ([[Ngũ hành]]).
- Loài khởi đầu giỏi Sức mạnh: Kỳ Nhông Lửa, Chuột Chũi, Nghé Đất (15) trong loài Thường; Bạch Hổ (23), Rồng Lửa Nhí (19) ([[Danh mục loài]]).
- Lớp học tương ứng ở [[Trường học]] giúp đạt ngưỡng kỹ năng nhanh hơn.

## Trường hợp đặc biệt
- Giờ đã làm và bậc lưu riêng từng nghề của từng bé (bảng `careers`, khóa `pet_id, career`, `petdex/server/jobs.js:20-24`); đổi nghề không mất bậc nghề cũ.
- Thâm niên (Trưởng thành, Lão làng) tính theo giờ đã làm **ở nghề này**: +1% mỗi 10 giờ, tối đa +30%.
- **Bé Hỏa được +5% lương** ở nghề này (`ELEMENT_RULES.perks.hoa.strengthPay`, áp khi `careerSkill === 'strength'`, `petdex/server/elements.js:34`). Đây là nghề duy nhất dùng Sức mạnh nên là nghề duy nhất hưởng lợi thế Hỏa.

## Liên quan
- [[Việc làm]] · [[Kỹ năng]] · [[Trường học]] · [[Giai đoạn tuổi]] · [[Module rules-careers]]
