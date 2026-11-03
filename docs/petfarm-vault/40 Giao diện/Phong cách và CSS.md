---
tags: [petfarm, giao-dien, css, thiet-ke]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/css/style.css, public/ta-tua/game/css/economy.css, public/ta-tua/game/css/community.css, public/ta-tua/game/css/townmap.css, public/ta-tua/game/css/games.css, public/ta-tua/game/css/production-a.css, public/ta-tua/game/css/production-b.css, public/ta-tua/game/css/clans.css, public/ta-tua/game/css/petlab.css]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Phong cách và CSS

> [!summary]
> Giao diện game theo phong cách "trà sữa": nền kem có chấm bi, thẻ bo tròn 22 px với bóng đặc lệch xuống (không mờ), nút "bấm lún" có viền và bóng cùng màu đậm, font tròn Baloo 2 cho tiêu đề và Nunito cho chữ thường. Mọi màu là biến CSS trên `:root` trong `style.css`; 8 file CSS khác chia theo nhóm màn. Không có chế độ tối: buổi tối chỉ thể hiện trong cảnh pixel (xem [[Cảnh nhà và thời gian trong ngày]]). Có tôn trọng `prefers-reduced-motion`.

## Biến thiết kế (`:root`)

| Biến | Giá trị | Vai trò |
|---|---|---|
| `--bg` | `#fbf1e3` | nền trang (kèm chấm bi `radial-gradient(var(--line) 2.5px)` lưới 34 px) |
| `--surface` / `--surface-2` | `#fffaf3` / `#fff3e3` | nền thẻ / nền phụ |
| `--ink` / `--muted` | `#4a3326` / `#8f7563` | chữ chính / chữ phụ |
| `--line` / `--line-strong` | `#ecd8bf` / `#dcc0a0` | viền, bóng |
| `--tea` / `--tea-deep` | `#c8915f` / `#9b6238` | màu chủ đạo (nút `primary`, logo) |
| `--pearl` | `#3d2a1f` | trân châu, chữ trên nền vàng |
| `--pink` / `--pink-deep` | `#f4a3b4` / `#d9708a` | nút `pink`, chữ "Park" của logo, chip Quà ngày sẵn sàng |
| `--mint` / `--mint-deep` | `#8fd3bf` / `#4fae93` | nút `mint`, thanh sức khỏe |
| `--sky` | `#bfe3f2` | |
| `--gold` / `--gold-deep` | `#f4c24f` / `#d79c1c` | nút `gold`, thanh XP, toast lên cấp |
| `--danger` | `#d9534f` | lỗi form |
| `--fullness` / `--happiness` / `--energy` | `#f39b4a` / `#ef7fa0` / `#58b9d6` | thanh chỉ số |
| `--radius` | `22px` | bo góc thẻ |
| `--shadow` | `0 6px 0 var(--line)` | bóng đặc của thẻ |
| `--font-body` / `--font-display` | Nunito / Baloo 2 | tải từ Google Fonts trong `index.html` |

Nguồn: `public/ta-tua/game/css/style.css:1-27`, `style.css:33-41`, `public/ta-tua/game/index.html:8-10`. Thanh sạch sẽ dùng `var(--sky-deep, #5fb4d9)` nhưng `--sky-deep` không được khai báo nên luôn ra màu dự phòng (`style.css:221`).

## Thành phần chung

| Lớp | Đặc điểm | Nguồn |
|---|---|---|
| `.card` | nền surface, viền 2 px, bo 22, bóng đặc | `style.css:48-53` |
| `.btn` + `primary`/`pink`/`mint`/`gold`/`small` | viền 2 px, bóng `0 4px 0` cùng màu đậm; hover nhích lên 1 px, active lún 3 px; `disabled` mờ 50% | `style.css:60-77` |
| `.chip` | viên thuốc 999 px; `.chip.coins` nền vàng nhạt; `.chip.daily.ready` hồng và lắc `wiggle` 2,4 giây | `style.css:123-134` |
| `.tabs button.active` | nền trắng, chữ trà đậm, bóng | `style.css:108-121` |
| `.bar > i` | thanh tròn, chuyển `width .5s`; `.bar.low` nhấp nháy `pulse` | `style.css:216-224` |
| `.modal-backdrop`, `.modal` | phủ `#4a332666`, hộp tối đa 460 px, `pop-in` | `style.css:337-344` |
| `.pick` | dòng chọn trong hộp thoại: lưới 48 px + nội dung + huy hiệu; `.current` nền bạc hà | `style.css:345-353` |
| `#toasts`, `.toast` (+ `error`, `level`, `out`) | góc dưới phải, z-index 200 | `style.css:355-366` |
| `.pixel-box` (và `.mood-bubble`, `.pg-name`, `.pg-bubble`) | khung "pixel" không bo góc, viền nâu `--pixel-line` | `style.css:163-170` |
| `.fx-px`, `.fx-fly`, `.fx-text` | lớp hiệu ứng z-index 9500 | `style.css:154-162` |
| `.room[data-time="dusk"/"night"] .sprite` | lọc màu bé theo buổi (sepia, giảm sáng) | `style.css:191-192` |
| `.tier-blue/green/gold/red` | biến `--tier` `#4f8fd6`, `#3fa860`, `#e0a21c`, `#e2493b`; hộp kín `sealed` tím `#a55fd0` viền đứt, icon lắc | `style.css:460-476` |
| `.badge.form-badge.form-0..5` | màu huy hiệu dáng theo cấp | `style.css:478+` |

## Bố cục đáp ứng

| Ngưỡng | Thay đổi | Nguồn |
|---|---|---|
| ≤ 1080 px | thanh trên xuống dòng, tab chiếm cả hàng thứ ba | `style.css:372-376` |
| ≤ 960 px | Nhà và Công viên còn một cột; phòng cao 380 px (mặc định 430) | `style.css:377-380`, `style.css:182-188` |
| ≤ 720 px | tab dạng icon trên chữ, ẩn tên người chơi và nhãn Quà ngày; nút hành động 2 cột; hàng xếp hạng gọn | `style.css:381-392` |
| `prefers-reduced-motion` | tắt gần hết hoạt ảnh và chuyển cảnh | `style.css:393-395` |

Bản đồ phố có thêm chế độ thu gọn dưới 520 px trong JS ([[Vẽ bản đồ phố]]); mini-game dùng `container-type: inline-size` (`css/games.css:2`).

## Các file CSS

| File | Phạm vi | Dòng |
|---|---|---|
| `style.css` | biến, khung app, đăng nhập, Nhà, Nhận nuôi, Siêu thị, Túi đồ, Bảng vàng, Công viên, hộp thoại, toast, ngũ hành, trang phục có cấp | 504 |
| `economy.css` | Việc làm, Ngân hàng, Ví, Sàn, Báo, Khu vui chơi, bản đồ; lớp `.up` `#2f9a6a`, `.down` `#d0505f`, `.small` | 228 |
| `community.css` | Quầy trà sữa, Tòa thị chính, Bạn bè, Hội, nhiệm vụ ngày; `.link-btn`, `.check` | 105 |
| `townmap.css` | bản đồ phố (`tm-*`), tỉ lệ khung 1000/600 | 94 |
| `games.css` | khung mini-game, HUD, đếm ngược, bảng kết thúc, lớp phủ | 116 |
| `production-a.css` | Vườn, Bếp, Trường học, Phòng khám | 210 |
| `production-b.css` | Khu công nghiệp, Hợp đồng, Chợ Phiên, Tín dụng (tiền tố `pb-`) | 237 |
| `clans.css` | Gia tộc & Sở Nhà Đất: tab, bản đồ, xưởng lắp ghép, thuế, vĩ mô | 133 |
| `petlab.css` | trang [[Xưởng tạo hình Pet Lab]] | 80 |

Nguồn: dòng đầu mỗi file; số dòng đo bằng `wc -l`. `index.html` nạp 8 file đầu theo thứ tự trên (`public/ta-tua/game/index.html:11-18`); `pet-lab.html` chỉ nạp `style.css` và `petlab.css`.

## Liên quan
- [[App shell]], [[Kiến trúc giao diện game]], [[Vẽ pixel]], [[Thanh điều hướng và menu tài khoản]]
