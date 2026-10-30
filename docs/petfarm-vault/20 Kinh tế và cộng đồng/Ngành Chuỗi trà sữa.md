---
tags: [petfarm, kinh-te, clan, nganh, beverage]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/clans.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🧋 Chuỗi trà sữa, ngành beverage]
---
# Ngành Chuỗi trà sữa

> [!summary]
> 🧋 Ngành `beverage`, một trong 11 ngành mà [[Clan|gia tộc]] có thể thâu tóm. Bồi thường thị trường khi vào ngành đầu tiên **45.000 xu**; nếu là ngành thứ 2 hoặc 3 của gia tộc thì gấp 10 (**450.000 xu**). Lô đất hợp địa hình và khí hậu thì sản lượng cao hơn. Cú sốc cầu của ngành đẩy giá [[Trân châu (nguyên liệu)]], [[Sữa tươi]] trên Sàn.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Bồi thường (ngành đầu) | 45.000 xu, quản trị viên chỉnh được | `public/ta-tua/game/js/shared/clan.js:43`, `petdex/server/clans.js:32,256` |
| Bồi thường (ngành thứ 2, 3) | 45.000 × `expandMultiplier` (10) = 450.000 xu | `petdex/server/clans.js:24,256` |
| Phần vào ngân sách | 50% | `petdex/server/clans.js:389` |
| Hàng Sàn chịu sốc | Trân châu, Sữa tươi | `public/ta-tua/game/js/shared/clan.js:43`, `petdex/server/macro.js:84-89` |

## Độ hợp địa hình (cộng vào hệ số môi trường)
| Địa hình | Độ hợp |
|---|---|
| 🏙️ Trung tâm | +30% |
| 🏖️ Ven biển | +10% |
| 🏞️ Ven sông | +8% |
| 🌊 Trên biển | +5% |
| 🌾 Đồng bằng | -5% |
| ⛰️ Đồi núi | -15% |
| 🌲 Rừng | -20% |

## Độ hợp khí hậu
| Khí hậu | Độ hợp |
|---|---|
| ☀️ Nhiều nắng | +8% |
| ⛅ Ôn hòa | +6% |
| 🌬️ Lộng gió | -4% |
| 🌧️ Mưa ẩm | -6% |

Hệ số môi trường = `max(0,2; 1 + độ hợp địa hình + độ hợp khí hậu)` (`public/ta-tua/game/js/shared/clan.js:98-102`).

## 5 lô hợp nhất trên bản đồ
D09 (🏙️ Trung tâm, ⛅ Ôn hòa, ×1,36, giá gốc 1.998.000); D10 (🏙️ Trung tâm, ⛅ Ôn hòa, ×1,36, giá gốc 2.000.000); D11 (🏙️ Trung tâm, ⛅ Ôn hòa, ×1,36, giá gốc 1.880.000); D12 (🏙️ Trung tâm, ⛅ Ôn hòa, ×1,36, giá gốc 2.000.000); E08 (🏙️ Trung tâm, ⛅ Ôn hòa, ×1,36, giá gốc 1.985.000).

(Tính từ `PLOTS` sinh với hạt giống 20261030, `public/ta-tua/game/js/shared/clan.js:138-174`.)

## Liên quan
- [[Clan]] · [[Bản đồ đất]] · [[Kinh tế vĩ mô]] · [[Thuế doanh nghiệp]] · [[MOC Kinh tế và cộng đồng]]
