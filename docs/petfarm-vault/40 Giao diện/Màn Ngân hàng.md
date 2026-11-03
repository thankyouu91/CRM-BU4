---
tags: [petfarm, giao-dien, man-hinh, ngan-hang]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/bank.js, public/ta-tua/game/js/charts.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Ngân hàng

> [!summary]
> Màn `#bank` (tòa 🏦, cần bé cấp `unlocks.bank` = 3): tiết kiệm không kỳ hạn, gửi kỳ hạn, bảng của [[Ngân hàng Trung ương]] có 2 biểu đồ đường (chỉ số giá, lãi suất cơ bản) và lối sang [[Màn Tín dụng]]. Luật ở [[Ngân hàng Trân Châu]].

## Khóa cấp

Nếu `bestLevel() < unlocks.bank` thì chỉ hiện "🔒 Ngân hàng chưa mở · Có một bé đạt cấp n là mở tài khoản được." và không gọi API (`public/ta-tua/game/js/views/bank.js:12-17`). Máy chủ chặn thêm ở `petdex/server/routes-economy.js:93,102`.

## Bốn khối

| Khối | Nội dung và nút | API | Nguồn |
|---|---|---|---|
| 🐷 Tiết kiệm không kỳ hạn | số dư `savings`; "Lãi đang chạy +x 🪙, cộng vào lúc nửa đêm. Lãi suất r%/ngày trên tối đa {cap} 🪙."; form số xu với 2 nút "Gửi vào" / "Rút ra"; chip "Gửi tất cả trừ 200" (điền `coins − 200`), "Rút hết" | `POST /bank/savings {action: 'deposit'|'withdraw', amount}` | `bank.js:24-38`, `bank.js:113` |
| 📜 Gửi kỳ hạn | nút chọn kỳ (`b.terms`): "n ngày · r%/ngày · cả kỳ R%"; form "Tối thiểu {minDeposit} xu" + "Gửi n ngày"; "Lãi chốt lúc gửi… Rút trước hạn chỉ nhận lại gốc."; danh sách sổ kỳ hạn có thanh tiến độ, "Đáo hạn sau …" hoặc "Đã đáo hạn", nút "Nhận tiền" (vàng) / "Rút sớm" (hỏi `confirm('Rút trước hạn sẽ mất toàn bộ tiền lãi. Vẫn rút?')`) | `POST /bank/deposits {amount, term}`, `POST /bank/deposits/:id/close` | `bank.js:40-63`, `bank.js:104-107`, `bank.js:114` |
| 🏛️ Ngân hàng Trung ương | "Phiên họp {tuần}: lượng xu bình quân mỗi người chơi n, tăng x%/tuần (mục tiêu +10%)"; 3 ô Chỉ số giá, Lãi suất cơ bản, Người chơi hoạt động; khi có từ 2 phiên trở lên thì 2 `lineChart` cao 110 px (chỉ số giá 3 chữ số thập phân; lãi suất màu `#58b9d6`); chưa họp: "Ngân hàng Trung ương họp lần đầu vào nửa đêm Chủ nhật này." | | `bank.js:65-78`, `bank.js:89-92` |
| 💳 Tín dụng & vay trả góp | lời giải thích điểm tín dụng; trạng thái Tài chính nâng cao (cần `unlocks.advanced` = 8); nút "Xem điểm tín dụng" → [[Màn Tín dụng]] | | `bank.js:80-87` |

Kỳ hạn đang chọn giữ ở biến module `term` (mặc định 7) và đổi kỳ thì `ctx.refresh()` vẽ lại cả màn (`bank.js:6`, `bank.js:98-100`). Số tối thiểu gửi kỳ hạn hiện là 100 xu (`petdex/server/rules/bank.js:8`).

> [!info] Chữ "mục tiêu +10%" là chữ cố định
> Mục tiêu tăng trưởng 10%/tuần được viết cứng trong giao diện (`bank.js:69`). Con số thật mà Ngân hàng Trung ương nhắm tới nằm ở luật máy chủ, xem [[Ngân hàng Trung ương]] và [[Kinh tế vĩ mô]].

## Liên quan
- [[Ngân hàng Trân Châu]], [[Ngân hàng Trung ương]], [[Chỉ số giá]], [[Tín dụng và vay]], [[Điểm tín dụng]]
- [[Màn Ví]], [[Màn Tín dụng]], [[Biểu đồ]], [[Màn Phố]] (huy hiệu "Kỳ hạn đến hạn!")
