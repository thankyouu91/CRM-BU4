---
tags: [petfarm, kinh-te, tin-dung, vay]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/credit.js, petdex/server/rules/production.js, petdex/server/routes-production.js, petdex/server/routes-economy.js, petdex/server/settings.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [💳 Tín dụng, Vay, Loans]
---
# Tín dụng và vay

> [!summary]
> Vay trả góp theo ngày ở ngân hàng, chỉ trong chế độ **Tài chính nâng cao** (bé cấp 8, máy chủ bật `advancedFinance`). Hạn mức theo hạng [[Điểm tín dụng]] và thu nhập; lãi = lãi cơ bản + phụ phí hạng + phụ phí lạm phát; mỗi nửa đêm tự trừ một kỳ (lấy cả tiết kiệm). Trễ 7 kỳ liền là vỡ nợ: −100 điểm, cấm vay 14 ngày, ngân hàng giữ 30% thu nhập mỗi ngày. Giải ngân tạo xu mới, trả gốc hủy xu.

## Điều kiện vay (`blockedReason`, `petdex/server/credit.js:49-56`)
| Điều kiện | Thông báo khi thiếu |
|---|---|
| Bật Tài chính nâng cao (`users.advanced`) | "Bật chế độ tài chính nâng cao (cấp 8) để vay." |
| Tài khoản ≥ 3 ngày tuổi | "Tài khoản cần đủ 3 ngày tuổi mới được vay." |
| Không bị cấm vay | "Bạn đang bị cấm vay vì từng vỡ nợ." |
| Không có khoản trễ/vỡ nợ | "Trả hết khoản đang trễ hạn đã." |
| Ít hơn 2 khoản đang mở | "Mỗi lúc chỉ có tối đa 2 khoản vay." |

Bật chế độ: `POST /settings { advancedFinance: true }`, cần bé cấp 8 và máy chủ cho phép, nếu không: "Máy chủ này đã tắt chế độ Tài chính nâng cao." (`petdex/server/routes-economy.js:137-147`, `petdex/server/routes-production.js:150-153`).

## Con số (`LOANS`, `petdex/server/rules/production.js:189`)
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Khoản vay tối thiểu | 50 xu | `petdex/server/credit.js:9,106` |
| Kỳ hạn | 3, 7, 14 ngày | `petdex/server/rules/production.js:189` |
| Phí giải ngân | 2% (làm tròn lên), trừ ngay sau khi giải ngân | `petdex/server/credit.js:114` |
| Phí trễ | 1% × (dư nợ gốc + phí còn nợ), mỗi kỳ trễ | `petdex/server/credit.js:216` |
| Vỡ nợ sau | 7 kỳ trễ liền | `petdex/server/credit.js:220` |
| Cấm vay sau vỡ nợ | 14 ngày | `petdex/server/credit.js:223` |
| Ngân hàng giữ thu nhập khi vỡ nợ | 30% thu nhập (nhóm `income`) của ngày | `petdex/server/credit.js:198-203` |

## Công thức
- **Lãi/ngày** (chốt lúc vay): `lãi cơ bản + phụ phí hạng + max(0, growth − 0,1) / 7` (`loanRate`, `petdex/server/rules/production.js:195`). Với lãi cơ bản 0,3%: Đồng 1,8%, Bạc 1,3%, Vàng 0,9%, Kim cương 0,6% mỗi ngày.
- **Hạn mức**: `floor(min(hạn mức hạng, 3 × thu nhập TB 7 ngày + 50% tiết kiệm) − dư nợ)`; thu nhập = các dòng nhóm `income` vào ví trong 7 ngày / 7 (`petdex/server/rules/production.js:198-200`, `petdex/server/credit.js:42-44,58-69`).
- **Kỳ trả góp** (`installment`, `petdex/server/rules/production.js:206-210`): `lãi = ceil(dư nợ × lãi)`, `gốc = ceil(gốc ban đầu / số ngày)` (hoặc toàn bộ dư nợ nếu đã quá hạn), cộng phí và lãi còn nợ kỳ trước.

> [!example] Vay 1.000 xu, 7 ngày, hạng Bạc, lãi cơ bản 0,3%
> Nhận 1.000, trả ngay phí 20. Lãi 1,3%/ngày, gốc mỗi kỳ ceil(1.000/7) = 143. Kỳ đầu trừ ngay nửa đêm hôm vay: lãi 13 + gốc 143 = 156. Các kỳ sau lãi 12, 10, 8, 6, 4, 2 trên dư nợ giảm dần; kỳ 7 trả nốt 142 gốc. Tổng lãi 55 xu cộng phí 20 = 75 xu chi phí vay.

## Quyết toán nửa đêm (`settleLoansDay`, `petdex/server/credit.js:192-228`)
1. Khoản `defaulted`: lấy 30% thu nhập trong ngày, trả phí/lãi rồi gốc; không cộng lãi mới.
2. Khoản khác: tính kỳ; trả từ **ví rồi tiết kiệm**: phí và lãi trước (50% vào ngân sách), rồi gốc (hủy).
3. Trả đủ: +5 điểm, khoản `late` trở lại `active`. Thiếu: phần thiếu thành `fees` + phí trễ 1%, −20 điểm, `late_days + 1`; đủ 7 → `defaulted`, −100 điểm, cấm vay 14 ngày.
4. Hết nợ (gốc và phí bằng 0): `repaid`, +30 điểm nếu chưa từng vỡ nợ (`finish`, `petdex/server/credit.js:176-186`).

## Trả trước
`POST /credit/loans/:id/repay { amount }`: chỉ từ ví (phải đủ), trả phí/lãi còn nợ rồi gốc, **không tính lãi ngày hôm đó**; trả hết phí của khoản trễ thì về `active` (`petdex/server/credit.js:158-173`).

## Trường hợp đặc biệt
- Dư nợ trừ vào [[Ví và tài sản ròng]] (`debt`) (`petdex/server/credit.js:231`, `petdex/server/wallet.js:35`).
- Khoản mở trong ngày cũng bị tính kỳ đầu ngay nửa đêm đó (`opened_at < end`, `petdex/server/credit.js:17,197`).
- Ngân hàng chỉ giữ 30% thu nhập khi đã vỡ nợ; trước đó chỉ trừ tới hết ví và tiết kiệm.

## Liên quan
- [[Điểm tín dụng]] · [[Hạng tín dụng Đồng]] · [[Hạng tín dụng Bạc]] · [[Hạng tín dụng Vàng]] · [[Hạng tín dụng Kim cương]] · [[Ngân hàng Trân Châu]] · [[Ngân hàng Trung ương]] · [[Module credit]] · [[MOC Kinh tế và cộng đồng]]
