---
tags: [petfarm, luat-choi, suc-khoe, bao-hiem]
aliases: [Bảo hiểm, Bảo hiểm Cơ bản, Bảo hiểm Toàn diện]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/production.js, petdex/server/care.js, petdex/server/scheduler.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Bảo hiểm sức khỏe

> [!summary]
> Người chơi mua một gói bảo hiểm ở 🩺 Phòng khám để được trả một phần viện phí (khám tổng quát và chữa bệnh) cho **mọi bé** trong nhà. Phí trừ mỗi nửa đêm; ví không đủ tiền thì gói tự hủy. Đây là cách giảm rủi ro chi phí khi nuôi nhiều bé hay bé già dễ ốm.

## Con số
| Gói | Mã | Phí/ngày (gốc) | Trả viện phí | Nguồn |
|---|---|---|---|---|
| Bảo hiểm Cơ bản | `basic` | 8 xu | 50% | `petdex/server/rules/production.js:26` |
| Bảo hiểm Toàn diện | `full` | 20 xu | 90% | `petdex/server/rules/production.js:27` |

Phí và viện phí đều nhân [[Chỉ số giá]] (`indexedPrice`, `petdex/server/care.js:41-44,88`).

## Cách hoạt động
- Mua/đổi/hủy: `POST /clinic/insurance` với `plan` = `basic`, `full` hoặc trống để hủy (`petdex/server/routes-production.js:32-34`, `petdex/server/care.js:72-82`). Mua không thu tiền ngay: lời báo "Đã mua …: N 🪙 mỗi ngày, trừ lúc nửa đêm."
- Mỗi người một gói (bảng `insurance` khóa theo `user_id`, `petdex/server/db.js:331`).
- Nửa đêm (`settleCareDay`, chạy sau quầy, xưởng và gia tộc trong `closeDay`, `petdex/server/scheduler.js:33`): đủ xu thì trừ phí (ghi sổ loại `insurance`), thiếu thì xóa gói (`petdex/server/care.js:87-94`).

## Công thức
```
phải trả = round( viện phí × (1 − cover) )     cover = 0,5 hoặc 0,9
```
(`petdex/server/care.js:32-36`.)

> [!tip] Hòa vốn
> Gói Cơ bản (8 xu/ngày) hòa vốn nếu cứ ~15 ngày chữa một lần Cảm lạnh (tiết kiệm 60 xu). Gói Toàn diện (20 xu/ngày) tiết kiệm 108 xu/lần Cảm lạnh, 180 xu/lần Đau bụng, 54 xu/lần khám tổng quát.

## Trường hợp đặc biệt
- **Không có thời gian chờ**: mua gói xong khám ngay là được trả liền, vì `billFor` đọc gói hiện tại lúc khám (`petdex/server/care.js:33`). Có thể mua ngay trước khi khám rồi hủy trước nửa đêm để không bị thu phí ngày đó.
- Gói bị hủy âm thầm khi thiếu tiền (không có tin báo).
- Phí bảo hiểm không phải thu nhập chịu thuế và không có hoàn phí.

## Liên quan
- [[Ốm và Phòng khám]] · [[Cảm lạnh]] · [[Đau bụng]] · [[Chỉ số giá]] · [[Quyết toán nửa đêm]] · [[Module care]]
