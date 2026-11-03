---
tags: [petfarm, kinh-te, bep, mon-an]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/farm.js, petdex/server/rules/production.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Công thức ẩn, Hidden dishes]
---
# Món ẩn

> [!summary]
> 3 trong 7 món của [[Bếp]] có cờ `hidden`: không hiện trong danh sách công thức cho tới khi người chơi tự ghép đúng nguyên liệu ở "🧪 Thử công thức". Ghép đúng lần đầu thì nấu luôn và học công thức vĩnh viễn (bảng `recipes_known`).

## Công thức (spoiler)

| Món | Nguyên liệu chính xác (phần) | Hành | Nguồn |
|---|---|---|---|
| 🍮 Thạch trà | trà khô 2, đường nâu 1 | Mộc | `petdex/server/rules/production.js:111` |
| 🍲 Canh cá lá trà | cá tươi 1, lá trà tươi 1, củ sắn 1 | Thủy | `petdex/server/rules/production.js:112` |
| 🥮 Bánh sắn nướng | củ sắn 2, đường nâu 1, sữa đặc 1 | Thổ | `petdex/server/rules/production.js:113` |

## Luật
- Thử ghép: bỏ các số không nguyên dương, so khớp **đúng** tập mặt hàng và số phần (`sameInputs`); không khớp thì báo lỗi và **không mất nguyên liệu** (`petdex/server/farm.js:193-198`, `petdex/server/rules/production.js:129-130`).
- Ghép trúng: báo "✨ Khám phá công thức mới! …" và ghi `recipes_known` (`petdex/server/farm.js:213-225`).
- Gọi nấu thẳng bằng mã món ẩn khi chưa biết: "Bạn chưa biết công thức này." (`petdex/server/farm.js:204`).
- Màn Bếp hiện số món ẩn còn lại (`hiddenLeft`) (`petdex/server/farm.js:180`).
- Mua món ẩn ở [[Chợ Phiên]] được, dù người mua chưa biết công thức (`petdex/server/farm.js:160`).

## Liên quan
- [[Bếp]] · [[Mặt hàng nguyên liệu]] · [[MOC Kinh tế và cộng đồng]]
