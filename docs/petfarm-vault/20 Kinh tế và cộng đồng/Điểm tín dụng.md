---
tags: [petfarm, kinh-te, tin-dung, diem-tin-dung]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/credit.js, petdex/server/rules/production.js, petdex/server/contracts.js, petdex/server/business.js, petdex/server/factory.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Credit score, Điểm uy tín tài chính]
---
# Điểm tín dụng

> [!summary]
> Mọi người chơi có điểm tín dụng 300–850 (bắt đầu 500, hạng Đồng), kể cả khi chưa bật vay. Điểm lên khi giữ lời hứa (trả góp đúng hạn, giao đủ hợp đồng) và xuống khi trễ nợ, phá hợp đồng, bị đóng quầy/xưởng vì nợ thuê. Hạng quyết định hạn mức và phụ phí lãi ở [[Tín dụng và vay]].

## Thay đổi điểm (`CREDIT`, `petdex/server/rules/production.js:182`)

| Sự kiện | Điểm | Nơi gọi |
|---|---|---|
| Trả góp đúng hạn (mỗi kỳ) | +5 | `petdex/server/credit.js:212` |
| Tất toán khoản vay (không từng vỡ nợ) | +30 | `petdex/server/credit.js:179` |
| Trễ một kỳ | −20 | `petdex/server/credit.js:219` |
| Vỡ nợ | −100 (cộng với −20 của kỳ trễ thứ 7) | `petdex/server/credit.js:222` |
| Mỗi đêm giao/nhận đủ [[Hợp đồng cung ứng]] | +3 mỗi bên | `petdex/server/contracts.js:186-189` |
| Phá hợp đồng | −30 | `petdex/server/contracts.js:126` |
| Quầy hoặc xưởng bị đóng vì nợ thuê 3 đêm | −40 | `petdex/server/business.js:340`, `petdex/server/factory.js:312` |

Điểm kẹp 300–850 (`clampCredit`); mỗi thay đổi ghi `credit_events` (12 dòng gần nhất hiện trên màn) (`petdex/server/credit.js:31-39`).

## Hạng (`TIERS`, `petdex/server/rules/production.js:183-188`)

| Hạng | Điểm | Hạn mức | Phụ phí lãi/ngày |
|---|---|---|---|
| 🥉 [[Hạng tín dụng Đồng]] | 300–549 | 500 | 1,5% |
| 🥈 [[Hạng tín dụng Bạc]] | 550–649 | 2.000 | 1% |
| 🥇 [[Hạng tín dụng Vàng]] | 650–749 | 8.000 | 0,6% |
| 💎 [[Hạng tín dụng Kim cương]] | 750–850 | 25.000 | 0,3% |

> [!tip] Lên Bạc nhanh nhất
> Từ 500 cần +50: ví dụ 17 đêm giao đủ hợp đồng (+3/đêm), hoặc một khoản vay 7 ngày trả đúng hạn (7 × 5 + 30 = +65).

## Liên quan
- [[Tín dụng và vay]] · [[Hợp đồng cung ứng]] · [[Quầy trà sữa]] · [[Khu công nghiệp]] · [[Module credit]] · [[MOC Kinh tế và cộng đồng]]
