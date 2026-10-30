---
tags: [petfarm, van-hanh, ten-mien]
loai: van-hanh
trang-thai: dang-chay
nguon: [lib/petdex-public.ts, middleware.ts, scripts/smoke-worker.mjs, README.md]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Tên miền Petfarm

> [!summary]
> Petfarm có ba tên miền công khai, cả ba là Custom Domain của cùng Worker `crm`: `petfarm.online` (trang giới thiệu, có bí danh `www`), `play.petfarm.online` (game) và `wiki.petfarm.online` (hướng dẫn chơi). Cùng một ứng dụng phục vụ cả ba; [[Middleware định tuyến]] nhìn header `host` để quyết định mỗi tên miền chỉ thấy phần của mình. Tên miền WorkHub vẫn là nơi nhân viên chơi trong khung và quản trị.

## Bảng tên miền

| Tên miền | Vai trò | Biến build để đổi | Mặc định | Đường gốc trong app | Nguồn |
|---|---|---|---|---|---|
| `petfarm.online` | Trang giới thiệu | `NEXT_PUBLIC_PETFARM_SITE_ORIGIN` | `https://petfarm.online` | `/petfarm` (`SITE_PATH`) | `lib/petdex-public.ts:54-58` |
| `www.petfarm.online` | Bí danh, chuyển 308 về tên miền chính, giữ đường dẫn và query | (tự suy ra) | `SITE_ALIAS` | | `lib/petdex-public.ts:57`, `middleware.ts:26` |
| `play.petfarm.online` | Game: trang chơi, link mời, link đặt mật khẩu, đăng nhập | `NEXT_PUBLIC_PETDEX_PLAY_ORIGIN` | `https://play.petfarm.online` | `/server1` (`PLAY_PATH`) | `lib/petdex-public.ts:7-11` |
| `wiki.petfarm.online` | Wiki người chơi | `NEXT_PUBLIC_PETFARM_WIKI_ORIGIN` | `https://wiki.petfarm.online` | `/wiki` (`WIKI_PATH`) | `lib/petdex-public.ts:72-74` |
| `crm.<subdomain>.workers.dev` | WorkHub: `/ta-tua` (chơi trong khung), `/ta-tua/quan-ly` | | | | `wrangler.jsonc:3-4` |

> [!info] Bí danh tự suy
> `SITE_ALIAS` là "tên kia" của tên miền giới thiệu: nếu `SITE_HOST` bắt đầu bằng `www.` thì bỏ đi, không thì thêm `www.` (`lib/petdex-public.ts:57`). Nhờ vậy đổi qua lại giữa `petfarm.online` và `www.petfarm.online` chỉ cần đổi một biến.

## Địa chỉ dựng sẵn
| Hàm | Kết quả | Nguồn |
|---|---|---|
| `inviteUrl(code)` | `https://play.petfarm.online/invitation/<code>` | `lib/petdex-public.ts:18` |
| `passwordUrl(code)` | `https://play.petfarm.online/password/<code>` | `lib/petdex-public.ts:19` |
| `playUrl()` | `https://play.petfarm.online/server1` | `lib/petdex-public.ts:20` |

## Xem trước khi chia sẻ link (Open Graph)
Trang `/server1`, `/invitation`, `/password/<mã>` dùng chung `playMetadata` để khung xem trước trong chat chỉ nói về game, không nhắc WorkHub (`lib/petdex-public.ts:22-32`).

| Trường | Giá trị | Nguồn |
|---|---|---|
| Tên trang (`siteName`, `applicationName`) | `Petfarm Server` | `lib/petdex-public.ts:23` |
| Tiêu đề | `Pet Town · Petfarm Server 1` | `lib/petdex-public.ts:24` |
| Mô tả | `Petfarm, có làm mới có ăn.` | `lib/petdex-public.ts:25` |
| Ngôn ngữ | `vi_VN`; Twitter card `summary` | `lib/petdex-public.ts:30-31` |

Trang giới thiệu có metadata riêng ([[Trang giới thiệu petfarm.online]]).

## Lịch sử
- `444bef7` (2026-10-29): game có tên miền riêng `play.petfarm.online`, link mời chuyển sang `/invitation/<mã>`.
- `02923b5` (2026-10-29): trang giới thiệu đặt ở `www.petfarm.online`, tên miền trần chuyển về `www`.
- `5fd3deb` (2026-10-30): đảo lại theo yêu cầu chủ dự án: trang giới thiệu ở tên miền trần `petfarm.online`, `www` chuyển 308 về đó (`SITE_APEX` đổi thành `SITE_ALIAS`).
- `63bf2c8` (2026-10-30): thêm `wiki.petfarm.online`.

Kiểm thử tự động cho cả ba tên miền nằm trong [[CI và smoke test]] (`scripts/smoke-worker.mjs:159-178`).

> [!warning] Việc ngoài code
> Phải gắn `petfarm.online`, `www.petfarm.online`, `play.petfarm.online`, `wiki.petfarm.online` làm Custom Domain của Worker `crm` trên Cloudflare (README.md:167, README.md:170-171). Code không tự làm việc này.

## Liên quan
- [[Middleware định tuyến]]
- [[Trang chơi server1]]
- [[Trang giới thiệu petfarm.online]]
- [[Wiki người chơi]]
- [[MOC Vận hành]]
