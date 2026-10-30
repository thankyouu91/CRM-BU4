---
tags: [petfarm, thiet-ke, tai-lieu]
loai: thiet-ke
trang-thai: dang-chay
nguon: [petdex/docs/thiet-ke-mo-rong.md]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Tài liệu thiết kế mở rộng

> [!summary]
> `petdex/docs/thiet-ke-mo-rong.md` ("Petdex Park mở rộng: Phố Trân Châu", 835 dòng) là bản thiết kế gốc biến Petdex Park từ game nuôi thú đơn giản thành một thị trấn có **nhiều hoạt động** và **nền kinh tế có chiều sâu**. Nó chia việc thành các giai đoạn 1A, 1B, 2, 3, 4; ba giai đoạn đầu **đã làm**, giai đoạn 3 (bất động sản, thi đấu) và 4 (thị trường vốn) **chưa làm theo bản gốc**. Mục 12 là nhật ký những chỗ code khác thiết kế và lý do. Ghi chú này tóm tắt tài liệu; **code là chuẩn**.

## Cấu trúc tài liệu
| Mục | Nội dung | Dòng |
|---|---|---|
| 1 | Hiện trạng và vấn đề trước khi mở rộng | `petdex/docs/thiet-ke-mo-rong.md:12-22` |
| 2 | Quyết định đã chốt | `petdex/docs/thiet-ke-mo-rong.md:24-34` |
| 3 | Bản đồ Phố Trân Châu và cấp mở khóa | `petdex/docs/thiet-ke-mo-rong.md:36-65` |
| 4 | Thú cưng sâu hơn: 5 chỉ số, kỹ năng, tính cách, nhịp tuổi | `petdex/docs/thiet-ke-mo-rong.md:67-120` |
| 5 | Hoạt động: nghề, mini-game, trường, vườn, bếp, thám hiểm, hội thi, nội thất, bạn bè, nhiệm vụ | `petdex/docs/thiet-ke-mo-rong.md:122-228` |
| 6 | Hệ thống tài chính (14 tiểu mục) | `petdex/docs/thiet-ke-mo-rong.md:230-591` |
| 7 | Cân bằng kinh tế | `petdex/docs/thiet-ke-mo-rong.md:593-633` |
| 8 | Kiến trúc kỹ thuật, bảng dữ liệu, giao diện | `petdex/docs/thiet-ke-mo-rong.md:635-695` |
| 9 | Kiểm chứng bằng mô phỏng kinh tế | `petdex/docs/thiet-ke-mo-rong.md:697-724` |
| 10 | Lộ trình | `petdex/docs/thiet-ke-mo-rong.md:726-751` |
| 11 | Còn để ngỏ | `petdex/docs/thiet-ke-mo-rong.md:753-760` |
| 12 | Nhật ký triển khai | `petdex/docs/thiet-ke-mo-rong.md:762-835` |

## Vấn đề ban đầu (mục 1)
| Đã có | Vấn đề |
|---|---|
| 3 chỉ số, cửa hàng 16 món, công viên | Ít việc để làm |
| Đi làm `22 + 3·cấp` xu, tốn 30 năng lượng | Bấm liên tục được khoảng 9 lần/ngày, hơn 300 xu/ngày gần như không tốn thời gian |
| Một loại tiền, chỉ tiêu ở cửa hàng NPC | Tiền ứ đọng, mất giá |
| Bé trưởng thành sau 21 giờ | Quá nhanh |

## Quyết định đã chốt (mục 2)
- Vay nợ, đầu cơ phái sinh, thi có lệ phí gom vào chế độ **Tài chính nâng cao** (cấp 8, tự bật, server có cờ tắt hẳn). Trong code: `settings.advancedFinance`, biến `ADVANCED_FINANCE=off` (`petdex/server/settings.js:5-6`, `petdex/server/index.js:42`).
- **1 ngày thật = 1 tuần tuổi**.
- Giai đoạn 1 ưu tiên quầy trà sữa, Sàn, mini-game, bạn bè, Hội.
- Giờ quyết toán: nửa đêm giờ Việt Nam. Xem [[Quyết toán nửa đêm]].

## Nguyên tắc kỹ thuật (mục 8.1) vẫn đúng trong code
- Luật chơi là **hàm thuần** trong `server/rules/` kèm test.
- **Tính bù theo thời gian (lazy)** khi có người đọc.
- **Bộ lập lịch toàn cục** lưu mốc lần chạy cuối để chạy bù. Trên Cloudflare: alarm mỗi phút của Durable Object (`petdex/server/durable.js:19`, `petdex/server/durable.js:48-51`). Xem [[Nhịp mỗi phút]].
- **Mọi thay đổi xu đi qua `ledger.post()`** trong transaction. Xem [[Sổ cái]].
- Thứ tự quyết toán tất định theo id.

> [!info] Nhịp trên Workers
> Mục 8.1 nói giá Sàn chạy "mỗi 10 phút"; code giữ đúng nhịp này (`petdex/server/scheduler.js:1`). Trên Cloudflare, alarm của Durable Object gọi `runDue()` mỗi 60 giây để xem việc nào đến hạn (`petdex/server/durable.js:19`, `petdex/server/durable.js:48-51`); máy chủ Node dùng `setInterval` 30 giây (`petdex/server/scheduler.js:91`). Chạy bù tối đa 3 ngày (`petdex/server/scheduler.js:20`).

## Đã làm và chưa làm
| Hạng mục thiết kế | Trạng thái trong code | Ghi chú |
|---|---|---|
| Sổ cái, Ví, Sàn 10 mặt hàng, ngân hàng, NHTW | đã làm (1A) | [[Sàn Nguyên Liệu]], [[Ngân hàng Trân Châu]], [[Ngân hàng Trung ương]] |
| Nghề, ca làm, kỹ năng, mini-game, bản đồ phố | đã làm (1A) | [[Việc làm]], [[Mini-game]], [[Bản đồ Phố Trân Châu]] |
| Quầy trà sữa, bạn bè, Hội, thuế lũy tiến, bỏ phiếu, nhiệm vụ ngày | đã làm (1B) | quầy chung của Hội dời sang sau |
| Xưởng, hợp đồng cung ứng, vườn, bếp, Chợ Phiên, phòng khám, bảo hiểm, tính cách, trường, vay tín chấp | đã làm (2) | đấu giá dời sang sau |
| Bất động sản cho thuê, đấu giá đất, thế chấp, nhà NPC | **chưa làm theo bản gốc**; thay bằng Gia tộc + 200 lô đất + Sở Nhà Đất (`05840b3`) | [[Clan]], [[Bản đồ đất]] |
| Thám hiểm, hội thi tuần, nội thất | chưa làm (không có mã nào trong `petdex/server`) | |
| Hợp đồng tương lai, Sở Giao Dịch, cổ phiếu, gọi vốn | chưa làm (giai đoạn 4) | |
| Đấu giá (Chợ Phiên và đất) | chưa làm | |

Chi tiết theo thời gian ở [[Lộ trình phát triển]]; lý do từng chỗ khác thiết kế ở [[Quyết định thiết kế]].

## Cân bằng mục tiêu (mục 7)
Người chơi chăm, cấp 10, chưa có quầy: vào khoảng 500 xu/ngày, ra khoảng 230, dư khoảng 270 để giấy phép quầy Hẻm 1.500 mất khoảng 1 tuần (`petdex/docs/thiet-ke-mo-rong.md:595-613`). "Lan can chống lạm phát": giới hạn ngày cho mọi nguồn in tiền, phí và thuế (một nửa bị hủy), món tiêu tiền lớn, NHTW tự điều chỉnh, chống tài khoản phụ (`petdex/docs/thiet-ke-mo-rong.md:622-633`). Xem [[Dòng xu trong game]].

## Mô phỏng (mục 9)
Thiết kế: 300 bot, 6 kiểu chơi, 90 ngày; tiêu chí Gini < 0,6, quầy Hẻm hoàn vốn 7–14 ngày, vỡ nợ < 10%… Bản rút gọn 50 bot × 30 ngày chạy trong test (`petdex/docs/thiet-ke-mo-rong.md:697-724`). Code: `petdex/scripts/simulate-economy.js`, `petdex/test/simulation.test.js`. Xem [[Mô phỏng kinh tế]].

## Còn để ngỏ (mục 11)
Số lô đất và tốc độ mở bán, hộ thuê NPC, bỏ phiếu ngân sách (đã chốt: mỗi tài khoản có bé từ cấp 3 được 1 phiếu), không bán khống trên Sàn giao ngay (`petdex/docs/thiet-ke-mo-rong.md:753-760`).

> [!warning] Lệch tài liệu: đường dẫn
> Tài liệu dùng đường dẫn của repo Petdex gốc (`server/rules/`, `public/js/...`). Trong repo này là `petdex/server/rules/` và `public/ta-tua/game/js/...`.

## Liên quan
- [[Lộ trình phát triển]]
- [[Quyết định thiết kế]]
- [[Thiết kế pet ngũ hành]]
- [[Tài liệu API giai đoạn 2]]
- [[MOC Thiết kế]]
