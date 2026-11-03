---
tags: [petfarm, kinh-te, clan, ban-do-dat, so-nha-dat]
loai: he-thong
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/clans.js, public/ta-tua/game/js/landmap.js, public/ta-tua/game/js/landpixel.js, public/ta-tua/game/js/views/clans.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Sở Nhà Đất, 🗺️ Bản đồ đất, Land map, 200 lô đất]
---
# Bản đồ đất

> [!summary]
> **Sở Nhà Đất** bán 200 lô đất (lưới 20 cột × 10 hàng, mã A01–J20) cho [[Clan|gia tộc]]. Bản đồ sinh **cố định** từ hạt giống `20261030` nên mọi máy giống nhau: 7 địa hình, 4 khí hậu, giá gốc 100.000–2.000.000 xu, % tăng giá mỗi tháng và % tốc độ sản xuất tối đa 18%. Giá lô trống tăng mạnh khi quỹ đất cạn và theo chỉ số giá đất của [[Kinh tế vĩ mô]]. Lô đã mua có ngành và công trình hoàn chỉnh thì sinh doanh thu mỗi đêm vào quỹ gia tộc.

## Sinh bản đồ (`generatePlots`, `public/ta-tua/game/js/shared/clan.js:138-174`)
- PRNG mulberry32 (`seeded`, dòng 110-119). Địa hình theo vị trí (`zoneAt`, dòng 127-135): biển ở góc đông nam, trung tâm quanh (9,5; 4,5), sông uốn theo `riverRow(c) = 4 + round(1,6 sin(c/3,2))` ở cột ≤ 13, đồi núi tây bắc, rừng đông bắc, còn lại đồng bằng; lô cạnh biển thành **Ven biển**.
- Khí hậu mặc định theo địa hình (biển hàng ≥ 8 lộng gió, còn lại nắng; đồi hàng 0 lộng gió, còn lại mưa; rừng, sông mưa; trung tâm ôn hòa; đồng bằng hàng ≥ 5 nắng, còn lại ôn hòa), 15% lô đổi ngẫu nhiên (dòng 151-156).
- Độ đắt `d = clamp01(gốc địa hình + 0,22 × max(0, 1 − khoảng cách tới tâm/10) + nhiễu ±0,06)`, gốc: trung tâm 0,82, ven biển 0,62, ven sông 0,52, biển 0,5, đồi 0,34, đồng bằng 0,28, rừng 0,24 (dòng 157-159).
- Giá gốc `round(100.000 + 1.900.000 × d^1,6, 1.000)`; % tăng giá/tháng `min(18%, 2% + 16% d)`; % sản xuất `min(18%, 2% + 14% d ± 2%)` (dòng 160-162).

### Bản đồ thực tế (U trung tâm, R ven sông, C ven biển, ~ biển, H đồi núi, F rừng, . đồng bằng)
```
    01        10        20
A   HHHHHHHHHHH...FFFFFF
B   HHHHHHHHH.....FFFFFF
C   HHHHHH........FFFFFF
D   HHHHHH..UUUURRFFFFFF
E   RRHH...UUUUUU.......
F   HHRR...UUUUUU.....CC
G   H...RRR.UUUU...CCC~~
H   .............CC~~~~~
I   ...........CC~~~~~~~
J   ..........C~~~~~~~~~
```

| Địa hình | Số lô | Giá gốc thấp–cao | Khí hậu phổ biến |
|---|---|---|---|
| 🏙️ Trung tâm | 20 | 1.801.000–2.000.000 | ôn hòa 19 |
| 🏖️ Ven biển | 10 | 929.000–1.428.000 | nắng 10 |
| 🏞️ Ven sông | 9 | 875.000–1.190.000 | mưa 6 |
| 🌊 Trên biển | 23 | 656.000–1.000.000 | lộng gió 13, nắng 9 |
| ⛰️ Đồi núi | 37 | 351.000–749.000 | mưa 24, lộng gió 9 |
| 🌾 Đồng bằng | 77 | 294.000–704.000 | nắng 44, ôn hòa 25 |
| 🌲 Rừng | 24 | 257.000–481.000 | mưa 22 |

Tổng giá gốc 146.081.000 xu, trung vị 561.000; rẻ nhất B20 (rừng, 257.000), đắt nhất D10, D12, E11, F10, F11 (trung tâm, 2.000.000). % tăng giá 5,4–18%/tháng, % sản xuất 3–17,8%. (Tính từ `PLOTS` tại commit e03a0db.)

## Giá lô trống (`listingPrice`, `petdex/server/clans.js:209-214`)
```
base   = scaledBase(lô) × multiplier         // giá gốc co giãn vào [minPrice, maxPrice] quản trị đặt
auto   : giá = base × scarcity(đã bán/200, k) × chỉ số giá đất
manual : giá = base
scarcity(r, k) = 1 + k × r^2,5               // k = 2: bán 50% → ×1,35; 90% → ×2,54; hết → ×3
làm tròn 1.000; có price_override thì dùng giá ghi đè
```
(`public/ta-tua/game/js/shared/clan.js:575`, `petdex/server/clans.js:203-206`.) Khi quỹ đất còn ≤ 20 lô, mỗi lần mua đăng tin "🏘️ Quỹ đất chỉ còn N lô, giá đất tăng mạnh" (`petdex/server/clans.js:448`).

## Mua, bán lại, giá trị
| Việc | Luật | Nguồn |
|---|---|---|
| Mua | tộc trưởng hoặc trưởng lão, trả bằng **quỹ**; tối đa `1 + 2 × cấp` lô; 20% giá vào ngân sách, 80% bị hủy; lưu giá mua và chỉ số đất lúc mua; công trình trống | `petdex/server/clans.js:433-451` |
| Giá trị hiện tại | `giá mua × min(3, (1 + %tăng)^(số tháng 30 ngày)) × (chỉ số đất hiện tại / lúc mua)` (chế độ manual bỏ phần chỉ số) | `petdex/server/clans.js:217-222` |
| Bán lại cho Sở | chỉ tộc trưởng, nhận **85%** giá trị vào quỹ; công trình bị dỡ, tiền công trình mất | `petdex/server/clans.js:453-462`, `public/ta-tua/game/js/views/clans.js:636` |
| Chọn ngành cho lô | ngành gia tộc đã thâu tóm; đổi ngành không tốn tiền, giữ công trình | `petdex/server/clans.js:464-471` |

## Doanh thu một đêm (`plotRevenue`, `petdex/server/clans.js:225-242`)
```
gross = round( round(scaledBase × 0,6%)        // base
             × (1 + %sản xuất lô)               // prod
             × env(ngành, địa hình, khí hậu)    // max(0,2; 1 + hợp địa hình + hợp khí hậu)
             × weather(thời tiết, địa hình, khí hậu)  // max(0,3; …)
             × phase(pha)                       // 1 / 1,12 / 1,05 / 0,85
             × cầu[ngành]                       // 0,7–1,35
             × 1 / (1 + 0,15 × (số gia tộc cùng ngành − 1))
             × (1 + 2% × (cấp gia tộc − 1))
             × (1 + thưởng công trình) )        // +0,5%/mảnh, tối đa +10%
revenue = gross nếu lô có ngành VÀ công trình hoàn chỉnh (≥ 3 mảnh, có móng nền), không thì 0
```
`GET /land/:id/preview?industry=` trả từng hệ số, doanh thu và **sau thuế** với thuế suất gia tộc sẽ có (nếu chưa có ngành đó thì tính như đã thâu tóm) (`petdex/server/clans.js:595-622`).

> [!example] D10 (trung tâm, ôn hòa, %sx 15,5%) làm Chuỗi trà sữa
> base 12.000 × 1,155 × env 1,36 = 18.850 xu/đêm ở pha Phục hồi, trời yên, cầu 1, một gia tộc, cấp 1, công trình 20 mảnh (+10%) → khoảng 20.700. Sau thuế 35% còn khoảng 13.500; giá lô từ 2.000.000 trở lên nên hoàn vốn hơn 150 đêm (chưa trừ phí duy trì 200/lô/đêm).

> [!example] B20 (rừng, nắng, rẻ nhất) làm Giải trí
> base 1.542 × 1,03 × 1,12 ≈ 1.780 xu/đêm; sau thuế 35% khoảng 1.160; giá gốc 257.000 nên hoàn vốn khoảng 220 đêm (chưa tính thưởng công trình và phí duy trì). Lợi suất gốc là 0,6%/ngày × hệ số cho mọi lô, nên chọn lô hợp ngành quan trọng hơn chọn lô đắt.

## Hiển thị
- Tab "🗺️ Bản đồ đất": tô màu theo Địa hình, Khí hậu, Giá đất, % tăng giá, Độ hợp ngành (chọn ngành) (`public/ta-tua/game/js/views/clans.js:263-268`); lô có chủ hiện huy hiệu, màu và công trình của gia tộc.
- Nền bản đồ vẽ bằng pixel art (`landpixel.js`, nửa độ phân giải, phóng `pixelated`) với phố uốn lượn, trục cam, sông có cầu, đồng bằng kẻ sọc, đồi đồng mức, rừng chấm cây, biển, bãi cát; lô 48×40 đơn vị trên lưới bẻ cong bằng nhiễu cố định (`public/ta-tua/game/js/landmap.js:1-40`, `public/ta-tua/game/js/landpixel.js:1-10`). Chi tiết vẽ: [[Vẽ bản đồ đất]].
- `landView` trả 200 lô: giá (trống) hoặc giá trị (đã bán), chủ, ngành, thiết kế, `mine`, tiền đã chi công trình (chỉ gia tộc mình), thống kê quỹ đất, hệ số khan hiếm, chỉ số đất, chế độ giá (`petdex/server/clans.js:563-592`).

## Cấu hình giá đất (`DEFAULT_CLAN_CONFIG.land`, `petdex/server/clans.js:33-46`)
| Khóa | Mặc định | Kẹp | Ý nghĩa |
|---|---|---|---|
| `mode` | `auto` | auto/manual | tự chạy theo khan hiếm và vĩ mô, hay cố định |
| `minPrice`, `maxPrice` | 100.000, 2.000.000 | 1.000–10^8 / –10^9 | co giãn giá gốc |
| `scarcityK` | 2 | 0–10 | độ dốc khan hiếm |
| `multiplier` | 1 | 0,1–10 | nhân mọi giá lô trống |
| `yieldRate` | 0,006 | 0–0,1 | doanh thu ngày theo giá gốc |
| `resaleRate` | 0,85 | 0–1 | Sở mua lại |
| `maxAppreciation` | 3 | 1–20 | trần tăng giá lô đã mua (lần giá mua) |
| `treasuryShare` | 0,2 | 0–1 | phần tiền đất vào ngân sách |
Quản trị viên còn đặt giá ghi đè từng lô 1.000–10^9 xu hoặc xóa (`setPlotOverride`, `petdex/server/clans.js:740-747`). Xem [[Quản trị Clan]].

## Liên quan
- [[Clan]] · [[Mẫu công trình]] · [[Trình lắp ghép công trình]] · [[Kinh tế vĩ mô]] · [[Thuế doanh nghiệp]] · các ghi chú ngành (xem [[MOC Kinh tế và cộng đồng]])
- [[Vẽ bản đồ đất]] · [[Màn Clan]] · [[Module clans]]
