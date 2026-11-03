---
tags: [petfarm, luat-choi, loai]
aliases: [Loài, Độ hiếm, Thường, Hiếm, Quý, Huyền thoại]
loai: luat
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/pets.js, petdex/server/species.js, petdex/server/routes.js, petdex/server/eggs.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Loài và độ hiếm

> [!summary]
> Game có **50 loài** vẽ bằng bộ khung, chia đều 5 hành × 10 loài, mỗi hành gồm 5 loài Thường, 3 Hiếm, 1 Quý, 1 Huyền thoại; cộng linh vật [[Linh vật Boba]]. Chỉ loài Thường (và Boba) nhận nuôi trực tiếp được; loài hiếm hơn phải nở từ [[Trứng ngũ hành]]. Độ hiếm tăng tổng kỹ năng khởi đầu và tuổi thọ; Huyền thoại còn đeo thêm 1 món trang phục.

## Con số
| Độ hiếm | Sao | Tổng kỹ năng khởi đầu | Tuổi thọ thêm | Khác | Tỉ lệ nở từ trứng | Nguồn |
|---|---|---|---|---|---|---|
| Thường (`thuong`) | ★ | 50 | 0 | nhận nuôi trực tiếp | 75% | `public/ta-tua/game/js/shared/pets.js:68,335` |
| Hiếm (`hiem`) | ★★ | 60 | +4 tuần | | 20% | `public/ta-tua/game/js/shared/pets.js:69,335` |
| Quý (`quy`) | ★★★ | 72 | +8 tuần | | 4% | `public/ta-tua/game/js/shared/pets.js:70,335` |
| Huyền thoại (`huyenthoai`) | ★★★★ | 85 | +12 tuần | đeo thêm 1 món (tối đa 5) | 1% | `public/ta-tua/game/js/shared/pets.js:71,335,372-376` |

| Hành | Thường ★ | Hiếm ★★ | Quý ★★★ | Huyền thoại ★★★★ |
|---|---|---|---|---|
| Kim | Mèo Bạc, Chuột Chuông, Sóc Đồng, Gà Vàng, Tê Tê Thép | Cú Ánh Kim, Hươu Pha Lê, Sói Bạc | Hạc Bạc | Bạch Hổ |
| Mộc | Thỏ Lá, Ếch Sen, Khỉ Tre, Nhím Rêu, Cún Cỏ | Gấu Trúc, Hươu Rêu, Cáo Lá | Rùa Cổ Thụ | Thanh Long |
| Thủy | Rái Cá, Chim Cánh Cụt, Hải Cẩu, Cá Nóc, Mèo Mưa | Kỳ Giông Hồng, Rùa Biển, Vịt Mây | Cá Chép Rồng | Huyền Vũ |
| Hỏa | Cáo Lửa, Gà Trống Lửa, Gấu Mèo Đỏ, Kỳ Nhông Lửa, Heo Than | Lân Con, Rồng Lửa Nhí, Chim Ưng Lửa | Ngựa Lửa | Chu Tước |
| Thổ | Chuột Chũi, Heo Đất, Nghé Đất, Lạc Đà Nhí, Chó Vàng | Gấu Mật, Tê Giác Đá, Sóc Nấm | Kỳ Lân Vàng | Hoàng Long |

(`SPECIES`, `public/ta-tua/game/js/shared/pets.js:150-210`.) Bảng đầy đủ số liệu từng loài: [[Danh mục loài]].

## Cách hoạt động
- Mỗi loài khai báo `S(id, name, element, rarity, body, ears, tail, face, pattern, feature, colors, fav, appetite, stamina)` (`public/ta-tua/game/js/shared/pets.js:146-148`): dáng khung (`biped`, `quad`, `round`, `bird`, `serpent`), bộ phận vẽ, 3 màu, kỹ năng sở trường `fav`, hệ số ăn `appetite` và hồi sức `stamina`.
- `speciesStats(sp)` (`public/ta-tua/game/js/shared/pets.js:246-264`) tính số liệu cố định cho loài:
  - Trọng số kỹ năng k = hệ số hành[k] + 0,6 nếu k là sở trường + `hash(id+k)` × 0,4; kỹ năng khởi đầu = round(trọng số / tổng × `skillSum`). Vì làm tròn, tổng thật có thể lệch ±1 (49–51, 59–61...).
  - Hệ số lên kỹ năng `growth[k]` = hệ số hành[k] + 0,1 nếu là sở trường.
  - `fullness` = `appetite` × hệ số No bụng của hành; `energyRegen` = `stamina` × hệ số hồi năng lượng của hành.
- `listSpecies()` (`petdex/server/species.js:29-40`) trả Boba, loài khách mời (nếu có), rồi 50 loài; `adoptable` = `rarity === 'thuong'` (37).
- Nhận nuôi loài không nhận được báo "<Loài> là loài hiếm, chưa nhận nuôi trực tiếp được." (`petdex/server/routes.js:174`).
- **Loài khách mời** (ảnh vẽ sẵn cài từ Petdex) mặc định hành Thủy, Thường, nhận nuôi được; trên Cloudflare danh sách rỗng (`petdex/server/species.js:9-23`). Loài lạ hoàn toàn dùng số liệu trung tính (mọi kỹ năng 10, hệ số 1) (`public/ta-tua/game/js/shared/pets.js:267-271`).

## Trường hợp đặc biệt
- Bé Huyền thoại dưới cấp 30 đeo 4 món, từ cấp 30 đeo 5 món (đủ cả khe Bùa) ([[Trang phục]]).
- Loài Hỏa ăn nhiều nhất: Heo Than có hệ số No bụng 1,32; loài Thổ ít nhất: Lạc Đà Nhí 0,68.
- Tuổi thọ dài nhất: Hoàng Long (Thổ, Huyền thoại) nền 110 tuần, tối đa 130 ([[Vòng đời và Đồi Sao]]).

## Liên quan
- [[Danh mục loài]] · [[Ngũ hành]] · [[Trứng ngũ hành]] · [[Linh vật Boba]] · [[Kỹ năng]] · [[Bộ khung thú]] · [[Xưởng tạo hình Pet Lab]]
