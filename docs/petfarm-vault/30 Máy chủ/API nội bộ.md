---
tags: [petfarm, may-chu, api, workhub, quan-tri]
loai: api
trang-thai: dang-chay
nguon: [petdex/server/internal.js, petdex/server/db.js, petdex/server/passwords.js, petdex/server/index.js, petdex/server/durable.js, lib/petdex.ts]
cap-nhat: 2026-10-30
commit: e03a0db
---
# API nội bộ

> [!summary]
> `internal.js` là API riêng cho ứng dụng WorkHub: đăng nhập một lần (SSO) cho nhân viên, vào chơi bằng link mời, tài khoản tên + mật khẩu của `play.petfarm.online`, link đặt mật khẩu, và toàn bộ bảng quản trị (người chơi, xu, thú, trang phục, mã quà, link mời, nhật ký, gia tộc, đất, vĩ mô, Sở thuế). Có **38 route**, gắn ở `/internal/*`, không bao giờ đi qua Worker công khai.

## Cách gọi và bảo vệ

| Môi trường | Cách vào | Bảo vệ | Nguồn |
|---|---|---|---|
| Cloudflare | `lib/petdex.ts` gọi `env.PETDEX.get(idFromName('park')).fetch('https://petdex.internal/internal/...')` | Worker không chuyển `/internal` (`worker.ts:31-32`); trong object không kiểm khóa | `lib/petdex.ts:30-38`, `durable.js:65` |
| Node dev | HTTP tới `PETDEX_URL` (mặc định cổng 3200) | Header `x-petdex-internal` phải bằng `PETDEX_INTERNAL_KEY`; sai -> 403 "Chỉ WorkHub mới gọi được." | `index.js:23`, `96-101`, `lib/petdex.ts:43` |

- Người thao tác (để ghi nhật ký) lấy từ `body.actor`, rồi header `x-actor`, mặc định `'WorkHub'`, cắt 80 ký tự (`internal.js:53`).
- Lỗi: `GameError` -> 400 `{ error }`, khác -> 500 "Máy chủ game gặp sự cố.", không khớp -> 404 (`internal.js:608-614`).
- Mọi thao tác ghi đều trong `store.transaction` kèm `store.adminLog(actor, action, userId, details)` (bảng `admin_log`), trừ nhóm gia tộc (log ngoài transaction).

## Đăng nhập, khách, tài khoản

| Method | Route | Body | Phản hồi | Ghi chú | Nguồn |
|---|---|---|---|---|---|
| GET | `/health` | | `{ ok, now }` | | `internal.js:90` |
| POST | `/sso` | `{ crmUserId, name }` | `{ token, userId, username, created }` | Tìm theo `crm_user_id`; chưa có thì tạo user `kind: 'member'` với tên đăng nhập sinh từ tên hiển thị (`usernameFrom`), cộng `RULES.startCoins` loại `opening`; đổi tên hiển thị nếu khác; tái dùng phiên mở trong 7 ngày (`recentToken`) | `internal.js:93-110` |
| GET | `/invites/:code` | | `{ valid, label }` | | `internal.js:113-116` |
| POST | `/guest` | `{ code, name }` | `{ token, userId, username }` | Link còn dùng được (`inviteUsable`: chưa thu hồi, chưa hết hạn, còn lượt); tạo user `kind: 'guest'`, tăng `uses` | `internal.js:118-129` |
| POST | `/guest/resume` | `{ token }` | `{ ok, userId, username, displayName, kind, hasPassword }` | Token còn sống và không bị khóa | `internal.js:132-136` |
| POST | `/account/register` | `{ username, password }` | `{ token, ...account }` | Tên 3-20 ký tự chữ/số/_; mật khẩu 6-72 ký tự; so trùng cả `username` lẫn `login_key` | `internal.js:158-169` |
| POST | `/account/login` | `{ username, password }` | `{ token, ...account }` | Tên có mà chưa có mật khẩu -> **409** `{ reason: 'no_password' }` | `internal.js:171-180` |
| POST | `/account/credentials` | `{ token, username, password, currentPassword? }` | account | Đặt/đổi tên + mật khẩu; đã có mật khẩu thì phải đúng mật khẩu cũ và mọi phiên khác bị đăng xuất | `internal.js:186-202` |
| POST | `/account/claim` | `{ username, password, tokens[] }` | `{ token, ...account }` | Tài khoản cũ chưa có mật khẩu chứng minh sở hữu bằng một trong tối đa 5 token trình duyệt còn giữ; không chứng minh được -> **409** `{ reason: 'no_proof' }` | `internal.js:208-221` |
| GET | `/password-links/:code` | | `{ valid, username, displayName, hasPassword, expiresAt }` | Mã phải là 32 hex; tra bằng sha256 | `internal.js:233-238` |
| POST | `/account/setup` | `{ code, username, password }` | `{ token, ...account }` | Dùng link một lần (`usePasswordLink`), đặt tên + mật khẩu, **đăng xuất mọi phiên cũ**, ghi log `password_set` | `internal.js:241-256` |

## Trang phục và mã quà

| Method | Route | Body | Việc | Log | Nguồn |
|---|---|---|---|---|---|
| GET | `/admin/gear-config` | | `{ config, defaults, tiers, affixes }` | | `internal.js:261-263` |
| POST | `/admin/gear-config` | `{ config }` | Chuẩn hóa và lưu `meta.gear_config` | `gear_config` | `internal.js:264-272` |
| POST | `/admin/players/:id/gear` | `{ itemId \| 'random', tier \| 'random', affixes? }` | Tặng một món; tự nhập dòng chỉ số thì phải chọn cấp | `gear_grant` | `internal.js:275-290` |
| POST | `/admin/gear/:gearId` | `{ tier, affixes }` | Sửa cấp và dòng chỉ số | `gear_edit` | `internal.js:293-304` |
| POST | `/admin/gear/:gearId/delete` | | Xóa món (không cho khi đang bày bán) | `gear_delete` | `internal.js:306-317` |
| GET | `/admin/gift-codes` | | `{ codes, items, wearables, categories }` | | `internal.js:319-327` |
| POST | `/admin/gift-codes` | `{ code?, label, rewards, maxUses?, expiresAt?, count? }` | Tạo 1 mã, hoặc 1-200 mã ngẫu nhiên cùng phần quà (khi `count > 1` thì để trống `code`) | `gift_code` (một dòng cho cả loạt) | `internal.js:330-344` |
| GET | `/admin/gift-codes/:id` | | `{ code, redemptions }` | | `internal.js:346-350` |
| POST | `/admin/gift-codes/:id/revoke` | | Thu hồi | `gift_code_revoke` | `internal.js:352-360` |

## Người chơi, xu, thú, link

| Method | Route | Body / query | Việc | Log | Nguồn |
|---|---|---|---|---|---|
| GET | `/admin/overview` | | Số người theo `kind`, hoạt động 1/7 ngày, tổng tiết kiệm, số thú, dòng tiền 7 ngày theo loại sổ, ngân sách, kinh tế, số người online công viên, top 10 giàu, nhãn loại sổ | | `internal.js:363-375` |
| GET | `/admin/players` | `?q=&kind=member\|guest\|player` | Tối đa 200 dòng `playerRow` (gồm `online` từ `parkUsers`) | | `internal.js:377-381` |
| GET | `/admin/players/:id` | | Chi tiết: thú, túi đồ, tài sản ròng, 30 dòng sổ cái, link mời, kỹ năng, ô nuôi, `spendable`, mọi loài (kể cả hiếm), tủ đồ (kể cả hộp kín và đồ đang bán) | | `internal.js:383-403` |
| POST | `/admin/players/:id/pets` | `{ species, name? }` | Tặng bé bất kỳ loài trong giới hạn ô nuôi | `pet_grant` | `internal.js:405-420` |
| POST | `/admin/players/:id/coins` | `{ delta, memo?, clamp? }` | Cộng/trừ xu qua sổ cái loại `admin`. Trừ thì lấy ví trước rồi tiết kiệm (không đụng kỳ hạn); không đủ thì báo số tối đa, `clamp: true` thì trừ hết | `coins` | `internal.js:429-462` |
| POST | `/admin/players/:id/pets/:petId` | `{ fullness?, happiness?, energy?, hygiene?, health?, level?, xp?, sick: null?, skills? }` | Sửa chỉ số (kẹp 0-100), cấp 1-100, XP, chữa bệnh, kỹ năng (làm tròn 0,1) | `pet` | `internal.js:466-505` |
| POST | `/admin/players/:id/status` | `{ banned }` | Khóa/mở khóa; khóa thì xóa mọi phiên | `ban`/`unban` | `internal.js:507-515` |
| POST | `/admin/players/:id/name` | `{ displayName }` | Đổi tên hiển thị 2-40 ký tự | `rename` | `internal.js:517-525` |
| POST | `/admin/players/:id/password-link` | | Tạo link đặt mật khẩu 24 giờ; trả `{ code, expiresAt }` **một lần**, DB chỉ lưu sha256, link cũ chưa dùng bị vô hiệu | `password_link` (không ghi mã) | `internal.js:528-539` |
| GET | `/admin/invites` | | Danh sách link mời kèm `usable`, số khách | | `internal.js:541` |
| POST | `/admin/invites` | `{ label?, maxUses? (1-10.000), expiresAt? }` | Tạo link mời (mã 18 hex) | `invite` | `internal.js:543-556` |
| POST | `/admin/invites/:id/revoke` | | Thu hồi | `invite_revoke` | `internal.js:558-567` |
| GET | `/admin/log` | `?limit=` (1-200, mặc định 50) | Nhật ký quản trị | | `internal.js:569-572` |

## Gia tộc, đất, vĩ mô, Sở thuế

| Method | Route | Body | Việc | Log | Nguồn |
|---|---|---|---|---|---|
| GET | `/admin/clans` | | `adminClanView()`: cấu hình, thống kê đất, vĩ mô, gia tộc (quỹ, giá trị đất, doanh thu/thuế 30 ngày), 200 lô, 100 hồ sơ trốn thuế, ngân sách | | `internal.js:576` |
| POST | `/admin/clans/config` | `{ config }` | `setClanConfig` (gộp với cấu hình cũ rồi chuẩn hóa) | `clan_config` | `internal.js:578-582` |
| POST | `/admin/clans/plots/:plotId` | `{ price \| null }` | Giá bán riêng một lô (>= 1.000) hoặc bỏ | `land_price` | `internal.js:584-588` |
| POST | `/admin/clans/macro` | `{ phase?, weather?, today?, landIndex? }` | Ép pha/thời tiết cho các ngày tới; `today` thì ghi đè luôn hôm nay | `macro` | `internal.js:591-598` |
| POST | `/admin/clans/evasion/:evasionId/:action` | `{ penalty? }` | `collect` (truy thu thuế trốn × (1 + phạt, tối đa 5), lấy tới hết quỹ) hoặc `dismiss` | `tax_collect`/`tax_dismiss` | `internal.js:600-606` |

## Hàm phụ trợ xuất ra
| Hàm | Dòng | Việc |
|---|---|---|
| `usernameFrom(name)` | `internal.js:29-43` | Tên hiển thị -> tên đăng nhập hợp lệ: NFC, khoảng trắng thành `_`, bỏ ký tự lạ, tối đa 20; ngắn hơn 3 thì thêm `_bé`; trùng thì thêm `_2`, `_3`... |
| `inviteUsable(invite, now)` | `internal.js:62-64` | Kiểm link mời |

> [!info] Không có bí mật trong DB
> Mật khẩu băm scrypt có muối (`passwords.js:4-6`), link đặt mật khẩu chỉ lưu sha256 của mã (`passwords.js:9`), token phiên là 48 hex ngẫu nhiên (`db.js:808-815`). Khóa nội bộ dev chỉ nằm ở biến môi trường.

## Liên quan
- [[Module internal]] · [[API người chơi]] · [[Lỗi và thông báo lỗi]]
- [[Đăng nhập một lần WorkHub]] · [[Link mời]] · [[Link đặt mật khẩu]] · [[Phiên chơi và token]]
- [[Bảng quản lý Pet Town]] · [[Quản trị trang phục và mã quà]] · [[Quản trị Clan]] · [[Nhật ký quản trị]]
