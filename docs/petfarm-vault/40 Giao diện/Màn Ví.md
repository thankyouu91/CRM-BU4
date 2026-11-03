---
tags: [petfarm, giao-dien, man-hinh, vi, so-cai]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/wallet.js, public/ta-tua/game/js/charts.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Ví

> [!summary]
> Tab 👛 Ví (`#wallet`, cũng mở khi bấm chip 🪙 số xu trên thanh trên): tài sản ròng chia 6 phần, báo cáo thu chi 7/30 ngày có biểu đồ cột, sao kê sổ cái lọc theo loại và tải thêm, và công tắc Tài chính nâng cao. Mã ở `views/wallet.js` (được import thành `renderWalletView` để khỏi trùng tên với hàm vẽ chip ví trong `app.js`).

## Khối hiển thị

| Khối | Nội dung | Nguồn |
|---|---|---|
| 💎 Tài sản ròng | số lớn `netWorth.total`; thanh xếp chồng và chú giải 6 phần: Ví `#c8915f`, Tiết kiệm `#58b98d`, Kỳ hạn `#3f8f6f`, Ký quỹ lệnh `#9aa6c9`, Hàng trong kho `#f2a65a`, Đồ đạc `#ef8fa8`; `lineChart` lịch sử nếu có từ 2 điểm, nếu không: "Biểu đồ tài sản có từ ngày mai (chụp lại mỗi nửa đêm)." | `public/ta-tua/game/js/views/wallet.js:9-16`, `wallet.js:46-52` |
| 📊 Thu chi | nút phân đoạn "7 ngày" / "30 ngày"; 3 ô Thu, Chi, Dư; `barChart(report.daily)` cao 120 px; chú giải màu `COLORS.income` / `COLORS.expense`; 2 cột danh sách tổng theo loại giao dịch (nhãn từ `catalog.kinds`) | `wallet.js:54-68` |
| 🧾 Sao kê | `<select data-kind>` "Tất cả giao dịch" + mọi loại; bảng Lúc, Nội dung (nhãn + huy hiệu "tiết kiệm" nếu tài khoản tiết kiệm + memo), Số xu (xanh/đỏ), Số dư; nút "Xem thêm" khi trang đủ 40 dòng | `wallet.js:25-32`, `wallet.js:70-81` |
| 🎓 Tài chính nâng cao | lời cảnh báo "Vay nợ, hợp đồng tương lai, hội thi có lệ phí và cổ phiếu sẽ mở dần trong các bản sau…", công tắc `switch` | `wallet.js:83-93` |

## API

| Hành động | API | Nguồn |
|---|---|---|
| Mở màn | `GET /wallet?days=7|30` | `wallet.js:133` |
| Đổi bộ lọc sao kê | `GET /wallet/ledger?kind=<loại>` | `wallet.js:99-106`, `wallet.js:119-122` |
| Xem thêm | `GET /wallet/ledger?kind=…&before=<id cuối>` (bỏ nút khi trang trả về dưới 40 dòng) | `wallet.js:100-105` |
| Bật/tắt Tài chính nâng cao | `confirm('Bật Tài chính nâng cao? Các công cụ này có thể làm bạn mất xu nếu không cẩn thận.')` rồi `POST /settings {advancedFinance}` | `wallet.js:123-130` |

Công tắc bị khóa khi `bestLevel() < unlocks.advanced` (= 8) **hoặc** máy chủ tắt tính năng (`catalog.advancedFinance` falsy) (`wallet.js:43`, `wallet.js:90`). Số ngày báo cáo và bộ lọc giữ ở biến module (`days`, `kindFilter`) nên quay lại màn vẫn nhớ.

> [!warning] Lệch tài liệu
> Lời mô tả Tài chính nâng cao vẫn nói vay nợ "sẽ mở dần trong các bản sau" (`wallet.js:86`), trong khi [[Màn Tín dụng]] đã có vay trả góp. Chữ này cũ hơn tính năng.

## Liên quan
- [[Ví và tài sản ròng]], [[Sổ cái]], [[Dòng xu trong game]], [[Tín dụng và vay]]
- [[Biểu đồ]], [[Màn Ngân hàng]], [[Màn Tín dụng]], [[Thanh điều hướng và menu tài khoản]]
