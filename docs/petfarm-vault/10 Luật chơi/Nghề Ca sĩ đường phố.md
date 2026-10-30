---
tags: [petfarm, luat-choi, viec-lam, nghe]
aliases: [Ca sĩ đường phố, singer]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/careers.js, petdex/server/jobs.js, petdex/server/elements.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Nghề Ca sĩ đường phố

> [!summary]
> 🎤 **Ca sĩ đường phố** (mã `singer`) là một trong 5 nghề ở [[Việc làm]]: "Hát rong, khách vui thì boa thêm." Nghề dùng kỹ năng **Duyên dáng** để tính lương và thăng bậc; mỗi giờ làm cộng 0,6 điểm thô Duyên dáng.

## Con số
| Bậc | Lương gốc/giờ | Kỹ năng Duyên dáng cần để lên bậc này | Lương gốc ca 4 giờ ở mức kỹ năng đó | Ca 4 giờ nếu Duyên dáng = 100 |
|---|---|---|---|---|
| 1 Học việc | 10 | 15 (ví dụ) | 35 | 52 |
| 2 Nhân viên | 16 | 20 | 58 | 83 |
| 3 Lành nghề | 24 | 40 | 96 | 125 |
| 4 Chuyên gia | 36 | 60 | 158 | 187 |
| 5 Bậc thầy | 50 | 80 | 240 | 260 |

Lương gốc = `round(pay[bậc] × (0,8 + kỹ năng/200) × giờ)` (`petdex/server/rules/careers.js:44-47`), trước các hệ số Hội, tính cách, ngũ hành, trang phục, tuổi ([[Việc làm]]). Lên bậc còn cần đủ 16 / 60 / 150 / 300 giờ làm ở nghề này (`petdex/server/rules/careers.js:26-31`). Nguồn dữ liệu nghề: `petdex/server/rules/careers.js:17`.

## Chọn bé
- Hành có hệ số Duyên dáng cao: Thủy (Duyên dáng ×1,3), Mộc (×1,1) ([[Ngũ hành]]).
- Loài khởi đầu giỏi Duyên dáng: Hải Cẩu (15), Ếch Sen, Cún Cỏ, Cá Nóc, Gấu Mèo Đỏ (14) trong loài Thường; Cá Chép Rồng (23), Chu Tước (22) ([[Danh mục loài]]).
- Lớp học tương ứng ở [[Trường học]] giúp đạt ngưỡng kỹ năng nhanh hơn.

## Trường hợp đặc biệt
- Giờ đã làm và bậc lưu riêng từng nghề của từng bé (bảng `careers`, khóa `pet_id, career`, `petdex/server/jobs.js:20-24`); đổi nghề không mất bậc nghề cũ.
- Thâm niên (Trưởng thành, Lão làng) tính theo giờ đã làm **ở nghề này**: +1% mỗi 10 giờ, tối đa +30%.
- **Tiền boa**: lúc nhận lương cộng thêm `round(lương × 0,6 × rand)` xu, đều trong 0–60% lương, kỳ vọng +30% (`tipsFor`, `petdex/server/rules/careers.js:50`; `petdex/server/jobs.js:171-172`). Lời báo "<tên> nhận N 🪙 + M tiền boa từ ca Ca sĩ đường phố."
- Boa không chốt trước, không nhân hành vượng hay trang phục (nhân gián tiếp vì tính trên lương ca đã nhân).
- Lương gốc thấp nhất, nhưng tính cả boa kỳ vọng thì bậc 1 ≈ 13/giờ, bậc 5 ≈ 65/giờ.

## Liên quan
- [[Việc làm]] · [[Kỹ năng]] · [[Trường học]] · [[Giai đoạn tuổi]] · [[Module rules-careers]]
