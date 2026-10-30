---
tags: [petfarm, thiet-ke, tai-lieu, ngu-hanh]
loai: thiet-ke
trang-thai: dang-chay
nguon: [petdex/docs/thiet-ke-pet-ngu-hanh.md, public/ta-tua/game/js/shared/pets.js, docs/pet-town-gear-balance.md]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Thiết kế pet ngũ hành

> [!summary]
> `petdex/docs/thiet-ke-pet-ngu-hanh.md` (357 dòng) là thiết kế "giai đoạn 2.5" chen giữa giai đoạn 2 và 3: vẽ lại mọi bé bằng **một bộ khung chung** để đồ đeo "dính" lên người, đưa **ngũ hành** vào luật chơi, thêm **6 giai đoạn đời** và **vòng đời** có kết thúc (Đồi Sao). Ba bước 2.5A, 2.5B, 2.5C đều **đã vào game**; sau đó có thêm Boba vẽ bằng bộ khung và hào quang cho bé quý hiếm. Một số con số trong tài liệu đã bị các bản sau vượt qua (5 khe đồ, 55 món, cộng dồn có giảm dần).

## Cấu trúc tài liệu
| Mục | Nội dung | Dòng |
|---|---|---|
| 1 | Vì sao đồ đeo cũ "không dính" (ảnh Boba vẽ sẵn, mũ dán tọa độ cố định) | `petdex/docs/thiet-ke-pet-ngu-hanh.md:10-16` |
| 2 | Bộ khung vẽ chung: 5 dáng, bộ phận, lưới 44×50, điểm neo, thứ tự lớp | `petdex/docs/thiet-ke-pet-ngu-hanh.md:18-58` |
| 3 | Ngũ hành: màu, kỹ năng, chỉ số, lợi thế, tương sinh/khắc | `petdex/docs/thiet-ke-pet-ngu-hanh.md:60-81` |
| 4 | Sáu giai đoạn đời và cuối đời | `petdex/docs/thiet-ke-pet-ngu-hanh.md:83-104` |
| 5 | 50 loài | `petdex/docs/thiet-ke-pet-ngu-hanh.md:106-187` |
| 6 | Đồ đeo, vật dụng, quà đồng bộ | `petdex/docs/thiet-ke-pet-ngu-hanh.md:189-199` |
| 7 | Cách có pet (trứng theo hành) | `petdex/docs/thiet-ke-pet-ngu-hanh.md:201-205` |
| 8 | Đưa vào game, chuyển dữ liệu, lộ trình 2.5A/B/C | `petdex/docs/thiet-ke-pet-ngu-hanh.md:207-221` |
| 9 | Câu hỏi cần chủ dự án chốt | `petdex/docs/thiet-ke-pet-ngu-hanh.md:223-228` |
| 10 | Nhật ký triển khai | `petdex/docs/thiet-ke-pet-ngu-hanh.md:230-357` |

## Ba bước và kết quả
| Bước | Nội dung | Trạng thái |
|---|---|---|
| **2.5A Hình mới** | Bộ khung vẽ ở Nhà, công viên, thăm nhà, bảng vàng, nhận nuôi; tủ đồ 4 khe; đồ ăn/chăm sóc/đồ chơi vẽ pixel; 6 giai đoạn tuổi phía server; bảng `pet_wear` thay cột `accessory` | ✅ |
| **2.5B Ngũ hành** | Số liệu 50 loài vào luật; hợp mệnh đồ đeo; đồ ăn có hành (+20% XP); vận khí ngày (+10% XP và lương); lợi thế làm ăn theo hành; trứng ngũ hành | ✅ |
| **2.5C Vòng đời** | Luật theo giai đoạn; lương thâm niên; tuổi thọ; Đồi Sao; kỷ vật; ô tưởng niệm; trứng tưởng niệm | ✅ |
| Boba vẽ bằng bộ khung | Boba thành linh vật (`MASCOTS`), không tính vào 50 loài, ôm cốc trà sữa | ✅ |
| Hào quang | Bé Quý (tím, 3 hạt) và Huyền thoại (vàng, 5 hạt) | ✅ |

Luật chi tiết ở [[Ngũ hành]], [[Hợp mệnh và kỵ mệnh]], [[Hành vượng]], [[Trứng ngũ hành]], [[Giai đoạn tuổi]], [[Vòng đời và Đồi Sao]], [[Bộ khung thú]], [[Linh vật Boba]].

## Con số chính, đối chiếu code
| Thông số | Tài liệu | Code | Nguồn code |
|---|---|---|---|
| Số loài ngũ hành | 50 | 50 (`SPECIES`) + 1 linh vật Boba | `public/ta-tua/game/js/shared/pets.js` |
| Tỷ lệ trứng | 75 / 20 / 4 / 1 % | `EGG_ODDS` 0,75 / 0,2 / 0,04 / 0,01 | `public/ta-tua/game/js/shared/pets.js:335` |
| Trứng | 600 xu, cấp 3, ấp 24 giờ | `EGG = { hours: 24, price: 600, minLevel: 3 }` | `public/ta-tua/game/js/shared/pets.js:336` |
| Tuổi thọ cộng theo độ hiếm | tới +12 tuần | Thường 0, Hiếm 4, Quý 8, Huyền thoại 12 | `public/ta-tua/game/js/shared/pets.js:68-71` |
| Báo trước | 7 tuần | `warnWeeks: 7` | `public/ta-tua/game/js/shared/pets.js:122` |
| Mở lại ô tưởng niệm | 3.000 xu × chỉ số giá | `reopenCost: 3000` | `public/ta-tua/game/js/shared/pets.js:123` |
| Trứng tưởng niệm | nở sau 3 ngày | `memorialEggDays: 3` | `public/ta-tua/game/js/shared/pets.js:124` |
| Kỷ vật | +5 kỹ năng sở trường | `heirloom: 5` | `public/ta-tua/game/js/shared/pets.js:125` |
| Lương thâm niên | +1% mỗi 10 giờ, tối đa +30% | `seniorityPer10h: 0.01`, `seniorityMax: 0.3` | `public/ta-tua/game/js/shared/pets.js:126-127` |
| Giai đoạn đời | 6 | `LIFE_STAGES` có 6 | `public/ta-tua/game/js/shared/pets.js` |
| Số ô nuôi | 4 | `maxPets: 4` | `petdex/server/game.js:15` |

> [!warning] Lệch tài liệu: tài liệu đã cũ ở phần đồ đeo
> - Tài liệu nói **4 khe** (Đầu, Mặt, Cổ, Lưng) và "Tổng 22 món". Code hiện có **5 khe** (thêm `charm`, Bùa) và **55 món** đồ đeo (`WEARABLES`), sau `5cfbd34` (+24 món, giới hạn đeo 3/4/5 theo cấp) và `152cd2e` (+9 món). README lại ghi "46 món" (README.md:174), cũng đã cũ.
> - Mục 3 ghi bộ đồ "từ 3 món cùng một hành" với 3/5/8% và hợp mệnh "không có trần" theo bản gốc; từ `152cd2e`, ái lực hợp mệnh của cả bộ có **trần +30%** (`wearCap`, `public/ta-tua/game/js/shared/pets.js:290`) và dòng chỉ số cộng dồn có giảm dần (đủ 25%, phần vượt 50%, tổng tối đa 60%). Xem `docs/pet-town-gear-balance.md` và [[Bộ đồ ngũ hành]], [[Cấp trang phục]].
> - Đường dẫn trong tài liệu (`public/js/shared/pets.js`, `public/js/rig.js`, `/pet-lab.html`) là của repo gốc; ở đây là `public/ta-tua/game/js/...` và `/ta-tua/game/pet-lab.html`.

## Câu hỏi đã chốt tạm (mục 9 và nhật ký)
- Giữ Boba (thành linh vật, không phải "khách mời").
- Cách có pet: trứng ngẫu nhiên theo hành; loài Hiếm trở lên chỉ có từ trứng; quản trị viên vẫn tặng được mọi loài ([[Bảng quản lý Pet Town]]).
- Pet không bán ở Chợ Phiên; trứng bán được vì loài chưa bốc khi trứng còn trong túi.
- Có kỷ vật khi bé mất.

## Mô phỏng trong nhật ký
- 2.5B: 45 bot × 30 ngày, lương trung bình 184 xu/bot/ngày (trung tính 178), khám bệnh 34 lượt (trung tính 40); ngũ hành tạo khác biệt nhỏ, không vỡ cân bằng (`petdex/docs/thiet-ke-pet-ngu-hanh.md:286-291`).
- 2.5C: bot bắt đầu ở 30 tuần, lương trung bình 205 xu/bot/ngày (`petdex/docs/thiet-ke-pet-ngu-hanh.md:330-332`).

## Liên quan
- [[Tài liệu thiết kế mở rộng]]
- [[Lộ trình phát triển]]
- [[Quyết định thiết kế]]
- [[Xưởng tạo hình Pet Lab]]
- [[Loài và độ hiếm]]
- [[MOC Thiết kế]]
