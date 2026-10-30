---
tags: [petfarm, luat-choi, ky-nang]
aliases: [Skills, Sức mạnh, Nhanh nhẹn, Thông minh, Duyên dáng, Khéo tay]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/careers.js, petdex/server/elements.js, public/ta-tua/game/js/shared/pets.js, petdex/server/jobs.js, petdex/server/care.js, petdex/server/minigames.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Kỹ năng

> [!summary]
> Mỗi bé có 5 kỹ năng thang 0–100: 💪 Sức mạnh, 🏃 Nhanh nhẹn, 🧠 Thông minh, ✨ Duyên dáng, 🖐️ Khéo tay. Kỹ năng quyết định lương và thăng bậc ở [[Việc làm]], chất lượng món ở [[Bếp]], công suất trực [[Quầy trà sữa]] và đứng máy ở [[Khu công nghiệp]]. Kỹ năng lên khi nhận lương ca, đi học, chơi mini-game; càng cao càng chậm.

## Con số
| Kỹ năng | Mã | Nghề dùng | Lớp học | Mini-game | Nguồn |
|---|---|---|---|---|---|
| 💪 Sức mạnh | `strength` | [[Nghề Bốc vác]]; đứng máy xưởng | Lớp thể lực (30 xu) | | `petdex/server/rules/careers.js:5` |
| 🏃 Nhanh nhẹn | `agility` | [[Nghề Giao hàng]] | Lớp chạy bền (30) | [[Câu cá]], [[Hứng trân châu]] | `petdex/server/rules/careers.js:6` |
| 🧠 Thông minh | `intellect` | [[Nghề Gia sư]] | Lớp toán vui (40) | [[Ghép hình nhớ]] | `petdex/server/rules/careers.js:7` |
| ✨ Duyên dáng | `charm` | [[Nghề Ca sĩ đường phố]] | Lớp thanh nhạc (50) | | `petdex/server/rules/careers.js:8` |
| 🖐️ Khéo tay | `craft` | [[Nghề Pha chế]]; trực quầy; nấu ăn | Lớp thủ công (40) | | `petdex/server/rules/careers.js:9` |

| Nguồn điểm thô | Lượng | Nguồn |
|---|---|---|
| Nhận lương ca nghề (kỹ năng chính của nghề) | 0,6 / giờ | `petdex/server/rules/careers.js:33`, `petdex/server/jobs.js:174` |
| Xong ca trực quầy (Khéo tay) | 0,6 / giờ | `petdex/server/jobs.js:198` |
| Xong ca đứng máy (Sức mạnh) | 0,6 / giờ | `petdex/server/jobs.js:214` |
| Một buổi học | 2–4 (đều) × Mọt sách 1,25 × tuổi | `petdex/server/rules/production.js:66`, `petdex/server/care.js:135` |
| [[Câu cá]] | 0,25 / con cá | `public/ta-tua/game/js/shared/minigames.js:110` |
| [[Hứng trân châu]] | 0,05 × min(điểm, 30), tối đa 1,5 | `public/ta-tua/game/js/shared/minigames.js:132` |
| [[Ghép hình nhớ]] | 0,4 + 0,1 / cặp (tối đa 1,2) | `public/ta-tua/game/js/shared/minigames.js:147` |
| Kỷ vật bé trước | +5 cố định khi tạo bé | `petdex/server/eggs.js:27-28` |
| [[Tính cách Có duyên]] | +5 Duyên dáng khi tạo bé | `petdex/server/eggs.js:25` |

## Công thức
```
hệ số = growth[k] × max(0,5, 1 + wearBonus) × (1 + %Chỉ số/100)
growth[k] = hệ số hành[k] + (k là sở trường ? 0,1 : 0)
điểm mới = clamp( hiện tại + thô × hệ số × (1 − hiện tại / 150), 0, 100 )
```
(`petdex/server/elements.js:11-23`, `public/ta-tua/game/js/shared/pets.js:252`, `petdex/server/rules/careers.js:42`.)

> [!example] Ví dụ
> Mèo Bạc (Kim, sở trường Khéo tay: growth 1,4), Khéo tay 20, không đồ, nhận lương ca Pha chế 4 giờ: thô 2,4 × 1,4 = 3,36 × (1 − 20/150) = **+2,91** → 22,9.
> Ở Khéo tay 80 cùng ca đó: 3,36 × (1 − 80/150) = +1,57. Hệ số giảm dần đạt 1/3 ở mức 100, nên 100 vẫn chạm được nhưng rất chậm.

Kỹ năng khởi đầu: theo loài ([[Danh mục loài]]); loài khách mời bốc ngẫu nhiên 5–15 mỗi kỹ năng (`initialSkills`, `petdex/server/rules/careers.js:37-39`).

## Trường hợp đặc biệt
- Kỹ năng lưu số thực, màn Nhà hiện phần nguyên (`Math.floor`, `public/ta-tua/game/js/app.js:528`).
- Lương ca nghề dùng kỹ năng **lúc bắt đầu ca**; điểm cộng thêm chỉ có tác dụng từ ca sau.
- Thăng bậc nghề xét kỹ năng **sau** khi cộng điểm của ca vừa nhận ([[Việc làm]]).
- Giới hạn 3 buổi/môn/ngày ở [[Trường học]] là cách tăng nhanh nhất (tối đa 15 buổi/ngày cho 5 môn nếu đủ năng lượng và xu).

## Liên quan
- [[Việc làm]] · [[Trường học]] · [[Mini-game]] · [[Ngũ hành]] · [[Hợp mệnh và kỵ mệnh]] · [[Dòng chỉ số trang phục]] · [[Module rules-careers]] · [[Module elements]]
