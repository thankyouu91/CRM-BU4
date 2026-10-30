---
tags: [petfarm, luat-choi, ky-nang, truong-hoc]
aliases: [Trường, Lớp học, Đi học]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/production.js, petdex/server/care.js, petdex/server/routes-production.js, public/ta-tua/game/js/views/school.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Trường học

> [!summary]
> 🏫 Trường học (mở ở cấp 2) cho bé học lớp 30 phút để tăng ngay 2–4 điểm thô một [[Kỹ năng]], tốn xu và 15 năng lượng, mỗi môn tối đa 3 buổi/ngày. Đây là cách chủ động nhất để đạt ngưỡng thăng bậc ở [[Việc làm]], nấu ăn khéo hơn ở [[Bếp]].

## Con số
| Lớp | Kỹ năng | Học phí gốc | Nguồn |
|---|---|---|---|
| 💪 Lớp thể lực | Sức mạnh | 30 | `petdex/server/rules/production.js:68` |
| 🏃 Lớp chạy bền | Nhanh nhẹn | 30 | `petdex/server/rules/production.js:69` |
| 🧠 Lớp toán vui | Thông minh | 40 | `petdex/server/rules/production.js:70` |
| ✨ Lớp thanh nhạc | Duyên dáng | 50 | `petdex/server/rules/production.js:71` |
| 🖐️ Lớp thủ công | Khéo tay | 40 | `petdex/server/rules/production.js:72` |

| Luật | Giá trị | Nguồn |
|---|---|---|
| Thời lượng | 30 phút, bé bận (`busy_kind = 'school'`, hao sức như đi làm) | `petdex/server/rules/production.js:66`, `petdex/server/care.js:137-139` |
| Năng lượng | cần ≥ 15, trừ 15 ngay | `petdex/server/care.js:126,139` |
| Điểm thô | đều trong 2–4 | `petdex/server/rules/production.js:66` |
| Giới hạn | 3 buổi / môn / bé / ngày | `petdex/server/care.js:128-129` |
| XP | 5 / buổi | `petdex/server/care.js:140` |
| Cấp mở | 2 (bé cao nhất) | `petdex/server/routes-production.js:44` |
| Tuổi | từ Nhí nhố (2 tuần) | `petdex/server/care.js:124` |

## Công thức
```
thô  = U(2, 4) × (Mọt sách ? 1,25 : 1) × stage.school       (Nhí nhố 1,3; Thiếu niên 1,15; Thanh niên, Trưởng thành 1; Lão làng 0,7)
tăng = thô × hệ số kỹ năng × (1 − hiện tại/150)            (xem Kỹ năng)
```
(`petdex/server/care.js:133-136`, `petdex/server/elements.js:17-23`.) Học phí nhân [[Chỉ số giá]], ghi sổ loại `school`.

> [!example] Ví dụ
> Bé Mộc Nhí nhố Mọt sách, Thông minh 15 (growth 1,3), học Lớp toán vui: thô trung bình 3 × 1,25 × 1,3 = 4,875; tăng ≈ 4,875 × 1,3 × 0,9 ≈ **5,7 điểm/buổi**. Ba buổi một ngày ≈ +16 Thông minh cho 120 xu.

## Lời báo
- "<tên> còn bé quá, 2 tuần tuổi mới đi học được." · "<tên> đang bận." · "<tên> cần 15 năng lượng để học." · "Hôm nay <tên> học <lớp> đủ 3 buổi rồi." (`petdex/server/care.js:124-129`).
- Bé ốm: "… đưa bé đi khám rồi hẵng đi học." (`petdex/server/care.js:123`).
- Xong: "<icon> <tên> học xong <lớp>: +N điểm." (`petdex/server/care.js:147`).
- Màn: "🏫 Trường học · Cho bé đi học để lên kỹ năng: làm việc giỏi hơn, lương cao hơn, nấu ăn khéo hơn." (`public/ta-tua/game/js/views/school.js:19`).

## Trường hợp đặc biệt
- Điểm kỹ năng cộng **ngay** khi vào lớp, không chờ hết 30 phút.
- Giới hạn 3 buổi tính theo từng bé và từng môn, theo ngày giờ Việt Nam (bảng `school_log`).
- Mỗi buổi cộng nhiệm vụ "Cho bé đi học 1 buổi" ([[Nhiệm vụ ngày]]).

## Liên quan
- [[Kỹ năng]] · [[Việc làm]] · [[Tính cách Mọt sách]] · [[Giai đoạn tuổi]] · [[Màn Trường học]] · [[Module care]]
