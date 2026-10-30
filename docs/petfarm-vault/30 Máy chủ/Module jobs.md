---
tags: [petfarm, may-chu, module, viec-lam]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/jobs.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module jobs

> [!summary]
> `petdex/server/jobs.js` (224 dòng): Trung tâm việc làm. Nhận ca theo giờ thật ở ba loại nơi làm: **nghề** (lương do hệ thống trả lúc nhận), **quầy trà sữa** và **xưởng** (của mình thì không lương; làm thuê thì lương giữ trước từ ví chủ). Nhận lương thì lên kỹ năng, XP, có thể thăng bậc. Luật: [[Việc làm]], [[Thuê bé làm việc]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `jobsView(userId, now)` | `jobs.js:38-83` | Mỗi bé: năng lượng, no, ốm, giai đoạn, bận, giờ đã làm hôm nay, `maxHours` và `workFactor` theo tuổi, thâm niên, kỹ năng, nghề; ca chưa nhận; tin tuyển quầy/xưởng; quầy và xưởng của mình; thưởng Văn phòng Hội |
| `startShift(userId, { petId, career, hours, businessId, factoryId }, now)` | `jobs.js:97-157` | Xem dưới |
| `claimShift(userId, shiftId, now, rand)` | `jobs.js:159-192` | Ca đã xong và chưa nhận: lương + boa (sổ `salary`), kỹ năng chính `SKILL_PER_HOUR × giờ`, cộng giờ nghề, thăng bậc nếu đủ, XP `XP_PER_HOUR × giờ` |

## `startShift`
1. `tick` bé; `checkShift` (nghề hợp lệ, giờ 1/2/4, không bận, không ốm, đủ giờ trong ngày theo tuổi, năng lượng `10 × giờ`, no >= 15).
2. Xưởng (`factoryShiftTerms`) hoặc quầy (`shiftTerms`): `pay = wage × giờ`, trừ ngay ví chủ (sổ `wage`), ghi báo cáo lương; chủ thiếu xu -> "Chủ quầy/Chủ xưởng không đủ tiền trả lương lúc này.".
3. Nghề: `shiftPay(career, rank, skill, hours)` × (1 + Văn phòng Hội) × `payFactor` (tính cách) × `elementPay` × tuổi (`work`, thâm niên).
4. Ghi `shifts`, `savePet` với `busy_kind: 'work'` tới `endsAt`.

> [!info] Năng lượng và no bụng của ca làm
> `startShift` **không** trừ năng lượng ngay; hao hụt được tính dần trong `game.tick` theo `BUSY_PER_HOUR` khi bé bận việc `work` hoặc `school` (`game.js:35`, `147-150`).

## Hàm nội bộ
`factoryName(id)` (dòng 85), `officeBonus(userId)` (dòng 88-91), `claimBusinessShift` (+ Khéo tay, dòng 195-208), `claimFactoryShift` (+ Sức mạnh, dòng 211-224).

## Bảng
`shifts`, `careers`, `pets`, `pet_skills`, `businesses`, `factories`, `guilds`, `guild_members`, `ledger`, `business_days`/`factory_days` (lương).

## Ai gọi
`routes-economy.js` (route `/jobs*`). Nhiệm vụ `shift` được báo khi nhận lương.

## Lưu ý
- Lương ca nghề được **chốt lúc nhận ca** (`shifts.pay`), boa tính lúc nhận lương.
- `lifecycle.passAway` tự trả lương ca chưa nhận nếu bé mất.

## Liên quan
- [[Việc làm]] · [[Module rules-careers]] · [[Module business]] · [[Module factory]] · [[Module elements]]
