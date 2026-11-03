---
tags: [petfarm, tong-quan]
loai: moc
trang-thai: dang-chay
nguon: []
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Home, Petfarm Second Brain]
---
# 🧋 Petfarm · Second Brain

> [!summary]
> Bộ não thứ hai của **Pet Town / Petfarm** (Phố Trân Châu): game nuôi thú cưng nhiều người chơi chạy trong WorkHub trên Cloudflare. Gần 300 ghi chú nối với nhau, ghi lại mọi luật chơi kèm con số và dòng code, từng module máy chủ, từng bảng dữ liệu, từng màn hình, cách vận hành và lịch sử thiết kế. Đối chiếu code ở commit `e03a0db` (30/10/2026).

## Bắt đầu từ đâu
| Bạn là | Đọc trước |
|---|---|
| Người mới tìm hiểu game | [[Bản đồ hệ thống]] → [[MOC Luật chơi]] → [[Thuật ngữ]] |
| Thiết kế, cân bằng game | [[Dòng xu trong game]], [[MOC Kinh tế và cộng đồng]], [[Mô phỏng kinh tế]], [[Quyết định thiết kế]] |
| Lập trình viên máy chủ | [[Kiến trúc máy chủ]], [[Lược đồ cơ sở dữ liệu]], [[API người chơi]], [[MOC Máy chủ]] |
| Lập trình viên giao diện | [[Kiến trúc giao diện game]], [[Bộ khung thú]], [[MOC Giao diện]] |
| Vận hành, quản trị | [[Tổng quan hạ tầng]], [[Bảng quản lý Pet Town]], [[Quy trình deploy]], [[MOC Vận hành]] |
| Người viết wiki, hỗ trợ người chơi | [[Wiki người chơi]], [[MOC Luật chơi]], [[Việc cần xem lại]] |

## Các khu
| Khu | Nội dung | Số ghi chú |
|---|---|---|
| [[MOC Luật chơi]] | chỉ số, ngũ hành, loài, tuổi, trang phục, Siêu thị, việc làm, mini-game, quà, nhiệm vụ, bạn bè | 58 |
| [[MOC Kinh tế và cộng đồng]] | xu, Sàn, ngân hàng, thuế, quầy, Chợ Phiên, vườn, bếp, xưởng, hợp đồng, tín dụng, Hội, Gia tộc, đất, vĩ mô | 90 |
| [[MOC Máy chủ]] | kiến trúc, 54 module, 69 bảng dữ liệu, 116 route người chơi, 38 route nội bộ, công viên WebSocket | 70 |
| [[MOC Giao diện]] | ứng dụng trình duyệt, 25 màn hình, bộ vẽ pixel, bản đồ, Pet Lab | 45 |
| [[MOC Vận hành]] | worker, tên miền, định tuyến, đăng nhập, quản trị, deploy, CI, trang giới thiệu, wiki | 21 |
| [[MOC Thiết kế]] | tài liệu thiết kế, lộ trình, quyết định, lịch sử phiên bản | 7 |
| [[Thuật ngữ]] | từ điển game và kỹ thuật | 1 |

## Đáng chú ý
- [[Việc cần xem lại]]: lỗi tiềm ẩn, chỗ giao diện ghi sai số, tài liệu cũ, rủi ro vận hành (đứng đầu: dữ liệu game chưa được sao lưu).
- [[Lịch sử phiên bản]]: game thay đổi theo từng ngày.
- [[Quy ước vault]]: cách đọc, tìm và giữ vault đúng với code.

## Ghi chú mới cập nhật
```dataview
TABLE loai, cap-nhat, commit FROM "" WHERE file.name != this.file.name AND !contains(file.path, "_Mẫu") SORT file.mtime DESC LIMIT 15
```

## Hệ thống sắp mở hoặc đang thử
```dataview
LIST FROM "" WHERE trang-thai = "sap-mo" OR trang-thai = "thu-nghiem"
```

## Bảo trì
- Khi một commit đổi luật: dùng mẫu `Mẫu nhật ký thay đổi luật`, sửa ghi chú tương ứng và đổi `commit` trong thuộc tính.
- Tìm link gãy: trong đồ thị Obsidian bật *Existing files only* tắt để thấy link chưa có ghi chú, hoặc chạy trong repo:
  ```bash
  grep -rhoP '\[\[\K[^\]|#]+' docs/petfarm-vault | sort -u > /tmp/links; ls -R docs/petfarm-vault | sed -n 's/\.md$//p' | sort -u > /tmp/notes; comm -23 /tmp/links /tmp/notes
  ```
- Các bảng của [[Wiki người chơi]] tự đọc từ code game; câu chữ trong wiki và trong vault thì cần sửa tay.

## Liên quan
- [[Bản đồ hệ thống]]
- [[Thuật ngữ]]
- [[Quy ước vault]]
