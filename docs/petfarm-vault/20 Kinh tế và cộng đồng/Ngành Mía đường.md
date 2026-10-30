---
tags: [petfarm, kinh-te, clan, nganh, sugar]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/clans.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🎋 Mía đường, ngành sugar]
---
# Ngành Mía đường

> [!summary]
> 🎋 Ngành `sugar`, một trong 11 ngành mà [[Clan|gia tộc]] có thể thâu tóm. Bồi thường thị trường khi vào ngành đầu tiên **20.000 xu**; nếu là ngành thứ 2 hoặc 3 của gia tộc thì gấp 10 (**200.000 xu**). Lô đất hợp địa hình và khí hậu thì sản lượng cao hơn. Cú sốc cầu của ngành đẩy giá [[Mía]], [[Đường nâu]] trên Sàn.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Bồi thường (ngành đầu) | 20.000 xu, quản trị viên chỉnh được | `public/ta-tua/game/js/shared/clan.js:23`, `petdex/server/clans.js:32,256` |
| Bồi thường (ngành thứ 2, 3) | 20.000 × `expandMultiplier` (10) = 200.000 xu | `petdex/server/clans.js:24,256` |
| Phần vào ngân sách | 50% | `petdex/server/clans.js:389` |
| Hàng Sàn chịu sốc | Mía, Đường nâu | `public/ta-tua/game/js/shared/clan.js:23`, `petdex/server/macro.js:84-89` |

## Độ hợp địa hình (cộng vào hệ số môi trường)
| Địa hình | Độ hợp |
|---|---|
| 🌾 Đồng bằng | +15% |
| 🏞️ Ven sông | +10% |
| 🏖️ Ven biển | +2% |
| ⛰️ Đồi núi | -10% |
| 🌲 Rừng | -15% |
| 🏙️ Trung tâm | -30% |
| 🌊 Trên biển | -60% |

## Độ hợp khí hậu
| Khí hậu | Độ hợp |
|---|---|
| ☀️ Nhiều nắng | +15% |
| ⛅ Ôn hòa | +3% |
| 🌬️ Lộng gió | -2% |
| 🌧️ Mưa ẩm | -8% |

Hệ số môi trường = `max(0,2; 1 + độ hợp địa hình + độ hợp khí hậu)` (`public/ta-tua/game/js/shared/clan.js:98-102`).

## 5 lô hợp nhất trên bản đồ
F05 (🌾 Đồng bằng, ☀️ Nhiều nắng, ×1,30, giá gốc 420.000); F06 (🌾 Đồng bằng, ☀️ Nhiều nắng, ×1,30, giá gốc 452.000); F07 (🌾 Đồng bằng, ☀️ Nhiều nắng, ×1,30, giá gốc 623.000); F14 (🌾 Đồng bằng, ☀️ Nhiều nắng, ×1,30, giá gốc 518.000); F15 (🌾 Đồng bằng, ☀️ Nhiều nắng, ×1,30, giá gốc 518.000).

(Tính từ `PLOTS` sinh với hạt giống 20261030, `public/ta-tua/game/js/shared/clan.js:138-174`.)

## Liên quan
- [[Clan]] · [[Bản đồ đất]] · [[Kinh tế vĩ mô]] · [[Thuế doanh nghiệp]] · [[MOC Kinh tế và cộng đồng]]
