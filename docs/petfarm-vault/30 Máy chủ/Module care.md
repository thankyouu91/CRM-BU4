---
tags: [petfarm, may-chu, module, cham-soc]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/care.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module care

> [!summary]
> `petdex/server/care.js` (150 dòng): chăm sóc giai đoạn 2: tắm, phòng khám, bảo hiểm sức khỏe (thu phí mỗi đêm) và trường học. Luật ở [[Chăm sóc ở nhà]], [[Ốm và Phòng khám]], [[Bảo hiểm sức khỏe]], [[Trường học]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `bath(userId, petId, now)` | `care.js:25-29` | `mutatePet` với `game.bathe`; nhiệm vụ `bath` |
| `clinicView(userId, now)` | `care.js:38-46` | Gói đang có, bảng giá gói, phí khám và chữa (đã trừ phần bảo hiểm trả) |
| `visitClinic(userId, petId, now)` | `care.js:49-70` | Ốm: chữa khỏi + `CLINIC.treatHealth`; khỏe: khám tổng quát + `checkupHealth`; trả phần sau bảo hiểm (sổ `clinic`) |
| `setInsurance(userId, plan, now)` | `care.js:72-82` | Mua/đổi hoặc hủy (`plan` null) |
| `settleCareDay(day, end, rand)` | `care.js:85-102` | Nửa đêm: thu phí gói (thiếu xu thì hủy gói, không nợ); mỗi bé chưa ốm có sức khỏe dưới ngưỡng có xác suất `0,5 × hệ số loài × hệ số tuổi` đổ bệnh |
| `schoolView(userId, petId, now)` | `care.js:106-115` | Lớp, học phí theo chỉ số giá, số buổi đã học hôm nay |
| `attendClass(userId, petId, skill, now, rand)` | `care.js:118-150` | Kiểm: không ốm, không phải sơ sinh, không bận, đủ năng lượng, chưa quá số buổi/môn/ngày; trừ học phí (sổ `school`), tăng kỹ năng (`growSkill`, `bookworm` ×1,25, hệ số tuổi), bé bận `busy_kind = 'school'` 30 phút |

`billFor(userId, amount)` nội bộ (dòng 32-36): `paid = round(amount × (1 - cover))`.

## Bảng
`insurance`, `school_log`, `pets`, `pet_skills`, `ledger`; khai câu `insertNews` nhưng không dùng (dòng 22).

## Ai gọi
`routes-production.js` (route), `scheduler.closeDay` (`settleCareDay`).

## Lưu ý
- Phần bảo hiểm trả chỉ là giảm giá: không có dòng sổ "bảo hiểm chi trả".
- `attendClass` tăng kỹ năng **trước** `mutatePet`; nếu `mutatePet` ném lỗi thì transaction ngoài hoàn tác cả hai.

## Liên quan
- [[Module game]] · [[Module elements]] · [[Quyết toán nửa đêm]] · [[Kỹ năng]]
