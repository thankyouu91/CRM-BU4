---
tags: [petfarm, kinh-te, clan, nganh, food]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/clans.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🍲 Ẩm thực & nhà hàng, ngành food]
---
# Ngành Ẩm thực & nhà hàng

> [!summary]
> 🍲 Ngành `food`, một trong 11 ngành mà [[Clan|gia tộc]] có thể thâu tóm. Bồi thường thị trường khi vào ngành đầu tiên **35.000 xu**; nếu là ngành thứ 2 hoặc 3 của gia tộc thì gấp 10 (**350.000 xu**). Lô đất hợp địa hình và khí hậu thì sản lượng cao hơn. Cú sốc cầu của ngành đẩy giá [[Cá tươi]], [[Dâu tây]] trên Sàn.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Bồi thường (ngành đầu) | 35.000 xu, quản trị viên chỉnh được | `public/ta-tua/game/js/shared/clan.js:48`, `petdex/server/clans.js:32,256` |
| Bồi thường (ngành thứ 2, 3) | 35.000 × `expandMultiplier` (10) = 350.000 xu | `petdex/server/clans.js:24,256` |
| Phần vào ngân sách | 50% | `petdex/server/clans.js:389` |
| Hàng Sàn chịu sốc | Cá tươi, Dâu tây | `public/ta-tua/game/js/shared/clan.js:48`, `petdex/server/macro.js:84-89` |

## Độ hợp địa hình (cộng vào hệ số môi trường)
| Địa hình | Độ hợp |
|---|---|
| 🏙️ Trung tâm | +25% |
| 🏖️ Ven biển | +12% |
| 🏞️ Ven sông | +10% |
| 🌊 Trên biển | +5% |
| 🌾 Đồng bằng | -5% |
| ⛰️ Đồi núi | -12% |
| 🌲 Rừng | -15% |

## Độ hợp khí hậu
| Khí hậu | Độ hợp |
|---|---|
| ⛅ Ôn hòa | +5% |
| ☀️ Nhiều nắng | +4% |
| 🌧️ Mưa ẩm | -3% |
| 🌬️ Lộng gió | -3% |

Hệ số môi trường = `max(0,2; 1 + độ hợp địa hình + độ hợp khí hậu)` (`public/ta-tua/game/js/shared/clan.js:98-102`).

## 5 lô hợp nhất trên bản đồ
D09 (🏙️ Trung tâm, ⛅ Ôn hòa, ×1,30, giá gốc 1.998.000); D10 (🏙️ Trung tâm, ⛅ Ôn hòa, ×1,30, giá gốc 2.000.000); D11 (🏙️ Trung tâm, ⛅ Ôn hòa, ×1,30, giá gốc 1.880.000); D12 (🏙️ Trung tâm, ⛅ Ôn hòa, ×1,30, giá gốc 2.000.000); E08 (🏙️ Trung tâm, ⛅ Ôn hòa, ×1,30, giá gốc 1.985.000).

(Tính từ `PLOTS` sinh với hạt giống 20261030, `public/ta-tua/game/js/shared/clan.js:138-174`.)

## Liên quan
- [[Clan]] · [[Bản đồ đất]] · [[Kinh tế vĩ mô]] · [[Thuế doanh nghiệp]] · [[MOC Kinh tế và cộng đồng]]
