---
tags: [petfarm, thiet-ke, moc]
loai: moc
trang-thai: dang-chay
nguon: [petdex/docs/thiet-ke-mo-rong.md, petdex/docs/thiet-ke-pet-ngu-hanh.md, petdex/docs/api-giai-doan-2.md, docs/pet-town-gear-balance.md]
cap-nhat: 2026-10-30
commit: e03a0db
---
# MOC Thiết kế

> [!summary]
> Tài liệu thiết kế của Pet Town, lộ trình, các quyết định kèm lý do và lịch sử phiên bản. Đây là nơi trả lời "vì sao game như thế này" và "tiếp theo làm gì". Con số hiện hành luôn lấy từ code (các ghi chú ở [[MOC Luật chơi]], [[MOC Kinh tế và cộng đồng]]); tài liệu thiết kế có thể đã cũ.

## Tài liệu gốc trong repo
- [[Tài liệu thiết kế mở rộng]]: `petdex/docs/thiet-ke-mo-rong.md`, Phố Trân Châu, hệ thống tài chính, giai đoạn 1A đến 4, nhật ký chỗ khác thiết kế.
- [[Thiết kế pet ngũ hành]]: `petdex/docs/thiet-ke-pet-ngu-hanh.md`, bộ khung vẽ, ngũ hành, vòng đời, bước 2.5A/B/C.
- [[Tài liệu API giai đoạn 2]]: `petdex/docs/api-giai-doan-2.md`, endpoint của giai đoạn sản xuất.
- Ngoài ra: `docs/pet-town-gear-balance.md` (cân bằng trang phục 3–5 món), tóm tắt trong [[Quyết định thiết kế]] và [[Cấp trang phục]].

## Hướng đi
- [[Lộ trình phát triển]]: dòng thời gian, đã làm và chưa làm, chuyện "Sở Nhà Đất sắp mở".
- [[Quyết định thiết kế]]: hơn 40 quyết định với lý do và nguồn.

## Lịch sử
- [[Lịch sử phiên bản]]: changelog theo ngày từ `git log`, mỗi dòng một SHA.

> [!tip] Khi thêm tính năng
> Ghi quyết định vào [[Quyết định thiết kế]], thêm dòng vào [[Lịch sử phiên bản]], cập nhật [[Lộ trình phát triển]], và kiểm [[Wiki người chơi]] có cần bài mới không.

## Bảng tự động
```dataview
TABLE loai, trang-thai FROM "60 Thiết kế" WHERE file.name != this.file.name SORT file.name
```

## Liên quan
- [[Trang chủ]]
- [[MOC Vận hành]]
- [[Bản đồ hệ thống]]
