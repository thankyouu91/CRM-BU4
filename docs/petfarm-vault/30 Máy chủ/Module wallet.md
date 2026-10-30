---
tags: [petfarm, may-chu, module, vi, kinh-te]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/wallet.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module wallet

> [!summary]
> `petdex/server/wallet.js` (99 dòng): tài sản ròng, báo cáo thu chi từ sổ cái, sao kê, ảnh chụp tài sản mỗi đêm và bảng xếp hạng giàu. Luật hiển thị: [[Ví và tài sản ròng]], [[Bảng vàng]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `netWorth(userId, now)` | `wallet.js:22-38` | `parts = { wallet, savings (gồm lãi lẻ), deposits, locked (ký quỹ lệnh Sàn), goods (hàng theo giá NPC mua), items (đồ trong túi × 50% giá chỉ số), escrow (ký quỹ hợp đồng), debt (âm dư nợ) }`, `total` = tổng |
| `report(userId, days, now)` | `wallet.js:41-67` | Thu/chi theo loại và theo ngày (bỏ `transfer`) |
| `ledgerPage(userId, { kind, before, limit = 40 })` | `wallet.js:69-75` | Sao kê phân trang theo `id < before` |
| `walletView(userId, days, now)` | `wallet.js:77-83` | `{ netWorth, report, history (30 ngày + hôm nay), ledger }` |
| `snapshotNetWorth(day, now)` | `wallet.js:86-91` | Chụp cho người có dòng sổ trong 7 ngày (`networth`) |
| `richList(limit = 20, now)` | `wallet.js:94-99` | Tính trực tiếp cho **mọi** người chơi rồi sắp xếp |

## Bảng
`ledger`, `networth`; gián tiếp `users`, `bank_accounts`, `deposits`, `lots`, `orders`, `inventory`, `contracts`, `loans`.

## Ai gọi
`routes-economy.js` (`/wallet*`), `routes.js` (`/leaderboard?by=networth`), `internal.js` (overview, chi tiết người chơi), `scheduler.closeDay`.

## Lưu ý
- Trang phục (`gear`) và quỹ gia tộc/Hội **không** nằm trong tài sản ròng.
- `richList` có độ phức tạp O(số người × nhiều truy vấn) (comment: "đủ nhanh với vài trăm người chơi", dòng 93).

## Liên quan
- [[Module ledger]] · [[Ví và tài sản ròng]] · [[Quyết toán nửa đêm]]
