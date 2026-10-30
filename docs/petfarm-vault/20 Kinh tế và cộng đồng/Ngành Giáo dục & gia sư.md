---
tags: [petfarm, kinh-te, clan, nganh, education]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/clans.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [📚 Giáo dục & gia sư, ngành education]
---
# Ngành Giáo dục & gia sư

> [!summary]
> 📚 Ngành `education`, một trong 11 ngành mà [[Clan|gia tộc]] có thể thâu tóm. Bồi thường thị trường khi vào ngành đầu tiên **25.000 xu**; nếu là ngành thứ 2 hoặc 3 của gia tộc thì gấp 10 (**250.000 xu**). Lô đất hợp địa hình và khí hậu thì sản lượng cao hơn.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Bồi thường (ngành đầu) | 25.000 xu, quản trị viên chỉnh được | `public/ta-tua/game/js/shared/clan.js:58`, `petdex/server/clans.js:32,256` |
| Bồi thường (ngành thứ 2, 3) | 25.000 × `expandMultiplier` (10) = 250.000 xu | `petdex/server/clans.js:24,256` |
| Phần vào ngân sách | 50% | `petdex/server/clans.js:389` |
| Hàng Sàn chịu sốc | không có (tin chung, không đổi giá) | `public/ta-tua/game/js/shared/clan.js:58`, `petdex/server/macro.js:84-89` |

## Độ hợp địa hình (cộng vào hệ số môi trường)
| Địa hình | Độ hợp |
|---|---|
| 🏙️ Trung tâm | +20% |
| 🌾 Đồng bằng | +6% |
| 🏞️ Ven sông | +5% |
| ⛰️ Đồi núi | +2% |
| 🌲 Rừng | 0% |
| 🏖️ Ven biển | 0% |
| 🌊 Trên biển | -20% |

## Độ hợp khí hậu
| Khí hậu | Độ hợp |
|---|---|
| ⛅ Ôn hòa | +8% |
| 🌧️ Mưa ẩm | +2% |
| ☀️ Nhiều nắng | -2% |
| 🌬️ Lộng gió | -3% |

Hệ số môi trường = `max(0,2; 1 + độ hợp địa hình + độ hợp khí hậu)` (`public/ta-tua/game/js/shared/clan.js:98-102`).

## 5 lô hợp nhất trên bản đồ
D09 (🏙️ Trung tâm, ⛅ Ôn hòa, ×1,28, giá gốc 1.998.000); D10 (🏙️ Trung tâm, ⛅ Ôn hòa, ×1,28, giá gốc 2.000.000); D11 (🏙️ Trung tâm, ⛅ Ôn hòa, ×1,28, giá gốc 1.880.000); D12 (🏙️ Trung tâm, ⛅ Ôn hòa, ×1,28, giá gốc 2.000.000); E08 (🏙️ Trung tâm, ⛅ Ôn hòa, ×1,28, giá gốc 1.985.000).

(Tính từ `PLOTS` sinh với hạt giống 20261030, `public/ta-tua/game/js/shared/clan.js:138-174`.)

## Liên quan
- [[Clan]] · [[Bản đồ đất]] · [[Kinh tế vĩ mô]] · [[Thuế doanh nghiệp]] · [[MOC Kinh tế và cộng đồng]]
