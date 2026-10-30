---
tags: [petfarm, kinh-te, vi, tai-san-rong, xep-hang]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/wallet.js, petdex/server/routes-economy.js, petdex/server/routes.js, petdex/server/internal.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [👛 Ví của bạn, Net worth, Tài sản ròng, Xếp hạng tài sản]
---
# Ví và tài sản ròng

> [!summary]
> Màn "👛 Ví của bạn" gom mọi thứ người chơi sở hữu thành **tài sản ròng**: ví, tiết kiệm, kỳ hạn, ký quỹ, hàng trong kho, đồ trong túi, trừ dư nợ. Kèm báo cáo thu chi 7/30 ngày từ [[Sổ cái]], biểu đồ tài sản 30 ngày (ảnh chụp mỗi nửa đêm), và sao kê. Tài sản ròng cũng là tiêu chí của bảng xếp hạng giàu có trên [[Bảng vàng]].

## Công thức (`netWorth`, `petdex/server/wallet.js:22-38`)

| Phần | Cách tính | Nguồn |
|---|---|---|
| `wallet` | `users.coins` | `petdex/server/wallet.js:28` |
| `savings` | tiết kiệm + phần nguyên lãi tích tới hiện tại | `petdex/server/bank.js:127-132` |
| `deposits` | tổng gốc các kỳ hạn đang mở (chưa tính lãi) | `petdex/server/bank.js:130` |
| `locked` | ký quỹ lệnh mua đang chờ | `petdex/server/market.js:433` |
| `goods` | hàng trong kho + hàng trong lệnh bán chờ, theo **giá bid NPC** | `petdex/server/market.js:423-431` |
| `items` | đồ trong túi: `floor(giá shop × chỉ số × 50%) × số lượng` | `petdex/server/wallet.js:25-26` |
| `escrow` | ký quỹ trong hợp đồng đang đề xuất/chạy | `petdex/server/contracts.js:36` |
| `debt` | − (dư nợ gốc + phí) các khoản vay | `petdex/server/credit.js:231` |

> [!warning] Không tính
> Trang phục (gear có cấp), món đã nấu, quầy/xưởng (giấy phép, nâng cấp), quỹ [[Hội]], phần đóng góp vào quỹ hay đất của [[Clan|gia tộc]] **không** nằm trong tài sản ròng.

## Báo cáo thu chi (`report`, `petdex/server/wallet.js:41-67`)
- Lấy mọi dòng sổ cái của người chơi trong `days` ngày (7 hoặc 30, `GET /wallet?days=30`), bỏ nhóm `transfer`.
- Tổng theo `kind` (thu dương, chi dương), sắp giảm dần; và theo ngày (`income`, `expense`).

## Ảnh chụp và lịch sử
- Mỗi nửa đêm, `snapshotNetWorth` lưu `networth (user_id, day, total, detail)` cho người có dòng sổ cái trong 7 ngày (`petdex/server/wallet.js:86-91`, `petdex/server/scheduler.js:41`).
- `walletView` trả 30 ảnh gần nhất, thêm giá trị hôm nay nếu chưa có (`petdex/server/wallet.js:77-83`).

## Xếp hạng
- `richList(limit)` tính trực tiếp tài sản ròng của **mọi** người chơi rồi sắp xếp ("đủ nhanh với vài trăm người chơi") (`petdex/server/wallet.js:93-99`).
- `GET /leaderboard?by=networth` trả top 20 (`petdex/server/routes.js:127-128`); bảng quản trị lấy top 10 (`petdex/server/internal.js:372`).

## Liên quan
- [[Sổ cái]] · [[Bảng vàng]] · [[Ngân hàng Trân Châu]] · [[Kho Sàn]] · [[Module wallet]] · [[MOC Kinh tế và cộng đồng]]
