---
tags: [petfarm, kinh-te, clan, cap-gia-toc]
loai: luat
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/clans.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Clan level, XP gia tộc]
---
# Cấp gia tộc

> [!summary]
> [[Clan|Gia tộc]] có 10 cấp theo XP tích lũy. Cấp mở thêm chỗ cho thành viên và lô đất, tăng 2% sản lượng đất mỗi cấp, và quyết định được thâu tóm ngành thứ 2 (cấp 3) và thứ 3 (cấp 5). XP đến từ góp quỹ và lợi nhuận đất, mất khi thiếu phí duy trì hoặc thành viên góp thiếu định mức tuần, nên cấp có thể **tụt**.

## Bảng cấp (`CLAN_LEVELS`, `clanPerks`, `public/ta-tua/game/js/shared/clan.js:179-187`)

| Cấp | XP cần | Thành viên tối đa | Lô tối đa | Thưởng sản lượng | Ngành tối đa (theo cấu hình mặc định) | Định mức góp/tuần/người | Phí duy trì cơ bản/đêm |
|---|---|---|---|---|---|---|---|
| 1 | 0 | 12 | 3 | 0% | 1 | 300 | 80 |
| 2 | 2.000 | 16 | 5 | +2% | 1 | 600 | 160 |
| 3 | 6.000 | 20 | 7 | +4% | 2 | 900 | 240 |
| 4 | 15.000 | 24 | 9 | +6% | 2 | 1.200 | 320 |
| 5 | 35.000 | 28 | 11 | +8% | 3 | 1.500 | 400 |
| 6 | 70.000 | 32 | 13 | +10% | 3 | 1.800 | 480 |
| 7 | 130.000 | 36 | 15 | +12% | 3 | 2.100 | 560 |
| 8 | 230.000 | 40 | 17 | +14% | 3 | 2.400 | 640 |
| 9 | 400.000 | 44 | 19 | +16% | 3 | 2.700 | 720 |
| 10 | 700.000 | 48 | 21 | +18% | 3 | 3.000 | 800 |

Phí duy trì cộng thêm 200 xu/lô/đêm (`petdex/server/clans.js:28-30,663`). Cấp ngành lấy từ `industryLevels` [1, 3, 5] của cấu hình (`petdex/server/clans.js:22,384-385`); `clanPerks().maxIndustries` hiển thị cùng mốc.

## XP lên và xuống

| Sự kiện | XP | Nguồn |
|---|---|---|
| Góp quỹ | `+floor(số xu / 10)` | `petdex/server/clans.js:371` |
| Đêm có doanh thu | `+floor((doanh thu − thuế) / 100)` | `petdex/server/clans.js:661` |
| Quỹ không đủ phí duy trì | `−ceil(phí / 10)` (phí không bị trừ) | `petdex/server/clans.js:667-671` |
| Đêm Chủ nhật, thành viên góp thiếu định mức | `−ceil(tổng phần thiếu / 10)` | `petdex/server/clans.js:674-678` |

XP không xuống dưới 0 (`MAX(0, xp + ?)`, `petdex/server/clans.js:116`). Cấp = vị trí cuối cùng trong bảng mà XP đạt (`clanLevelOf`, `public/ta-tua/game/js/shared/clan.js:180`).

> [!warning] Tụt cấp không đuổi người, không thu đất
> Khi XP giảm làm tụt cấp, số thành viên và số lô đang có được giữ nguyên; chỉ chặn **thêm** người và **mua thêm** lô (kiểm ở `joinClan` và `buyPlot`, `petdex/server/clans.js:301,441-442`). Phí duy trì và định mức tính theo cấp hiện tại.

> [!example] Góp quỹ để lên cấp 2
> Cần 2.000 XP = 20.000 xu góp. Đổi lại, góp tiền cũng là nguồn vốn mua đất và trả phí ngành.

## Liên quan
- [[Clan]] · [[Bản đồ đất]] · [[Thuế doanh nghiệp]] · [[MOC Kinh tế và cộng đồng]]
