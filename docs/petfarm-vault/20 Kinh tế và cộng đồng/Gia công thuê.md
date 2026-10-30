---
tags: [petfarm, kinh-te, khu-cong-nghiep, gia-cong]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/factory.js, petdex/server/routes-production.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Toll processing, Đơn gia công]
---
# Gia công thuê

> [!summary]
> Người chưa có xưởng (từ cấp 2) gửi nguyên liệu nhờ xưởng của người khác chế biến, trả phí cố định mỗi mẻ do chủ xưởng đặt (0–100 xu). Nguyên liệu rời kho ngay, phí giữ trong tài khoản ký quỹ `toll:<id>`, xong mẻ nào trả mẻ đó cho chủ xưởng. Đơn gia công luôn được làm **trước** hàng của chủ xưởng.

## Cách hoạt động
1. Chủ xưởng mở nhận gia công: `POST /factory/:id/toll { fee, open }` (`petdex/server/factory.js:170-179`).
2. Người gửi xem `tollOffers` (xưởng đang nhận, xếp theo phí tăng dần) và đặt `POST /factory/:id/order { batches }` 1–100 mẻ, cần cấp 2 (`petdex/server/factory.js:41-43,192-208`, `petdex/server/routes-production.js:103-106`).
3. Phí của đơn **chốt theo phí lúc đặt**; tiền `fee × mẻ` chuyển ví → `toll:<id>` (`toll_fee`).
4. Khi xưởng chạy: mỗi mẻ xong, thành phẩm vào kho người gửi, `fee` chuyển `toll:<id>` → chủ xưởng (`toll_income`, chịu [[Thuế thu nhập]]) (`petdex/server/factory.js:110-125`).
5. Hủy đơn: chạy bù trước, trả lại nguyên liệu phần chưa làm (nhận tới khi kho đầy) và hoàn số dư ký quỹ (`petdex/server/factory.js:210-227`).

## Trường hợp đặc biệt
- "Xưởng của mình thì cứ để nguyên liệu trong kho là được." khi gửi cho chính xưởng mình (`petdex/server/factory.js:197`).
- Nguyên liệu trả lại khi hủy có **hạn dùng mới** tính từ lúc trả (mặc định `addGoods`), có thể lợi cho hàng tươi.
- Xưởng không có bé đứng máy thì đơn đứng yên; chủ xưởng không thể đóng xưởng khi còn đơn chờ, và xưởng nợ thuê cũng không bị đóng khi còn đơn (`petdex/server/factory.js:233,310`).
- Phí 0 xu hợp lệ (gia công miễn phí cho bạn bè).

## Liên quan
- [[Khu công nghiệp]] · [[Xưởng sấy trà]] · [[Xưởng bột trân châu]] · [[Nhà máy đường]] · [[Lò sữa đặc]] · [[MOC Kinh tế và cộng đồng]]
