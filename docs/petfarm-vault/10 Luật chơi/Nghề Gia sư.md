---
tags: [petfarm, luat-choi, viec-lam, nghe]
aliases: [Gia sư, tutor]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/careers.js, petdex/server/jobs.js, petdex/server/elements.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Nghề Gia sư

> [!summary]
> 📚 **Gia sư** (mã `tutor`) là một trong 5 nghề ở [[Việc làm]]: "Dạy kèm cho các bé nhỏ hơn." Nghề dùng kỹ năng **Thông minh** để tính lương và thăng bậc; mỗi giờ làm cộng 0,6 điểm thô Thông minh.

## Con số
| Bậc | Lương gốc/giờ | Kỹ năng Thông minh cần để lên bậc này | Lương gốc ca 4 giờ ở mức kỹ năng đó | Ca 4 giờ nếu Thông minh = 100 |
|---|---|---|---|---|
| 1 Học việc | 13 | 15 (ví dụ) | 46 | 68 |
| 2 Nhân viên | 20 | 20 | 72 | 104 |
| 3 Lành nghề | 30 | 40 | 120 | 156 |
| 4 Chuyên gia | 42 | 60 | 185 | 218 |
| 5 Bậc thầy | 58 | 80 | 278 | 302 |

Lương gốc = `round(pay[bậc] × (0,8 + kỹ năng/200) × giờ)` (`petdex/server/rules/careers.js:44-47`), trước các hệ số Hội, tính cách, ngũ hành, trang phục, tuổi ([[Việc làm]]). Lên bậc còn cần đủ 16 / 60 / 150 / 300 giờ làm ở nghề này (`petdex/server/rules/careers.js:26-31`). Nguồn dữ liệu nghề: `petdex/server/rules/careers.js:16`.

## Chọn bé
- Hành có hệ số Thông minh cao: Mộc (Thông minh ×1,3) ([[Ngũ hành]]).
- Loài khởi đầu giỏi Thông minh: Nhím Rêu (15), Mèo Mưa (14) trong loài Thường; Thanh Long (25), Hoàng Long (23) ([[Danh mục loài]]).
- Lớp học tương ứng ở [[Trường học]] giúp đạt ngưỡng kỹ năng nhanh hơn.

## Trường hợp đặc biệt
- Giờ đã làm và bậc lưu riêng từng nghề của từng bé (bảng `careers`, khóa `pet_id, career`, `petdex/server/jobs.js:20-24`); đổi nghề không mất bậc nghề cũ.
- Thâm niên (Trưởng thành, Lão làng) tính theo giờ đã làm **ở nghề này**: +1% mỗi 10 giờ, tối đa +30%.
- Lương bậc 1 thấp nhất nhóm (13) nhưng bậc 5 cao nhất (58): nghề "đầu tư dài hạn".

## Liên quan
- [[Việc làm]] · [[Kỹ năng]] · [[Trường học]] · [[Giai đoạn tuổi]] · [[Module rules-careers]]
