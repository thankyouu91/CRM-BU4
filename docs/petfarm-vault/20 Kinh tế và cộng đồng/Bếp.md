---
tags: [petfarm, kinh-te, bep, nau-an]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/farm.js, petdex/server/rules/production.js, petdex/server/routes-production.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🍳 Bếp, Kitchen]
---
# Bếp

> [!summary]
> Bé chính nấu món (cấp 3) từ nguyên liệu trong [[Kho Sàn]]. Có 7 món (3 [[Món ẩn]] phải tự ghép đúng công thức để khám phá), 3 mức chất lượng theo Khéo tay. Món để được 3 ngày: cho bé ăn (hồi chỉ số, +XP), bán cho quán ăn đầu phố 60% giá trị, hoặc bày ở [[Chợ Phiên]].

## Món (`DISHES`, `petdex/server/rules/production.js:106-114`)

| Món | Hành | Nguyên liệu (phần) | Hiệu quả khi ăn (chất lượng Thường) | Giá trị (Thường, chỉ số 1) | Ẩn |
|---|---|---|---|---|---|
| 🧋 Trà sữa nhà làm | Mộc | trà khô, sữa tươi, trân châu, đường nâu × 1 | No +30, Vui +12 | 17 | |
| 🍹 Sinh tố dâu | Hỏa | dâu × 2, sữa tươi × 1 | No +20, Vui +25, Năng lượng +10 | 20 | |
| 🐟 Cá nướng | Hỏa | cá × 2, đường nâu × 1 | No +55 | 24 | |
| 🍰 Bánh dâu | Hỏa | dâu × 2, trân châu × 1, đường × 2, sữa tươi × 1 | No +35, Vui +40 | 28 | |
| 🍮 Thạch trà | Mộc | trà khô × 2, đường × 1 | Vui +30, Năng lượng +15 | 15 | ẩn |
| 🍲 Canh cá lá trà | Thủy | cá, lá trà, sắn × 1 | No +45, Sức khỏe +10 | 14 | ẩn |
| 🥮 Bánh sắn nướng | Thổ | sắn × 2, đường × 1, sữa đặc × 1 | No +40, Vui +15 | 13 | ẩn |

Giá trị = `round(Σ base × chỉ số × phần / 10 × 1,8 × hệ số chất lượng)` (`dishValue`, `petdex/server/rules/production.js:133-136`).

## Chất lượng (`QUALITY`, `rollQuality`, `petdex/server/rules/production.js:115-127`)

| Mức | Hệ số | Xác suất (`r` đều 0–1) |
|---|---|---|
| Thường | ×1 | còn lại |
| Ngon | ×1,2 | `r < craft/200 + 0,3 + craft/300` |
| Tuyệt hảo | ×1,5 | `r < craft/200` |

- `craft` = Khéo tay của bé chính, **+15** nếu bé hành Kim (`public/ta-tua/game/js/shared/pets.js:293`, `petdex/server/farm.js:207-208`).
- May mắn từ [[Trang phục]]: `r` được chia cho `(1 + luck/100)`, tức dễ ra mức cao hơn (`petdex/server/farm.js:210-211`).

> [!example] Khéo tay 60
> Tuyệt hảo 30%, Ngon thêm 50% (tổng 0,8), Thường 20%. Khéo tay 100 (hoặc bé Kim có Khéo tay 85): Tuyệt hảo 50%, Ngon 50%, không bao giờ ra Thường.

## Con số (`KITCHEN`, `petdex/server/rules/production.js:120`)
| Thông số | Giá trị |
|---|---|
| Năng lượng mỗi lần nấu | 5 (bé phải khỏe, không bận) |
| XP bé nấu | +4 |
| Hạn dùng món | 3 ngày |
| Bán cho quán ăn | 60% giá trị (+ thưởng giao dịch trang phục) |
| XP khi ăn | `round(8 × hệ số chất lượng × (1 + thưởng hợp mệnh))` |

## Cách hoạt động
- `POST /kitchen/cook { recipe }` nấu món đã biết; `{ inputs }` là "🧪 Thử công thức": tìm món có **đúng** bộ nguyên liệu và số phần (`sameInputs`) (`petdex/server/farm.js:190-228`, `petdex/server/rules/production.js:129-130`).
- Nguyên liệu bị trừ trước, nhưng mọi lỗi (bé mệt, ốm, bận) hoàn tác cả giao dịch (`transaction`).
- Ăn: hiệu quả nhân hệ số chất lượng; món có No mà bé đã no ≥ 97 thì "… no căng bụng rồi!" (`petdex/server/farm.js:231-246`). Ăn món hợp mệnh thêm 20% XP (xem [[Hợp mệnh và kỵ mệnh]]).
- Bán quán ăn: `round(dishValue × 0,6)`, dòng `kitchen_sale` (`petdex/server/farm.js:248-258`).
- Món hết hạn bị xóa khi mở Bếp (`petdex/server/farm.js:168`).

## Lỗi người chơi thấy
"Hãy chọn nguyên liệu.", "Ghép thế này chưa ra món nào. Thử đổi số lượng hoặc nguyên liệu xem!", "Cần một bé vào bếp.", "Bạn chưa biết công thức này.", "X cần 5 năng lượng để nấu.", "X đang bận, xong việc rồi vào bếp nhé." (`petdex/server/farm.js:194-220`).

## Liên quan
- [[Món ẩn]] · [[Chợ Phiên]] · [[Đồ ăn và đồ chăm sóc]] · [[Chỉ số của bé]] · [[Ngũ hành]] · [[Thú chính]] · [[Module farm]] · [[MOC Kinh tế và cộng đồng]]
