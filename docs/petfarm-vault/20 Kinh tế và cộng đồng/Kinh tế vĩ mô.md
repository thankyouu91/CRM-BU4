---
tags: [petfarm, kinh-te, kinh-te-vi-mo, chu-ky, thoi-tiet]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/macro.js, public/ta-tua/game/js/shared/clan.js, petdex/server/clans.js, petdex/server/routes-clans.js, petdex/server/internal.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Vĩ mô, Macro economy, 📊 Vĩ mô]
---
# Kinh tế vĩ mô

> [!summary]
> Mỗi ngày game có một bản ghi `macro_days`: **pha chu kỳ** (Phục hồi, Tăng trưởng nóng, Đỉnh chu kỳ, Suy thoái), **thời tiết** (6 kiểu), **cầu từng ngành** (11 ngành, 0,7–1,35), **chỉ số giá đất** (0,6–1,8) và một con số "tăng trưởng" để hiển thị. Nó tác động lên doanh thu đất của [[Clan|gia tộc]], giá lô đất trống, giá một số hàng trên [[Sàn Nguyên Liệu]] (qua [[Tin tức thị trường]]) và lượng khách [[Quầy trà sữa]]. Quản trị viên có thể ép pha và thời tiết.

## Cách hoạt động
- `macroFor(day)`: có bản ghi thì trả, chưa có thì sinh từ ngày gần nhất trước đó (hoặc trạng thái đầu: Phục hồi, trời yên, chỉ số đất 1, cầu 1) rồi ghi lại kèm tin và hiệu ứng (`petdex/server/macro.js:73,95-102`).
- Quyết toán nửa đêm: `settleClansDay` dùng vĩ mô của ngày vừa đóng để tính doanh thu, rồi `rollNextDay` sinh sẵn ngày mai (`petdex/server/clans.js:633,689`, `petdex/server/macro.js:124-127`).
- `GET /macro` trả hôm nay và 14 ngày gần nhất cho tab "📊 Vĩ mô" của [[Màn Clan]] (`petdex/server/routes-clans.js:44-47`, `petdex/server/macro.js:118-121`).

## Công thức (`rollMacro`, `petdex/server/macro.js:40-71`)

| Thành phần | Cách tính | Nguồn |
|---|---|---|
| Pha | Markov mỗi ngày theo `PHASE_NEXT`: Phục hồi → Tăng trưởng nóng 12%; Tăng trưởng nóng → Đỉnh 10%; Đỉnh → Suy thoái 14% hoặc → Tăng trưởng nóng 4%; Suy thoái → Phục hồi 12% | `public/ta-tua/game/js/shared/clan.js:545-550` |
| Thời tiết | bốc có trọng số: yên 5, thuận lợi 1,2, nắng nóng 1, mưa lớn 1, rét 0,7, bão 0,6 (tổng 9,5) | `public/ta-tua/game/js/shared/clan.js:556-563`, `petdex/server/macro.js:26-34,53` |
| Cầu ngành | `1 + (cầu cũ − 1) × 0,85 + N(0; 0,03)`; 4%/ngày có cú sốc ±10–20%; kẹp 0,7–1,35, làm tròn 3 số | `petdex/server/macro.js:56-65` |
| Chỉ số giá đất | `× (1 + land(pha) − (lãi cơ bản − 0,003) × 2 + N(0; 0,003))`, kẹp 0,6–1,8 | `petdex/server/macro.js:66-68` |
| Tăng trưởng (`gdp`) | Phục hồi 2,5%, Tăng trưởng nóng 7%, Đỉnh 4%, Suy thoái −3%, cộng N(0; 0,5%); chỉ hiển thị | `petdex/server/macro.js:22,69` |

## Tác động

| Lên đâu | Cơ chế | Nguồn |
|---|---|---|
| Doanh thu lô đất | nhân `PHASES[pha].factor` (1 / 1,12 / 1,05 / 0,85), `weatherFactor`, `cầu[ngành]` | `petdex/server/clans.js:225-242` |
| Giá lô đất trống | nhân chỉ số giá đất (chế độ `auto`) | `petdex/server/clans.js:209-214` |
| Giá trị lô đã mua | nhân `chỉ số đất hiện tại / chỉ số lúc mua` | `petdex/server/clans.js:217-222` |
| Giá Sàn | tin thời tiết theo `WEATHER.news`; tin sốc cầu = cú sốc / 2 cho mặt hàng của ngành | `petdex/server/macro.js:80-89` |
| Khách quầy trà sữa | hiệu ứng `traffic` trong ngày: Tăng trưởng nóng +10%, Đỉnh +5%, Suy thoái −10% | `public/ta-tua/game/js/shared/clan.js:538-543`, `petdex/server/macro.js:90-91` |

Ghi chú riêng cho từng pha: [[Pha Phục hồi]], [[Pha Tăng trưởng nóng]], [[Pha Đỉnh chu kỳ]], [[Pha Suy thoái]]. Từng kiểu thời tiết: [[Thời tiết Trời yên biển lặng]], [[Thời tiết thuận lợi]], [[Thời tiết Nắng nóng kéo dài]], [[Thời tiết Mưa lớn nhiều ngày]], [[Thời tiết Bão biển]], [[Thời tiết Rét đậm]].

## Quản trị
- Cấu hình `clan_config.macro = { phase, weather }` ép pha hoặc thời tiết cho **các ngày sẽ sinh tới**; `null` là tự chạy (`petdex/server/clans.js:47-48,82-85`).
- `POST /admin/clans/macro` lưu ép buộc; nếu `today` thì ghi đè ngay bản ghi hôm nay (`overrideMacro`, có thể đặt chỉ số giá đất 0,6–1,8; cầu và tăng trưởng giữ nguyên) và ghi nhật ký quản trị (`petdex/server/internal.js:591-597`, `petdex/server/macro.js:105-116`). Xem [[Quản trị Clan]].

## Trường hợp đặc biệt
- Ghi đè hôm nay **không** đăng lại tin thời tiết hay hiệu ứng khách (chỉ `write()` lúc sinh mới đăng), nên đổi thời tiết giữa ngày không đổi giá Sàn hôm đó.
- Cú sốc ngành không có mặt hàng (Giao vận, Giáo dục, Giải trí) vẫn đăng tin chung `effect 0` (`petdex/server/macro.js:88`).
- Ngày bị bỏ qua (máy chủ tắt) vẫn được sinh tuần tự khi quyết toán bù, vì `macroFor` lấy ngày gần nhất trước đó.

## Liên quan
- [[Clan]] · [[Bản đồ đất]] · [[Thuế doanh nghiệp]] · [[Ngân hàng Trung ương]] · [[Tin tức thị trường]] · [[Quầy trà sữa]] · [[Module macro]] · [[MOC Kinh tế và cộng đồng]]
