---
tags: [petfarm, may-chu, module, luat, viec-lam]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/careers.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module rules-careers

> [!summary]
> `petdex/server/rules/careers.js` (70 dòng): luật thuần của kỹ năng, nghề, lương ca và thăng bậc, cùng bộ kiểm tra trước khi nhận ca. Diễn giải: [[Việc làm]], [[Kỹ năng]].

## Exports
| Tên | Dòng | Nội dung |
|---|---|---|
| `SKILLS` | `rules/careers.js:4-10` | `strength`, `agility`, `intellect`, `charm`, `craft` (tên, icon) |
| `CAREERS` | `rules/careers.js:12-18` | `barista` (craft), `courier` (agility), `porter` (strength), `tutor` (intellect), `singer` (charm, `tips` 0,6); mỗi nghề `pay` 5 bậc |
| `RANK_TITLES` | `rules/careers.js:20` | 5 danh hiệu bậc |
| `SHIFT_HOURS` | `rules/careers.js:21` | [1, 2, 4] |
| `MAX_HOURS_PER_DAY` | `rules/careers.js:22` | 8 (mặc định; tuổi có thể giảm qua `stageRules().maxHours`) |
| `ENERGY_PER_HOUR`, `XP_PER_HOUR` | `rules/careers.js:23-24` | 10, 4 |
| `PROMOTION` | `rules/careers.js:26-31` | Giờ và kỹ năng cần cho bậc 2-5 |
| `SKILL_PER_HOUR` | `rules/careers.js:33` | 0,6 |
| `initialSkills(rand)` | `rules/careers.js:37-39` | Mỗi kỹ năng 5-15 (loài lạ, migration) |
| `gainSkill(current, amount)` | `rules/careers.js:42` | `clamp(current + amount × (1 - current/150), 0, 100)` |
| `shiftPay(careerId, rank, skill, hours)` | `rules/careers.js:44-47` | `round(pay[rank-1] × (0,8 + skill/200) × hours)` |
| `tipsFor(careerId, pay, rand)` | `rules/careers.js:50` | `round(pay × tips × rand())` |
| `canPromote(rank, hoursDone, skill)` | `rules/careers.js:52-55` | |
| `checkShift({ pet, stage, careerId, hours, hoursToday, busy, maxHours })` | `rules/careers.js:58-70` | Ném `GameError` cho từng điều kiện (xem [[Lỗi và thông báo lỗi]]); `careerId` `shop`/`factory` là ca quầy/xưởng |

## Ai dùng
`jobs.js`, `elements.js` (`gainSkill`), `eggs.js` và `migrate.js` (`initialSkills`), `internal.js` (`SKILLS`), `routes.js` (`/catalog`).

## Lưu ý
`MIN_STAGE = 'baby'` (dòng 35): bé sơ sinh vẫn nhận ca nhẹ; giới hạn giờ và hệ số lương theo tuổi đến từ `LIFE_STAGES` trong `shared/pets.js`.

## Liên quan
- [[Module jobs]] · [[Giai đoạn tuổi]] · [[Kỹ năng]]
