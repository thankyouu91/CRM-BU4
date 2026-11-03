---
tags: [petfarm, giao-dien, man-hinh, viec-lam]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/jobs.js, public/ta-tua/game/js/shared/pets.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Việc làm

> [!summary]
> "💼 Trung tâm việc làm" (`#jobs`): danh sách ca đang làm có đồng hồ đếm từng giây, chọn bé, thẻ từng nghề với lương mỗi giờ, tiến độ thăng chức và nút nhận ca 1, 2 hoặc 4 giờ (`SHIFT_HOURS = [1, 2, 4]` ở `petdex/server/rules/careers.js:21`, gửi xuống qua `catalog.jobs.shiftHours`), cộng thêm việc ở quầy trà sữa và Khu công nghiệp. Luật ở [[Việc làm]] và [[Thuê bé làm việc]].

## Bố cục

| Vùng | Nội dung | Nguồn |
|---|---|---|
| Đầu màn | "Ca làm tốn thời gian thật. Bé đi làm cả khi bạn tắt app, xong ca quay lại nhận lương." | `public/ta-tua/game/js/views/jobs.js:9` |
| 📋 Ca làm | mỗi ca: icon nghề (🏭 "Đứng máy ở {xưởng}", 🧋 "Trực {quầy}" hoặc nghề thường), "{bé} · nghề", "n giờ · lương 🪙 (+ tiền boa)", thanh tiến độ, đếm ngược hoặc nút "Nhận lương" | `jobs.js:18-35` |
| Đổi bé | nút mỗi bé, có icon bận nếu đang bận | `jobs.js:127-130` |
| Trạng thái bé | ⚡ năng lượng, 🍙 no bụng (đỏ nếu < 15), "⏱ Đã làm hôm nay h/max giờ", "💼 lương n%" theo tuổi nếu `workFactor < 1`, thanh mini từng kỹ năng | `jobs.js:131-140` |
| Thẻ nghề | tên, "{danh hiệu bậc} · bậc n", mô tả, "**x 🪙/giờ** · theo {kỹ năng} n · thâm niên +y%", tiến độ "Lên {bậc kế}: ⏱ giờ/giờ cần, kỹ năng/ngưỡng" hoặc "🏅 Đã là Bậc thầy", các nút ca | `jobs.js:37-78` |
| 🤝 Việc ở quầy trà sữa | "Trực quầy {của mình}" (không lương, quầy chỉ bán khi có bé đứng) và các tin tuyển của quầy người khác (chủ, địa điểm, chỗ trống, lương/giờ, "lên Khéo tay"); rỗng: "Chưa có quầy nào đang tuyển người." | `jobs.js:81-97` |
| 🏭 Việc ở Khu công nghiệp | "Đứng máy ở {xưởng mình}" (không lương, lên 💪 Sức mạnh) và tin tuyển công nhân; ẩn khi không có gì | `jobs.js:100-115` |
| Văn phòng Hội | "🏯 Văn phòng Hội đang cộng thêm n% lương ca làm." nếu `officeBonus` | `jobs.js:144` |
| Rỗng | "🐣 Nhận nuôi một bé trước đã." + "Về nhà" | `jobs.js:119-122` |

## Công thức lương hiển thị

```
senior  = pet.seniority ? seniorityBonus(giờ ở nghề) : 0
perHour = round(career.pay[rank-1] × (0.8 + skill/200) × pet.workFactor × (1 + senior))
nút ca  = perHour × h
```

Nguồn `jobs.js:40-42`; `seniorityBonus` ở `public/ta-tua/game/js/shared/pets.js` (comment ở `jobs.js:40`: sơ sinh 50%, nhí nhố 60%, thiếu niên 85%; thâm niên +1% mỗi 10 giờ, tối đa 30%, từ tuổi Trưởng thành). Đây là ước tính hiển thị, số thật do máy chủ tính khi nhận lương.

## Khóa nút ca

Thứ tự lý do (`jobs.js:45-49`):

| Điều kiện | Chữ hiện |
|---|---|
| bé đang bận việc khác (học, tắm) | "Bé đang đi học, xong rồi hẵng nhận ca" (theo `busyOf`) |
| bé đang làm ca khác | "Bé đang làm ca khác" |
| bé ốm | "Bé đang ốm, đưa đi Phòng khám trước đã" |
| hết giờ trong ngày | "Hôm nay làm đủ n giờ rồi" |
| no bụng < 15 | "Bé đói quá, cho ăn rồi hẵng đi làm" |

Ngoài ra từng nút còn khóa khi `h > giờ còn lại` hoặc `energy < h × 10` (`jobs.js:71`). Nút 4 giờ được tô `primary`.

## API

| Hành động | API | Nguồn |
|---|---|---|
| Mở màn | `GET /jobs` | `jobs.js:185` |
| Ca nghề | `POST /jobs/start {petId, career, hours}` | `jobs.js:167-168` |
| Ca quầy | `POST /jobs/start {petId, businessId, hours}` | `jobs.js:169-171` |
| Ca xưởng | `POST /jobs/start {petId, factoryId, hours}` | `jobs.js:172-174` |
| Nhận lương | `POST /jobs/:id/claim`; thêm toast "{kỹ năng} +n" và "🏅 Thăng chức: {danh hiệu} nghề X!" (loại `level`) | `jobs.js:175-182` |

`tickClock` chạy mỗi giây cập nhật đếm ngược và thanh; khi có ca vừa xong thì `ctx.refresh()` vẽ lại để hiện nút "Nhận lương" (`jobs.js:147-158`). Bé chọn lưu ở biến module `selectedPet`. Thân request ở máy chủ: `petdex/server/routes-economy.js:31-40`.

## Liên quan
- [[Việc làm]], [[Kỹ năng]], [[Giai đoạn tuổi]], [[Thuê bé làm việc]], [[Quầy trà sữa]], [[Khu công nghiệp]], [[Hội]], [[Hành vượng]]
- [[Màn Nhà]] (nút Đi làm), [[Màn Quầy trà sữa]], [[Màn Khu công nghiệp]], [[Màn Phố]] (huy hiệu "Lương sẵn sàng!")
