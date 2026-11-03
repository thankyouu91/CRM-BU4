---
tags: [petfarm, kinh-te, clan, nganh, dairy]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/clans.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🥛 Bò sữa & sữa đặc, ngành dairy]
---
# Ngành Bò sữa & sữa đặc

> [!summary]
> 🥛 Ngành `dairy`, một trong 11 ngành mà [[Clan|gia tộc]] có thể thâu tóm. Bồi thường thị trường khi vào ngành đầu tiên **40.000 xu**; nếu là ngành thứ 2 hoặc 3 của gia tộc thì gấp 10 (**400.000 xu**). Lô đất hợp địa hình và khí hậu thì sản lượng cao hơn. Cú sốc cầu của ngành đẩy giá [[Sữa tươi]], [[Sữa đặc]] trên Sàn.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Bồi thường (ngành đầu) | 40.000 xu, quản trị viên chỉnh được | `public/ta-tua/game/js/shared/clan.js:18`, `petdex/server/clans.js:32,256` |
| Bồi thường (ngành thứ 2, 3) | 40.000 × `expandMultiplier` (10) = 400.000 xu | `petdex/server/clans.js:24,256` |
| Phần vào ngân sách | 50% | `petdex/server/clans.js:389` |
| Hàng Sàn chịu sốc | Sữa tươi, Sữa đặc | `public/ta-tua/game/js/shared/clan.js:18`, `petdex/server/macro.js:84-89` |

## Độ hợp địa hình (cộng vào hệ số môi trường)
| Địa hình | Độ hợp |
|---|---|
| 🌾 Đồng bằng | +18% |
| 🏞️ Ven sông | +8% |
| ⛰️ Đồi núi | +5% |
| 🌲 Rừng | -5% |
| 🏖️ Ven biển | -8% |
| 🏙️ Trung tâm | -25% |
| 🌊 Trên biển | -60% |

## Độ hợp khí hậu
| Khí hậu | Độ hợp |
|---|---|
| ⛅ Ôn hòa | +8% |
| ☀️ Nhiều nắng | 0% |
| 🌬️ Lộng gió | -3% |
| 🌧️ Mưa ẩm | -4% |

Hệ số môi trường = `max(0,2; 1 + độ hợp địa hình + độ hợp khí hậu)` (`public/ta-tua/game/js/shared/clan.js:98-102`).

## 5 lô hợp nhất trên bản đồ
A12 (🌾 Đồng bằng, ⛅ Ôn hòa, ×1,26, giá gốc 467.000); A13 (🌾 Đồng bằng, ⛅ Ôn hòa, ×1,26, giá gốc 510.000); A14 (🌾 Đồng bằng, ⛅ Ôn hòa, ×1,26, giá gốc 553.000); B11 (🌾 Đồng bằng, ⛅ Ôn hòa, ×1,26, giá gốc 525.000); B12 (🌾 Đồng bằng, ⛅ Ôn hòa, ×1,26, giá gốc 657.000).

(Tính từ `PLOTS` sinh với hạt giống 20261030, `public/ta-tua/game/js/shared/clan.js:138-174`.)

## Liên quan
- [[Clan]] · [[Bản đồ đất]] · [[Kinh tế vĩ mô]] · [[Thuế doanh nghiệp]] · [[MOC Kinh tế và cộng đồng]]
