---
tags: [petfarm, kinh-te, san-nguyen-lieu, lenh]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/market.js, petdex/server/rules/market.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Limit order, Lệnh chờ]
---
# Lệnh giới hạn

> [!summary]
> Lệnh mua/bán trên [[Sàn Nguyên Liệu]] kèm giá đặt. Phần khớp được ngay thì khớp (lệnh chờ người khác trước, NPC sau); phần còn lại **nằm chờ tới hết ngày** (giờ Việt Nam). Mua thì xu bị ký quỹ, bán thì hàng rời kho. Đây là cách duy nhất để người chơi khớp trực tiếp với nhau trên Sàn.

## Cách hoạt động
1. Giá đặt phải trong ±15% giá hiện tại, nếu không: "Giá đặt phải nằm trong khoảng lo–hi xu/lô." (`petdex/server/market.js:213-217`).
2. Bán: lấy hàng khỏi kho ngay (FIFO theo hạn dùng), nhớ hạn dùng sớm nhất và giá vốn bình quân (`petdex/server/market.js:220`).
3. Khớp với lệnh đối ứng của người khác: chỉ lệnh trong ±20% giá hiện tại, giá tốt hơn hoặc bằng ask/bid NPC và không tệ hơn giá mình đặt; ưu tiên giá tốt nhất rồi lệnh cũ hơn (`petdex/server/market.js:45-47,226-236`). Lệnh chờ được thanh toán ở **giá của lệnh chờ** (`settleResting`, `petdex/server/market.js:163-188`).
4. Phần còn lại khớp NPC, giới hạn bởi hạn mức 40 lô/ngày và bởi `npcQtyWithin` để giá bình quân không vượt giá đặt (`petdex/server/market.js:238-249`).
5. Còn dư: tạo lệnh `open`. Lệnh mua ký quỹ `thành tiền + phí` ở giá đặt (`escrow_lock`) (`petdex/server/market.js:266-270`). Chỗ trong kho cho lệnh mua được giữ trước (`reserved`, `petdex/server/market.js:32,82-84`).
6. Sau **mỗi nhịp 10 phút**, mọi lệnh chờ chạm giá NPC được khớp với NPC (vẫn trong hạn mức ngày của chủ lệnh), giá bị tác động như lệnh thường (`matchRestingWithNpc`, `petdex/server/market.js:312-325`).
7. Hủy: hoàn ký quỹ hoặc trả hàng về kho, báo "Đã hủy lệnh, ký quỹ và hàng đã trả về." (`petdex/server/market.js:285-302`).
8. Quyết toán nửa đêm: lệnh có `day` trước hôm nay chuyển `expired`, hoàn như hủy (`petdex/server/market.js:305-309`, `petdex/server/scheduler.js:38`).

## Trường hợp đặc biệt
- Khi lệnh mua chờ khớp, phần ký quỹ thừa (do khớp ở giá thấp hơn giá đặt) được hoàn ngay khi lệnh đầy: "Hoàn ký quỹ thừa" (`petdex/server/market.js:183-186`).
- Ký quỹ lệnh mua tính vào [[Ví và tài sản ròng]] (`locked`) và vào lượng xu của [[Ngân hàng Trung ương]] (`petdex/server/bank.js:27`).
- Hàng trong lệnh bán chờ vẫn được tính giá trị theo bid NPC trong tài sản ròng (`petdex/server/market.js:423-431`), nhưng **không bị hư** khi đang nằm trong lệnh (hư chỉ quét bảng `lots`); khi trả về kho thì mang lại hạn dùng cũ và có thể hư ngay.
- Không khớp lệnh của chính mình (`user_id != ?`, `petdex/server/market.js:46`).

## Liên quan
- [[Sàn Nguyên Liệu]] · [[Kho Sàn]] · [[Module market]] · [[MOC Kinh tế và cộng đồng]]
