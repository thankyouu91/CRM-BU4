---
tags: [petfarm, may-chu, module, clan, dat]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/clans.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module clans

> [!summary]
> `petdex/server/clans.js` (768 dòng, module lớn nhất): Gia tộc và Sở Nhà Đất. Lập gia tộc, vai trò, góp quỹ theo tuần, cấp gia tộc từ XP, thâu tóm tối đa 3 ngành (trả bồi thường thị trường), mua 200 lô đất, lắp ghép công trình, doanh thu mỗi đêm theo đất, ngành và vĩ mô, thuế doanh nghiệp trên phần **tự khai**, hồ sơ trốn thuế bí mật, hoàn thuế cuối tháng, cấu hình quản trị. Luật chung ở `public/ta-tua/game/js/shared/clan.js`; ý nghĩa ở [[Clan]], [[Bản đồ đất]], [[Thuế doanh nghiệp]].

## Cấu hình
| Tên | Dòng | Việc |
|---|---|---|
| `DEFAULT_CLAN_CONFIG` | `clans.js:18-49` | `createCost` 3.000, `unlockLevel` 4, `industryLevels` [1, 3, 5], `expandMultiplier` 10, `baseTax` 0,35, `extraTaxPerIndustry` 0,05, `refundRate` 0,15, `donationQuotaPerLevel` 300, `upkeepPerLevel` 80, `upkeepPerPlot` 200, `comp` theo ngành, `land { mode 'auto', minPrice, maxPrice, scarcityK 2, multiplier 1, yieldRate 0,006, resaleRate 0,85, maxAppreciation 3, treasuryShare 0,2 }`, `macro { phase, weather }` |
| `normalizeClanConfig(input)` | `clans.js:54-87` | Kẹp từng trường vào khoảng an toàn; `industryLevels` không giảm dần |
| `clanConfig()`, `setClanConfig(input)` | `clans.js:90-106` | `meta.clan_config`, cache RAM; `set` gộp sâu `land`, `macro` |

## Tính toán (thuần)
| Tên | Dòng | Việc |
|---|---|---|
| `clanBalance(id)` | `clans.js:180` | Số dư `clan:<id>` |
| `taxRate(industryCount, cfg)` | `clans.js:200` | `baseTax + extra × (số ngành - 1)` |
| `scaledBase(plot, cfg)` | `clans.js:203-206` | Đổi giá gốc lô sang khoảng giá quản trị đặt |
| `listingPrice(plot, row, { soldRatio, landIndex }, cfg)` | `clans.js:209-214` | Giá riêng nếu có; `auto`: `× scarcityFactor × landIndex`; làm tròn nghìn |
| `plotValue(plot, row, landIndex, now, cfg)` | `clans.js:217-222` | Giá mua × tăng trưởng tháng (có trần) × biến động chỉ số đất |
| `plotRevenue(plot, { industry, design, level, macro, clansInIndustry }, cfg)` | `clans.js:225-242` | Tích các hệ số `base, prod, env, weather, phase, demand, competition, level, building`; chỉ có doanh thu khi công trình hoàn chỉnh |
| `entryFee(industry, owned, cfg)` | `clans.js:256` | Ngành đầu giá gốc, từ ngành 2 × `expandMultiplier` |

## Hành động người chơi
| Tên | Dòng | Quyền |
|---|---|---|
| `createClan(userId, { name, emblem, color }, now)` | `clans.js:279-294` | Ai chưa ở gia tộc; tên 3-24; một nửa phí vào ngân sách |
| `joinClan` | `clans.js:296-305` | Giới hạn thành viên theo cấp |
| `leaveClan` | `clans.js:318-333` | Tộc trưởng rời: trưởng lão (rồi người góp nhiều) lên thay; người cuối: `dissolveClan` (trả đất, xóa ngành, quỹ về ngân sách, đổi tên `name #id`) |
| `kickMember`, `setMemberRole` | `clans.js:335-361` | Tộc trưởng; nhường chức thì mình thành trưởng lão |
| `donateClan(userId, amount, now)` | `clans.js:363-374` | Tối thiểu 10; +XP `floor(amount/10)`; ghi định mức tuần |
| `enterIndustry` | `clans.js:376-395` | Tộc trưởng; tối đa 3; cấp tối thiểu theo thứ tự ngành; trả từ quỹ, một nửa vào ngân sách |
| `setDeclareRatio(userId, ratio)` | `clans.js:398-406` | Tộc trưởng; 0-1 |
| `payDividend(userId, amount, now)` | `clans.js:409-419` | Tộc trưởng; chia đều từ quỹ (sổ `clan_dividend`) |
| `buyPlot` | `clans.js:433-451` | Tộc trưởng hoặc trưởng lão; số lô tối đa theo cấp; `treasuryShare` vào ngân sách; còn ≤ 20 lô thì đăng tin |
| `sellPlot` | `clans.js:453-462` | Tộc trưởng; nhận `plotValue × resaleRate` vào quỹ |
| `setPlotIndustry`, `saveDesign` | `clans.js:464-490` | Tộc trưởng hoặc trưởng lão; thiết kế chỉ trả phần chi phí vượt số đã chi cho lô |
| `clanView`, `landView`, `plotPreview` | `clans.js:498-622` | Màn xem |

## Quyết toán và quản trị
| Tên | Dòng | Việc |
|---|---|---|
| `settleClansDay(day, rand)` | `clans.js:627-691` | Doanh thu mọi lô vào quỹ; thuế = `round(round(doanh thu × tỉ lệ khai) × taxRate)`, một nửa vào ngân sách; phần khai thiếu -> `tax_evasion` + `adminLog('Sở thuế', 'tax_evasion')`; XP `floor((doanh thu - thuế)/100)`; phí duy trì (`upkeepPerLevel × cấp + upkeepPerPlot × số lô`), thiếu thì trừ XP thay vì nợ; Chủ nhật phạt XP nếu thành viên góp thiếu định mức; cuối tháng hoàn `refundRate` thuế đã đóng (tối đa số dư ngân sách); cuối cùng `rollNextDay` |
| `adminClanView(now)` | `clans.js:695-738` | Cho bảng quản trị |
| `setPlotOverride(plotId, price)` | `clans.js:740-747` | Giá riêng >= 1.000 hoặc bỏ |
| `resolveEvasion(id, action, { penalty, actor }, now)` | `clans.js:750-768` | `collect`: thu `evaded × (1 + penalty)` (penalty 0-5, mặc định 0,5) tới hết quỹ, vào ngân sách; `dismiss` |

## Bảng
`clans`, `clan_members`, `clan_donations`, `clan_industries`, `land_plots`, `clan_days`, `clan_tax_refunds`, `tax_evasion`, `accounts` (`clan:<id>`, `treasury`), `news`, `meta`, `admin_log`, `users`; qua `macro`: `macro_days`.

## Ai gọi
`routes-clans.js`, `internal.js`, `routes.js` (`clanConfig().unlockLevel`), `scheduler.closeDay`.

## Lưu ý
- Quỹ gia tộc là tài khoản chung: `post` không chặn âm, nên mọi chi tiêu đi qua `clanSpend` (kiểm số dư, dòng 189-193).
- `ensurePlots()` chèn 200 dòng `land_plots` lần đầu cần (cờ `plotsReady` trong RAM, dòng 182-187).
- Gia tộc không thấy hồ sơ trốn thuế của mình; chỉ `adminClanView` trả `evasions`.

## Liên quan
- [[Clan]] · [[Bản đồ đất]] · [[Thuế doanh nghiệp]] · [[Module macro]] · [[Quản trị Clan]] · [[Vẽ bản đồ đất]]
