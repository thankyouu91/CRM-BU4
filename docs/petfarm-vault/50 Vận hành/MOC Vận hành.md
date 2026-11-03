---
tags: [petfarm, van-hanh, moc]
loai: moc
trang-thai: dang-chay
nguon: [worker.ts, wrangler.jsonc, middleware.ts, lib/petdex.ts, lib/petdex-public.ts, app/(app)/ta-tua, app/api/ta-tua, app/server1, app/invitation, app/password, app/petfarm, app/wiki, .github/workflows/ci.yml, scripts/smoke-worker.mjs, docs/production-release.md]
cap-nhat: 2026-10-30
commit: e03a0db
---
# MOC Vận hành

> [!summary]
> Mọi thứ về cách Pet Town chạy **bên trong WorkHub trên Cloudflare**: Worker và Durable Object, ba tên miền Petfarm và cách định tuyến, đăng nhập (nhân viên, khách mời, tài khoản mật khẩu), giới hạn tần suất, bảng quản lý cho quản trị viên và nhật ký, trang giới thiệu, wiki, sao lưu, CI và quy trình deploy. Luật chơi ở [[MOC Luật chơi]], máy chủ game ở [[MOC Máy chủ]].

## Hạ tầng
- [[Tổng quan hạ tầng]]: sơ đồ một Worker, một Durable Object, ba tên miền, Postgres, R2.
- [[Worker và wrangler]]: `worker.ts` chuyển `/ta-tua/api` và `/ta-tua/ws` vào object `park`; mọi binding trong `wrangler.jsonc`.
- [[Sao lưu dữ liệu]]: cron 02:00, sao lưu Postgres lên R2; dữ liệu game **không** nằm trong bản sao lưu.

## Tên miền và định tuyến
- [[Tên miền Petfarm]]: `petfarm.online` (+ `www`), `play.petfarm.online`, `wiki.petfarm.online`; metadata xem trước link.
- [[Middleware định tuyến]]: thứ tự xử lý trong `middleware.ts`, bảng `siteHostRoute`, `wikiHostRoute`, `playHostRedirect`, CSRF.

## Vào game
- [[Trang chơi server1]]: trang chơi toàn màn hình, ba lối vào, khung game, đăng xuất.
- [[Link mời]]: khách ngoài WorkHub vào bằng tên.
- [[Link đặt mật khẩu]]: link một lần 24 giờ do admin tạo.
- [[Đăng nhập một lần WorkHub]]: nhân viên chơi bằng tài khoản WorkHub qua `/internal/sso`.
- [[Phiên chơi và token]]: bảng `sessions`, `GUEST_SESSION_KEY`, thu hồi phiên.
- [[Giới hạn tần suất]]: binding `LOGIN_LIMITER`, `LOGIN_IP_LIMITER` và giới hạn trong game.
- [[API cầu nối WorkHub]]: `/api/ta-tua/guest`, `/account`, `/admin/[...path]`.

## Quản trị
- [[Bảng quản lý Pet Town]]: bảy tab, ngăn người chơi, cộng/trừ xu, tặng bé, sửa chỉ số, khóa.
- [[Quản trị trang phục và mã quà]]: tỷ lệ cấp, biên độ, rớt đồ, tặng/sửa/xóa đồ, tạo mã quà.
- [[Quản trị Clan]]: Sở thuế, giá đất, luật gia tộc, vĩ mô, 200 lô.
- [[Nhật ký quản trị]]: `admin_log` của game và `AuditLog` của WorkHub.

## Trang công khai
- [[Trang giới thiệu petfarm.online]]: trang landing và đối chiếu số liệu.
- [[Wiki người chơi]]: 26 bài, bảng đọc từ code, chỗ wiki chậm hơn code.

## Phát hành
- [[CI và smoke test]]: các bước CI, những gì smoke test kiểm cho Pet Town.
- [[Quy trình deploy]]: chỉ phiên deploy chuyên trách, commit được duyệt, CI xanh trên đúng SHA; kiểm tra production chỉ đọc.

> [!warning] Chỗ lệch tài liệu đã thấy trong khu này
> Tìm `Lệch tài liệu` trong thư mục: README về cộng/trừ xu và tab Gia tộc, wiki thiếu Gia tộc/Đất, production không có R2 nên không sao lưu, `docs/production-release.md` chưa nhắc Pet Town.

## Bảng tự động
```dataview
TABLE loai, trang-thai FROM "50 Vận hành" WHERE file.name != this.file.name SORT file.name
```

## Liên quan
- [[Trang chủ]]
- [[Bản đồ hệ thống]]
- [[MOC Máy chủ]]
- [[MOC Thiết kế]]
