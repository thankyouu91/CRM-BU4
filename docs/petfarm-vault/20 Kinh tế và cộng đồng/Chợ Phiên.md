---
tags: [petfarm, kinh-te, cho-phien, giao-dich]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/bazaar.js, petdex/server/rules/production.js, petdex/server/routes-production.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🏮 Chợ Phiên, Bazaar]
---
# Chợ Phiên

> [!summary]
> Chợ người chơi bán cho nhau (cấp 4): đồ [[Siêu thị]] trong túi, từng món [[Trang phục]] (kèm cấp) và món tự nấu ở [[Bếp]]. Giá tự đặt trong 50–300% giá tham chiếu, phí đăng tin 1%, phí bán 5% người bán chịu, tin còn 48 giờ. Đây là kênh chuyển xu giữa người chơi; một nửa phí vào [[Ngân sách thị trấn]].

## Con số (`BAZAAR`, `petdex/server/rules/production.js:178`)

| Thông số | Giá trị | Nguồn |
|---|---|---|
| Mở khóa (bày bán, mua) | bé cấp 4 | `petdex/server/routes-production.js:137-144`, `petdex/server/routes-economy.js:19` |
| Tuổi tài khoản tối thiểu để bày bán | 3 ngày | `petdex/server/bazaar.js:76` |
| Số tin đang bày tối đa | 10 | `petdex/server/bazaar.js:79` |
| Khoảng giá | 50–300% giá tham chiếu (làm tròn, tối thiểu 1) | `petdex/server/bazaar.js:102-103` |
| Phí đăng tin | `max(1, round(giá × 1%))`, không hoàn khi gỡ | `petdex/server/bazaar.js:113,149` |
| Phí bán | `max(1, round(giá × 5%))`, trừ vào tiền người bán nhận | `petdex/server/bazaar.js:129-131` |
| Thời hạn tin | 48 giờ (món nấu: không quá hạn dùng của món) | `petdex/server/bazaar.js:87,93,98` |

## Giá tham chiếu
| Loại (`kind`) | Giá tham chiếu | Nguồn |
|---|---|---|
| `item` (đồ Siêu thị, không phải trang phục) | `indexedPrice(giá shop)` | `petdex/server/bazaar.js:82-87` |
| `gear` (một món trang phục cụ thể) | `indexedPrice(giá shop) × TIER_VALUE[cấp]` (xem [[Cấp trang phục]]) | `petdex/server/bazaar.js:88-93` |
| `dish` (món đã nấu) | `dishValue(món, chất lượng, chỉ số giá)` | `petdex/server/bazaar.js:94-98` |

## Cách hoạt động
- Bày bán: đồ rời túi (bỏ trang bị nếu hết), trang phục đánh dấu `listed` và bị tháo khỏi bé, món nấu rời tủ (`petdex/server/bazaar.js:105-114`, `petdex/server/gear.js:200-203`).
- Mua: trả đủ giá (`bazaar_buy`), người bán nhận `giá − phí` (`bazaar_sale`) cộng thưởng "Thu nhập giao dịch" trang phục của bé chính người bán; `floor(phí/2)` vào ngân sách; đồ/món/trang phục chuyển cho người mua (`petdex/server/bazaar.js:119-141`).
- Gỡ tin hoặc hết hạn: trả hàng về người bán; **món ăn đã hư thì mất** (`petdex/server/bazaar.js:64-68,143-161`). Hết hạn được quét lúc nửa đêm (`petdex/server/scheduler.js:40`).

## Lỗi người chơi thấy
"Tài khoản cần đủ 3 ngày tuổi mới bày bán được.", "Mỗi người bày tối đa 10 món.", "Trang phục bán theo từng món: chọn món ở mục Trang phục.", "Mở hộp trước rồi hẵng bày bán nhé.", "Giá phải từ lo đến hi xu (giá tham chiếu X).", "Bạn đã có X rồi, món này dùng mãi mãi." (đồ chơi dùng mãi), "Đây là món bạn đang bán.", "Món này vừa có người mua mất rồi." (`petdex/server/bazaar.js:74-135`).

> [!warning] Lệch tài liệu
> `petdex/README.md:72` chỉ nói bán "đồ siêu thị và món tự nấu"; code còn bán **trang phục** theo từng món và đòi tài khoản **≥ 3 ngày**, tối đa **10 tin**. `petdex/docs/thiet-ke-mo-rong.md:54` có "đấu giá đồ hiếm" nhưng code chưa có đấu giá.

## Liên quan
- [[Bếp]] · [[Trang phục]] · [[Cấp trang phục]] · [[Siêu thị]] · [[Ngân sách thị trấn]] · [[Module bazaar]] · [[MOC Kinh tế và cộng đồng]]
