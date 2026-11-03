---
tags: [petfarm, may-chu, module, khu-cong-nghiep]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/factory.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module factory

> [!summary]
> `petdex/server/factory.js` (317 dòng): Khu công nghiệp. Xưởng chế biến hàng thô thành hàng chế biến, chỉ chạy khi có bé đứng máy, mô phỏng bù theo giờ; nhận gia công thuê cho người khác (đơn được làm trước hàng của chủ); tiền thuê đất mỗi đêm. Luật: [[Khu công nghiệp]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `simulateFactory(f, to, rand)` | `factory.js:68-138` | Mỗi giờ có người trực: số mẻ = `batchesPerHour(kind, level, strength, craft)` của bé giỏi nhất × giờ phủ × (1,1 nếu bé Kim), làm tròn ngẫu nhiên; ưu tiên đơn gia công, phần còn lại dùng nguyên liệu trong kho chủ. Thành phẩm gia công về kho người đặt (kho đầy thì coi như chưa làm), phí từ `toll:<id>` chuyển chủ xưởng (sổ `toll_income`). Thành phẩm của chủ mang giá vốn nguyên liệu |
| `syncFactories(userId, now, rand)` | `factory.js:140-144` | |
| `buildFactory(userId, kind, now)` | `factory.js:146-155` | Tối đa 2 xưởng (`MAX_FACTORIES`), sổ `factory_build` |
| `upgradeFactory(userId, factoryId, now)` | `factory.js:157-168` | Sổ `factory_upgrade` |
| `setToll(userId, factoryId, { fee, open }, now)` | `factory.js:170-179` | Phí 0-`maxTollFee`/mẻ |
| `setFactoryJobs(userId, factoryId, { wage, slots, open })` | `factory.js:181-189` | Lương theo `BUSINESS.wageMin/Max`, 1-3 người |
| `orderToll(userId, factoryId, batches, now)` | `factory.js:192-208` | Nguyên liệu rời kho ngay, phí giữ ở `toll:<orderId>` (sổ `toll_fee`) |
| `cancelToll(userId, orderId, now)` | `factory.js:210-227` | Chạy bù trước, trả nguyên liệu phần chưa làm và phí còn trong quỹ đơn |
| `closeFactory(userId, factoryId, now)` | `factory.js:229-238` | Không đóng khi còn đơn gia công |
| `openFactoryJobs(userId, now)`, `factoryShiftTerms(userId, factoryId, now)`, `recordFactoryWages(...)` | `factory.js:240-257` | Cho `jobs.js` |
| `factoryView(userId, now)` | `factory.js:259-293` | Đồng bộ xưởng mình **và** xưởng đang gia công cho mình |
| `settleFactoryDay(day, rand)` | `factory.js:296-317` | Nửa đêm: chạy bù, thuê đất; nợ 3 đêm và không còn đơn thì đóng, -40 điểm tín dụng, đăng tin |

## Bảng
`factories`, `factory_days`, `factory_jobs`, `toll_orders`, `shifts`, `pets`, `pet_skills`, `lots`, `accounts` (`toll:<id>`), `news`, `ledger`.

## Ai gọi
`routes-production.js`, `jobs.js`, `scheduler.closeDay`.

## Lưu ý
- Hàm hoàn phí trong `cancelToll` dùng sổ `toll_fee` với `delta` dương (dòng 223), nên báo cáo ví sẽ hiện như một khoản chi âm.
- `factoryView` có tác dụng phụ ghi DB (mô phỏng bù) dù là GET.

## Liên quan
- [[Khu công nghiệp]] · [[Module rules-production]] · [[Module market]] · [[Module jobs]]
