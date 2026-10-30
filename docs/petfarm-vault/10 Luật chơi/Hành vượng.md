---
tags: [petfarm, luat-choi, ngu-hanh]
aliases: [Vận khí, Vận khí hôm nay, Fortune]
loai: luat
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/pets.js, petdex/server/elements.js, petdex/server/clock.js, public/ta-tua/game/js/views/map.js, public/ta-tua/game/js/app.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Hành vượng

> [!summary]
> Mỗi ngày (giờ Việt Nam) đúng một hành "vượng". Bé thuộc hành đó được **+10% XP** mọi hành động và **+10% lương** ca nghề trong ngày. Vòng xoay theo thứ tự tương sinh Mộc → Hỏa → Thổ → Kim → Thủy, lặp lại mỗi 5 ngày, nên người chơi có thể canh ngày để cho bé đi làm.

## Công thức
```
n = floor( Date.parse("YYYY-MM-DDT00:00:00Z") / 86 400 000 )   (số ngày kể từ 1/1/1970 của ngày VN)
hành vượng = FORTUNE_CYCLE[ n mod 5 ],  FORTUNE_CYCLE = [moc, hoa, tho, kim, thuy]
```
(`public/ta-tua/game/js/shared/pets.js:302-307`.) `dayKey` lấy ngày theo UTC+7, qua ngày lúc 00:00 giờ Việt Nam (`petdex/server/clock.js:4-7`).

## Con số
| Ngày (VN) | Hành vượng |
|---|---|
| 30/10/2026 | 🔥 Hỏa |
| 31/10/2026 | ⛰️ Thổ |
| 01/11/2026 | 🪙 Kim |
| 02/11/2026 | 💧 Thủy |
| 03/11/2026 | 🌿 Mộc |

(Tính bằng `fortuneOf` của chính game.)

| Hiệu ứng | Giá trị | Áp dụng | Nguồn |
|---|---|---|---|
| XP | ×1,1 | mọi XP qua `mutatePet` | `petdex/server/elements.js:26`, `petdex/server/service.js:70` |
| Lương ca nghề | +0,1 vào hệ số `elementPay` (cộng, không nhân) | 5 nghề, lương chốt lúc **bắt đầu** ca | `petdex/server/elements.js:29-31`, `petdex/server/jobs.js:150` |

## Cách hiện trên giao diện
- Màn Phố: dải "Vận khí hôm nay: hành X vượng. Bé hành X được +10% kinh nghiệm và +10% lương ca làm." (`public/ta-tua/game/js/views/map.js:30-36`).
- Màn Nhà: huy hiệu "🌟 Hôm nay hành X vượng: +10% XP và lương" cạnh hành của bé (`public/ta-tua/game/js/app.js:426-440`).
- `snapshot` gửi `fortune` cho client mỗi lần tải (`petdex/server/service.js:46`).

## Trường hợp đặc biệt
- Lương được tính và chốt khi nhận ca (`startShift`); ca bắt đầu lúc 23:30 ngày vượng vẫn hưởng +10% dù xong ca sang ngày khác.
- Trực quầy và đứng máy (làm thuê) không hưởng hành vượng: lương do chủ đặt (`petdex/server/jobs.js:116-145`).
- Bé khách mời không có hành thì không bao giờ vượng.

## Liên quan
- [[Ngũ hành]] · [[Việc làm]] · [[Cấp độ và XP]] · [[Đồng hồ và ngày giờ game]] · [[Màn Phố]]
