---
tags: [petfarm, luat-choi, viec-lam, nghe]
aliases: [Pha chế, barista]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/careers.js, petdex/server/jobs.js, petdex/server/elements.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Nghề Pha chế

> [!summary]
> 🧋 **Pha chế** (mã `barista`) là một trong 5 nghề ở [[Việc làm]]: "Pha trà sữa ở quán đầu phố." Nghề dùng kỹ năng **Khéo tay** để tính lương và thăng bậc; mỗi giờ làm cộng 0,6 điểm thô Khéo tay.

## Con số
| Bậc | Lương gốc/giờ | Kỹ năng Khéo tay cần để lên bậc này | Lương gốc ca 4 giờ ở mức kỹ năng đó | Ca 4 giờ nếu Khéo tay = 100 |
|---|---|---|---|---|
| 1 Học việc | 14 | 15 (ví dụ) | 49 | 73 |
| 2 Nhân viên | 20 | 20 | 72 | 104 |
| 3 Lành nghề | 28 | 40 | 112 | 146 |
| 4 Chuyên gia | 38 | 60 | 167 | 198 |
| 5 Bậc thầy | 52 | 80 | 250 | 270 |

Lương gốc = `round(pay[bậc] × (0,8 + kỹ năng/200) × giờ)` (`petdex/server/rules/careers.js:44-47`), trước các hệ số Hội, tính cách, ngũ hành, trang phục, tuổi ([[Việc làm]]). Lên bậc còn cần đủ 16 / 60 / 150 / 300 giờ làm ở nghề này (`petdex/server/rules/careers.js:26-31`). Nguồn dữ liệu nghề: `petdex/server/rules/careers.js:13`.

## Chọn bé
- Hành có hệ số Khéo tay cao: Kim (Khéo tay ×1,3), Thổ (×1,15) ([[Ngũ hành]]).
- Loài khởi đầu giỏi Khéo tay: Mèo Bạc (16), Sóc Đồng, Heo Đất (15) trong loài Thường; Sóc Nấm (17) Hiếm ([[Danh mục loài]]).
- Lớp học tương ứng ở [[Trường học]] giúp đạt ngưỡng kỹ năng nhanh hơn.

## Trường hợp đặc biệt
- Giờ đã làm và bậc lưu riêng từng nghề của từng bé (bảng `careers`, khóa `pet_id, career`, `petdex/server/jobs.js:20-24`); đổi nghề không mất bậc nghề cũ.
- Thâm niên (Trưởng thành, Lão làng) tính theo giờ đã làm **ở nghề này**: +1% mỗi 10 giờ, tối đa +30%.

## Liên quan
- [[Việc làm]] · [[Kỹ năng]] · [[Trường học]] · [[Giai đoạn tuổi]] · [[Module rules-careers]]
