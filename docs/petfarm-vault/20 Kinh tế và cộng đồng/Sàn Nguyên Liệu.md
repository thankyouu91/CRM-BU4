---
tags: [petfarm, kinh-te, san-nguyen-lieu, thi-truong]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/market.js, petdex/server/rules/market.js, petdex/server/routes-economy.js, petdex/server/scheduler.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Sàn, Commodity exchange, 📈 Sàn Nguyên Liệu]
---
# Sàn Nguyên Liệu

> [!summary]
> Sàn giao dịch 10 [[Mặt hàng nguyên liệu]] (6 thô, 4 chế biến) với giá chạy mỗi 10 phút theo mô hình hồi về trung bình (Ornstein–Uhlenbeck) cộng [[Tin tức thị trường]]. Người chơi mua bán với một NPC luôn đứng giá (chênh ±1%, phí 1%, có tác động giá, hạn mức 40 lô/ngày) hoặc khớp với lệnh chờ của nhau. Đây là "trái tim" của chuỗi sản xuất: [[Vườn]], [[Khu công nghiệp]], [[Quầy trà sữa]], [[Bếp]], [[Hợp đồng cung ứng]] và [[Hội]] đều lấy hàng từ [[Kho Sàn]].

## Cách hoạt động
- **Mở khóa**: xem giá thì ai cũng xem được; đặt lệnh cần một bé cấp 2 (`UNLOCKS.market = 2`, `petdex/server/routes-economy.js:18-25,68-80`). Mỗi lần đặt lệnh tính nhiệm vụ "Giao dịch 1 lần trên Sàn" (`petdex/server/routes-economy.js:78`).
- **Đơn vị**: 1 lô = 10 phần (`LOT`, `petdex/server/rules/market.js:5`). Kho và khối lượng lệnh tính bằng **phần**, giá niêm yết **theo lô**. Thành tiền `round(phần/10 × giá lô)` (`petdex/server/rules/market.js:107`).
- **Nhịp giá**: bộ lập lịch chạy `marketTick` mỗi 10 phút, chạy bù tối đa 3 ngày nếu máy chủ tắt; lần đầu khởi động "ấm" từ 24 giờ trước để biểu đồ có sóng (`petdex/server/scheduler.js:20,50-64`). Thứ tự trong một nhịp: tin mới → giá trung bình → bước giá → khớp lệnh chờ với NPC (`petdex/server/market.js:330-349`). Hàng thô tính trước hàng chế biến (`RAW_FIRST`, `petdex/server/rules/market.js:54-55`) vì giá trung bình hàng chế biến phụ thuộc giá đầu vào vừa tính.
- **Báo giá NPC**: bid = giá × 0,99, ask = giá × 1,01 (`petdex/server/rules/market.js:23,93`).
- **Lệnh thị trường**: khớp với lệnh chờ của người khác trước (nếu giá chờ tốt hơn hoặc bằng ask/bid của NPC và nằm trong ±20% giá hiện tại), phần còn lại khớp NPC trong hạn mức ngày (`petdex/server/market.js:205-264`).
- **Lệnh giới hạn**: xem [[Lệnh giới hạn]].
- **Tác động giá**: mỗi lần khớp NPC, giá đổi `giá × (1 ± lô/độ sâu)`; giá khớp bình quân là nửa đường `ref × (1 ± lô/độ sâu/2)` (`petdex/server/rules/market.js:95-99`). Độ sâu 200 lô cho hàng thô, 600 lô cho hàng chế biến (`depthOf`, `petdex/server/rules/market.js:25-26,102`).
- **Giá vốn và lãi chốt**: mỗi lô trong kho mang giá vốn mỗi phần (mua NPC: `giá khớp × 1,01 / 10`, `petdex/server/market.js:258`). Khi bán, lãi chốt = tiền nhận − phí − phần × giá vốn được ghi vào bảng `gains` để tính [[Thuế thu nhập]] (`petdex/server/market.js:122-125,263`).
- **Người đọc tin sớm**: có bé Thông minh ≥ 60 thì thấy tin trước 30 phút (`petdex/server/market.js:355-387`).

## Con số

| Thông số | Giá trị | Nguồn |
|---|---|---|
| Nhịp giá | 10 phút | `petdex/server/rules/market.js:21` |
| Tốc độ hồi về trung bình θ | 0,35/ngày | `petdex/server/rules/market.js:22` |
| Chênh mua/bán NPC | ±1% | `petdex/server/rules/market.js:23` |
| Phí giao dịch | 1% (tối thiểu 1 xu nếu thành tiền > 0) | `petdex/server/rules/market.js:24,104` |
| Độ sâu thanh khoản | 200 lô làm giá dịch 100% (hàng chế biến ×3 = 600) | `petdex/server/rules/market.js:25-26` |
| Biên giá lệnh giới hạn | ±15% giá hiện tại | `petdex/server/rules/market.js:27` |
| Biên khớp lệnh chờ | lệnh ngoài ±20% giá hiện tại tạm không khớp | `petdex/server/rules/market.js:28` |
| Hạn mức với NPC | 40 lô mỗi người, mỗi mặt hàng, mỗi chiều (mua/bán), mỗi ngày | `petdex/server/rules/market.js:29`, `petdex/server/market.js:157-160` |
| Tin tức | 0,8 tin/ngày/mặt hàng, báo trước 30 phút | `petdex/server/rules/market.js:30-31` |
| Khối lượng một lệnh | 0,1–100 lô (1–1.000 phần, số nguyên) | `petdex/server/rules/market.js:32`, `petdex/server/market.js:194-196` |
| Sàn giá | không dưới 25% giá gốc | `petdex/server/rules/market.js:83` |
| Lịch sử giá | giữ 14 ngày | `petdex/server/scheduler.js:42` |
| Biểu đồ | `day`: các nhịp 10 phút trong 24 giờ; `week`: nến giờ trong 7 ngày | `petdex/server/market.js:409-420` |

## Công thức

Giá trung bình (`meanPrice`, `petdex/server/rules/market.js:66-76`):
- Hàng thô: `base × chỉ số giá × drift × tin`.
- Hàng chế biến: `base × (Σ giá đầu vào hiện tại × số lô) / (Σ giá gốc đầu vào × số lô) × tin` (giữ biên lời cho xưởng, không nhân [[Chỉ số giá]] trực tiếp).
- `tin` = tích `(1 + effect)` của mọi tin đang hiệu lực (`petdex/server/market.js:340`).

Bước giá (`stepPrice`, `petdex/server/rules/market.js:79-84`), với `dt = 10 phút / 1 ngày`, `z` chuẩn:
```
giá' = max(0,25 × base, giá + 0,35 × (trung bình − giá) × dt + vol × giá × √dt × z)
```
Độ trôi riêng của hàng thô (`stepDrift`, `petdex/server/rules/market.js:87-91`): `drift' = drift × exp(0,03 √dt z − 0,1 ln(drift) dt)`, kẹp 0,8–1,25.

Giới hạn khớp NPC của lệnh giới hạn (`npcQtyWithin`, `petdex/server/market.js:152-155`): số phần tối đa sao cho giá khớp bình quân không vượt giá đặt, `floor(room × 2 × độ sâu × 10)` với `room = limit/ref − 1` (mua) hoặc `1 − limit/ref` (bán).

> [!example] Mua 40 lô lá trà ở giá 12
> ask = 12,12; giá khớp bình quân = 12,12 × (1 + 40/200/2) = 13,33; thành tiền 533 xu, phí 5 xu; giá sau lệnh = 12 × 1,2 = 14,4 (tới nhịp sau mới hồi dần về trung bình).

## Trường hợp đặc biệt và lỗi người chơi thấy
- "Hôm nay đã hết hạn mức giao dịch với NPC cho mặt hàng này." khi lệnh thị trường không khớp được phần nào (`petdex/server/market.js:274`). Lệnh thị trường khớp một phần thì phần thừa (bán) trả lại kho, báo "… lô chưa khớp, đã trả lại kho" (`petdex/server/market.js:271-280`).
- "Kho không đủ chỗ cho lượng hàng này." khi mua mà kho không còn chỗ (tính cả chỗ giữ cho lệnh mua chờ) (`petdex/server/market.js:221`).
- "Kho chỉ còn X lô …" khi bán quá số có (`petdex/server/market.js:106`).
- "Khối lượng từ 0,1 đến 100 lô.", "Giá đặt phải nằm trong khoảng lo–hi xu/lô." (`petdex/server/market.js:195,216`).
- Bán dùng hàng sắp hư trước (FIFO theo hạn dùng); hàng bán qua lệnh chờ giữ nguyên hạn dùng sớm nhất cho người mua (`petdex/server/market.js:102-120,233-234`).
- Tiền bán trên Sàn được cộng thêm thưởng "Thu nhập giao dịch" của [[Trang phục]] bé chính (`petdex/server/market.js:261`).

## Mã nguồn
- `petdex/server/rules/market.js`: `COMMODITIES` (7-18), `MARKET` (20-38), `HEADLINES` (41-52), `meanPrice` (66), `stepPrice` (79), `stepDrift` (87), `quote` (93), `impact` (96), `fillPrice` (99), `depthOf` (102), `tradeFee` (104), `inBand` (109), `shelfLife` (111), `rollNews` (114).
- `petdex/server/market.js`: `placeOrder` (205), `cancelOrder` (295), `expireOrders` (305), `matchRestingWithNpc` (312), `marketTick` (330), `marketView` (359), `priceHistory` (409), `goodsValue` (423).
- API: `GET /market`, `GET /market/:commodity/history?range=day|week`, `POST /market/order`, `POST /market/orders/:id/cancel`, `POST /market/warehouse` (`petdex/server/routes-economy.js:62-86`).

## Liên quan
- [[Mặt hàng nguyên liệu]] · [[Kho Sàn]] · [[Lệnh giới hạn]] · [[Tin tức thị trường]] · [[Chỉ số giá]] · [[Kinh tế vĩ mô]]
- [[Màn Sàn]] · [[Biểu đồ]] · [[Module market]] · [[Module rules-market]] · [[Nhịp mỗi phút]]
- [[MOC Kinh tế và cộng đồng]]
