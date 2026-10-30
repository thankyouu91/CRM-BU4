---
tags: [petfarm, tong-quan, quy-uoc]
loai: moc
trang-thai: dang-chay
nguon: []
cap-nhat: 2026-10-30
commit: e03a0db
---
# Quy ước vault

> [!summary]
> Vault này là "bộ não thứ hai" của Pet Town: mọi luật chơi, con số, mã nguồn, dữ liệu, giao diện và cách vận hành, nối với nhau bằng liên kết. Trang này nói cách đọc, cách tìm và cách giữ vault đúng với code.

## Mở vault
1. Cài [Obsidian](https://obsidian.md).
2. *Open folder as vault*, chọn thư mục `docs/petfarm-vault` trong repo.
3. (Nên có) bật plugin cộng đồng **Dataview** để các bảng tự động trong MOC hiện ra. Không có Dataview thì MOC vẫn có danh sách viết tay.
4. Mermaid (sơ đồ) và callout có sẵn trong Obsidian, không cần plugin.

## Thư mục
| Thư mục | Nội dung | Màu trên đồ thị |
|---|---|---|
| `00 Trang chủ` | [[Trang chủ]], [[Bản đồ hệ thống]], trang này | cam |
| `10 Luật chơi` | nuôi bé, tiến trình, hoạt động của người chơi: [[MOC Luật chơi]] | xanh lá |
| `20 Kinh tế và cộng đồng` | xu, Sàn, ngân hàng, thuế, kinh doanh, Hội, Clan: [[MOC Kinh tế và cộng đồng]] | vàng |
| `30 Máy chủ` | kiến trúc, từng module, cơ sở dữ liệu, API: [[MOC Máy chủ]] | xanh dương |
| `40 Giao diện` | ứng dụng trong trình duyệt, từng màn, bộ vẽ: [[MOC Giao diện]] | hồng |
| `50 Vận hành` | WorkHub, tên miền, quản trị, deploy: [[MOC Vận hành]] | tím |
| `60 Thiết kế` | tài liệu thiết kế, lộ trình, quyết định, lịch sử: [[MOC Thiết kế]] | tím |
| `90 Thuật ngữ` | [[Thuật ngữ]] | cam |
| `_Mẫu` | mẫu ghi chú (Templates) | ẩn khỏi đồ thị |

## Một ghi chú gồm gì
- **Thuộc tính** (frontmatter): `tags`, `loai` (he-thong, luat, ma-nguon, api, du-lieu, giao-dien, van-hanh, thiet-ke, moc), `trang-thai` (dang-chay, sap-mo, thu-nghiem, da-bo), `nguon` (file code), `cap-nhat`, `commit` (commit đã đối chiếu).
- **Tóm tắt** trong callout `[!summary]` ngay dưới tiêu đề.
- **Con số** luôn kèm cột `Nguồn` dạng `đường/dẫn:dòng`. Số trong vault là **giá gốc**; giá thật nhân với [[Chỉ số giá]].
- `> [!warning] Lệch tài liệu`: chỗ README, tài liệu thiết kế hoặc wiki nói khác code. **Code là chuẩn.**
- `## Liên quan` ở cuối mỗi ghi chú.

## Tìm nhanh
- `Ctrl/Cmd + O`: mở ghi chú theo tên. Gõ không dấu cũng được.
- Tìm theo thuộc tính: `["loai": api]`, `["trang-thai": sap-mo]`.
- Tìm chỗ lệch tài liệu: tìm `Lệch tài liệu`.
- Mỗi module máy chủ có ghi chú tên `Module <tên file>`, mỗi màn hình có ghi chú tên `Màn <tên>`.

## Giữ vault đúng với code
Khi một commit đổi luật chơi:
1. Tạo ghi chú từ mẫu `Mẫu nhật ký thay đổi luật` (hoặc thêm dòng vào [[Lịch sử phiên bản]]).
2. Sửa con số trong ghi chú luật tương ứng, đổi `cap-nhat` và `commit`.
3. Sửa wiki người chơi (`lib/wiki/articles.ts`) nếu là luật người chơi thấy. Các bảng của wiki tự đọc từ code, câu chữ thì không.

> [!tip] Kiểm tra liên kết gãy
> Trong Obsidian: *Settings → Files and links → Detect all file extensions* rồi xem *Unresolved links* trong đồ thị. Hoặc trong repo chạy lệnh ở [[Trang chủ#Bảo trì]].

## Liên quan
- [[Trang chủ]]
- [[Bản đồ hệ thống]]
