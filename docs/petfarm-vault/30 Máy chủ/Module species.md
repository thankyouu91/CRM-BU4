---
tags: [petfarm, may-chu, module, loai]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/species.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module species

> [!summary]
> `petdex/server/species.js` (42 dòng): danh sách loài phục vụ nhận nuôi và `/catalog`: linh vật Boba, loài khách mời Petdex (chỉ khi chạy Node có thư mục `pets/`), rồi 50 loài ngũ hành vẽ bằng bộ khung. Chỉ loài độ hiếm `thuong` (và linh vật, khách mời) nhận nuôi trực tiếp; loài hiếm nở từ trứng.

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `listSpecies()` | `species.js:29-40` | `MASCOTS` (rig, mascot, adoptable) + `guestSpecies()` + `SPECIES` (adoptable khi `rarity === 'thuong'`, mô tả = tính khí của hành) |
| `getSpecies(id)` | `species.js:42` | Tìm trong `listSpecies()` (dựng lại danh sách mỗi lần gọi) |

Hàm nội bộ `guestSpecies()` (dòng 9-23): bỏ loài đã có bản vẽ khung (`SPECIES_BY_ID`), hành/độ hiếm lấy từ `GUEST_SPECIES` hoặc mặc định `thuy`/`thuong`.

## Ai gọi
`routes.js` (`/catalog`, `/pets`), `internal.js` (tặng thú bất kỳ loài).

## Lưu ý
Trên Cloudflare `settings.guestPets` luôn rỗng, nên không có loài khách mời (`species.js:5-7`).

## Liên quan
- [[Loài và độ hiếm]] · [[Linh vật Boba]] · [[Trứng ngũ hành]] · [[Module settings]]
