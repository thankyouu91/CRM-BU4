---
tags: [petfarm, kinh-te, clan, nganh, logistics]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/clans.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [📦 Giao vận & bốc xếp, ngành logistics]
---
# Ngành Giao vận & bốc xếp

> [!summary]
> 📦 Ngành `logistics`, một trong 11 ngành mà [[Clan|gia tộc]] có thể thâu tóm. Bồi thường thị trường khi vào ngành đầu tiên **25.000 xu**; nếu là ngành thứ 2 hoặc 3 của gia tộc thì gấp 10 (**250.000 xu**). Lô đất hợp địa hình và khí hậu thì sản lượng cao hơn.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Bồi thường (ngành đầu) | 25.000 xu, quản trị viên chỉnh được | `public/ta-tua/game/js/shared/clan.js:53`, `petdex/server/clans.js:32,256` |
| Bồi thường (ngành thứ 2, 3) | 25.000 × `expandMultiplier` (10) = 250.000 xu | `petdex/server/clans.js:24,256` |
| Phần vào ngân sách | 50% | `petdex/server/clans.js:389` |
| Hàng Sàn chịu sốc | không có (tin chung, không đổi giá) | `public/ta-tua/game/js/shared/clan.js:53`, `petdex/server/macro.js:84-89` |

## Độ hợp địa hình (cộng vào hệ số môi trường)
| Địa hình | Độ hợp |
|---|---|
| 🏞️ Ven sông | +18% |
| 🏖️ Ven biển | +15% |
| 🏙️ Trung tâm | +12% |
| 🌾 Đồng bằng | +8% |
| 🌊 Trên biển | -10% |
| ⛰️ Đồi núi | -20% |
| 🌲 Rừng | -25% |

## Độ hợp khí hậu
| Khí hậu | Độ hợp |
|---|---|
| ⛅ Ôn hòa | +4% |
| ☀️ Nhiều nắng | +2% |
| 🌬️ Lộng gió | -6% |
| 🌧️ Mưa ẩm | -8% |

Hệ số môi trường = `max(0,2; 1 + độ hợp địa hình + độ hợp khí hậu)` (`public/ta-tua/game/js/shared/clan.js:98-102`).

## 5 lô hợp nhất trên bản đồ
F03 (🏞️ Ven sông, ⛅ Ôn hòa, ×1,22, giá gốc 897.000); G05 (🏞️ Ven sông, ⛅ Ôn hòa, ×1,22, giá gốc 1.001.000); G07 (🏞️ Ven sông, ☀️ Nhiều nắng, ×1,20, giá gốc 1.118.000); F19 (🏖️ Ven biển, ☀️ Nhiều nắng, ×1,17, giá gốc 1.149.000); F20 (🏖️ Ven biển, ☀️ Nhiều nắng, ×1,17, giá gốc 929.000).

(Tính từ `PLOTS` sinh với hạt giống 20261030, `public/ta-tua/game/js/shared/clan.js:138-174`.)

## Liên quan
- [[Clan]] · [[Bản đồ đất]] · [[Kinh tế vĩ mô]] · [[Thuế doanh nghiệp]] · [[MOC Kinh tế và cộng đồng]]
