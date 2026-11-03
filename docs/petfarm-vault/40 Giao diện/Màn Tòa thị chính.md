---
tags: [petfarm, giao-dien, man-hinh, toa-thi-chinh, thue]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/townhall.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Tòa thị chính

> [!summary]
> Màn ngân sách công (`#townhall`, tòa 🏛️, khóa ở bản đồ tới `unlocks.townhall` = 3): số dư ngân sách thị trấn và dòng thu chi 7 ngày, bỏ phiếu đề xuất chi tiêu tuần, hiệu ứng đang chạy, lịch sử các tuần và bảng thuế thu nhập kèm sao kê thuế của chính người chơi. Luật ở [[Tòa thị chính]], [[Ngân sách thị trấn]], [[Thuế thu nhập]].

## Bốn khối

| Khối | Nội dung | Nguồn |
|---|---|---|
| 💰 Ngân sách thị trấn | số lớn `treasury`; danh sách `flows` chỉ gồm các khóa có trong `FLOW_LABELS`: Phí giao dịch, Thuế, Quỹ khởi tạo (thu, xanh), Trợ cấp tân thủ, Đề xuất được duyệt, Thưởng dự án Hội (chi, đỏ); rỗng: "Chưa có thu chi trong 7 ngày."; ghi chú "Trợ cấp tân thủ hiện là {stipend.amount} 🪙/ngày trong {stipend.days} ngày đầu." | `public/ta-tua/game/js/views/townhall.js:5-8`, `townhall.js:23-29` |
| 🗳️ Bỏ phiếu tuần này | huy hiệu "Chốt sau {countdown}"; thẻ đề xuất: icon, tên, mô tả, "Chi phí n 🪙" (+ "ngân sách chưa đủ" nếu thiếu), số phiếu, nút "Bầu" hoặc "✓ Bạn đã bầu"; ghi chú "Đổi ý được trước khi chốt…" hoặc "🔒 Có một bé cấp n là được bỏ phiếu." | `townhall.js:31-47` |
| ✨ Đang có hiệu lực | các `effects` với "còn {countdown}"; rỗng: "Chưa có. Bỏ phiếu để thay đổi thị trấn!"; "Các tuần trước": "MM-DD · tên" + "đã làm" / "thiếu tiền" | `townhall.js:49-56` |
| 🧾 Thuế thu nhập | bảng bậc thuế từ `catalog.town.brackets` ("a – b" hoặc "a – trở lên"), thuế suất trừ `taxCut` và ghi "(đang giảm)"; giải thích chịu thuế (lương, lãi ngân hàng, lợi nhuận quầy) và không chịu thuế (quà, nhiệm vụ, mini-game), "Thuế trừ vào ví lúc nửa đêm"; nợ thuế `taxDue`; bảng theo ngày: Lương, Lãi, Quầy, Chịu thuế, Thuế | `townhall.js:58-75` |

## Tương tác

| Hành động | API | Ghi chú |
|---|---|---|
| Mở màn | `GET /town` | `townhall.js:84` |
| Bầu | `POST /town/vote {option}` | nút khóa nếu `bestLevel() < unlocks.townhall` (`townhall.js:16`, `townhall.js:79-82`); máy chủ cũng chặn bằng `requireLevel` ở `petdex/server/routes-community.js:45` |

> [!warning] Lệch tài liệu
> Bảng thuế ở màn chỉ ghi "Lương, Lãi, Quầy". Nếu máy chủ đã thêm [[Thuế doanh nghiệp]] hay nguồn thu chịu thuế khác (xưởng, Chợ Phiên), cột tương ứng chưa có trên giao diện (`townhall.js:71-73` chỉ đọc `parts.salary`, `parts.interest`, `parts.business`). Cần đối chiếu với [[Thuế thu nhập]].

## Liên quan
- [[Tòa thị chính]], [[Ngân sách thị trấn]], [[Thuế thu nhập]], [[Thuế doanh nghiệp]], [[Hội]]
- [[Màn Phố]], [[Màn Ví]], [[App shell]]
