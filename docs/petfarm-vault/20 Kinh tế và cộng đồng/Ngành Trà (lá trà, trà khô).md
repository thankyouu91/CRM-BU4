---
tags: [petfarm, kinh-te, clan, nganh, tea]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/clans.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🍃 Trà (lá trà, trà khô), ngành tea]
---
# Ngành Trà (lá trà, trà khô)

> [!summary]
> 🍃 Ngành `tea`, một trong 11 ngành mà [[Clan|gia tộc]] có thể thâu tóm. Bồi thường thị trường khi vào ngành đầu tiên **30.000 xu**; nếu là ngành thứ 2 hoặc 3 của gia tộc thì gấp 10 (**300.000 xu**). Lô đất hợp địa hình và khí hậu thì sản lượng cao hơn. Cú sốc cầu của ngành đẩy giá [[Lá trà tươi]], [[Trà khô]] trên Sàn.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Bồi thường (ngành đầu) | 30.000 xu, quản trị viên chỉnh được | `public/ta-tua/game/js/shared/clan.js:13`, `petdex/server/clans.js:32,256` |
| Bồi thường (ngành thứ 2, 3) | 30.000 × `expandMultiplier` (10) = 300.000 xu | `petdex/server/clans.js:24,256` |
| Phần vào ngân sách | 50% | `petdex/server/clans.js:389` |
| Hàng Sàn chịu sốc | Lá trà tươi, Trà khô | `public/ta-tua/game/js/shared/clan.js:13`, `petdex/server/macro.js:84-89` |

## Độ hợp địa hình (cộng vào hệ số môi trường)
| Địa hình | Độ hợp |
|---|---|
| ⛰️ Đồi núi | +22% |
| 🌲 Rừng | +10% |
| 🏞️ Ven sông | +5% |
| 🌾 Đồng bằng | 0% |
| 🏖️ Ven biển | -12% |
| 🏙️ Trung tâm | -30% |
| 🌊 Trên biển | -60% |

## Độ hợp khí hậu
| Khí hậu | Độ hợp |
|---|---|
| 🌧️ Mưa ẩm | +12% |
| ⛅ Ôn hòa | +5% |
| 🌬️ Lộng gió | -5% |
| ☀️ Nhiều nắng | -6% |

Hệ số môi trường = `max(0,2; 1 + độ hợp địa hình + độ hợp khí hậu)` (`public/ta-tua/game/js/shared/clan.js:98-102`).

## 5 lô hợp nhất trên bản đồ
B01 (⛰️ Đồi núi, 🌧️ Mưa ẩm, ×1,34, giá gốc 351.000); B02 (⛰️ Đồi núi, 🌧️ Mưa ẩm, ×1,34, giá gốc 536.000); B04 (⛰️ Đồi núi, 🌧️ Mưa ẩm, ×1,34, giá gốc 537.000); B05 (⛰️ Đồi núi, 🌧️ Mưa ẩm, ×1,34, giá gốc 667.000); B06 (⛰️ Đồi núi, 🌧️ Mưa ẩm, ×1,34, giá gốc 681.000).

(Tính từ `PLOTS` sinh với hạt giống 20261030, `public/ta-tua/game/js/shared/clan.js:138-174`.)

## Liên quan
- [[Clan]] · [[Bản đồ đất]] · [[Kinh tế vĩ mô]] · [[Thuế doanh nghiệp]] · [[MOC Kinh tế và cộng đồng]]
