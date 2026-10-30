---
tags: [petfarm, giao-dien, cong-cu, pet-lab, rig]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/pet-lab.html, public/ta-tua/game/js/petlab.js, public/ta-tua/game/css/petlab.css]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Xưởng tạo hình Pet Lab

> [!summary]
> `pet-lab.html` là trang công cụ độc lập (không cần đăng nhập, không gọi API) để xem toàn bộ 50 loài ngũ hành và [[Linh vật Boba]] vẽ bằng [[Bộ khung thú]]: lọc theo hành, độ hiếm, giai đoạn tuổi; bấm một bé để xem 8 hoạt ảnh, thử đồ theo 5 khe, xem dải dáng theo cấp, dải vòng đời, số liệu loài và quan hệ tương sinh tương khắc. Dùng cho thiết kế và kiểm tra hình, cũng là cách nhanh nhất để soi điểm neo đồ đeo.

## Mở trang

Đường dẫn tương đối với game: `pet-lab.html` (cùng thư mục `index.html`; trong WorkHub là `/ta-tua/game/pet-lab.html`). Trang có nút "← Về Phố Trân Châu" trỏ về `index.html` (`public/ta-tua/game/pet-lab.html:22`). Chỉ nạp `css/style.css` và `css/petlab.css`.

### Tham số địa chỉ

| Tham số | Tác dụng | Nguồn |
|---|---|---|
| `?rarity=hiem\|quy\|huyenthoai` | lọc độ hiếm tối thiểu; nếu không kèm `species` thì chọn sẵn loài Huyền thoại đầu tiên | `public/ta-tua/game/js/petlab.js:31-32`, `petlab.js:41` |
| `?stage=baby\|kid\|teen\|young\|adult\|elder` | giai đoạn tuổi (mặc định `young`) | `petlab.js:33` |
| `?level=n` | cấp để vẽ **dáng theo cấp** (n ≥ 1, lấy phần nguyên; 10, 20, 30, 40, 50 là các mốc đổi dáng) | `petlab.js:34` |
| `?species=<id>` | chọn sẵn một loài (mặc định `meo_bac`) | `petlab.js:35` |
| `?wear=0` | bỏ hết đồ thử và tắt "Cả đàn mặc đồ đang thử" | `petlab.js:36-39` |

Ví dụ trong comment: `/pet-lab.html?rarity=hiem&stage=adult&wear=0` (`petlab.js:29`). Đồ thử mặc định: nón lá (`nonla`) và khăn (`scarf`) (`petlab.js:24`).

## Bố cục

| Vùng | Nội dung | Nguồn |
|---|---|---|
| Đầu trang | "🐾 Xưởng tạo hình pet ngũ hành", mô tả | `pet-lab.html:16-23` |
| Bộ lọc | chip hành (tô `--el`), độ hiếm ("Mọi độ hiếm", "★★ Hiếm trở lên", "★★★ Quý trở lên", "★★★★ Huyền thoại"), giai đoạn ("Sơ sinh 0+ tuần"...); công tắc "Hiện điểm neo", "Cả đàn mặc đồ đang thử" | `pet-lab.html:24-30`, `petlab.js:84-92` |
| Bộ sưu tập | nhóm theo hành "Hành X · tính khí", mỗi loài một thẻ canvas chạy hoạt ảnh idle (tỉ lệ 3), tên, sao độ hiếm, icon sở trường | `petlab.js:101-126` |
| Chi tiết | tên, hành, sao, giai đoạn; canvas lớn tỉ lệ 5; chip 8 hoạt ảnh (Đứng chơi, Vẫy tay, Nhảy, Chạy, Buồn, Ngó nghiêng, Làm việc, Xoay); "👗 Thử đồ" mỗi khe một hàng chip đồ của khe đó (tô `good`/`bad` theo hợp/kỵ mệnh, nhãn ngắn quan hệ); số món đeo được theo `wearLimit(level, rarity)`; tổng % hợp mệnh của bộ đang thử | `petlab.js:146-189` |
| 📈 Dáng theo cấp | 6 ô Lv 1+, 10+, 20+, 30+, 40+, 50+ với hình vẽ ở cấp đó; bấm để đổi `state.level` | `petlab.js:190-192`, `petlab.js:233-240` |
| 🌱 Vòng đời | 6 ô giai đoạn tuổi, ghi chú giai đoạn, tuổi thọ loài "khoảng n tuần (chăm tốt sống lâu hơn tới 20 tuần)" | `petlab.js:194-199` |
| 📊 Số liệu loài | thanh 5 kỹ năng khởi điểm (trên thang 30) và hệ số tăng; hao no bụng, hồi năng lượng, hao vui, hao sạch, khả năng ốm, hồi sức khỏe (chỉ dòng khác 1); sở trường; lợi thế hành | `petlab.js:201-215` |
| ☯️ Tương sinh, tương khắc | được hành nào nuôi dưỡng, nuôi dưỡng hành nào, khắc và bị khắc | `petlab.js:130-138`, `petlab.js:216-217` |

## Kỹ thuật

- Không dùng `sprite.js`: tự chạy hoạt ảnh bằng một vòng `requestAnimationFrame` vẽ `animFrames(...)` của `rig.js` lên canvas (`petlab.js:56-79`). Khung hình lưu đệm theo khóa `loài|tuổi|hoạt ảnh|đồ|neo|cấp` (`petlab.js:48-53`).
- "Hiện điểm neo" truyền `anchors: true` cho `drawFrame`, chấm 5 điểm màu (xem [[Bộ khung thú]]).
- Tính số liệu bằng `speciesStats`, quan hệ bằng `relation` và `RELATIONS` từ `shared/pets.js`.

> [!warning] Lệch tài liệu
> Mô tả trên trang ghi đồ đeo "gắn vào điểm neo đầu · mặt · cổ · lưng" (`pet-lab.html:19`) nhưng bộ khung đã có khe thứ năm là bùa (`charm`) và trang có hàng thử đồ cho khe này. Tổng % "Bộ đồ đang mặc" ở trang cộng thô từng món, không áp trần `ELEMENT_RULES.wearCap` như hộp thoại Trang phục trong game (`petlab.js:140-144`).

## Liên quan
- [[Bộ khung thú]], [[Sprite và bảng hình]], [[Thiết kế pet ngũ hành]], [[Loài và độ hiếm]], [[Dáng theo cấp]], [[Giai đoạn tuổi]], [[Ngũ hành]], [[Hợp mệnh và kỵ mệnh]], [[Trang phục]]
