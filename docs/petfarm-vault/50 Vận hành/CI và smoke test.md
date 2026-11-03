---
tags: [petfarm, van-hanh, ci, kiem-thu]
loai: van-hanh
trang-thai: dang-chay
nguon: [.github/workflows/ci.yml, scripts/smoke-worker.mjs, scripts/package-worker.mjs, package.json]
cap-nhat: 2026-10-30
commit: e03a0db
---
# CI và smoke test

> [!summary]
> Mỗi push và pull request chạy workflow `CI` trên GitHub Actions: lint, kiểm kiểu, test WorkHub, **test riêng của game** (`npm run test:petdex`), audit gói, build OpenNext, dry-run wrangler, đóng gói bản Worker Linux, rồi **chạy chính gói đó trong workerd** bằng `scripts/smoke-worker.mjs`. Chỉ khi tất cả xanh mới có artifact `cloudflare-worker-<sha>` để deploy. Smoke test kiểm tra Pet Town từ đầu đến cuối: API, Durable Object, đăng nhập một lần, WebSocket, bảng quản lý, ba tên miền, tài khoản mật khẩu.

## Các bước của `ci.yml`
| # | Bước | Ý nghĩa | Nguồn |
|---|---|---|---|
| | Kích hoạt | `pull_request`, `push`; hủy lần chạy cũ cùng ref | `.github/workflows/ci.yml:2-7` |
| | Môi trường | `ubuntu-latest`, 15 phút, Node 22, dịch vụ Postgres 16 chỉ cho CI | `.github/workflows/ci.yml:11-27`, `.github/workflows/ci.yml:35-38` |
| 1 | `npm ci` | | `.github/workflows/ci.yml:39` |
| 2 | `npx prisma migrate deploy` | schema WorkHub vào DB test | `.github/workflows/ci.yml:40` |
| 3 | `npm run lint` | | `.github/workflows/ci.yml:41` |
| 4 | `npm run typecheck` | `tsc --noEmit` | `.github/workflows/ci.yml:42`, `package.json:10` |
| 5 | `npm test` | Vitest (có suite cho router, hub, API nội bộ của game) | `.github/workflows/ci.yml:43`, `package.json:22` |
| 6 | `npm run test:petdex` | `node --test petdex/test/*.test.js` (luật chơi, kinh tế, mô phỏng, clan…) | `.github/workflows/ci.yml:44`, `package.json:24` |
| 7 | `npm audit --omit=dev --audit-level=high` | | `.github/workflows/ci.yml:45` |
| 8 | `npx opennextjs-cloudflare build` | | `.github/workflows/ci.yml:46` |
| 9 | `npx wrangler deploy --dry-run --outdir .wrangler-dry-run` | bundle cuối, không deploy | `.github/workflows/ci.yml:47` |
| 10 | `node scripts/package-worker.mjs` | gói `.release/worker-release.tar.gz` + `release.json` (commit, source head, tree, SHA-256 của worker.js) | `.github/workflows/ci.yml:48`, `scripts/package-worker.mjs:22-34` |
| 11 | `node scripts/smoke-worker.mjs` | chạy gói trong workerd local | `.github/workflows/ci.yml:49` |
| 12 | upload artifact `cloudflare-worker-${sha}` | giữ 7 ngày, thiếu file thì lỗi | `.github/workflows/ci.yml:50-55` |

Test của game nằm ở `petdex/test/`: `clans`, `community-rules`, `community`, `economy`, `game`, `pets`, `production-rules`, `production`, `rules`, `simulation`. Xem [[Kiểm thử petdex]].

## smoke-worker.mjs: Pet Town được kiểm gì
An toàn trước tiên: script từ chối chạy nếu `TEST_DATABASE_URL` không phải localhost/127.0.0.1/postgres và tên DB không kết thúc bằng `_test` (`scripts/smoke-worker.mjs:10-12`). Nó dựng `wrangler dev --local` cổng 8788 từ chính `.release/worker/wrangler.json` (`scripts/smoke-worker.mjs:23-29`), tạo người dùng tạm, cuối cùng xóa sạch (`scripts/smoke-worker.mjs:210-214`).

| Kiểm tra | Kỳ vọng | Dòng |
|---|---|---|
| `GET /ta-tua/api/catalog` | 200, có loài, có 4 cấp trang phục `blue, green, gold, red` | `scripts/smoke-worker.mjs:89-93` |
| `/ta-tua` với cookie nhân viên | 200, HTML chứa iframe `/ta-tua/game/#token=<hex>` | `scripts/smoke-worker.mjs:94-98` |
| `GET /ta-tua/api/me` bằng token | 200; nhân viên mới có **150 xu**; snapshot có `gear` | `scripts/smoke-worker.mjs:99-103` |
| Nhập mã quà lạ | 400 "Mã quà không đúng" | `scripts/smoke-worker.mjs:104-106` |
| `/api/ta-tua/admin/overview`, `gear-config`, `gift-codes` với người không phải admin | 403 | `scripts/smoke-worker.mjs:107-112` |
| `/internal/health`, `/ta-tua/internal/health`, `/ta-tua/api/%2e%2e/internal/health`, `/ta-tua/api/internal/health` | không được trả `{"ok":true}` (API nội bộ không lộ) | `scripts/smoke-worker.mjs:113-118` |
| WebSocket `/ta-tua/ws` | token đúng: `connect`; token sai: `connect_error` | `scripts/smoke-worker.mjs:119-137` |
| `petfarm.online/` | 200, có "Nuôi bé, đi làm" và ảnh `/petfarm/map.webp` | `scripts/smoke-worker.mjs:159-162` |
| `petfarm.online/dashboard` | về `/` | `scripts/smoke-worker.mjs:163` |
| `petfarm.online/api/projects` | 404 | `scripts/smoke-worker.mjs:164` |
| `www.petfarm.online/abc` | `https://petfarm.online/abc` | `scripts/smoke-worker.mjs:165` |
| `wiki.petfarm.online/` và `/bat-dau` | 200, có "Sổ tay Phố Trân Châu" | `scripts/smoke-worker.mjs:167-171` |
| `wiki.petfarm.online/api/projects` | 404 | `scripts/smoke-worker.mjs:172` |
| `play.petfarm.online/dashboard` | 307 về `/server1` | `scripts/smoke-worker.mjs:174-176` |
| `play.petfarm.online/api/projects` | 404 | `scripts/smoke-worker.mjs:177-178` |
| `/server1` với cookie | iframe có token | `scripts/smoke-worker.mjs:179-180` |
| `/invitation/deadbeef00` | "Link mời này không còn hiệu lực" | `scripts/smoke-worker.mjs:181-182` |
| `/ta-tua/khach/deadbeef00` | chuyển `https://play.petfarm.online/invitation/deadbeef00` | `scripts/smoke-worker.mjs:183-184` |
| Đăng ký, đăng nhập, sai mật khẩu (400), nhân viên thêm mật khẩu, đăng nhập rỗng với tên lạ (400) | đúng luồng [[Tài khoản người chơi]] | `scripts/smoke-worker.mjs:185-198` |
| `/password/000…0` (32 số 0) | trang "…đã dùng rồi hoặc đã hết hạn", và 200 trên tên miền game | `scripts/smoke-worker.mjs:199-201` |
| `/ta-tua/game/` và `/ta-tua/game/index.html` | 200 không redirect (static asset) | `scripts/smoke-worker.mjs:202-205` |

> [!info] Header Host
> `fetch` của Node bỏ header `Host` tự đặt, nên các kiểm tra theo tên miền dùng `node:http` (`scripts/smoke-worker.mjs:138-158`).

## Khi CI đỏ
- Test chập chờn đã từng gặp: `8c49f6f` sửa test mã quà (món ngẫu nhiên đôi khi cũng là vương miện, khoảng 1/30 lần, CI run 40908062501). Code đúng, test được ghim `Math.random`.
- Không deploy commit nào chưa có CI xanh **trên đúng SHA đó**, xem [[Quy trình deploy]].

## Liên quan
- [[Quy trình deploy]]
- [[Kiểm thử petdex]]
- [[Tên miền Petfarm]]
- [[Middleware định tuyến]]
- [[MOC Vận hành]]
