---
tags: [petfarm, giao-dien, man-hinh, tin-dung, vay]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/credit.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Tín dụng

> [!summary]
> "💳 Tín dụng" (`#credit`): không có tòa riêng, mở từ [[Màn Ngân hàng]] ("Xem điểm tín dụng") hoặc [[Màn Hợp đồng]]. Hiện điểm tín dụng trên thang có kim chỉ và các dải hạng màu, tiến độ lên hạng, form vay trả góp có xem trước lịch trả, các khoản vay đang mở với kỳ tối nay và form trả nợ, lịch sử thay đổi điểm, bảng luật điểm và bảng hạng. Luật ở [[Điểm tín dụng]] và [[Tín dụng và vay]].

## Các khối (thứ tự trên màn)

| Khối | Nội dung | Nguồn |
|---|---|---|
| 📊 Điểm tín dụng | số lớn, huy hiệu "{icon} Hạng X" tô màu theo `TIER_COLORS` (bronze `#e0a77f`, silver `#c3c8d4`, gold `#f4c24f`, diamond `#8fd0e6`); thước `credit-gauge` với dải hạng và kim `credit-needle`; "Còn **n điểm** nữa lên hạng …" + thanh, hoặc "🏆 Bạn đang ở hạng cao nhất. Giữ vững phong độ nhé!"; 4 ô Hạn mức hạng, Phụ phí lãi/ngày, Còn vay được, Lãi nếu vay hôm nay | `public/ta-tua/game/js/views/credit.js:9`, `credit.js:48-91` |
| 🏦 Vay trả góp | bị chặn: lý do `c.blocked`, "⛔ Bị cấm vay thêm … nữa", khối bật Tài chính nâng cao; hạn mức dưới tối thiểu: lời khuyên tăng thu nhập/tiết kiệm/hạng; bình thường: form (xem dưới) | `credit.js:159-191` |
| 📒 Khoản vay của bạn | thẻ từng khoản (xem dưới) và "Đã tất toán"; ẩn khi chưa từng vay | `credit.js:193-233` |
| 🕑 Thay đổi gần đây | `±n` lý do, thời gian; rỗng: "Chưa có thay đổi nào…" | `credit.js:124-131` |
| ⚖️ Điểm lên xuống vì đâu? | 7 dòng lấy từ `catalog.credit`: contractDay, onTime, repaid, late, contractBroken, evicted, defaulted; "Ai cũng bắt đầu từ start điểm, thang min–max"; nút "📜 Xem hợp đồng của bạn" | `credit.js:106-122` |
| 🪜 Các hạng | tên, "từ n điểm", hạn mức, "lãi +x%/ngày"; công thức "Hạn mức thực tế = min(hạn mức hạng, 3 × thu nhập bình quân 7 ngày + 50% tiền tiết kiệm) − dư nợ đang có." | `credit.js:93-104` |
| ❓ Vay và trả thế nào? | kỳ hạn, phí giải ngân, tuổi tài khoản tối thiểu, trừ kỳ mỗi tối (ví trước rồi tiết kiệm), điểm cộng trừ, phí trễ, vỡ nợ (cấm vay `banDays` ngày, giữ `garnish` thu nhập), trả trước không mất lãi ngày đó | `credit.js:235-247` |

> [!warning] Chữ cố định
> Công thức hạn mức "3 × thu nhập bình quân 7 ngày + 50% tiền tiết kiệm" là chữ viết cứng (`credit.js:102`), không đọc từ cấu hình. Đối chiếu số thật ở [[Tín dụng và vay]] và [[Module credit]].

## Bật Tài chính nâng cao

Chỉ hiện khi chưa bật: máy chủ tắt thì "Máy chủ này đã tắt chế độ Tài chính nâng cao."; thiếu cấp thì "Cần một bé đạt cấp n…"; còn lại là nút "🎓 Bật Tài chính nâng cao" với `confirm` cảnh báo phạt phí, mất điểm và bị giữ thu nhập, rồi `POST /settings {advancedFinance: true}` (`credit.js:133-141`, `credit.js:296-299`). Công tắc tương tự ở [[Màn Ví]].

## Form vay

- Ô số tiền `minLoan`–`limit`, chip "25% · n", "50% · n" (chỉ khi ≥ tối thiểu, < hạn mức và không trùng) và "Tối đa · n"; nút kỳ hạn `c.terms` ("n ngày · n kỳ góp"); kỳ mặc định 7, nếu không có thì kỳ thứ hai trong danh sách (`credit.js:6`, `credit.js:168-185`, `credit.js:266`).
- Xem trước (`previewHtml`): phí giải ngân, nhận vào ví, lãi/ngày trên dư nợ, kỳ đầu (nửa đêm nay), tổng lãi nếu trả đúng hạn, tổng phải trả (`credit.js:143-157`).
- `plan(amount, term, rate, fee)` mô phỏng: mỗi kỳ lãi `ceil(dư nợ × rate)` + gốc `ceil(amount/term)` (kỳ cuối trả hết), phí `ceil(amount × fee)` (`credit.js:12-25`).
- Gửi: `confirm` nhiều dòng (phí, nhận vào ví, kỳ đầu, tổng lãi, phạt trễ) rồi `POST /credit/borrow {amount, term}` (`credit.js:316-323`).

## Thẻ khoản vay

Huy hiệu "Đang trả" / "Trễ n kỳ" / "Vỡ nợ"; thanh gốc đã trả; "đáo hạn sau …" hoặc "đã tới hạn, phải trả hết gốc"; 3 ô Dư nợ gốc, Lãi & phí còn nợ, Trả hết ngay; "🌙 Kỳ tối nay: n 🪙 (nợ cũ + lãi + gốc)" kèm cảnh báo khi ví không đủ; cảnh báo trễ và vỡ nợ; form trả nợ với chip "Trả hết · payoff" → `POST /credit/loans/:id/repay {amount}` (`credit.js:193-222`, `credit.js:324-327`). Số đang gõ lưu ở `repayDrafts`.

## API và làm mới

`GET /credit` một lần; đồng hồ 1 giây cho đếm ngược; không poll (`credit.js:262-268`, `credit.js:330-339`).

## Liên quan
- [[Điểm tín dụng]], [[Tín dụng và vay]], [[Ngân hàng Trân Châu]], [[Hợp đồng cung ứng]]
- [[Màn Ngân hàng]], [[Màn Hợp đồng]], [[Màn Ví]], [[Module credit]]
