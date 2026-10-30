---
tags: [petfarm, giao-dien, moc]
loai: moc
trang-thai: dang-chay
nguon: [public/ta-tua/game/index.html, public/ta-tua/game/js, public/ta-tua/game/css, public/ta-tua/game/pet-lab.html, app/(app)/ta-tua, app/server1, components/tatua]
cap-nhat: 2026-10-30
commit: e03a0db
---

# MOC Giao diện

> [!summary]
> Bản đồ nội dung của khu Giao diện: client trình duyệt của Pet Town (`public/ta-tua/game/**`), từng màn người chơi thấy, các bộ vẽ pixel art, 3 mini-game, xưởng tạo hình Pet Lab, CSS và trang bọc WorkHub. Luật chơi nằm ở [[MOC Luật chơi]], kinh tế ở [[MOC Kinh tế và cộng đồng]], mã máy chủ ở [[MOC Máy chủ]]; ở đây chỉ nói người chơi thấy gì, bấm gì, và client gọi API nào.

## Bắt đầu từ đâu
- [[Kiến trúc giao diện game]]: sơ đồ mô-đun, bảng 24 màn với hash và khóa cấp, sơ đồ điều hướng, đường ống vẽ.
- [[App shell]]: `index.html`, trạng thái, định tuyến hash, `act()`, làm mới 30 giây, `ctx`, `api.js`, `ui.js`.

## Khung, điều hướng, đăng nhập
- [[Thanh điều hướng và menu tài khoản]]: 6 tab, chip Quà ngày, chip xu, menu tài khoản (mã quà, mật khẩu, đăng xuất).
- [[Màn Đăng nhập]]: form trong game và bản nhúng.
- [[Khung nhúng WorkHub]]: trang `/ta-tua` và `/server1`, hash `#token`, `postMessage` đăng xuất, thanh nhắc mật khẩu, nền đồng cỏ.
- [[Socket phía trình duyệt]]: WebSocket thuần giả API socket.io, nối lại tăng dần.

## Màn chăm sóc và đời sống bé
- [[Màn Phố]]: trang chủ, nhiệm vụ ngày, 18 tòa nhà.
- [[Màn Nhà]]: căn phòng, chỉ số, 8 nút hành động, tủ đồ 5 khe, hiệu ứng.
- [[Màn Nhận nuôi]]: chọn loài, bảng trứng ngũ hành.
- [[Màn Túi đồ]]: trang phục có cấp, hộp kín, đồ dùng.
- [[Màn Siêu thị]]: lưới hàng, giá theo chỉ số giá, hộp trang phục.
- [[Màn Phòng khám]]: hóa đơn, bảo hiểm, mẹo.
- [[Màn Trường học]]: lớp học, lý do chặn, hiệu ứng điểm.
- [[Màn Việc làm]]: ca làm, lương ước tính, việc ở quầy và xưởng.
- [[Màn Khu vui chơi]]: phần thưởng ngày, lớp phủ mini-game, bảng kết quả.
- [[Màn Công viên]]: sân chơi nhiều người.
- [[Màn Bạn bè]]: bạn bè, thăm nhà, tặng quà, Hội.
- [[Màn Bảng vàng]]: cấp độ, tài sản ròng, Đồi Sao.

## Màn kinh tế
- [[Màn Ví]]: tài sản ròng, thu chi, sao kê, Tài chính nâng cao.
- [[Màn Ngân hàng]]: tiết kiệm, kỳ hạn, Ngân hàng Trung ương.
- [[Màn Tín dụng]]: điểm, hạng, vay trả góp.
- [[Màn Sàn]]: bảng giá, biểu đồ, đặt lệnh, kho, tin.
- [[Màn Hợp đồng]]: hợp đồng cung ứng.
- [[Màn Báo Trân Châu]]: tin tức.
- [[Màn Tòa thị chính]]: ngân sách, bỏ phiếu, thuế thu nhập.
- [[Màn Vườn]]: ô đất, tưới hộ.
- [[Màn Bếp]]: công thức, nấu thử, tủ món.
- [[Màn Chợ Phiên]]: chợ người chơi.
- [[Màn Quầy trà sữa]]: khai trương, thực đơn, trực quầy.
- [[Màn Khu công nghiệp]]: xưởng, gia công thuê.
- [[Màn Clan]]: gia tộc, bản đồ đất, xưởng lắp ghép, thuế, vĩ mô.

## Bộ vẽ
- [[Vẽ pixel]]: `pixel.js`, bút, dither, viền, kho hạt.
- [[Bộ khung thú]]: `rig.js`, bộ xương, 5 điểm neo, dáng theo cấp, đồ đeo, hoạt ảnh.
- [[Sprite và bảng hình]]: `petsheet.js`, `sprite.js`, `createPetFigure`.
- [[Cảnh nhà và thời gian trong ngày]]: `scenes.js`, 4 buổi, `?time=`.
- [[Vẽ bản đồ phố]]: `townmap.js`.
- [[Vẽ bản đồ đất]]: `landmap.js`, `landpixel.js`.
- [[Vẽ công viên]]: `park.js`.
- [[Hiệu ứng hạt]]: `fx.js`.
- [[Hình vật phẩm]]: `itemart.js`.
- [[Biểu đồ]]: `charts.js`.

## Mini-game, công cụ, phong cách
- [[Giao diện mini-game]]: Câu cá, Hứng trân châu, Ghép hình nhớ.
- [[Xưởng tạo hình Pet Lab]]: `pet-lab.html`, tham số `?level=` và các tham số khác.
- [[Phong cách và CSS]]: biến thiết kế, thành phần, bố cục đáp ứng, 9 file CSS.

## Tất cả ghi chú

```dataview
TABLE loai, trang-thai FROM "40 Giao diện" WHERE file.name != this.file.name SORT file.name
```

## Liên quan
- [[Trang chủ]], [[Bản đồ hệ thống]], [[MOC Luật chơi]], [[MOC Kinh tế và cộng đồng]], [[MOC Máy chủ]], [[MOC Vận hành]]
