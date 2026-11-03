---
tags: [petfarm, kinh-te, clan, nganh, fruit]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/clans.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🍓 Dâu tây & trái cây, ngành fruit]
---
# Ngành Dâu tây & trái cây

> [!summary]
> 🍓 Ngành `fruit`, một trong 11 ngành mà [[Clan|gia tộc]] có thể thâu tóm. Bồi thường thị trường khi vào ngành đầu tiên **35.000 xu**; nếu là ngành thứ 2 hoặc 3 của gia tộc thì gấp 10 (**350.000 xu**). Lô đất hợp địa hình và khí hậu thì sản lượng cao hơn. Cú sốc cầu của ngành đẩy giá [[Dâu tây]] trên Sàn.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Bồi thường (ngành đầu) | 35.000 xu, quản trị viên chỉnh được | `public/ta-tua/game/js/shared/clan.js:33`, `petdex/server/clans.js:32,256` |
| Bồi thường (ngành thứ 2, 3) | 35.000 × `expandMultiplier` (10) = 350.000 xu | `petdex/server/clans.js:24,256` |
| Phần vào ngân sách | 50% | `petdex/server/clans.js:389` |
| Hàng Sàn chịu sốc | Dâu tây | `public/ta-tua/game/js/shared/clan.js:33`, `petdex/server/macro.js:84-89` |

## Độ hợp địa hình (cộng vào hệ số môi trường)
| Địa hình | Độ hợp |
|---|---|
| ⛰️ Đồi núi | +18% |
| 🌾 Đồng bằng | +5% |
| 🌲 Rừng | +4% |
| 🏞️ Ven sông | +3% |
| 🏖️ Ven biển | -10% |
| 🏙️ Trung tâm | -30% |
| 🌊 Trên biển | -60% |

## Độ hợp khí hậu
| Khí hậu | Độ hợp |
|---|---|
| ⛅ Ôn hòa | +12% |
| ☀️ Nhiều nắng | +2% |
| 🌧️ Mưa ẩm | -8% |
| 🌬️ Lộng gió | -8% |

Hệ số môi trường = `max(0,2; 1 + độ hợp địa hình + độ hợp khí hậu)` (`public/ta-tua/game/js/shared/clan.js:98-102`).

## 5 lô hợp nhất trên bản đồ
A02 (⛰️ Đồi núi, ⛅ Ôn hòa, ×1,30, giá gốc 533.000); A03 (⛰️ Đồi núi, ⛅ Ôn hòa, ×1,30, giá gốc 542.000); B03 (⛰️ Đồi núi, ⛅ Ôn hòa, ×1,30, giá gốc 450.000); A10 (⛰️ Đồi núi, ☀️ Nhiều nắng, ×1,20, giá gốc 577.000); A12 (🌾 Đồng bằng, ⛅ Ôn hòa, ×1,17, giá gốc 467.000).

(Tính từ `PLOTS` sinh với hạt giống 20261030, `public/ta-tua/game/js/shared/clan.js:138-174`.)

## Liên quan
- [[Clan]] · [[Bản đồ đất]] · [[Kinh tế vĩ mô]] · [[Thuế doanh nghiệp]] · [[MOC Kinh tế và cộng đồng]]
