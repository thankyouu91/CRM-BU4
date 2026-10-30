---
tags: [petfarm, kinh-te, mo-phong, can-bang]
loai: van-hanh
trang-thai: dang-chay
nguon: [petdex/scripts/simulate-economy.js, petdex/scripts/gear-balance-sim.mjs, docs/pet-town-gear-balance.md, petdex/docs/thiet-ke-mo-rong.md]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [simulate-economy, gear-balance-sim, Economy simulation]
---
# Mô phỏng kinh tế

> [!summary]
> Hai script cân bằng chạy bằng Node trên máy dev. `simulate-economy.js` cho nhiều bot chơi theo 5 kiểu trong N ngày, gọi **đúng code server** trên một DB SQLite trong RAM (`PETDEX_DB=':memory:'`), rồi in tài sản ròng theo kiểu chơi, chính sách [[Ngân hàng Trung ương]], lợi nhuận quầy/xưởng và **đối soát [[Sổ cái]]**. `gear-balance-sim.mjs` quay 20.000 bộ trang phục để đo mức cộng dồn chỉ số khi đeo 3–5 món. Không đụng dữ liệu thật.

## simulate-economy.js

### Chạy
`node petdex/scripts/simulate-economy.js --bots 60 --days 30 --seed 1 [--no-elements]` (mặc định 60 bot, 30 ngày, seed 1) (`petdex/scripts/simulate-economy.js:59,278-286`).

> [!warning] Lệch tài liệu
> Chú thích đầu file ghi "Chạy: `npm run simulate`" (`petdex/scripts/simulate-economy.js:2`), nhưng `petdex/package.json` chỉ có `{ "type": "module", "private": true }` và `package.json` gốc không có script `simulate`. Thiết kế (`petdex/docs/thiet-ke-mo-rong.md:699`) mô tả **300 bot, 6 kiểu chơi (có "địa chủ"), 90 ngày**, Gini, lợi suất cho thuê, vỡ nợ, hợp đồng tương lai; script hiện chỉ có 5 kiểu, mặc định 60 bot × 30 ngày, không mô phỏng vay, Chợ Phiên, hợp đồng, gia tộc hay đất.

### Thiết lập (`petdex/scripts/simulate-economy.js:42-75`)
- Bắt đầu thứ Hai 2026-11-02 7h sáng giờ VN; mỗi bot nhận 150 xu, một bé Thanh niên 30 tuần (loài Thường xoay vòng đủ 5 hành, hoặc loài trung tính với `--no-elements`), kỹ năng khởi đầu theo loài.
- Kiểu bot xoay vòng `casual, diligent, speculator, merchant, casual, diligent, speculator, merchant, producer` (chủ xưởng khoảng 1/9).
- Mỗi ngày 3 phiên lúc 8h, 12h, 18h giờ VN; bot "thỉnh thoảng" chỉ vào phiên sáng (`petdex/scripts/simulate-economy.js:200-210`).

### Hành vi mỗi phiên
| Việc | Ai | Mô tả |
|---|---|---|
| Quà ngày + trợ cấp tân thủ | mọi bot (phiên đầu ngày) | đúng công thức chuỗi |
| Cho ăn | mọi bot | mua Cá tươi ở Siêu thị tới khi No ≥ 70 (tối đa 6 lần) |
| Chăm | mọi bot | ốm thì đi khám, bẩn < 40 thì tắm |
| Làm nghề 4 giờ | ai không có ca riêng | nhận lương ca trước rồi nhận ca mới |
| Chơi với bé + mini-game | mọi bot (không phải casual thì 2 ván) | kết quả ngẫu nhiên hợp lệ |
| Đầu cơ | speculator | mỗi mặt hàng đang giữ có 50% khả năng bán hết bằng lệnh thị trường; mua 50–199 phần (5–19,9 lô) một mặt hàng ngẫu nhiên (`petdex/scripts/simulate-economy.js:110-118`) |
| Gửi tiết kiệm | diligent | gửi phần ví vượt 400 |
| Mở quầy ở Hẻm nhỏ khi có ≥ 2.300 xu; nhập đủ 40 phần mỗi nguyên liệu trà sữa; trực trưa 4 giờ | merchant | |
| Trồng chè kín vườn; xây Xưởng sấy trà khi có giá xây + 500; mua thêm lá trà khi còn lời; đứng máy sáng và trưa 4 giờ; bán trà khô buổi sáng | producer | |

### Đầu ra
Bảng tài sản ròng trung bình mỗi 3 ngày theo kiểu chơi kèm chỉ số giá và lãi cơ bản; thống kê quầy (lợi nhuận/ngày, ly/ngày, uy tín, ngày hoàn vốn giấy phép 1.500); xưởng (mẻ/ngày, biên mỗi mẻ theo giá cuối, lời gộp/ngày); các phiên Ngân hàng Trung ương; lương, mini-game, tiền ăn, phí, thuế bình quân mỗi bot mỗi ngày; giá cuối / giá gốc; **số người lệch giữa `users.coins` và tổng sổ cái ví**, số dư âm (`petdex/scripts/simulate-economy.js:212-297`).

### Kết quả chạy tại commit e03a0db (60 bot × 30 ngày, seed 1)
| Chỉ số | Kết quả |
|---|---|
| Tài sản ròng TB ngày 30 | 12.760 (thỉnh thoảng 3.695, chăm chỉ 19.671, đầu cơ 17.887, chủ quầy 11.070, chủ xưởng 10.343) |
| Ngân hàng Trung ương | tuần 1 coi như 10%; sau đó tăng 125% → 66% → 56%/tuần; chỉ số giá 1,000 → 1,045 → 1,092 → 1,141; lãi cơ bản chạm sàn 0,05% |
| Quầy trà sữa | 13 quầy, lợi nhuận 115 xu/ngày, 14 ly/ngày, uy tín 1,27, hoàn vốn 13 ngày |
| Xưởng sấy trà | 6 xưởng, 12 mẻ/ngày, biên 18 xu/mẻ, lời gộp 160 xu/ngày |
| Mỗi bot mỗi ngày | lương 203, mini-game 79, tiền ăn 99, phí 4, thuế 5 |
| Giá cuối / gốc | lá trà 3,39, trà khô 2,84, dâu 1,52; cá 0,66, trân châu 0,75 |
| Đối soát sổ cái | 0 lệch, 0 số dư âm |

> [!info] Đọc kết quả
> Lạm phát vẫn trên mục tiêu 10%/tuần (đúng với ghi chú "chưa tới đích" ở thiết kế), nên chỉ số giá tăng đều 4,5%/tuần và lãi ở sàn. Lá trà tăng mạnh vì bot chủ xưởng mua liên tục và tác động giá NPC chưa kịp hồi. Chạy lại với seed khác cho số khác; các con số trên chỉ là một mẫu.

## gear-balance-sim.mjs
- Chạy: `node petdex/scripts/gear-balance-sim.mjs` (`petdex/scripts/gear-balance-sim.mjs:2`). Dùng `normalizeGearConfig(DEFAULT_GEAR_CONFIG)`, PRNG Park–Miller seed 12345, N = 20.000 (`petdex/scripts/gear-balance-sim.mjs:3-6`).
- Kịch bản cho 3, 4, 5 món: đồ Siêu thị (`rollShopGear`), đồ rớt mini-game (`rollGear`), toàn Vàng, toàn Đỏ, "Đỏ chọn lọc" (giữ món có dòng thu nhập cao nhất trong 5 lần quay). In trung bình, p90 và max của 4 loại chỉ số sau `sumBonus` (cộng dồn có giảm dần) (`petdex/scripts/gear-balance-sim.mjs:8-32`).
- Phần cuối đo vòng lặp May mắn: tỉ lệ cấp khi May mắn 0/25/50/100% (`petdex/scripts/gear-balance-sim.mjs:34-37`).
- Kết quả tại e03a0db: 5 món Đỏ chọn lọc trung bình 58,8% "Thu nhập ca làm" (trần 60); May mắn 0% ra Đỏ 2,1%, May mắn 100% ra Đỏ 9,1%. Khớp với bảng "sau" trong `docs/pet-town-gear-balance.md`.
- Luật trang phục thuộc khu A: xem [[Cấp trang phục]], [[Trang phục]], [[Bộ đồ ngũ hành]].

## Liên quan
- [[Ngân hàng Trung ương]] · [[Dòng xu trong game]] · [[Sổ cái]] · [[Quầy trà sữa]] · [[Khu công nghiệp]] · [[Kiểm thử petdex]] · [[Tài liệu thiết kế mở rộng]] · [[MOC Kinh tế và cộng đồng]]
