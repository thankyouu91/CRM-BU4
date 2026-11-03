---
tags: [petfarm, may-chu, module, luat, thi-tran]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/town.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module rules-town

> [!summary]
> `petdex/server/rules/town.js` (97 dòng): luật thuần của thị trấn: thuế thu nhập lũy tiến, đề xuất ngân sách, trợ cấp tân thủ, quỹ khởi tạo, nhiệm vụ ngày, quà ngày theo chuỗi và Hội. Diễn giải: [[Thuế thu nhập]], [[Tòa thị chính]], [[Nhiệm vụ ngày]], [[Quà ngày]], [[Hội]].

## Exports
| Tên | Dòng | Nội dung |
|---|---|---|
| `BRACKETS` | `rules/town.js:4` | `[[300, 0], [1000, 0.05], [3000, 0.1], [Infinity, 0.15]]` (trần bậc, thuế suất) theo thu nhập chịu thuế mỗi ngày |
| `incomeTax(taxable, cut)` | `rules/town.js:7-15` | Lũy tiến từng bậc, mỗi bậc trừ `cut` điểm (không âm), `floor` |
| `STIPEND` | `rules/town.js:17` | 30 xu/lần quà ngày, trong 7 ngày đầu |
| `TREASURY_SEED` | `rules/town.js:18` | 5.000 (migration `treasury_seed_v1`) |
| `PROPOSALS` | `rules/town.js:21-28` | 6 đề xuất: `bridge`, `food_fest`, `tax_cut`, `milk_subsidy`, `promote_town`, `newbie_fund` (chi phí, hiệu ứng `{ kind, target, value, days }`) |
| `pickProposals(rand)` | `rules/town.js:30-37` | Xáo trộn, lấy 3 |
| `winner(rows)` | `rules/town.js:40-44` | Nhiều phiếu nhất; hòa lấy rẻ hơn; không ai bầu thì null |
| `QUESTS` | `rules/town.js:48-63` | 14 nhiệm vụ (`goal`, `reward`, có thể `level` tối thiểu hoặc `needs`: `friend`/`guild`/`business`) |
| `QUEST_SLOTS`, `QUEST_CHEST`, `QUEST_XP` | `rules/town.js:64-66` | 3, 50 xu, 10 XP |
| `pickQuests({ level, has }, rand)` | `rules/town.js:69-78` | Lọc theo điều kiện, xáo, lấy 3 |
| `dailyReward(streak)` | `rules/town.js:81` | `60 + 10 × (min(max(streak, 1), 7) - 1)` |
| `GUILD`, `GUILD_EMBLEMS`, `GUILD_UPGRADES`, `GUILD_PROJECTS` | `rules/town.js:85-97` | Lập Hội 2.000, tối đa 20 người; `office` (+3% lương/cấp), `sign` (+5% khách/cấp); 4 dự án tuần |

## Ai dùng
`town.js`, `quests.js`, `social.js`, `jobs.js` và `business.js` (`GUILD_UPGRADES`), `migrate.js`, `routes.js`.

## Liên quan
- [[Module town]] · [[Module quests]] · [[Module social]]
