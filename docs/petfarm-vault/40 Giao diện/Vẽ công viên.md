---
tags: [petfarm, giao-dien, render, cong-vien, websocket]
loai: ma-nguon
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/park.js, public/ta-tua/game/js/scenes.js, public/ta-tua/game/js/socket.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Vẽ công viên

> [!summary]
> `park.js` (423 dòng) dựng [[Màn Công viên]]: nền pixel từ `mountParkScene`, các bé của người chơi đang có mặt (và "cư dân" của người chơi vắng mặt) chạy quanh bằng một vòng `requestAnimationFrame`, menu bấm vào bé khác để vuốt ve hoặc tặng quà, danh sách người có mặt, nhật ký chat và nút cảm xúc. Mọi trạng thái đồng bộ qua [[Socket phía trình duyệt]] với các sự kiện `pg:*` của [[Giao thức công viên]].

## Thế giới và tỉ lệ

| Mục | Giá trị | Nguồn |
|---|---|---|
| Thế giới mặc định | 1000×600, vùng đi được x 50–950, y 318–585 (máy chủ gửi lại trong `pg:state`) | `public/ta-tua/game/js/park.js:44` |
| Co giãn | `scale = wrap.clientWidth / world.width`, `transform: scale()` cho `#park-world` | `park.js:56-61` |
| Tốc độ | `SPEED = 190` đơn vị/giây | `park.js:6` |
| Cỡ bé | `BASE_SCALE = 0.6` | `park.js:7`, `park.js:86` |
| Khoảng cách vuốt ve | `CUDDLE_GAP = 62` (chạy tới cạnh bé kia trước) | `park.js:8`, `park.js:215-238` |
| Độ sâu | `zIndex = round(y)` nên bé phía dưới đè bé phía trên | `park.js:77-81` |

## Vòng lặp di chuyển (`step`)

- Mỗi khung: tiến tới đích `(tx, ty)` theo `SPEED × dt` (dt tối đa 0,05 giây); quay mặt `runRight`/`runLeft` khi đi ngang đủ nhiều; thân nảy `translateY(−|sin(now/85)| × 5px)`; mỗi 170 ms tung 1 hạt bụi sau gót (`park.js:160-185`).
- Tới nơi: về `idle`, chạy hàm `onArrive` (ví dụ gửi vuốt ve).
- **Cư dân**: bé của người chơi vắng mặt (`offline`) tự đi dạo quanh chỗ cũ mỗi 4–12 giây trong ±110 × ±45 đơn vị; chỉ chạy ở máy mỗi người, không gửi lên máy chủ, nên mỗi máy thấy một kiểu (`park.js:110-112`, `park.js:186-191`).
- Tên dưới bé: "{tên bé} **Lv n** · 💤 {người chơi}"; lớp `away` và tooltip "… đang vắng, bé vẫn dạo công viên" (`park.js:83-92`).

## Thao tác

| Thao tác | Kết quả | Sự kiện gửi | Nguồn |
|---|---|---|---|
| Bấm bãi cỏ | bé mình chạy tới (kẹp trong vùng đi được) | `pg:move {x, y}` | `park.js:200-209`, `park.js:270-284` |
| Bấm bé mình | nhảy | `pg:emote {kind:'jump'}` | `park.js:277` |
| Bấm bé khác hoặc dòng danh sách | mở menu `pg-menu`: "{bé} của {người}", "💖 Vuốt ve", "🎁 Tặng quà từ túi đồ" (đồ ăn, đồ chăm sóc đang có, emoji + số lượng) hoặc "Túi chưa có gì để tặng." | | `park.js:240-268`, `park.js:286-289` |
| Vuốt ve | chạy tới cạnh rồi gửi | `pg:cuddle {targetId}` | `park.js:262` |
| Tặng | | `pg:gift {targetId, itemId}` | `park.js:263` |
| Nút 👋 Vẫy / 🦘 Nhảy / 🌀 Xoay | | `pg:emote {kind}` | `park.js:22-26`, `park.js:291-295` |
| Chat (tối đa 120 ký tự) | | `pg:chat {text}` | `park.js:29-32`, `park.js:297-304` |
| Esc | đóng menu | | `park.js:306-307` |

## Sự kiện nhận

| Sự kiện | Hiển thị | Nguồn |
|---|---|---|
| `connect` | "Đang vào công viên…", gửi `pg:join` | `park.js:315-318` |
| `connect_error` | "Không kết nối được: …" | `park.js:319` |
| `disconnect` | "Mất kết nối, đang thử lại…" (trừ khi tự ngắt) | `park.js:320-322` |
| `pg:state` | nhận `selfId`, `world`, danh sách người; log "Bạn đã vào công viên. Chào mọi người đi! 👋" | `park.js:324-337` |
| `pg:joined` | thêm bé, 5 lấp lánh, log "X dắt Y vào công viên" | `park.js:338-343` |
| `pg:left` | log "X đã về nhà, bé vẫn ở lại chơi" (trừ `quiet`) | `park.js:345-348` |
| `pg:moved` | đổi đích | `park.js:350-353` |
| `pg:player` | cập nhật bé (đổi đồ, lên cấp); người vừa online thì bỏ bản cư dân cũ (`dropResident`) | `park.js:355-363` |
| `pg:chat` | bong bóng thoại 4,5 giây + log | `park.js:365-368` |
| `pg:emote` | chạy hoạt ảnh một lần; vẫy có nốt nhạc, xoay có lấp lánh, nhảy có bụi | `park.js:370-377` |
| `pg:fx` cuddle | bé được vuốt nhảy, người vuốt vẫy, 6 + 2 tim, log "💖 X vuốt ve Y" | `park.js:380-385` |
| `pg:fx` gift | món quà bay vòng cung (`flyTo`) từ bé tặng sang bé nhận, lấp lánh, log "🎁 X tặng Y …" | `park.js:386-396` |
| `me:changed` | lên cấp: 12 lấp lánh + "LÊN CẤP!"; rồi `ctx.onMeChanged` (app tải lại `/me`, toast thông báo, chúc mừng) | `park.js:399-406`, `public/ta-tua/game/js/app.js:1032-1036` |
| `pg:error` | toast lỗi | `park.js:407` |
| `pg:kicked` | "Bạn vừa vào công viên từ một tab khác." rồi ngắt | `park.js:408-411` |

Nhật ký giữ tối đa 80 dòng (`park.js:66-73`). Hàm dọn hủy rAF, ResizeObserver, socket, menu, mọi hình bé và cảnh nền (`park.js:413-422`).

## Liên quan
- [[Màn Công viên]], [[Socket phía trình duyệt]], [[Giao thức công viên]], [[Hub WebSocket]], [[Durable Object PetdexPark]]
- [[Cảnh nhà và thời gian trong ngày]], [[Sprite và bảng hình]], [[Hiệu ứng hạt]], [[Công viên]]
