---
tags: [petfarm, giao-dien, man-hinh, truong-hoc, ky-nang]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/school.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Trường học

> [!summary]
> Màn `#school` (tòa 🏫, cần `unlocks.school` = 2): chọn bé, xem năng lượng, tính cách và 5 kỹ năng, rồi vào các lớp trong "📚 Thời khóa biểu hôm nay" để tăng kỹ năng. Có hiệu ứng "+n điểm" nổi trên thẻ lớp vừa học. Luật ở [[Trường học]] và [[Kỹ năng]].

## Khóa và rỗng

| Trường hợp | Hiển thị | Nguồn |
|---|---|---|
| Chưa đủ cấp | "🔒 Trường chưa nhận học sinh · Có một bé đạt cấp n là trường mở cửa cho cả nhà." | `public/ta-tua/game/js/views/school.js:23-28` |
| Chưa có bé | "🐾 Chưa có học sinh" + "🏠 Về nhà" | `school.js:30-35` |

## Bố cục

| Vùng | Nội dung | Nguồn |
|---|---|---|
| Đổi bé | "⭐ Tên · Lv n" kèm icon trạng thái: icon bệnh, ⏳ bận, 🍼 sơ sinh | `school.js:44-51` |
| Hộp bé | tên, Lv, nhãn tuổi, huy hiệu bệnh; thanh ⚡; chip tính cách (Mọt sách tô riêng); "📚 {tên} là **Mọt sách**: mỗi buổi học được thêm 25% điểm!"; danh sách 5 kỹ năng có thanh và số 1 chữ số thập phân; chữ lý do chặn; "Mỗi buổi n phút, tốn n ⚡ và học phí… Mỗi môn học tối đa n buổi/ngày; qua nửa đêm lại học tiếp." | `school.js:68-97` |
| Thẻ lớp | icon, tên lớp, kỹ năng; "Hiện tại x/100"; thanh; chấm `taken/max` "n/m buổi hôm nay"; "+a–b điểm mỗi buổi (đã tính Mọt sách), điểm càng cao lên càng chậm."; "Giúp: {các nghề dùng kỹ năng này}" (+ "nấu món ngon ở Bếp, đứng máy xưởng" cho Khéo tay, "đứng máy xưởng" cho Sức mạnh); nút "📚 Vào học · học phí 🪙" | `school.js:10-13`, `school.js:100-142` |

Số điểm hiển thị dùng `skillText(v) = floor(v×10)/10` (`school.js:15`). Khoảng điểm mỗi buổi là `rules.gain` × 1,25 nếu có tính cách Mọt sách (`school.js:114-115`).

## Lý do chặn

| Cấp | Điều kiện | Chữ |
|---|---|---|
| Cả trường (`blockAll`) | bé ốm | "{icon} {tên} đang {bệnh}, khỏi bệnh mới đi học được." + link "Tới phòng khám" |
| | sơ sinh | "🍼 {tên} còn bé quá, tròn 2 tuần tuổi mới đi học được." |
| | đang bận | "⏳ {tên} đang bận, rảnh sau {đếm ngược}." (đếm từng giây) |
| | thiếu năng lượng | "😴 {tên} cần n ⚡ để học (đang có m). Cho bé nghỉ hoặc ăn gì đó đã." |
| Từng lớp | kỹ năng 100 | "Kỹ năng này đã tối đa" |
| | đủ buổi | "Hôm nay học đủ n buổi rồi" |
| | thiếu xu | "Không đủ xu đóng học phí" |

Nguồn `school.js:54-66`, `school.js:111-112`.

## API và làm mới

| Hành động | API | Nguồn |
|---|---|---|
| Mở màn | `GET /school?petId=<id>` | `school.js:194` |
| Vào học | `POST /school/class {petId, skill}`; `onResult` lưu `flash = {petId, skill, gain}` để thẻ lớp hiện "+n điểm" trong 5 giây | `school.js:166-172`, `school.js:146` |
| Đổi bé | `ctx.refresh()` (gọi lại `/school` với bé mới) | `school.js:163-165` |

Khi đồng hồ bận chạy về 0, màn tự `refreshMe()` rồi vẽ lại, giới hạn tối đa một lần mỗi 15 giây (`lastAuto`) (`school.js:177-192`). Máy chủ chặn cấp ở `petdex/server/routes-production.js:44`.

## Liên quan
- [[Trường học]], [[Kỹ năng]], [[Tính cách]], [[Giai đoạn tuổi]], [[Ốm và Phòng khám]]
- [[Màn Việc làm]], [[Màn Bếp]], [[Màn Khu công nghiệp]], [[Màn Phòng khám]]
