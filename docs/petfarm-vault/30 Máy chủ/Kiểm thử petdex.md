---
tags: [petfarm, may-chu, kiem-thu, ci]
loai: van-hanh
trang-thai: dang-chay
nguon: [package.json, vitest.config.ts, petdex/test, tests/petdex-clans.test.ts, tests/petdex-gear.test.ts, tests/petdex-hub.test.ts, tests/petdex-internal.test.ts, tests/petdex-park.test.ts, tests/petdex-router.test.ts, petdex/scripts/simulate-economy.js, .github/workflows]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Kiểm thử petdex

> [!summary]
> Máy chủ game có hai bộ test chạy độc lập: **10 file `node:test`** trong `petdex/test/` (luật thuần, tích hợp kinh tế trên DB `:memory:`, mô phỏng bot) và **6 file Vitest** `tests/petdex-*.test.ts` (router, hub, API nội bộ, trang phục và mã quà, công viên, gia tộc). Cả hai đều chạy trong CI trước khi build Worker.

## Cách chạy

| Lệnh | Định nghĩa | Phạm vi | Nguồn |
|---|---|---|---|
| `npm run test:petdex` | `node --disable-warning=ExperimentalWarning --test "petdex/test/*.test.js"` | 10 file `petdex/test/*.test.js`, mỗi file một tiến trình | `package.json` (scripts) |
| `npm test` | `vitest run` | `tests/**/*.test.ts(x)` (cả test của WorkHub), `environment: "node"`, `TZ: "Asia/Ho_Chi_Minh"` | `package.json`, `vitest.config.ts:7` |
| `npx vitest run tests/petdex-` | | Chỉ 6 file petdex | |
| `node petdex/scripts/simulate-economy.js --bots 60 --days 30 [--seed 1] [--no-elements]` | | Mô phỏng kinh tế đầy đủ | `simulate-economy.js:2`, `278-284` |
| `node petdex/scripts/gear-balance-sim.mjs` | | Mô phỏng cộng dồn trang phục 3-5 món | `gear-balance-sim.mjs:1-2` |
| `npm run petdex:dev` | `node --watch petdex/server/index.js` | Server dev cổng 3200 | `package.json` |

CI: `npm test` rồi `npm run test:petdex` ở `.github/workflows/*.yml:43-44`, trước `opennextjs-cloudflare build` và smoke test Worker. Xem [[CI và smoke test]].

## Mẫu dựng môi trường test
- Đặt `process.env.PETDEX_DB = ':memory:'` **trước** khi `await import('../server/db.js')`, vì `db.js` mở DB ngay khi import (`db.js:762-767`). Mọi import server sau đó đều là `await import(...)` động.
- Điều khiển thời gian bằng tham số `now`: test chọn mốc cố định, ví dụ `T0 = Date.parse('2026-11-02T03:00:00Z')` (10 giờ sáng thứ Hai giờ VN) trong `economy.test.js`, rồi gọi `migrate(T0)`, `runDue(T0)`.
- Tạo người chơi trực tiếp qua `store.createUser`, nạp xu bằng `post({ kind: 'opening' })`, dùng loài lạ `'test_pet'` để số liệu loài trung tính.
- Test Vitest gọi API thật qua `handleFetch(api | internalApi, new Request(...))`, không cần server.
- Nhiều test kết thúc bằng **kiểm toán sổ cái**: mọi số dư ví, tiết kiệm, tài khoản chung bằng tổng `delta` trong `ledger`.

## `petdex/test/` (node:test)

| File | Loại | Bao quát | Số test |
|---|---|---|---|
| `game.test.js` | Luật thuần | `tick` theo giờ, đói thì buồn gấp đôi, lúc đi làm hao nhanh, kẹp 0-100; `settle` lên nhiều cấp; `ageInfo` 6 giai đoạn; `play`, `useItem` | 7 |
| `rules.test.js` | Luật thuần | Nghề (lương, thăng bậc, kỹ năng chậm dần, `checkShift`); Sàn (báo giá, phí, biên, tác động giá, giá hàng chế biến, hồi về trung bình); ngân hàng (trần lãi, rút sớm, chính sách NHTW); mini-game (câu cá, hứng trân châu, ghép hình) | 14 |
| `community-rules.test.js` | Luật thuần | Thuế lũy tiến có giảm thuế; quà ngày theo chuỗi; bỏ phiếu; bốc nhiệm vụ; giá tham chiếu và uy tín quầy | 6 |
| `production-rules.test.js` | Luật thuần | Tính cách; sức khỏe; vườn; bếp; xưởng; hợp đồng; tín dụng; trả góp | 8 |
| `economy.test.js` | Tích hợp | Ca làm; Sàn với NPC và lệnh giới hạn khớp nhau; ngân hàng và NHTW; mini-game chặn gian lận và nộp hai lần; sổ cái khớp từng xu | 6 |
| `community.test.js` | Tích hợp | Quầy (bán giờ cao điểm, thuế doanh thu, tuyển người, thực đơn); bạn bè; Hội và dự án tuần; nhiệm vụ; quyết toán (tiền thuê, thuế, phiên bầu Chủ nhật); sổ cái | 8 |
| `production.test.js` | Tích hợp | Chăm sóc và phòng khám; trường; vườn; bếp và món ẩn; xưởng và gia công; hợp đồng (giao, thiếu, hoàn ký quỹ); Chợ Phiên; vay và vỡ nợ; sổ cái giai đoạn 2 | 10 |
| `pets.test.js` | Tích hợp | 50 loài và ngũ hành; danh sách loài; đồ đeo và khe; chuyển phụ kiện cũ (migration); chỉ số theo loài; hợp mệnh; vận khí ngày; trứng; giai đoạn đời; vòng đời và Đồi Sao | 12 |
| `clans.test.js` | Tích hợp | Bản đồ 200 lô; lắp ghép; lập gia tộc và thâu tóm ngành; thuế theo số ngành; mua đất và công trình; quyết toán đêm với hồ sơ trốn thuế; hoàn thuế tháng; giá đất; vĩ mô; rời và giải tán | 10 |
| `simulation.test.js` | Mô phỏng | 16 bot x 15 ngày (`seed: 7`): sổ cái khớp, không số dư âm, NHTW họp, chăm chỉ giàu hơn chơi thỉnh thoảng, đầu cơ không lời hơn hẳn, lương bình quân < 260/ngày, mini-game <= 100, giá trôi trong 0,4-2,5 lần, tỉ lệ khám bệnh < 20%, quầy có lãi | 1 |

## `tests/petdex-*.test.ts` (Vitest)

| File | Bao quát | Số `it` |
|---|---|---|
| `petdex-router.test.ts` | Tham số và query, cắt prefix; parse JSON và giữ status; từ chối body không phải JSON hoặc quá lớn; router lồng; catch-all 404; error handler; handler bất đồng bộ | 7 |
| `petdex-hub.test.ts` | Token sai -> `connect_error` rồi đóng; room và broadcast như socket.io; `bindWebSocket` khung đầu là auth, đóng thì dọn | 3 |
| `petdex-internal.test.ts` | SSO một lần giữ đúng tài khoản; đăng ký gốc đóng; khách qua link mời; cộng/trừ xu (ví rồi tiết kiệm, `clamp`); sửa chỉ số thú; tặng loài hiếm trong giới hạn ô; bé cấp 1 làm ca nhẹ 2 giờ 50% lương; tắm là "đang tắm" không phải đi làm; khóa/mở khóa; overview; tài khoản tên + mật khẩu, so tên không phân biệt hoa thường có dấu, đổi mật khẩu đăng xuất nơi khác, tài khoản cũ cần chứng minh, link đặt mật khẩu một lần 24 giờ, người bị khóa không đăng nhập được | 19 |
| `petdex-gear.test.ts` | Quay 1-4 dòng theo cấp; May mắn đẩy cấp cao; cộng dồn có trần; hộp kín ở Siêu thị; chỉ số tác động lương, chăm sóc, rớt đồ; bán ở Chợ Phiên chuyển bản; quản trị sửa/xóa có log; cấu hình được kiểm; số món đeo theo cấp và Huyền thoại; mọi món có hình và khe; mã quà (một lần mỗi người, hạn, thu hồi, loạt mã, hợp mệnh, lượt chọn, kiểm phần quà, chống dò 10 lần/phút) | 18 |
| `petdex-park.test.ts` | Cư dân công viên (online hay không), thay chỗ khi vào/ra; vuốt ve và tặng quà cư dân vắng chủ; bé mất thì cư dân biến mất | 3 |
| `petdex-clans.test.ts` | Người chơi đủ cấp lập gia tộc, thâu tóm ngành, mua lô qua API; bảng quản trị chỉnh giá đất và vĩ mô | 2 |

> [!tip] Viết test mới
> Test tích hợp nên đi qua `handleFetch` (như các file Vitest) để bắt được cả `auth`, `requireLevel`, `reply()`; còn luật số học thì gọi thẳng `rules/*.js`. Khi thêm loại sổ cái mới, thêm vào `KINDS` rồi chạy các test "sổ cái khớp".

> [!warning] Lệch tài liệu
> `petdex/README.md:17-19` nói `npm test`, `npm run simulate`, `npm run demo` (của repo gốc); trong repo này không có các script đó trong `petdex/package.json`. `npm test` ở gốc là Vitest (không chạy `petdex/test`), còn test node là `npm run test:petdex`; mô phỏng chạy bằng `node petdex/scripts/simulate-economy.js`.

## Liên quan
- [[CI và smoke test]] · [[Mô phỏng kinh tế]] · [[Quy trình deploy]]
- [[Router]] · [[Hub WebSocket]] · [[API nội bộ]] · [[Sổ cái]]
