---
tags: [petfarm, giao-dien, man-hinh, phong-kham, bao-hiem]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/clinic.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Phòng khám

> [!summary]
> Màn `#clinic` (tòa 🩺, không khóa cấp): thẻ sức khỏe từng bé với hóa đơn khám/chữa (đã trừ phần bảo hiểm), nút tắm miễn phí, các gói [[Bảo hiểm sức khỏe]] và mẹo giữ bé khỏe. Luật ở [[Ốm và Phòng khám]].

## Thẻ từng bé

| Phần | Nội dung | Nguồn |
|---|---|---|
| Đầu thẻ | tên, "Lv n · tâm trạng · đang bận"; huy hiệu bệnh (icon + tên) hoặc "💚 Khỏe" | `public/ta-tua/game/js/views/clinic.js:44-53` |
| Thanh | ❤️ Sức khỏe (đỏ khi `< care.health.sickBelow`), 🫧 Sạch sẽ (đỏ khi `< 20`, hằng `DIRTY_BELOW` ở client) | `clinic.js:6`, `clinic.js:54-55` |
| Ghi chú | ốm: "Bé ốm không đi làm, đi học, chơi mini-game hay vào bếp được, và không tự khỏi. Chữa sớm cho bé nhé!"; sức khỏe thấp: "❤️ Sức khỏe dưới n: bé dễ ốm, nhất là qua đêm. Nên khám tổng quát."; bẩn: "🫧 Bé đang lấm lem…" | `clinic.js:38-41` |
| Hóa đơn | "Chữa {bệnh}" hoặc "Khám tổng quát" + tổng; "🛡️ Bảo hiểm trả −n"; "Bạn trả n" | `clinic.js:57-61` |
| Nút | "🩺 Chữa bệnh / Khám tổng quát · +n ❤️" (khóa khi sức khỏe đầy và không ốm, hoặc không đủ xu); "🛁 Tắm miễn phí" (khóa khi bận hoặc sạch 100) | `clinic.js:62-66` |
| Chú thích | "Sức khỏe đang đầy, chưa cần khám đâu." / "Không đủ xu trả viện phí." | `clinic.js:67-68` |

Số cộng sức khỏe: `care.clinic.treatHealth` khi chữa, `checkupHealth` khi khám; hóa đơn lấy từ `c.treatments[bệnh].bill` hoặc `c.checkup` do `GET /clinic` trả (`clinic.js:28-36`).

## Bảo hiểm

- Ghi chú đầu khối: có gói thì "Bảo hiểm trả một phần viện phí cho mọi bé trong nhà."; chưa có thì "Chưa có bảo hiểm: mỗi lần khám hay chữa bệnh bạn trả đủ 100%." + "Phí trừ lúc nửa đêm mỗi ngày; ví không đủ xu thì gói tự hủy." (`clinic.js:107-112`).
- Thẻ gói (icon 🩹 `basic`, 🛡️ `full`): phí/ngày, "Trả n% viện phí", ví dụ tính trên bệnh `stomach` (hoặc bệnh đầu tiên), nút "Đăng ký" / "Chuyển sang gói này" hoặc "✅ Đang dùng từ {ngày}" + link "Hủy bảo hiểm" (`clinic.js:5`, `clinic.js:72-90`).

## Mẹo

4 dòng lấy số từ catalog: tắm bận `health.bathMinutes` phút, sạch sẽ giảm `|hygienePerHour|`/giờ, dưới 20 là bẩn; ăn đều; dưới `sickBelow` dễ ốm; chữa +`treatHealth`, khám +`checkupHealth` (`clinic.js:115-123`).

## API

| Hành động | API | Nguồn |
|---|---|---|
| Mở màn | `GET /clinic` | `clinic.js:139` |
| Khám / chữa | `POST /clinic/visit {petId}` | `clinic.js:131` |
| Tắm | `POST /pets/:id/bath` | `clinic.js:132` |
| Đổi gói | `POST /clinic/insurance {plan}` | `clinic.js:133` |
| Hủy gói | `confirm('Hủy bảo hiểm? Lần sau bé ốm bạn sẽ phải trả đủ viện phí.')` rồi `POST /clinic/insurance {plan: null}` | `clinic.js:134-136` |

Rỗng: "🐾 Chưa có bé nào để khám." + "🏠 Về nhà" (`clinic.js:102-105`). Danh sách bé lấy từ `ctx.me.pets`, chỉ hóa đơn và gói lấy từ `/clinic`.

## Liên quan
- [[Ốm và Phòng khám]], [[Bảo hiểm sức khỏe]], [[Chỉ số của bé]], [[Chăm sóc ở nhà]]
- [[Màn Nhà]] (nút Phòng khám và hộp "đang bị ốm"), [[Màn Trường học]], [[Màn Phố]]
