---
tags: [petfarm, kinh-te, clan, nganh, fishery]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/clans.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🐟 Thủy hải sản, ngành fishery]
---
# Ngành Thủy hải sản

> [!summary]
> 🐟 Ngành `fishery`, một trong 11 ngành mà [[Clan|gia tộc]] có thể thâu tóm. Bồi thường thị trường khi vào ngành đầu tiên **50.000 xu**; nếu là ngành thứ 2 hoặc 3 của gia tộc thì gấp 10 (**500.000 xu**). Lô đất hợp địa hình và khí hậu thì sản lượng cao hơn. Cú sốc cầu của ngành đẩy giá [[Cá tươi]] trên Sàn.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Bồi thường (ngành đầu) | 50.000 xu, quản trị viên chỉnh được | `public/ta-tua/game/js/shared/clan.js:38`, `petdex/server/clans.js:32,256` |
| Bồi thường (ngành thứ 2, 3) | 50.000 × `expandMultiplier` (10) = 500.000 xu | `petdex/server/clans.js:24,256` |
| Phần vào ngân sách | 50% | `petdex/server/clans.js:389` |
| Hàng Sàn chịu sốc | Cá tươi | `public/ta-tua/game/js/shared/clan.js:38`, `petdex/server/macro.js:84-89` |

## Độ hợp địa hình (cộng vào hệ số môi trường)
| Địa hình | Độ hợp |
|---|---|
| 🌊 Trên biển | +35% |
| 🏖️ Ven biển | +22% |
| 🏞️ Ven sông | +12% |
| 🌾 Đồng bằng | -25% |
| 🏙️ Trung tâm | -30% |
| 🌲 Rừng | -40% |
| ⛰️ Đồi núi | -45% |

## Độ hợp khí hậu
| Khí hậu | Độ hợp |
|---|---|
| ☀️ Nhiều nắng | +5% |
| ⛅ Ôn hòa | +2% |
| 🌧️ Mưa ẩm | 0% |
| 🌬️ Lộng gió | -5% |

Hệ số môi trường = `max(0,2; 1 + độ hợp địa hình + độ hợp khí hậu)` (`public/ta-tua/game/js/shared/clan.js:98-102`).

## 5 lô hợp nhất trên bản đồ
G19 (🌊 Trên biển, ☀️ Nhiều nắng, ×1,40, giá gốc 835.000); G20 (🌊 Trên biển, ☀️ Nhiều nắng, ×1,40, giá gốc 784.000); H16 (🌊 Trên biển, ☀️ Nhiều nắng, ×1,40, giá gốc 875.000); H17 (🌊 Trên biển, ☀️ Nhiều nắng, ×1,40, giá gốc 889.000); H18 (🌊 Trên biển, ☀️ Nhiều nắng, ×1,40, giá gốc 827.000).

(Tính từ `PLOTS` sinh với hạt giống 20261030, `public/ta-tua/game/js/shared/clan.js:138-174`.)

## Liên quan
- [[Clan]] · [[Bản đồ đất]] · [[Kinh tế vĩ mô]] · [[Thuế doanh nghiệp]] · [[MOC Kinh tế và cộng đồng]]
