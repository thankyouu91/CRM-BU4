---
tags: [petfarm, kinh-te, ngan-hang-trung-uong, chinh-sach-tien-te]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/bank.js, petdex/server/rules/bank.js, petdex/server/scheduler.js, petdex/server/credit.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [NHTW, Central bank]
---
# Ngân hàng Trung ương

> [!summary]
> "Bộ điều nhiệt" chống lạm phát của game. Mỗi tuần (nửa đêm cuối Chủ nhật) đo **lượng xu bình quân mỗi người chơi hoạt động**, so với tuần trước: tăng nhanh hơn mục tiêu 10%/tuần thì nâng [[Chỉ số giá]] (giá NPC đắt hơn, hút xu) và hạ lãi suất cơ bản (bớt in xu qua lãi); tăng chậm hoặc co lại thì làm ngược lại. Kết quả đăng thành tin và hiện lịch sử 12 tuần ở [[Màn Ngân hàng]].

## Cách hoạt động
1. `closeDay` của ngày Chủ nhật gọi `centralBankWeek(day, end)` (`petdex/server/scheduler.js:43-46`).
2. Đếm người chơi hoạt động = số `user_id` khác nhau có dòng sổ cái trong 7 ngày (tối thiểu 1) (`petdex/server/bank.js:30,152`).
3. Lượng xu = ví + tiết kiệm + kỳ hạn mở + ký quỹ lệnh mua + lương ca thuê chưa nhận + mọi tài khoản chung trừ ngân sách thị trấn (`petdex/server/bank.js:23-29`). Xem [[Dòng xu trong game]].
4. `growth = (xu/người tuần này − tuần trước) / tuần trước`; phiên đầu tiên chưa có số liệu thì coi như đúng mục tiêu 10% (giữ nguyên chính sách) (`petdex/server/bank.js:154-158`).
5. `policy` tính chỉ số giá và lãi mới, ghi bảng `central_bank` theo khóa tuần là ngày Chủ nhật đó (`petdex/server/bank.js:159-160`).
6. Đăng tin "Ngân hàng Trung ương: lượng xu tăng X%/tuần, lãi suất cơ bản Y%/ngày, chỉ số giá Z" hiệu lực 7 ngày (`petdex/server/bank.js:161-165`).

## Công thức (`policy`, `petdex/server/rules/bank.js:31-37`)
```
gap        = growth − 0,10
priceIndex = priceIndex_cũ × (1 + 0,3 × clamp(gap, −0,05, +0,15))
baseRate   = clamp(0,003 − gap / 20, 0,0005, 0,005)
```

| Tăng trưởng tuần | gap | Chỉ số giá đổi | Lãi cơ bản mới |
|---|---|---|---|
| 0% hoặc co lại | ≤ −0,10 | −1,5% (chặn ở gap −0,05) | 0,5% (trần) |
| 5% | −0,05 | −1,5% | 0,003 + 0,0025 = 0,55% → chặn 0,5% |
| 6% | −0,04 | −1,2% | 0,5% |
| 8% | −0,02 | −0,6% | 0,4% |
| 10% (mục tiêu) | 0 | 0% | 0,3% |
| 12% | +0,02 | +0,6% | 0,2% |
| 14% | +0,04 | +1,2% | 0,1% |
| 15% | +0,05 | +1,5% | 0,05% (sàn) |
| 25% trở lên | ≥ +0,15 | +4,5% (trần) | 0,05% (sàn) |

Như vậy lãi cơ bản rất nhạy: chỉ cần tăng trưởng lệch mục tiêu ±5 điểm % là đã chạm trần hoặc sàn, còn chỉ số giá phản ứng chậm hơn (tối đa +4,5% hoặc −1,5% mỗi tuần, lệch về phía chống lạm phát).

> [!info] Lãi suất không "trôi" từ tuần trước
> Lãi cơ bản mỗi tuần tính lại tuyệt đối từ mức trung tính 0,3% theo `gap`, không cộng dồn; chỉ **chỉ số giá** là cộng dồn qua các tuần.

## Ảnh hưởng tới các hệ thống khác
- [[Chỉ số giá]] nhân vào gần như mọi giá NPC.
- Lãi tiết kiệm, lãi kỳ hạn mới gửi ([[Ngân hàng Trân Châu]]), lãi vay ([[Tín dụng và vay]]): khoản vay mới còn cộng **phụ phí lạm phát** `max(0, growth − 0,1) / 7` mỗi ngày (`petdex/server/rules/production.js:195`, `petdex/server/credit.js:61-68`).
- [[Kinh tế vĩ mô]]: lãi cơ bản cao hơn 0,3% kéo chỉ số giá đất xuống `(lãi − 0,003) × 2` mỗi ngày (`petdex/server/macro.js:67`).

## Trường hợp đặc biệt
- Chưa có phiên họp nào: `economy()` trả chỉ số 1, lãi 0,3%, growth 10% (`petdex/server/bank.js:34-37`).
- Mẫu số là người **có dòng sổ cái** trong 7 ngày; người chỉ đăng nhập mà không phát sinh xu không được đếm.
- Quỹ gia tộc rất lớn (mua đất hàng trăm nghìn xu) nằm trong lượng xu: một gia tộc tích quỹ có thể đẩy `growth`, còn mua đất (hủy 80%) kéo `growth` xuống.

## Liên quan
- [[Chỉ số giá]] · [[Ngân hàng Trân Châu]] · [[Dòng xu trong game]] · [[Mô phỏng kinh tế]] · [[Quyết toán nửa đêm]] · [[Module bank]] · [[MOC Kinh tế và cộng đồng]]
