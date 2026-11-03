---
tags: [petfarm, luat-choi, tien-trinh, hinh-dang]
aliases: [Dáng trưởng thành, Level forms, Mầm non, Thần thái]
loai: luat
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/pets.js, public/ta-tua/game/js/rig.js, public/ta-tua/game/js/app.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Dáng theo cấp

> [!summary]
> Cứ 10 cấp, bé đổi "dáng trưởng thành" một lần: to người hơn và thêm nét vẽ màu hành. Dáng theo cấp cộng dồn với dáng theo tuổi ([[Giai đoạn tuổi]]). Đây là phần thưởng hình ảnh, không đổi luật chơi, hiện thành huy hiệu ✨ cạnh cấp ở màn Nhà.

## Con số
| Từ cấp | Tên dáng | Hệ số cỡ (`grow`) | Nét vẽ thêm | Nguồn |
|---|---|---|---|---|
| 1 | Mầm non | 1 | Dáng mộc mạc lúc mới nuôi | `public/ta-tua/game/js/shared/pets.js:383` |
| 10 | Chớm lớn | 1,03 | Hai bên thái dương nhú vạch màu hành | `public/ta-tua/game/js/shared/pets.js:384` |
| 20 | Cứng cáp | 1,06 | Hai bên hông có vằn | `public/ta-tua/game/js/shared/pets.js:385` |
| 30 | Tinh anh | 1,09 | Vòng linh khí màu hành dưới chân | `public/ta-tua/game/js/shared/pets.js:386` |
| 40 | Linh khí | 1,12 | Đốm sáng ngũ hành bay quanh người | `public/ta-tua/game/js/shared/pets.js:387` |
| 50 | Thần thái | 1,15 | To nhất, vạch và linh khí hóa ánh vàng | `public/ta-tua/game/js/shared/pets.js:388` |

## Cách hoạt động
- `formIndex(level)` tìm mốc cuối cùng ≤ cấp (`public/ta-tua/game/js/shared/pets.js:391`); `levelForm(level)` trả mốc đó (392).
- Bộ khung vẽ nhân cỡ người theo `grow` (`public/ta-tua/game/js/rig.js:883`) và vẽ nét theo bậc (`public/ta-tua/game/js/rig.js:962-968`).
- Màn Nhà hiện huy hiệu "✨ <tên dáng>", di chuột thấy gợi ý "Lên Lv N: <dáng kế>" (`formBadge`, `public/ta-tua/game/js/app.js:100-105`).
- Đồi Sao vẽ bé đã mất với cấp lúc mất (`public/ta-tua/game/js/app.js:980`).
- Có thể xem trước ở Pet Lab với tham số `?level=50` ([[Xưởng tạo hình Pet Lab]]).

## Liên quan
- [[Cấp độ và XP]] · [[Giai đoạn tuổi]] · [[Trang phục]] (mốc cấp 10–40 của đồ cao cấp trùng với mốc dáng) · [[Bộ khung thú]]
