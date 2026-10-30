---
tags: [petfarm, kinh-te, clan, nganh, entertainment]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/clans.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🎤 Giải trí & ca nhạc, ngành entertainment]
---
# Ngành Giải trí & ca nhạc

> [!summary]
> 🎤 Ngành `entertainment`, một trong 11 ngành mà [[Clan|gia tộc]] có thể thâu tóm. Bồi thường thị trường khi vào ngành đầu tiên **30.000 xu**; nếu là ngành thứ 2 hoặc 3 của gia tộc thì gấp 10 (**300.000 xu**). Lô đất hợp địa hình và khí hậu thì sản lượng cao hơn.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Bồi thường (ngành đầu) | 30.000 xu, quản trị viên chỉnh được | `public/ta-tua/game/js/shared/clan.js:63`, `petdex/server/clans.js:32,256` |
| Bồi thường (ngành thứ 2, 3) | 30.000 × `expandMultiplier` (10) = 300.000 xu | `petdex/server/clans.js:24,256` |
| Phần vào ngân sách | 50% | `petdex/server/clans.js:389` |
| Hàng Sàn chịu sốc | không có (tin chung, không đổi giá) | `public/ta-tua/game/js/shared/clan.js:63`, `petdex/server/macro.js:84-89` |

## Độ hợp địa hình (cộng vào hệ số môi trường)
| Địa hình | Độ hợp |
|---|---|
| 🏙️ Trung tâm | +22% |
| 🏖️ Ven biển | +18% |
| 🌊 Trên biển | +15% |
| 🏞️ Ven sông | +6% |
| 🌲 Rừng | +2% |
| 🌾 Đồng bằng | -4% |
| ⛰️ Đồi núi | -6% |

## Độ hợp khí hậu
| Khí hậu | Độ hợp |
|---|---|
| ☀️ Nhiều nắng | +10% |
| ⛅ Ôn hòa | +4% |
| 🌬️ Lộng gió | -4% |
| 🌧️ Mưa ẩm | -10% |

Hệ số môi trường = `max(0,2; 1 + độ hợp địa hình + độ hợp khí hậu)` (`public/ta-tua/game/js/shared/clan.js:98-102`).

## 5 lô hợp nhất trên bản đồ
F19 (🏖️ Ven biển, ☀️ Nhiều nắng, ×1,28, giá gốc 1.149.000); F20 (🏖️ Ven biển, ☀️ Nhiều nắng, ×1,28, giá gốc 929.000); G16 (🏖️ Ven biển, ☀️ Nhiều nắng, ×1,28, giá gốc 1.170.000); G17 (🏖️ Ven biển, ☀️ Nhiều nắng, ×1,28, giá gốc 1.032.000); G18 (🏖️ Ven biển, ☀️ Nhiều nắng, ×1,28, giá gốc 1.023.000).

(Tính từ `PLOTS` sinh với hạt giống 20261030, `public/ta-tua/game/js/shared/clan.js:138-174`.)

## Liên quan
- [[Clan]] · [[Bản đồ đất]] · [[Kinh tế vĩ mô]] · [[Thuế doanh nghiệp]] · [[MOC Kinh tế và cộng đồng]]
