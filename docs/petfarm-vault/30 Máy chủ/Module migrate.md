---
tags: [petfarm, may-chu, module, migration]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/migrate.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module migrate

> [!summary]
> `petdex/server/migrate.js` (113 dòng): 8 bước chuyển dữ liệu cũ, mỗi bước chạy đúng một lần (cờ `meta.migrated_<tên>`) trong transaction riêng. Danh sách và ý nghĩa từng bước ở [[Migration]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `migrate(now = Date.now())` | `migrate.js:105-113` | Duyệt `steps` theo thứ tự khai báo |

Hằng nội bộ: `OLD_STAGE_DAYS` (dòng 17), `STAGE_MIN_DAYS_V1` (dòng 19), `steps` (dòng 21-103), câu lệnh `insertOpening`, `hasLedger` (dòng 11-14).

## Bảng chạm tới
`ledger`, `pets` (`born_at`, `traits`), `pet_skills`, `pet_wear`, `inventory`, `gear`, `listings`, `accounts` (`treasury`).

## Ai gọi
`durable.js:28`, `index.js:45`, mọi test tích hợp và `simulate-economy.js`.

## Lưu ý
- Ghi sổ cái qua `post()` (`treasury_seed_v1`) và `insertOpening` trực tiếp (`ledger_v1`, bỏ qua `post` để không đổi `coins`).
- Bước `gear_v1` có lỗi định dạng nhỏ: `},  /**` (dòng 59) nhưng không ảnh hưởng.

## Liên quan
- [[Migration]] · [[Module db]] · [[Module gear]]
