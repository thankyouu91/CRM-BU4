---
tags: [petfarm, kinh-te, ngan-hang, tiet-kiem]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/bank.js, petdex/server/rules/bank.js, petdex/server/routes-economy.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Ngân hàng, 🏦 Ngân hàng Trân Châu, Bank]
---
# Ngân hàng Trân Châu

> [!summary]
> Ngân hàng của người chơi (mở ở cấp 3): **tiết kiệm không kỳ hạn** có lãi tính theo giờ trên 10.000 xu đầu, cộng phần nguyên mỗi nửa đêm, và **gửi kỳ hạn 3/7/14 ngày** chốt lãi lúc gửi. Lãi là một nguồn tạo xu nên [[Ngân hàng Trung ương]] chỉnh lãi suất cơ bản mỗi tuần. Vay vốn nằm ở [[Tín dụng và vay]].

## Con số

| Thông số | Giá trị | Nguồn |
|---|---|---|
| Mở khóa (gửi/rút, gửi kỳ hạn) | bé cấp 3 | `petdex/server/routes-economy.js:18-19,92-106` |
| Phần tiết kiệm được tính lãi | 10.000 xu đầu | `petdex/server/rules/bank.js:5,15-18` |
| Lãi suất cơ bản ban đầu | 0,3%/ngày | `petdex/server/rules/bank.js:6`, `petdex/server/bank.js:34-37` |
| Khoảng lãi cơ bản do NHTW đặt | 0,05–0,5%/ngày | `petdex/server/rules/bank.js:35` |
| Kỳ hạn và lãi cộng thêm | 3 ngày +0,1; 7 ngày +0,2; 14 ngày +0,3 điểm %/ngày | `petdex/server/rules/bank.js:7` |
| Gửi kỳ hạn tối thiểu | 100 xu | `petdex/server/rules/bank.js:8`, `petdex/server/bank.js:69` |

## Công thức
- **Tiết kiệm**: `lãi tích = min(max(0, số dư), 10.000) × lãi cơ bản × số ngày` (lãi đơn theo thời gian thực) (`accrue`, `petdex/server/rules/bank.js:15-18`). Mỗi lần xem/gửi/rút, ngân hàng "chạm" tài khoản để cộng dồn phần lẻ vào `accrued` với lãi suất **hiện hành** (`touch`, `petdex/server/bank.js:43-49`).
- Nửa đêm: phần nguyên của `accrued` cộng vào tiết kiệm (dòng `interest`, tài khoản `savings`), phần lẻ giữ lại (`petdex/server/bank.js:135-144`).
- **Kỳ hạn**: lãi chốt = `lãi cơ bản lúc gửi + phụ trội kỳ hạn`; tiền lãi = `floor(gốc × lãi × số ngày)` (lãi đơn), chỉ trả khi đủ hạn (`petdex/server/rules/bank.js:21-24`, `petdex/server/bank.js:66-77`).

> [!example] Gửi 1.000 xu kỳ hạn 14 ngày khi lãi cơ bản 0,3%
> Lãi chốt 0,6%/ngày → đáo hạn nhận 1.000 + floor(1.000 × 0,006 × 14) = 1.084 xu. Giữ 1.000 xu trong tiết kiệm 14 ngày (lãi không đổi) được 42 xu.

## Trường hợp đặc biệt
- Rút kỳ hạn trước hạn: chỉ nhận gốc, báo "Rút trước hạn: nhận lại X 🪙, không có lãi." (`petdex/server/bank.js:87-97`).
- Kỳ hạn đến hạn tự tất toán ở lần quyết toán nửa đêm sau `matures_at` (`petdex/server/bank.js:145`). Vì tất toán lúc nửa đêm và kỳ hạn tính từ giờ gửi, khoản gửi 3 ngày lúc 10h sáng sẽ được trả ở nửa đêm của ngày thứ 4.
- Gửi/rút không có phí và không giới hạn số lần. Số dư tiết kiệm trên 10.000 vẫn an toàn nhưng không sinh lãi.
- Lỗi: "Kỳ hạn chỉ có 3, 7 hoặc 14 ngày.", "Gửi kỳ hạn tối thiểu 100 🪙.", "Tài khoản tiết kiệm không đủ tiền.", "Không tìm thấy khoản gửi này." (`petdex/server/bank.js:52-90`, `petdex/server/ledger.js:124-129`).
- Lãi (tiết kiệm và kỳ hạn) là thu nhập chịu [[Thuế thu nhập]] (`petdex/server/town.js:22-24`).
- Khi trả góp vay, ngân hàng được phép lấy sang tiết kiệm nếu ví thiếu (`petdex/server/credit.js:206`).
- Nhiệm vụ "Gửi tiền vào ngân hàng" tính khi gửi tiết kiệm hoặc mở kỳ hạn (`petdex/server/routes-economy.js:97,104`).

## Mã nguồn
- `petdex/server/bank.js`: `economy` (34), `indexedPrice` (40), `moveSavings` (51), `openDeposit` (66), `closeDeposit` (87), `bankView` (100), `bankHoldings` (127), `settleBankDay` (135), `centralBankWeek` (150).
- API: `GET /bank`, `POST /bank/savings {action, amount}`, `POST /bank/deposits {amount, term}`, `POST /bank/deposits/:id/close` (`petdex/server/routes-economy.js:90-110`).

## Liên quan
- [[Ngân hàng Trung ương]] · [[Chỉ số giá]] · [[Tín dụng và vay]] · [[Ví và tài sản ròng]] · [[Màn Ngân hàng]] · [[Module bank]] · [[Module rules-bank]] · [[MOC Kinh tế và cộng đồng]]
