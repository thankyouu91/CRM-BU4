# API giai đoạn 2

Mô tả các endpoint mới của giai đoạn 2 cho phía giao diện. Mọi endpoint nằm dưới `/api`, cần đăng nhập (header `Authorization: Bearer …`, `api()` trong `public/js/api.js` tự gắn).

## Quy ước chung

- **GET** trả về dữ liệu của màn (gọi bằng `api(path)`).
- **POST** trả về toàn bộ trạng thái người chơi kèm `result`, giống mọi hành động khác. Gọi bằng `ctx.act(path, body, { onResult })`. `act` tự cập nhật `ctx.me`, vẽ lại màn hiện tại (màn sẽ tự gọi lại GET) và hiện `result.message` thành thông báo.
- Lỗi luật chơi trả HTTP 400 với `{ error: 'thông báo tiếng Việt' }`; `act` tự hiện thông báo lỗi.
- Tiền là số nguyên xu. Hàng hóa tính bằng **phần**; 1 lô = 10 phần (`ctx.catalog.market.lot`). Dùng `fmtLots(qty)` để hiện số lô.
- Giá trong GET đã nhân chỉ số giá. Giá gốc trong catalog thì nhân `ctx.me.economy.priceIndex` trước khi hiện.
- Cấp mở khóa: `ctx.catalog.unlocks` = `{ school: 2, garden: 2, kitchen: 3, bazaar: 4, factory: 6, contracts: 6, advanced: 8, … }`, so với `ctx.bestLevel()`. Phòng khám không khóa.

## Thú cưng (trong `ctx.me.pets[]`)

Mỗi bé có thêm:

```js
{
  hygiene: 0..100,           // Sạch sẽ: −5/giờ, dưới 20 là bẩn
  health: 0..100,            // Sức khỏe: dưới 40 dễ ốm
  sick: null | { id: 'cold' | 'stomach', name, icon, treat },
  traits: ['glutton', 'bookworm', …],   // mã tính cách, tra tên ở catalog.care.traits
  mood: { key: 'sick' | 'dirty' | 'great' | 'ok' | 'hungry' | 'tired' | 'sad', label },
}
```

Bé ốm không đi làm, không đi học, không chơi mini-game, không vào bếp được.

## Catalog (`ctx.catalog`)

```js
care:   { health, illnesses, clinic: { checkup, checkupHealth, treatHealth }, insurance: { basic, full }, traits: { id: { name, icon, desc } } }
school: { minutes, energy, perSkillPerDay, gain, classes: { strength: { name, icon, cost }, … } }
garden: { startPlots, expandCosts, waterBonus, helpReward, helpXp, helpPerDay, pestChance, pestLoss, crops: { tea: { name, icon, commodity, hours, seed, yield: [lo, hi] }, … } }
kitchen: { energy, shelfDays, npcRate, valueMarkup, quality: [{ name, mult }], dishes: { id: { name, icon, inputs: { commodity: phần }, effect } } }  // không có món ẩn
factory: { landRent, upgradeCosts, perLevel, skillBoost, maxTollFee, kinds: { dryer: { name, icon, input: { commodity: lô }, output: { commodity: lô }, perHour, build }, … } }
contracts: { days: [3, 14], maxLots, band: [0.5, 2], sellerEscrow, shortfallExtra, proposalHours, maxOpen }
bazaar: { listFee, saleFee, band: [0.5, 3], hours, minAccountDays, maxListings }
credit: { start, min, max, onTime, repaid, late, defaulted, contractDay, contractBroken, evicted, tiers: [{ key, name, icon, min, limit, premium }], loans: { terms, originationFee, lateFee, defaultAfter, garnish, banDays, minAccountDays } }
```

## Chăm sóc & Phòng khám

| Lệnh | Body | Ghi chú |
| --- | --- | --- |
| `POST /pets/:id/bath` | – | Tắm miễn phí ở nhà: Sạch sẽ 100, bé bận 15 phút |
| `GET /clinic` | – | Xem dưới |
| `POST /clinic/visit` | `{ petId }` | Bé ốm thì chữa khỏi (+30 Sức khỏe), bé khỏe thì khám tổng quát (+15) |
| `POST /clinic/insurance` | `{ plan: 'basic' \| 'full' \| null }` | `null` là hủy. Phí trừ mỗi đêm |

```js
GET /clinic → {
  plan: null | { id, since, premium, cover },
  plans: { basic: { name, premium, cover }, full: { … } },    // premium đã nhân chỉ số giá
  checkup: { total, paid, cover },                             // paid = phần mình trả sau bảo hiểm
  treatments: { cold: { name, icon, treat, bill: { total, paid, cover } }, stomach: { … } },
}
```

## Trường học

| Lệnh | Body | Ghi chú |
| --- | --- | --- |
| `GET /school?petId=` | – | Bỏ `petId` thì lấy bé chính |
| `POST /school/class` | `{ petId, skill }` | 30 phút, tốn xu và 15 năng lượng, mỗi môn tối đa 3 buổi/ngày. `result.skill = { id, gain }` |

```js
GET /school → {
  classes: { strength: { name, icon, cost, taken, max }, agility: …, intellect: …, charm: …, craft: … },
  rules: { minutes, energy, perSkillPerDay, gain },
}
```

Kỹ năng hiện tại của bé ở `ctx.me.pets[i].skills`. Tính cách `bookworm` học được thêm 25%.

## Vườn

| Lệnh | Body | Ghi chú |
| --- | --- | --- |
| `GET /garden?owner=<userId>` | – | Bỏ `owner` là vườn mình; vườn bạn bè thì truyền id bạn |
| `POST /garden/plant` | `{ plot, crop }` | `plot` là số thứ tự ô (0…), `crop` là mã cây |
| `POST /garden/water` | `{ owner, plot }` | Chỉ tưới vườn bạn bè: vụ đó +20%, người tưới +2 xu, +5 XP |
| `POST /garden/pests` | `{ plot }` | Bắt sâu (khi `pests: true`) |
| `POST /garden/harvest` | `{ plot }` | Hàng vào kho Sàn |
| `POST /garden/expand` | – | Mở thêm ô, giá ở `nextPlotCost` |

```js
GET /garden → {
  owner: 'tên', own: true | false,
  plots: [
    { idx, crop: null },                                       // ô trống
    { idx, crop, plantedAt, readyAt, ready, watered, wateredBy, canWater, pests },
  ],
  nextPlotCost: number | null,          // giá gốc, nhân chỉ số giá khi hiện
  crops: { tea: { name, icon, commodity, hours, seed /* đã nhân chỉ số */, yield }, … },
  helpLeft: number,                     // số lần mình còn tưới giúp hôm nay
}
```

Danh sách bạn bè (để tưới hộ): `GET /friends` → `{ friends: [{ id, username, … }], … }` (đã có từ giai đoạn 1B).

## Bếp

| Lệnh | Body | Ghi chú |
| --- | --- | --- |
| `GET /kitchen` | – | |
| `POST /kitchen/cook` | `{ recipe }` hoặc `{ inputs: { commodity: phần } }` | Ghép đúng công thức ẩn thì khám phá; ghép sai không mất nguyên liệu. Bé chính vào bếp, tốn 5 năng lượng |
| `POST /kitchen/dishes/:id/eat` | `{ petId }` | Hiệu quả nhân theo chất lượng |
| `POST /kitchen/dishes/:id/sell` | – | Bán cho quán ăn đầu phố giá `npcPrice` |

```js
GET /kitchen → {
  recipes: { id: { name, icon, inputs: { commodity: phần }, effect, canMake, value, hidden? } },   // món ẩn chỉ có sau khi khám phá
  hiddenLeft: number,
  dishes: [{ id, recipe, name, icon, effect, quality: 0|1|2, qualityName, expiresAt, value, npcPrice }],
  goods: { commodity: phần },
}
```

Món nấu hư sau 3 ngày. Chất lượng: Thường ×1, Ngon ×1,2, Tuyệt hảo ×1,5 (tay nghề Khéo tay của bé chính càng cao càng dễ ra món ngon).

## Khu công nghiệp (xưởng)

| Lệnh | Body | Ghi chú |
| --- | --- | --- |
| `GET /factory` | – | |
| `POST /factory/build` | `{ kind }` | Tối đa 2 xưởng |
| `POST /factory/:id/upgrade` | – | +3 mẻ/giờ mỗi cấp |
| `POST /factory/:id/toll` | `{ fee, open }` | Nhận gia công thuê, phí 0–100 xu/mẻ |
| `POST /factory/:id/jobs` | `{ wage, slots, open }` | Tuyển công nhân (lương 8–80 xu/giờ, 1–3 người) |
| `POST /factory/:id/close` | – | |
| `POST /factory/:id/order` | `{ batches }` | Gửi nguyên liệu nhờ xưởng người khác chế biến (1–100 mẻ). Nguyên liệu rời kho ngay, phí giữ trước |
| `POST /factory/orders/:id/cancel` | – | Hủy đơn gia công của mình, nhận lại nguyên liệu và phí của phần chưa làm |
| `POST /jobs/start` | `{ petId, hours, factoryId }` | Cho bé đứng máy (xưởng mình: không lương; xưởng người khác: theo tin tuyển). Màn Việc làm lo phần này |

```js
GET /factory → {
  factories: [{
    id, kind, level, nextUpgrade /* null nếu tối đa */, tollFee, tollOpen, unpaidDays, rent, canRun /* số mẻ đủ nguyên liệu */,
    duty: [{ petName, owner, own, startsAt, endsAt }],      // bé đang/sắp đứng máy
    queue: [{ id, batches, done, fee, user }],             // đơn gia công đang chờ
    jobPost: null | { factory_id, wage, slots, open },
    days: [{ day, batches, toll_batches, toll_income, rent, wages }],   // 7 ngày gần nhất
  }],
  tollOffers: [{ id, kind, name, owner, fee, level }],     // xưởng người khác đang nhận gia công
  myTolls: [{ id, kind, name, owner, batches, done, fee }],
  kinds: { dryer: { name, icon, input, output, perHour, build /* đã nhân chỉ số */ }, … },
  goods: { commodity: phần },
  max: 2,
}
```

Xưởng chỉ chạy khi có bé đứng máy. Mỗi giờ làm `(perHour + level × 3) × (1 + tới 30% theo Sức mạnh + Khéo tay)` mẻ; đơn gia công làm trước, sau đó tới nguyên liệu trong kho chủ. Tiền thuê đất trừ mỗi đêm; nợ 3 đêm thì đóng cửa.

## Hợp đồng cung ứng

| Lệnh | Body | Ghi chú |
| --- | --- | --- |
| `GET /contracts` | – | |
| `POST /contracts` | `{ counterpart: 'tên người chơi', role: 'sell' \| 'buy', commodity, lots, price, days }` | `lots` lô mỗi ngày, `price` xu mỗi lô (số nguyên, 50–200% giá Sàn), `days` 3–14. Ký quỹ phần mình ngay |
| `POST /contracts/:id/accept` | – | Bên được mời nhận, ký quỹ phần mình |
| `POST /contracts/:id/decline` | – | Bên được mời từ chối, hoặc bên đề xuất rút lại |
| `POST /contracts/:id/break` | – | Tự hủy hợp đồng đang chạy: bồi thường cho đối tác 10% giá trị phần còn lại (lấy từ ký quỹ của mình, tối đa bằng ký quỹ), phần dư về ví, −30 điểm tín dụng |

```js
GET /contracts → {
  contracts: [{
    id, role: 'sell'|'buy', partner, proposedByMe, commodity, lots, price, market /* giá Sàn hiện tại mỗi lô */,
    days, daysLeft, delivered /* số lô đã giao */, myEscrow, theirEscrow,
    status: 'proposed'|'active'|'done'|'broken'|'cancelled'|'rejected'|'expired', brokenByMe, createdAt, expiresAt,
  }],
  prices: { commodity: giá mỗi lô },
  goods: { commodity: phần },
  rules: { days, maxLots, band, sellerEscrow, shortfallExtra, breakShare, proposalHours, maxOpen },
}
```

Ký quỹ: bên mua giữ tiền hàng 1 ngày (`lots × price`), bên bán giữ 20% tổng giá trị. Mỗi nửa đêm hàng đi từ kho bên bán sang kho bên mua, tiền đi ngược lại. Giao thiếu thì bên bán bồi thường `số lô thiếu × (max(0, giá Sàn − giá hợp đồng) + 10% giá hợp đồng)`. Ngày nào giao đủ thì cả hai được +3 điểm tín dụng.

## Chợ Phiên

| Lệnh | Body | Ghi chú |
| --- | --- | --- |
| `GET /bazaar` | – | |
| `POST /bazaar/list` | `{ kind: 'item', ref: mãMón, price }` hoặc `{ kind: 'dish', ref: idMónĐãNấu, price }` | Giá 50–300% giá tham chiếu, phí đăng 1%, tin còn 48 giờ, tối đa 10 tin |
| `POST /bazaar/:id/buy` | – | Người bán nhận giá trừ 5% phí. Đồ dùng mãi mãi (đồ chơi, phụ kiện) chỉ mua được nếu chưa có |
| `POST /bazaar/:id/cancel` | – | Gỡ tin, món về lại túi (phí đăng không hoàn) |

```js
GET /bazaar → {
  listings: [{ id, kind, ref, name, icon, type /* food|care|toy|accessory|dish */, quality? /* tên chất lượng món */, spoilsAt?,
               price, refPrice, seller, mine, createdAt, expiresAt }],
  sold: [{ …listing, status: 'sold'|'expired'|'cancelled', buyer, soldAt }],   // tin của mình đã đóng
  bought: [{ …listing, soldAt }],
  sellable: {
    items: [{ ref, name, icon, qty, refPrice }],
    dishes: [{ ref /* id món */, recipe, name, icon, quality /* tên */, expiresAt, refPrice }],
  },
  canSell: boolean, sellFrom: timestamp,      // tài khoản cần đủ 3 ngày tuổi
  open: number,                               // số tin mình đang bày
  rules: { listFee, saleFee, band, hours, minAccountDays, maxListings },
}
```

## Tín dụng & vay (chế độ Tài chính nâng cao)

| Lệnh | Body | Ghi chú |
| --- | --- | --- |
| `GET /credit` | – | Ai cũng xem được điểm tín dụng |
| `POST /credit/borrow` | `{ amount, term }` | `term` ∈ `loans.terms` (3, 7, 14 ngày). Phí giải ngân 2% |
| `POST /credit/loans/:id/repay` | `{ amount }` | Trả trước một phần hoặc toàn bộ (`payoff`) |

```js
GET /credit → {
  score, tier: { key, name, icon, min, limit, premium }, nextTier: null | { … }, tiers: [ … ],
  events: [{ delta, reason, at }],            // 12 thay đổi điểm gần nhất
  limit,                                      // hạn mức còn vay được (0 nếu đang bị chặn)
  rate,                                       // lãi mỗi ngày nếu vay bây giờ
  terms: [3, 7, 14], originationFee, minLoan,
  blocked: null | 'lý do chưa vay được',      // ví dụ chưa bật chế độ nâng cao
  banUntil: null | timestamp,
  loans: [{ id, principal, remaining, fees, rate, termDays, openedAt, dueAt, lateDays,
            status: 'active'|'late'|'defaulted', today: null | { arrears, interest, principal, total }, payoff }],
  history: [{ id, principal, termDays, openedAt }],
}
```

Mỗi tối ngân hàng tự trừ kỳ trả góp (`today.total`) từ ví, thiếu thì lấy sang tiết kiệm. Trả đủ +5 điểm, tất toán +30. Thiếu thì phần thiếu cộng 1% phí trễ và −20 điểm; trễ 7 kỳ là vỡ nợ: −100 điểm, cấm vay 14 ngày, từ đó mỗi tối giữ 30% thu nhập trong ngày để thu nợ. Bật chế độ nâng cao: `POST /settings { advancedFinance: true }` (cần bé cấp 8).

## Việc làm (đã có, thêm phần xưởng)

`GET /jobs` có thêm:

```js
factoryJobs: [{ factoryId, kind, name, owner, wage, free }],   // xưởng người khác đang tuyển
myFactories: [{ id, kind, name }],                              // xưởng của mình (bé mình đứng máy không lương)
```

Ca đứng máy: `POST /jobs/start { petId, hours, factoryId }`, xong ca nhận lương và lên Sức mạnh.
