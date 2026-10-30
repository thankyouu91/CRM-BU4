---
tags: [petfarm, luat-choi, viec-lam, nghe]
aliases: [Giao hàng, courier]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/careers.js, petdex/server/jobs.js, petdex/server/elements.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Nghề Giao hàng

> [!summary]
> 📦 **Giao hàng** (mã `courier`) là một trong 5 nghề ở [[Việc làm]]: "Chạy khắp phố giao bưu kiện." Nghề dùng kỹ năng **Nhanh nhẹn** để tính lương và thăng bậc; mỗi giờ làm cộng 0,6 điểm thô Nhanh nhẹn.

## Con số
| Bậc | Lương gốc/giờ | Kỹ năng Nhanh nhẹn cần để lên bậc này | Lương gốc ca 4 giờ ở mức kỹ năng đó | Ca 4 giờ nếu Nhanh nhẹn = 100 |
|---|---|---|---|---|
| 1 Học việc | 15 | 15 (ví dụ) | 53 | 78 |
| 2 Nhân viên | 21 | 20 | 76 | 109 |
| 3 Lành nghề | 29 | 40 | 116 | 151 |
| 4 Chuyên gia | 39 | 60 | 172 | 203 |
| 5 Bậc thầy | 54 | 80 | 259 | 281 |

Lương gốc = `round(pay[bậc] × (0,8 + kỹ năng/200) × giờ)` (`petdex/server/rules/careers.js:44-47`), trước các hệ số Hội, tính cách, ngũ hành, trang phục, tuổi ([[Việc làm]]). Lên bậc còn cần đủ 16 / 60 / 150 / 300 giờ làm ở nghề này (`petdex/server/rules/careers.js:26-31`). Nguồn dữ liệu nghề: `petdex/server/rules/careers.js:14`.

## Chọn bé
- Hành có hệ số Nhanh nhẹn cao: Thủy (Nhanh nhẹn ×1,15), Hỏa (×1,1) ([[Ngũ hành]]).
- Loài khởi đầu giỏi Nhanh nhẹn: Rái Cá (16), Chó Vàng (14) trong loài Thường; Ngựa Lửa (21), Vịt Mây (18) hiếm hơn ([[Danh mục loài]]).
- Lớp học tương ứng ở [[Trường học]] giúp đạt ngưỡng kỹ năng nhanh hơn.

## Trường hợp đặc biệt
- Giờ đã làm và bậc lưu riêng từng nghề của từng bé (bảng `careers`, khóa `pet_id, career`, `petdex/server/jobs.js:20-24`); đổi nghề không mất bậc nghề cũ.
- Thâm niên (Trưởng thành, Lão làng) tính theo giờ đã làm **ở nghề này**: +1% mỗi 10 giờ, tối đa +30%.

## Liên quan
- [[Việc làm]] · [[Kỹ năng]] · [[Trường học]] · [[Giai đoạn tuổi]] · [[Module rules-careers]]
