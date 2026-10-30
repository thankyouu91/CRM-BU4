---
tags: [petfarm, luat-choi, loai, du-lieu]
aliases: [Bảng loài, Species catalogue, 50 loài]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/pets.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Danh mục loài

> [!summary]
> Bảng số liệu đầy đủ của 50 loài và linh vật Boba, tính bằng chính hàm `speciesStats` của game (`public/ta-tua/game/js/shared/pets.js:246-264`) trên dữ liệu `SPECIES` (150-210) và `MASCOTS` (216-222). Dùng để chọn loài theo nghề, theo sức ăn, theo tuổi thọ.

## Cách đọc
- **Ăn** (`appetite`) và **Sức** (`stamina`): hệ số riêng của loài khai báo trong `S(...)`.
- **Hệ số No** = Ăn × hệ số No bụng của hành (Hỏa 1,1, Thổ 0,85): No bụng tụt nhanh/chậm bao nhiêu so với 8/giờ.
- **Hệ số NL** = Sức × hệ số hồi năng lượng của hành (Hỏa 1,2): năng lượng hồi bao nhiêu so với 12/giờ.
- **Kỹ năng khởi đầu** theo thứ tự 💪 Sức mạnh / 🏃 Nhanh nhẹn / 🧠 Thông minh / ✨ Duyên dáng / 🖐️ Khéo tay, trước khi cộng [[Tính cách Có duyên]] (+5 Duyên dáng) và kỷ vật (+5 sở trường của bé cũ).
- **Tuổi thọ nền** tính với sức khỏe trung bình 70 (mặc định của `speciesStats`); thực tế lệch −10 đến +20 tuần theo cách chăm ([[Vòng đời và Đồi Sao]]).
- Hệ số lên kỹ năng (`growth`) = hệ số hành + 0,1 ở kỹ năng sở trường. Ví dụ Mèo Bạc (Kim, sở trường Khéo tay): Sức mạnh 1,15, Khéo tay 1,4, còn lại 1.

## Con số
| Loài | Mã | Hành | Độ hiếm | Sở trường | Ăn | Sức | Hệ số No | Hệ số NL | Kỹ năng khởi đầu | Tổng | Tuổi thọ nền (tuần) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Mèo Bạc | `meo_bac` | Kim | ★ Thường | Khéo tay | 0.95 | 1 | 0.95 | 1 | 10 / 7 / 8 / 9 / 16 | 50 | 90 |
| Chuột Chuông | `chuot_chuong` | Kim | ★ Thường | Nhanh nhẹn | 0.9 | 1.05 | 0.9 | 1.05 | 9 / 13 / 8 / 8 / 12 | 50 | 90 |
| Sóc Đồng | `soc_dong` | Kim | ★ Thường | Khéo tay | 1 | 1.05 | 1 | 1.05 | 11 / 9 / 7 / 8 / 15 | 50 | 90 |
| Gà Vàng | `ga_vang` | Kim | ★ Thường | Duyên dáng | 1.05 | 1 | 1.05 | 1 | 9 / 9 / 8 / 13 / 11 | 50 | 90 |
| Tê Tê Thép | `te_te` | Kim | ★ Thường | Sức mạnh | 1 | 0.95 | 1 | 0.95 | 14 / 9 / 8 / 9 / 9 | 49 | 90 |
| Cú Ánh Kim | `cu_anh_kim` | Kim | ★★ Hiếm | Thông minh | 0.9 | 1 | 0.9 | 1 | 12 / 9 / 16 / 11 / 12 | 60 | 94 |
| Hươu Pha Lê | `huou_pha_le` | Kim | ★★ Hiếm | Duyên dáng | 0.95 | 1.05 | 0.95 | 1.05 | 11 / 12 / 9 / 15 / 13 | 60 | 94 |
| Sói Bạc | `soi_bac` | Kim | ★★ Hiếm | Nhanh nhẹn | 1.1 | 1.1 | 1.1 | 1.1 | 11 / 15 / 10 / 11 / 13 | 60 | 94 |
| Hạc Bạc | `hac_bac` | Kim | ★★★ Quý | Thông minh | 0.9 | 1.05 | 0.9 | 1.05 | 15 / 11 / 17 / 14 / 14 | 71 | 98 |
| Bạch Hổ | `bach_ho` | Kim | ★★★★ Huyền thoại | Sức mạnh | 1.1 | 1.15 | 1.1 | 1.15 | 23 / 16 / 13 / 15 / 18 | 85 | 102 |
| Thỏ Lá | `tho_la` | Mộc | ★ Thường | Nhanh nhẹn | 1 | 1.05 | 1 | 1.05 | 8 / 12 / 10 / 10 / 9 | 49 | 90 |
| Ếch Sen | `ech_sen` | Mộc | ★ Thường | Duyên dáng | 0.95 | 1 | 0.95 | 1 | 9 / 8 / 10 / 14 / 9 | 50 | 90 |
| Khỉ Tre | `khi_tre` | Mộc | ★ Thường | Nhanh nhẹn | 1.05 | 1.05 | 1.05 | 1.05 | 9 / 13 / 10 / 10 / 8 | 50 | 90 |
| Nhím Rêu | `nhim_reu` | Mộc | ★ Thường | Thông minh | 0.95 | 0.95 | 0.95 | 0.95 | 9 / 8 / 15 / 8 / 10 | 50 | 90 |
| Cún Cỏ | `cun_co` | Mộc | ★ Thường | Duyên dáng | 1.05 | 1 | 1.05 | 1 | 8 / 8 / 11 / 14 / 8 | 49 | 90 |
| Gấu Trúc | `gau_truc` | Mộc | ★★ Hiếm | Sức mạnh | 1.15 | 0.95 | 1.15 | 0.95 | 16 / 9 / 13 / 12 / 10 | 60 | 94 |
| Hươu Rêu | `huou_reu` | Mộc | ★★ Hiếm | Thông minh | 0.95 | 1.05 | 0.95 | 1.05 | 10 / 10 / 17 / 13 / 11 | 61 | 94 |
| Cáo Lá | `cao_la` | Mộc | ★★ Hiếm | Nhanh nhẹn | 1 | 1.1 | 1 | 1.1 | 9 / 17 / 11 / 12 / 10 | 59 | 94 |
| Rùa Cổ Thụ | `rua_co_thu` | Mộc | ★★★ Quý | Thông minh | 0.85 | 0.9 | 0.85 | 0.9 | 13 / 12 / 21 / 12 / 13 | 71 | 98 |
| Thanh Long | `thanh_long` | Mộc | ★★★★ Huyền thoại | Thông minh | 1 | 1.15 | 1 | 1.15 | 15 / 15 / 25 / 17 / 13 | 85 | 102 |
| Rái Cá | `rai_ca` | Thủy | ★ Thường | Nhanh nhẹn | 1 | 1.05 | 1 | 1.05 | 8 / 16 / 7 / 11 / 8 | 50 | 90 |
| Chim Cánh Cụt | `canh_cut` | Thủy | ★ Thường | Nhanh nhẹn | 1.05 | 1 | 1.05 | 1 | 9 / 13 / 9 / 11 / 9 | 51 | 90 |
| Hải Cẩu | `hai_cau` | Thủy | ★ Thường | Duyên dáng | 1.05 | 0.95 | 1.05 | 0.95 | 8 / 10 / 9 / 15 / 8 | 50 | 90 |
| Cá Nóc | `ca_noc` | Thủy | ★ Thường | Duyên dáng | 0.9 | 1 | 0.9 | 1 | 9 / 10 / 9 / 14 / 7 | 49 | 90 |
| Mèo Mưa | `meo_mua` | Thủy | ★ Thường | Thông minh | 0.95 | 1 | 0.95 | 1 | 8 / 9 / 14 / 11 / 8 | 50 | 90 |
| Kỳ Giông Hồng | `ky_giong` | Thủy | ★★ Hiếm | Duyên dáng | 0.95 | 1.05 | 0.95 | 1.05 | 11 / 12 / 11 / 16 / 11 | 61 | 94 |
| Rùa Biển | `rua_bien` | Thủy | ★★ Hiếm | Thông minh | 0.9 | 0.95 | 0.9 | 0.95 | 11 / 12 / 14 / 12 / 11 | 60 | 94 |
| Vịt Mây | `vit_may` | Thủy | ★★ Hiếm | Nhanh nhẹn | 1 | 1.05 | 1 | 1.05 | 10 / 18 / 10 / 12 / 10 | 60 | 94 |
| Cá Chép Rồng | `ca_chep_rong` | Thủy | ★★★ Quý | Duyên dáng | 1 | 1.1 | 1 | 1.1 | 12 / 14 / 11 / 23 / 12 | 72 | 98 |
| Huyền Vũ | `huyen_vu` | Thủy | ★★★★ Huyền thoại | Thông minh | 0.9 | 1 | 0.9 | 1 | 15 / 18 / 21 / 17 / 13 | 84 | 102 |
| Cáo Lửa | `cao_lua` | Hỏa | ★ Thường | Nhanh nhẹn | 1.1 | 1.1 | 1.21 | 1.32 | 11 / 13 / 9 / 8 / 9 | 50 | 90 |
| Gà Trống Lửa | `ga_trong` | Hỏa | ★ Thường | Sức mạnh | 1.1 | 1.05 | 1.21 | 1.26 | 14 / 10 / 8 / 9 / 9 | 50 | 90 |
| Gấu Mèo Đỏ | `gau_meo_do` | Hỏa | ★ Thường | Duyên dáng | 1.05 | 1.05 | 1.16 | 1.26 | 11 / 8 / 8 / 14 / 9 | 50 | 90 |
| Kỳ Nhông Lửa | `ky_nhong` | Hỏa | ★ Thường | Sức mạnh | 1.15 | 1.1 | 1.26 | 1.32 | 15 / 10 / 9 / 8 / 8 | 50 | 90 |
| Heo Than | `heo_than` | Hỏa | ★ Thường | Sức mạnh | 1.2 | 1 | 1.32 | 1.2 | 13 / 10 / 9 / 9 / 9 | 50 | 90 |
| Lân Con | `lan_con` | Hỏa | ★★ Hiếm | Duyên dáng | 1.05 | 1.1 | 1.16 | 1.32 | 13 / 11 / 11 / 15 / 10 | 60 | 94 |
| Rồng Lửa Nhí | `rong_lua` | Hỏa | ★★ Hiếm | Sức mạnh | 1.15 | 1.15 | 1.26 | 1.38 | 19 / 12 / 10 / 10 / 9 | 60 | 94 |
| Chim Ưng Lửa | `ung_lua` | Hỏa | ★★ Hiếm | Nhanh nhẹn | 1.1 | 1.15 | 1.21 | 1.38 | 12 / 17 / 10 / 10 / 10 | 59 | 94 |
| Ngựa Lửa | `ngua_lua` | Hỏa | ★★★ Quý | Nhanh nhẹn | 1.1 | 1.2 | 1.21 | 1.44 | 15 / 21 / 13 / 11 / 12 | 72 | 98 |
| Chu Tước | `chu_tuoc` | Hỏa | ★★★★ Huyền thoại | Duyên dáng | 1.05 | 1.2 | 1.16 | 1.44 | 18 / 15 / 15 / 22 / 16 | 86 | 102 |
| Chuột Chũi | `chuot_chui` | Thổ | ★ Thường | Sức mạnh | 0.85 | 0.95 | 0.72 | 0.95 | 15 / 9 / 10 / 7 / 9 | 50 | 98 |
| Heo Đất | `heo_dat` | Thổ | ★ Thường | Khéo tay | 0.85 | 1 | 0.72 | 1 | 11 / 8 / 7 / 9 / 15 | 50 | 98 |
| Nghé Đất | `nghe_dat` | Thổ | ★ Thường | Sức mạnh | 0.95 | 1 | 0.81 | 1 | 15 / 9 / 8 / 9 / 9 | 50 | 98 |
| Lạc Đà Nhí | `lac_da` | Thổ | ★ Thường | Nhanh nhẹn | 0.8 | 1 | 0.68 | 1 | 10 / 12 / 9 / 9 / 10 | 50 | 98 |
| Chó Vàng | `cho_vang` | Thổ | ★ Thường | Nhanh nhẹn | 0.95 | 1.05 | 0.81 | 1.05 | 9 / 14 / 8 / 10 / 9 | 50 | 98 |
| Gấu Mật | `gau_mat` | Thổ | ★★ Hiếm | Sức mạnh | 1.05 | 0.95 | 0.89 | 0.95 | 16 / 11 / 12 / 9 / 12 | 60 | 102 |
| Tê Giác Đá | `te_giac_da` | Thổ | ★★ Hiếm | Sức mạnh | 0.9 | 0.95 | 0.77 | 0.95 | 16 / 11 / 11 / 9 / 13 | 60 | 102 |
| Sóc Nấm | `soc_nam` | Thổ | ★★ Hiếm | Khéo tay | 0.9 | 1 | 0.77 | 1 | 13 / 11 / 9 / 11 / 17 | 61 | 102 |
| Kỳ Lân Vàng | `ky_lan` | Thổ | ★★★ Quý | Duyên dáng | 0.9 | 1.05 | 0.77 | 1.05 | 16 / 11 / 13 / 17 / 15 | 72 | 106 |
| Hoàng Long | `hoang_long` | Thổ | ★★★★ Huyền thoại | Thông minh | 0.95 | 1.1 | 0.81 | 1.1 | 17 / 16 / 23 / 14 / 15 | 85 | 110 |
| Boba | `boba` | Thủy | ★ Thường | Khéo tay | 1 | 1 | 1 | 1 | 9 / 9 / 10 / 11 / 12 | 51 | 90 |

Nguồn: `public/ta-tua/game/js/shared/pets.js:152-209` (50 loài), `:218` (Boba), công thức `:246-264`, tuổi thọ `:134-137`.

## Nhận xét nhanh
- Giỏi Sức mạnh sẵn: Bạch Hổ (23), Rồng Lửa Nhí (19), Gấu Trúc, Gấu Mật, Tê Giác Đá (16): hợp [[Nghề Bốc vác]].
- Giỏi Nhanh nhẹn: Ngựa Lửa (21), Vịt Mây (18), Cáo Lá, Chim Ưng Lửa (17), Rái Cá (16): hợp [[Nghề Giao hàng]] và [[Câu cá]].
- Giỏi Thông minh: Thanh Long (25), Hoàng Long (23), Rùa Cổ Thụ, Huyền Vũ (21): hợp [[Nghề Gia sư]] và [[Ghép hình nhớ]].
- Giỏi Duyên dáng: Cá Chép Rồng (23), Chu Tước (22): hợp [[Nghề Ca sĩ đường phố]] và [[Quầy trà sữa]].
- Giỏi Khéo tay: Sóc Nấm (17), Mèo Bạc (16), Heo Đất, Sóc Đồng (15): hợp [[Nghề Pha chế]] và [[Bếp]].
- Loài Thường giỏi nhất ở mỗi nghề có kỹ năng chính 14–16, đủ để nhận nuôi ngay mà không cần trứng.

## Liên quan
- [[Loài và độ hiếm]] · [[Ngũ hành]] · [[Linh vật Boba]] · [[Kỹ năng]] · [[Việc làm]] · [[Chỉ số của bé]]
