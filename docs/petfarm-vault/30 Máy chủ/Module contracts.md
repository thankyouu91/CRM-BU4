---
tags: [petfarm, may-chu, module, hop-dong]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/contracts.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module contracts

> [!summary]
> `petdex/server/contracts.js` (240 dòng): hợp đồng cung ứng giữa hai người chơi. Mỗi đêm bên bán giao `qty` lô cho bên mua với giá đã chốt, hai bên ký quỹ vào tài khoản chung `contract:<id>`. Luật: [[Hợp đồng cung ứng]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `escrowOf(userId)` | `contracts.js:36` | Tổng ký quỹ của người đó trong hợp đồng `proposed`/`active` (cho tài sản ròng) |
| `propose(userId, { counterpart, role, commodity, lots, price, days }, now)` | `contracts.js:54-81` | Kiểm vai, mặt hàng, 1-`maxLots` lô/ngày, `days` 3-14, giá mỗi lô trong `band` × giá Sàn (làm tròn); đối tác theo **tên**; mỗi bên tối đa `maxOpen` hợp đồng mở; ký quỹ phần mình ngay |
| `acceptContract(userId, contractId, now)` | `contracts.js:89-100` | Chỉ bên được mời, trong `proposalHours` (48 giờ); ký quỹ phần mình, `status = 'active'` |
| `declineContract(userId, contractId, now)` | `contracts.js:103-111` | Bên được mời từ chối (`rejected`) hoặc bên đề xuất rút (`cancelled`); hoàn ký quỹ cho bên đề xuất |
| `breakContract(userId, contractId, now)` | `contracts.js:130-137` | Phá hợp đồng đang chạy |
| `settleContractsDay(day)` | `contracts.js:201-212` | Nửa đêm: `deliver` mọi hợp đồng `active` đã nhận trước nửa đêm và chưa giao ngày này (`last_day < day`); hủy đề xuất quá hạn (`expired`) |
| `contractsView(userId, now)` | `contracts.js:214-240` | Hợp đồng đang mở và đã kết thúc trong 3 ngày, giá Sàn, kho |

## Giao hàng một đêm (`deliver`, dòng 149-198)
1. Lấy tối thiểu(hàng bên bán có, `qty × LOT`).
2. Bên mua không đủ (ví + ký quỹ) cho phần có sẵn -> bên mua phá hợp đồng.
3. Chuyển hàng (giữ hạn dùng; giá vốn bên mua = giá hợp đồng); kho bên mua đầy thì phần dư trả lại bên bán và **không** tính là giao thiếu.
4. Bên mua trả (ví trước, thiếu thì trừ ký quỹ của mình): sổ `contract_buy`/`contract_sell`; `recordGain` cho bên bán.
5. Giao thiếu: phạt `shortfallPenalty` (ví trước rồi ký quỹ), bên mua nhận `contract_comp`; không đủ trả phạt -> bên bán phá hợp đồng.
6. Giao đủ: hai bên +3 điểm tín dụng. Hết ngày: hoàn ký quỹ, `status = 'done'`.

## Phá hợp đồng (`breakBy`, dòng 117-128)
Bên kia nhận `min(ký quỹ bên phá, round(days_left × giá trị/ngày × 10%))`, phần ký quỹ dư về bên phá, bên kia nhận lại ký quỹ của mình; bên phá -30 điểm tín dụng.

## Bảng
`contracts`, `accounts` (`contract:<id>`), `lots`, `gains`, `ledger`, `credit_events`.

## Ai gọi
`routes-production.js`, `scheduler.closeDay`, `wallet.netWorth`.

## Lưu ý
- Trong bảng, `qty` là **lô/ngày**, `price` là **xu/lô** (comment dòng 11), còn `delivered` tính bằng **phần**.
- Đối tác tìm bằng `findUserByName` (cột `username` NOCASE), không phải `login_key`.

## Liên quan
- [[Hợp đồng cung ứng]] · [[Module market]] · [[Module credit]] · [[Module rules-production]]
