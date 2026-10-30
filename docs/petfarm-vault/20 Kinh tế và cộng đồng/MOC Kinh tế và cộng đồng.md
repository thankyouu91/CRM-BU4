---
tags: [petfarm, kinh-te, moc]
loai: moc
trang-thai: dang-chay
nguon: [petdex/server/market.js, petdex/server/bank.js, petdex/server/macro.js, petdex/server/town.js, petdex/server/ledger.js, petdex/server/wallet.js, petdex/server/business.js, petdex/server/bazaar.js, petdex/server/farm.js, petdex/server/factory.js, petdex/server/contracts.js, petdex/server/credit.js, petdex/server/social.js, petdex/server/clans.js, public/ta-tua/game/js/shared/clan.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Kinh tế, Economy MOC]
---
# MOC Kinh tế và cộng đồng

> [!summary]
> Bản đồ khu **Kinh tế và cộng đồng**: tiền xu đi đâu, các chợ và ngân hàng, thuế và ngân sách, các doanh nghiệp (quầy, vườn, bếp, xưởng, hợp đồng), tín dụng, Hội, Gia tộc và 200 lô đất. Bắt đầu từ [[Dòng xu trong game]] để thấy bức tranh toàn cảnh, rồi đi vào từng hệ thống. Chăm sóc bé, trang phục và mini-game thuộc [[MOC Luật chơi]]; mã nguồn từng file thuộc [[MOC Máy chủ]].

## Tổng quan dòng tiền
- [[Dòng xu trong game]]: mọi nguồn tạo, chuyển và hủy xu, sơ đồ Mermaid.
- [[Sổ cái]]: hàm `post()` duy nhất, danh mục `kind` thu/chi/chuyển.
- [[Ví và tài sản ròng]]: tài sản ròng, báo cáo thu chi, ảnh chụp mỗi đêm, xếp hạng giàu.
- [[Mô phỏng kinh tế]]: bot mô phỏng 30 ngày, đối soát sổ cái, mô phỏng trang phục.

## Sàn Nguyên Liệu
- [[Sàn Nguyên Liệu]]: giá OU 10 phút, NPC ±1%, phí 1%, tác động giá, hạn mức 40 lô.
- [[Lệnh giới hạn]]: ±15%, khớp với người khác, chờ tới hết ngày.
- [[Kho Sàn]]: 200/500/2.000 lô, hàng hư.
- [[Tin tức thị trường]]: tin ngẫu nhiên, thời tiết, sốc ngành, trợ giá.
- [[Mặt hàng nguyên liệu]]: bảng 10 mặt hàng và chuỗi giá trị.
  - Thô: [[Lá trà tươi]] · [[Sữa tươi]] · [[Củ sắn]] · [[Mía]] · [[Dâu tây]] · [[Cá tươi]]
  - Chế biến: [[Trà khô]] · [[Trân châu (nguyên liệu)]] · [[Đường nâu]] · [[Sữa đặc]]

## Ngân hàng và tiền tệ
- [[Ngân hàng Trân Châu]]: tiết kiệm (10.000 xu đầu có lãi), kỳ hạn 3/7/14 ngày.
- [[Ngân hàng Trung ương]]: họp Chủ nhật, mục tiêu 10%/tuần, công thức chính sách.
- [[Chỉ số giá]]: cái gì nhân chỉ số, cái gì không.
- [[Kinh tế vĩ mô]]: pha, thời tiết, cầu ngành, chỉ số giá đất.
  - Pha: [[Pha Phục hồi]] · [[Pha Tăng trưởng nóng]] · [[Pha Đỉnh chu kỳ]] · [[Pha Suy thoái]]
  - Thời tiết: [[Thời tiết Trời yên biển lặng]] · [[Thời tiết thuận lợi]] · [[Thời tiết Nắng nóng kéo dài]] · [[Thời tiết Mưa lớn nhiều ngày]] · [[Thời tiết Bão biển]] · [[Thời tiết Rét đậm]]

## Thuế, ngân sách, thị trấn
- [[Thuế thu nhập]]: bậc 0/5/10/15% theo ngày, thuế doanh thu quầy 3%.
- [[Thuế doanh nghiệp]]: 35% +5 điểm/ngành, tự khai, hoàn 15% cuối tháng.
- [[Sở thuế và trốn thuế]]: hồ sơ khai thiếu, truy thu kèm phạt.
- [[Ngân sách thị trấn]]: thu chi của quỹ chung.
- [[Tòa thị chính]]: bỏ phiếu tuần.
  - [[Đề xuất Xây cầu Phố–Hẻm]] · [[Đề xuất Lễ hội ẩm thực]] · [[Đề xuất Giảm thuế]] · [[Đề xuất Trợ giá sữa tươi]] · [[Đề xuất Quảng bá phố]] · [[Đề xuất Quỹ chào tân thủ]]

## Kinh doanh và sản xuất
- [[Quầy trà sữa]]: mở quầy, khách theo giờ, nâng cấp, thuê mặt bằng.
  - Vị trí: [[Quầy ở Hẻm nhỏ]] · [[Quầy ở Mặt phố]] · [[Quầy ở Trung tâm]]
  - [[Thực đơn quầy trà sữa]] · [[Uy tín quầy]]
- [[Thuê bé làm việc]]: tuyển bé người khác cho quầy, xưởng.
- [[Chợ Phiên]]: người chơi bán đồ, trang phục, món nấu cho nhau.
- [[Vườn]]: 4 cây, tưới hộ, sâu.
- [[Bếp]]: 7 món, chất lượng, bán quán ăn. [[Món ẩn]]: 3 công thức bí mật.
- [[Khu công nghiệp]]: 2 xưởng, mẻ/giờ, thuê đất.
  - [[Xưởng sấy trà]] · [[Xưởng bột trân châu]] · [[Nhà máy đường]] · [[Lò sữa đặc]]
  - [[Gia công thuê]]
- [[Hợp đồng cung ứng]]: giao hàng mỗi đêm, ký quỹ, bồi thường.

## Tín dụng
- [[Tín dụng và vay]]: tài chính nâng cao, hạn mức, trả góp, vỡ nợ.
- [[Điểm tín dụng]]: 300–850, sự kiện cộng trừ.
  - [[Hạng tín dụng Đồng]] · [[Hạng tín dụng Bạc]] · [[Hạng tín dụng Vàng]] · [[Hạng tín dụng Kim cương]]

## Cộng đồng
- [[Hội]]: quỹ, Văn phòng, Biển hiệu, dự án tuần.
  - [[Dự án Dãy đèn lồng công viên]] · [[Dự án Sửa đài phun nước]] · [[Dự án Quán trà miễn phí]] · [[Dự án Tiệc cá cuối tuần]]
- [[Clan]] (Gia tộc): lập, vai trò, quỹ, ngành, phí duy trì, định mức.
  - [[Cấp gia tộc]]: 10 cấp, XP lên xuống.
  - [[Bản đồ đất]]: Sở Nhà Đất, 200 lô, giá, doanh thu.
  - [[Mẫu công trình]] · [[Trình lắp ghép công trình]]
  - Ngành: [[Ngành Trà (lá trà, trà khô)]] · [[Ngành Bò sữa & sữa đặc]] · [[Ngành Mía đường]] · [[Ngành Sắn & trân châu]] · [[Ngành Dâu tây & trái cây]] · [[Ngành Thủy hải sản]] · [[Ngành Chuỗi trà sữa]] · [[Ngành Ẩm thực & nhà hàng]] · [[Ngành Giao vận & bốc xếp]] · [[Ngành Giáo dục & gia sư]] · [[Ngành Giải trí & ca nhạc]]

## Mốc mở khóa (cấp bé cao nhất, `petdex/server/routes-economy.js:18-20`)
| Cấp | Mở |
|---|---|
| 2 | Đặt lệnh Sàn, Vườn (gieo), gửi gia công |
| 3 | Ngân hàng, bỏ phiếu Tòa thị chính, lập Hội, Bếp |
| 4 | Quầy trà sữa, Chợ Phiên, Gia tộc (`clan_config.unlockLevel`) |
| 6 | Xây xưởng, Hợp đồng cung ứng |
| 8 | Tài chính nâng cao (vay) |
Xem thêm [[Mở khóa theo cấp]].

## Thứ tự quyết toán nửa đêm (`petdex/server/scheduler.js:28-47`)
Quầy → xưởng → gia tộc (và vĩ mô ngày mai) → sức khỏe, bảo hiểm → vòng đời → hợp đồng → lãi ngân hàng → trả góp → thuế thu nhập → hết hạn lệnh Sàn, tin Chợ Phiên → chụp tài sản ròng → xóa lịch sử giá > 14 ngày; Chủ nhật thêm Ngân hàng Trung ương và đóng phiên Tòa thị chính. Chi tiết: [[Quyết toán nửa đêm]].

## Tất cả ghi chú
```dataview
TABLE loai, trang-thai FROM "20 Kinh tế và cộng đồng" WHERE file.name != this.file.name SORT file.name
```

## Liên quan
- [[Trang chủ]] · [[Bản đồ hệ thống]] · [[Thuật ngữ]] · [[MOC Luật chơi]] · [[MOC Máy chủ]] · [[MOC Giao diện]] · [[MOC Vận hành]]
