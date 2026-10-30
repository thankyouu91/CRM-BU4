---
tags: [petfarm, giao-dien, man-hinh, hop-dong]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/contracts.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Hợp đồng

> [!summary]
> "📜 Hợp đồng cung ứng" (`#contracts`): không có tòa riêng trên bản đồ, mở từ [[Màn Sàn]], [[Màn Khu công nghiệp]] hoặc nút điều hướng trong màn. Người chơi xem tổng quan, nhận/từ chối lời mời, theo dõi hợp đồng đang chạy (đêm nay đủ hàng/đủ tiền chưa), phá hợp đồng, và soạn đề xuất mới có xem trước ký quỹ. Luật ở [[Hợp đồng cung ứng]].

## Khóa cấp

Màn luôn mở xem được. Khi `bestLevel() < unlocks.contracts` (= 6) thì form đề xuất thay bằng "🔒 Có một bé đạt cấp n là gửi và nhận hợp đồng được." và nút "🤝 Nhận" bị khóa (tooltip "Cần bé cấp n") (`public/ta-tua/game/js/views/contracts.js:33`, `contracts.js:119`, `contracts.js:225-227`). Máy chủ: `petdex/server/routes-production.js:117,128`.

## Bố cục

| Khối | Nội dung | Nguồn |
|---|---|---|
| Đầu màn | nút "🏭 Xưởng", "📈 Sàn", "💳 Tín dụng" | `contracts.js:24-29` |
| Tổng quan | 4 ô Đang chạy, Lời mời đến (xanh nếu có), Đang mở `n/maxOpen`, Bạn đang ký quỹ | `contracts.js:292-299` |
| 📨 Lời mời gửi tới bạn | "{đối tác} muốn mua của bạn / bán cho bạn n lô mỗi đêm trong d ngày"; điều khoản; "Nhận thì bạn ký quỹ ngay n" (đỏ nếu thiếu xu); ký quỹ đối tác; kho của bạn (bên bán) hoặc "Mỗi đêm trả n 🪙 (ví trước, thiếu thì trừ ký quỹ)" (bên mua); "Hết hạn sau …"; nút "Từ chối", "🤝 Nhận" | `contracts.js:100-123` |
| 🤝 Đang chạy | điều khoản; "Ngày a/d · đã giao x/y lô", "Lượt giao tới sau …" (đếm tới nửa đêm giờ VN); 2 dòng ký quỹ; dự báo đêm nay; link "Phá hợp đồng". Rỗng: "Chưa có hợp đồng nào đang chạy. Gửi đề xuất cho một người trồng, chủ xưởng hay đầu bếp…" | `contracts.js:139-171`, `contracts.js:303-304` |
| 📤 Đề xuất bạn đã gửi | ký quỹ đã giữ, "chờ X trả lời · hết hạn sau …" hoặc "đề xuất đã hết hạn, ký quỹ tự hoàn lúc nửa đêm (hoặc rút lại ngay)", nút "Rút lại" | `contracts.js:125-136` |
| 🗂️ Gần đây | các hợp đồng đã kết thúc với huy hiệu trạng thái | `contracts.js:173-181` |
| ✍️ Đề xuất hợp đồng mới | form (xem dưới) | `contracts.js:224-261` |
| ❓ Hợp đồng hoạt động thế nào? | `<details>` nhớ trạng thái: giao hàng mỗi nửa đêm theo giá chốt, ký quỹ (bên mua 1 đêm tiền hàng, bên bán `sellerEscrow` tổng giá trị), giao thiếu, +`contractDay` điểm tín dụng mỗi ngày đủ, phá thì bồi thường `breakShare` phần còn lại và mất `contractBroken` điểm, tối đa `maxOpen` hợp đồng mở | `contracts.js:263-277` |

### Huy hiệu trạng thái

| `status` | Chữ |
|---|---|
| proposed | Chờ trả lời |
| active | Đang chạy |
| done | Hoàn thành |
| broken | Bạn đã phá / Đối tác phá |
| cancelled | Bạn rút lại / Đối tác rút lại |
| rejected | Bị từ chối / Bạn từ chối |
| expired | Hết hạn |

Nguồn `contracts.js:67-79`.

### Dự báo đêm nay (`tonight`)

| Vai | Trường hợp | Chữ |
|---|---|---|
| Bán | kho đủ | "✅ Kho đủ hàng cho đêm nay: có x lô, cần n lô." |
| Bán | thiếu | "⚠️ Kho chỉ có x lô, đêm nay thiếu ~m lô → bồi thường ≈ p 🪙…", `p = round(m × (max(0, giá Sàn − giá HĐ) + giá HĐ × shortfallExtra))` |
| Mua | ví đủ | "✅ Ví đủ trả đêm nay (n 🪙)." |
| Mua | ví + ký quỹ đủ | "Ví đang thiếu, đêm nay sẽ trừ vào ký quỹ…" |
| Mua | không đủ | "⚠️ Ví và ký quỹ không đủ trả đêm nay…: hợp đồng sẽ bị tính là bạn phá." |

Nguồn `contracts.js:139-152`.

## Form đề xuất

- Ô Đối tác có `<datalist>` gợi ý tên bạn bè (lấy từ `GET /friends`); nút "Tôi bán" / "Tôi mua"; chọn mặt hàng (kèm giá Sàn/lô); Lô mỗi đêm (1–`maxLots`); Số ngày (`days[0]`–`days[1]`); Giá mỗi lô trong biên `band` × giá Sàn; chip "Giá Sàn", "−10%", "+10%"; "Đề xuất hết hạn sau `proposalHours` giờ" (`contracts.js:231-260`).
- Xem trước cập nhật mỗi lần gõ: lỗi kiểm tra (lô, giá, ngày), "Mỗi đêm a × b = c", cả hợp đồng, "Bạn ký quỹ ngay" (đỏ nếu thiếu), kho đủ bao nhiêu đêm (bên bán) hoặc tiền cần sẵn mỗi đêm (bên mua), so sánh với giá Sàn "có lợi cho bạn" / "rẻ hơn bán ở Sàn" / "đắt hơn mua ở Sàn" (`contracts.js:183-222`).
- Công thức ký quỹ ở client: bán `round(lots × price × days × sellerEscrow)`, mua `lots × price` (`contracts.js:48`). Bồi thường khi phá: `min(myEscrow, round(daysLeft × lots × price × breakShare))` (`contracts.js:46`).
- Nháp form là biến module `form`, giữ qua các lần vẽ; gửi xong chỉ xóa ô đối tác. Đổi mặt hàng thì giá nhảy về giá Sàn của mặt hàng đó (`contracts.js:6`, `contracts.js:365-375`).

## API

| Hành động | API | Xác nhận | Nguồn |
|---|---|---|---|
| Tải | `GET /contracts` + `GET /friends` | | `contracts.js:321` |
| Gửi đề xuất | `POST /contracts {counterpart, role, commodity, lots, price, days}` | | `contracts.js:380-387` |
| Nhận | `POST /contracts/:id/accept` | "Nhận hợp đồng #id với X? Bạn ký quỹ n 🪙 ngay. Lượt giao đầu tiên vào nửa đêm nay. Phá giữa chừng sẽ mất bồi thường và k điểm tín dụng." | `contracts.js:346-351` |
| Từ chối / Rút lại | `POST /contracts/:id/decline` (cùng một API) | | `contracts.js:352-355` |
| Phá | `POST /contracts/:id/break` | liệt kê bồi thường, ký quỹ còn lại, điểm tín dụng bị trừ | `contracts.js:356-361` |

Làm mới: đồng hồ 1 giây cho các đếm ngược, poll 60 giây khi tab hiện và không gõ trong ô nhập (`contracts.js:390-398`). Quy tắc lấy từ `catalog.contracts` rồi ghi đè bằng `d.rules` của máy chủ (`contracts.js:324`).

> [!warning] Lệch quy ước chữ
> Hai câu trong khối trợ giúp dùng dấu gạch dài trong chữ hiển thị (`contracts.js:267`). Đây là chữ của game, không phải lỗi luật.

## Liên quan
- [[Hợp đồng cung ứng]], [[Điểm tín dụng]], [[Kho Sàn]], [[Sàn Nguyên Liệu]]
- [[Màn Sàn]], [[Màn Khu công nghiệp]], [[Màn Tín dụng]], [[Màn Bạn bè]]
