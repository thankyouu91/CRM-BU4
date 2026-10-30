---
tags: [petfarm, kinh-te, san-nguyen-lieu, kho, hu-hong]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/market.js, petdex/server/rules/market.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Kho, Warehouse]
---
# Kho Sàn

> [!summary]
> Kho hàng nguyên liệu của mỗi người chơi, dùng chung cho mọi hệ thống sản xuất: hàng mua trên [[Sàn Nguyên Liệu]], thu hoạch ở [[Vườn]], cá và trân châu từ [[Mini-game]], thành phẩm [[Khu công nghiệp]], hàng nhận theo [[Hợp đồng cung ứng]]. [[Quầy trà sữa]], [[Bếp]], xưởng và dự án [[Hội]] lấy nguyên liệu từ đây. Kho có 3 bậc sức chứa và hàng tươi tự hư khi quá hạn.

## Con số

| Bậc | Sức chứa | Giá nâng | Nguồn |
|---|---|---|---|
| 0 | 200 lô (2.000 phần) | miễn phí | `petdex/server/rules/market.js:33-37` |
| 1 | 500 lô | 1.500 xu | `petdex/server/rules/market.js:35` |
| 2 | 2.000 lô | 6.000 xu | `petdex/server/rules/market.js:36` |

> [!warning] Lệch tài liệu
> Giá nâng kho **không** nhân [[Chỉ số giá]] (`post({ delta: -next.price })`, `petdex/server/market.js:143`), khác với hầu hết giá NPC khác. README không nhắc tới kho 3 bậc.

## Cách hoạt động
- Mỗi lần nhập là một dòng `lots` mang `qty` (phần), `acquired_at`, `expires_at`, `cost` (giá vốn mỗi phần) (`petdex/server/market.js:33,90-99`).
- Chỗ trống = sức chứa − hàng đang giữ − chỗ giữ cho lệnh mua chờ (`freeSpace`, `petdex/server/market.js:82-84`).
- Nhập đầy: lỗi "Kho đầy rồi: nâng cấp kho hoặc bán bớt hàng." trừ khi gọi với `allowPartial` (thu hoạch, thưởng, giao hàng hợp đồng, thành phẩm xưởng), khi đó nhận tới khi đầy, phần thừa mất (`petdex/server/market.js:90-99`).
- Lấy hàng: theo thứ tự sắp hư trước rồi không hạn (`ORDER BY expires_at IS NULL, expires_at, id`, `petdex/server/market.js:28,102-120`).
- Nâng cấp: `POST /market/warehouse`, báo "Kho mở rộng lên N lô." hoặc "Kho đã lớn nhất rồi." (`petdex/server/market.js:138-147`). Không có điều kiện cấp.

## Hàng hư
- Hạn dùng `shelfLife = lúc nhập + shelfDays × 1 ngày` (`petdex/server/rules/market.js:111`): lá trà 2, cá 2, sữa tươi 3, dâu 3, trân châu 5, sữa đặc 7 ngày; sắn, mía, trà khô, đường không hư (xem [[Mặt hàng nguyên liệu]]).
- `purge` xóa mọi lô có `expires_at <= now` mỗi khi xem Sàn, đặt lệnh hoặc đọc kho; màn Sàn báo các lô vừa hư (`spoiled`) (`petdex/server/market.js:75-79,360,404`).
- Hàng qua hợp đồng giữ hạn dùng gốc của bên bán (`petdex/server/contracts.js:162-163`); thành phẩm xưởng có hạn mới tính từ lúc ra lò (`addGoods` mặc định, `petdex/server/factory.js:132`).

## Liên quan
- [[Sàn Nguyên Liệu]] · [[Mặt hàng nguyên liệu]] · [[Lệnh giới hạn]] · [[Module market]] · [[MOC Kinh tế và cộng đồng]]
