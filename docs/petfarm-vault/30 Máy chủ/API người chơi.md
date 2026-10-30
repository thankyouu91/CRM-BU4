---
tags: [petfarm, may-chu, api, http]
loai: api
trang-thai: dang-chay
nguon: [petdex/server/routes.js, petdex/server/routes-economy.js, petdex/server/routes-community.js, petdex/server/routes-production.js, petdex/server/routes-clans.js, petdex/server/http.js, petdex/server/service.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# API người chơi

> [!summary]
> Danh mục **đầy đủ 116 route HTTP** mà giao diện game gọi, gom từ năm file `routes*.js`. Đường dẫn công khai là `/ta-tua/api/<route>` (Worker cắt `/ta-tua`, Durable Object cắt `/api`). Mọi route trừ 4 route công khai đều cần `Authorization: Bearer <token>`; nhiều route còn chặn theo **cấp của bé cao cấp nhất**.

## Quy ước

| Mục | Quy ước | Nguồn |
|---|---|---|
| Xác thực | `auth`: đọc `Authorization: Bearer`, tìm `sessions`; không có -> 401 "Phiên đăng nhập đã hết, hãy đăng nhập lại."; bị khóa -> 403 "Tài khoản này đã bị quản trị viên khóa."; ghi `last_seen_at` | `http.js:6-15` |
| Chặn cấp | `requireLevel(userId, level, place)`: lấy `max(level)` của mọi bé; thiếu -> "`<place>` mở khi có một bé đạt cấp `<level>`." | `routes-economy.js:22-25` |
| Bảng cấp | `UNLOCKS = { market: 2, school: 2, garden: 2, bank: 3, townhall: 3, guild: 3, kitchen: 3, business: 4, bazaar: 4, factory: 6, contracts: 6, advanced: 8 }`; gia tộc dùng `clanConfig().unlockLevel` (mặc định 4) | `routes-economy.js:18-20`, `clans.js:20` |
| Body | JSON (`content-type: application/json`), tối đa 16 KB | `router.js:101`, `110-121` |
| Số nguyên | `intField(value, label, {min, max})` -> "`<label>` không hợp lệ." | `http.js:25-29` |
| Phản hồi hành động (ký hiệu **R**) | `reply()`: `{ ...snapshot(userId), result: { ...kết quả, levelUps: [{level, reward}] } }`; bỏ `pet` và `levelsGained` khỏi `result` | `http.js:18-22` |
| Phản hồi xem (ký hiệu **V**) | JSON riêng của hàm `*View` | các module |
| `snapshot` | `{ user: {id, username, coins, activePetId, dailyReadyAt, streak, taxDue, advanced, credit, hasPassword, kind}, pets[], inventory, gear[], economy: {priceIndex, baseRate}, eggs[], slots, memorials[], fortune, badges: {jobs, bank} }` | `service.js:21-52` |
| Lỗi | `GameError` -> 400 `{ error }`; khác -> 500; không khớp -> 404 | `routes.js:320-327`; [[Lỗi và thông báo lỗi]] |

## Công khai (không cần token)

| Method | Route | Body / query | Phản hồi | Nguồn |
|---|---|---|---|---|
| GET | `/catalog` | | Toàn bộ dữ liệu tĩnh: `items, species, rules, gear{tiers, odds}, unlocks, stages, skills, careers, jobs, commodities, market, games, gameCaps, bank, kinds, advancedFinance, business, town, quests, guild, care, school, garden, kitchen` (ẩn món bí mật), `factory, contracts, bazaar, credit` | `routes.js:65-101` |
| POST | `/auth/register` | `{ username, password }` | `{ token, ...snapshot }`. Chỉ khi `settings.openSignup` (production tắt) | `routes.js:103-116` |
| POST | `/auth/login` | `{ username, password }` | `{ token, ...snapshot }`. Chỉ khi `openSignup` | `routes.js:118-125` |
| GET | `/leaderboard` | `?by=networth` | Top 20 bé theo cấp/XP (`{id, name, species, level, xp, wear, owner, weeks}`), hoặc top 20 tài sản ròng | `routes.js:127-140` |

## Lõi: tài khoản, thú, cửa hàng (`routes.js`)

| Method | Route | Cấp | Body | Phản hồi | Nguồn |
|---|---|---|---|---|---|
| POST | `/auth/logout` | | | `{ ok: true }` | `routes.js:144-147` |
| GET | `/me` | | | snapshot | `routes.js:149` |
| POST | `/daily` | | | R; quà ngày + trợ cấp tân thủ | `routes.js:151-168` |
| POST | `/pets` | | `{ name, species }` | R; bé đầu miễn phí, từ bé 2 trừ `RULES.adoptCost` | `routes.js:170-184` |
| GET | `/memorials` | | `?scope=all` | V: bia Đồi Sao của mình hoặc toàn phố | `routes.js:188` |
| POST | `/slots/reopen` | | | R | `routes.js:190` |
| POST | `/eggs/incubate` | | `{ itemId }` | R | `routes.js:194-196` |
| POST | `/eggs/:id/hatch` | | `{ name }` | R, `result.hatched` | `routes.js:198-202` |
| POST | `/pets/:id/active` | | | R; đổi bé chính | `routes.js:204-209` |
| POST | `/pets/:id/use` | | `{ itemId }` | R; `result.gain.xp` | `routes.js:211-229` |
| POST | `/pets/:id/play` | | `{ toyId? }` | R; +4 xu | `routes.js:231-251` |
| POST | `/pets/:id/equip` | | `{ gearId }` đeo, `{ slot }` tháo khe, `{}` tháo hết | R | `routes.js:254-266` |
| POST | `/gear/:id/open` | | | R, `result.opened` | `routes.js:269-277` |
| POST | `/gifts/redeem` | | `{ code, choice? }` | R; có thể `result.needsChoice` | `routes.js:280-284` |
| POST | `/shop/buy` | theo `minLevel` của món | `{ itemId, qty }` (1-20; trang phục chỉ 1) | R; trang phục ra hộp kín `result.gear` | `routes.js:286-313` |

## Kinh tế (`routes-economy.js`, `auth` ở dòng 15)

| Method | Route | Cấp | Body / query | Phản hồi | Nguồn |
|---|---|---|---|---|---|
| GET | `/jobs` | | | V `jobsView` | `routes-economy.js:29` |
| POST | `/jobs/start` | | `{ petId, career, hours, businessId?, factoryId? }` | R `{message, endsAt}` | `routes-economy.js:31-40` |
| POST | `/jobs/:id/claim` | | | R; `gain, skill, promoted` | `routes-economy.js:42-44` |
| GET | `/games` | | | V `{caps, used}` | `routes-economy.js:48` |
| POST | `/games/:game/start` | | | `{ session: {id, game, seed, duration}, caps, used }` (không phải snapshot) | `routes-economy.js:50-53` |
| POST | `/games/finish` | | `{ sessionId, result }` | R; `score, coins, portions, capped, skill, drops` | `routes-economy.js:55-58` |
| GET | `/market` | | | V `marketView` | `routes-economy.js:62` |
| GET | `/market/:commodity/history` | | `?range=week` (mặc định `day`) | Mảng điểm giá hoặc nến giờ | `routes-economy.js:64-66` |
| POST | `/market/order` | 2 | `{ commodity, side, qty (phần), type: 'market'\|'limit', limit? }` | R `{filled, amount, fee, orderId}` | `routes-economy.js:68-80` |
| POST | `/market/orders/:id/cancel` | | | R | `routes-economy.js:82-84` |
| POST | `/market/warehouse` | | | R | `routes-economy.js:86` |
| GET | `/bank` | | | V `bankView` | `routes-economy.js:90` |
| POST | `/bank/savings` | 3 | `{ action: 'deposit'\|'withdraw', amount }` | R | `routes-economy.js:92-99` |
| POST | `/bank/deposits` | 3 | `{ amount, term }` | R | `routes-economy.js:101-106` |
| POST | `/bank/deposits/:id/close` | | | R | `routes-economy.js:108-110` |
| GET | `/wallet` | | `?days=30` (mặc định 7) | V `{netWorth, report, history, ledger}` | `routes-economy.js:114-117` |
| GET | `/wallet/ledger` | | `?kind=&before=` | Trang 40 dòng sổ cái | `routes-economy.js:119-122` |
| GET | `/news` | | | 40 tin trong 3 ngày đã có hiệu lực `{id, commodity, headline, up, at}` | `routes-economy.js:126-133` |
| POST | `/settings` | 8 khi bật | `{ advancedFinance: bool }` | R | `routes-economy.js:137-147` |

## Cộng đồng (`routes-community.js`, `auth` ở dòng 17)

| Method | Route | Cấp | Body | Phản hồi | Nguồn |
|---|---|---|---|---|---|
| GET | `/business` | | | V `businessView` (tự mô phỏng bù) | `routes-community.js:23` |
| POST | `/business/open` | 4 | `{ name, location }` | R | `routes-community.js:25-28` |
| POST | `/business/menu` | | `{ menu: [{recipe, price}] }` | R | `routes-community.js:29` |
| POST | `/business/upgrade` | | `{ key }` | R | `routes-community.js:30` |
| POST | `/business/promote` | | | R | `routes-community.js:31` |
| POST | `/business/jobs` | | `{ wage, slots, open }` | R | `routes-community.js:32-38` |
| POST | `/business/close` | | | R | `routes-community.js:39` |
| GET | `/town` | | | V `townView` | `routes-community.js:43` |
| POST | `/town/vote` | 3 | `{ option }` | R | `routes-community.js:44-47` |
| GET | `/friends` | | | V | `routes-community.js:51` |
| POST | `/friends/request` | | `{ username }` | R | `routes-community.js:52` |
| POST | `/friends/:id/accept` | | | R | `routes-community.js:53` |
| POST | `/friends/:id/remove` | | | R | `routes-community.js:54` |
| GET | `/friends/:id/visit` | | | V thăm nhà | `routes-community.js:55` |
| POST | `/friends/:id/like` | | | R | `routes-community.js:56` |
| POST | `/friends/:id/gift` | | `{ itemId }` | R | `routes-community.js:57-59` |
| GET | `/guild` | | | V | `routes-community.js:63` |
| POST | `/guild/create` | 3 | `{ name, emblem }` | R | `routes-community.js:64-67` |
| POST | `/guild/:id/join` | | | R | `routes-community.js:68` |
| POST | `/guild/leave` | | | R | `routes-community.js:69` |
| POST | `/guild/donate` | | `{ amount }` | R | `routes-community.js:70` |
| POST | `/guild/upgrade` | | `{ key }` | R | `routes-community.js:71` |
| POST | `/guild/contribute` | | `{ commodity, qty (phần) }` | R | `routes-community.js:72-75` |
| GET | `/quests` | | | V | `routes-community.js:79` |
| POST | `/quests/:slot/claim` | | `slot = -1` là rương | R | `routes-community.js:80-84` |

## Sản xuất (`routes-production.js`, `auth` ở dòng 20)

| Method | Route | Cấp | Body / query | Phản hồi | Nguồn |
|---|---|---|---|---|---|
| POST | `/pets/:id/bath` | | | R | `routes-production.js:28` |
| GET | `/clinic` | | | V | `routes-production.js:30` |
| POST | `/clinic/visit` | | `{ petId }` | R | `routes-production.js:31` |
| POST | `/clinic/insurance` | | `{ plan: 'basic'\|'full'\|null }` | R | `routes-production.js:32-34` |
| GET | `/school` | | `?petId` (mặc định bé chính) | V | `routes-production.js:38-42` |
| POST | `/school/class` | 2 | `{ petId, skill }` | R, `result.skill` | `routes-production.js:43-46` |
| GET | `/garden` | | `?owner=<userId>` | V | `routes-production.js:52-55` |
| POST | `/garden/plant` | 2 | `{ plot (0-99), crop }` | R | `routes-production.js:56-59` |
| POST | `/garden/water` | | `{ owner, plot }` | R | `routes-production.js:60-62` |
| POST | `/garden/pests` | | `{ plot }` | R | `routes-production.js:63` |
| POST | `/garden/harvest` | | `{ plot }` | R | `routes-production.js:64` |
| POST | `/garden/expand` | | | R | `routes-production.js:65` |
| GET | `/kitchen` | | | V | `routes-production.js:69` |
| POST | `/kitchen/cook` | 3 | `{ recipe }` hoặc `{ inputs: {commodity: phần} }` | R | `routes-production.js:70-76` |
| POST | `/kitchen/dishes/:id/eat` | | `{ petId }` | R | `routes-production.js:77-79` |
| POST | `/kitchen/dishes/:id/sell` | | | R | `routes-production.js:80-82` |
| GET | `/factory` | | | V (chạy bù xưởng mình và xưởng đang gia công cho mình) | `routes-production.js:88` |
| POST | `/factory/build` | 6 | `{ kind }` | R | `routes-production.js:89-92` |
| POST | `/factory/:id/upgrade` | | | R | `routes-production.js:93` |
| POST | `/factory/:id/toll` | | `{ fee, open }` | R | `routes-production.js:94-96` |
| POST | `/factory/:id/jobs` | | `{ wage, slots, open }` | R | `routes-production.js:97-101` |
| POST | `/factory/:id/close` | | | R | `routes-production.js:102` |
| POST | `/factory/:id/order` | 2 ("Gia công") | `{ batches (1-100) }` | R | `routes-production.js:103-106` |
| POST | `/factory/orders/:id/cancel` | | | R | `routes-production.js:107-109` |
| GET | `/contracts` | | | V | `routes-production.js:115` |
| POST | `/contracts` | 6 | `{ counterpart (tên), role: 'sell'\|'buy', commodity, lots, price, days }` | R | `routes-production.js:116-126` |
| POST | `/contracts/:id/accept` | 6 | | R | `routes-production.js:127-130` |
| POST | `/contracts/:id/decline` | | | R | `routes-production.js:131` |
| POST | `/contracts/:id/break` | | | R | `routes-production.js:132` |
| GET | `/bazaar` | | | V | `routes-production.js:136` |
| POST | `/bazaar/list` | 4 | `{ kind: 'item'\|'gear'\|'dish', ref, price }` | R | `routes-production.js:137-140` |
| POST | `/bazaar/:id/buy` | 4 | | R | `routes-production.js:141-144` |
| POST | `/bazaar/:id/cancel` | | | R | `routes-production.js:145` |
| GET | `/credit` | | | V | `routes-production.js:149` |
| POST | `/credit/borrow` | `advancedFinance` bật trên máy chủ + `users.advanced` | `{ amount, term }` | R | `routes-production.js:150-153` |
| POST | `/credit/loans/:id/repay` | | `{ amount }` | R | `routes-production.js:154-156` |

## Gia tộc, đất, vĩ mô (`routes-clans.js`, `auth` cho `/clans`, `/land`, `/macro` ở dòng 13-15)

| Method | Route | Cấp | Body / query | Phản hồi | Nguồn |
|---|---|---|---|---|---|
| GET | `/clans` | | | V `clanView` | `routes-clans.js:20` |
| POST | `/clans/create` | `unlockLevel` | `{ name, emblem, color }` | R | `routes-clans.js:21-24` |
| POST | `/clans/:id/join` | `unlockLevel` | | R | `routes-clans.js:25-28` |
| POST | `/clans/leave` | | | R | `routes-clans.js:29` |
| POST | `/clans/donate` | | `{ amount >= 10 }` | R | `routes-clans.js:30` |
| POST | `/clans/kick` | | `{ userId }` | R | `routes-clans.js:31` |
| POST | `/clans/role` | | `{ userId, role }` | R | `routes-clans.js:32` |
| POST | `/clans/industries` | | `{ industry }` | R | `routes-clans.js:33` |
| POST | `/clans/declare` | | `{ ratio (0-1) }` | R | `routes-clans.js:34` |
| POST | `/clans/dividend` | | `{ amount }` | R | `routes-clans.js:35` |
| GET | `/land` | | | V `landView` (200 lô) | `routes-clans.js:37` |
| GET | `/land/:id/preview` | | `?industry=` | V hệ số + doanh thu ước tính | `routes-clans.js:38` |
| POST | `/land/:id/buy` | | | R | `routes-clans.js:39` |
| POST | `/land/:id/sell` | | | R | `routes-clans.js:40` |
| POST | `/land/:id/industry` | | `{ industry }` | R | `routes-clans.js:41` |
| POST | `/land/:id/design` | | `{ design: [...] }` | R | `routes-clans.js:42` |
| GET | `/macro` | | | `{ today, history (14 ngày) }` | `routes-clans.js:44-47` |

Quyền theo vai trò trong gia tộc (tộc trưởng/trưởng lão) do `clans.js` kiểm tra, không ở route: xem [[Module clans]].

## Đếm route
| File | GET | POST | Tổng |
|---|---|---|---|
| `routes.js` | 4 | 15 | 19 |
| `routes-economy.js` | 8 | 11 | 19 |
| `routes-community.js` | 6 | 19 | 25 |
| `routes-production.js` | 8 | 28 | 36 |
| `routes-clans.js` | 4 | 13 | 17 |
| **Tổng** | **30** | **86** | **116** |

> [!warning] Lệch tài liệu
> `petdex/docs/api-giai-doan-2.md:186` chỉ ghi `POST /bazaar/list` với `kind: 'item'` hoặc `'dish'`; mã hiện nhận thêm `kind: 'gear'` (`bazaar.js:88-93`) và từ chối `item` là trang phục ("Trang phục bán theo từng món..."). Tài liệu cũng chưa có các route gia tộc, đất, vĩ mô, mã quà, trang phục.

## Bẫy khi gọi API
- Không token tới đường dẫn không tồn tại nhận 401 chứ không phải 404, vì `auth` của các router con chạy trước catch-all ([[Router]]).
- `POST /games/:game/start` không trả snapshot; năng lượng đã bị trừ ngay lúc bắt đầu.
- Mọi khối lượng hàng tính bằng **phần** (`qty`), trừ hợp đồng tính bằng **lô** (`lots`) và dự án Hội hiển thị theo lô.

## Liên quan
- [[API nội bộ]] · [[Giao thức công viên]] · [[Lỗi và thông báo lỗi]] · [[Router]]
- [[Module routes]] · [[Module routes-economy]] · [[Module routes-community]] · [[Module routes-production]] · [[Module routes-clans]] · [[Module http]]
- [[Mở khóa theo cấp]] · [[Phiên chơi và token]]
