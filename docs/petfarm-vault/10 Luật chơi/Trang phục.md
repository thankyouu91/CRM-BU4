---
tags: [petfarm, luat-choi, trang-phuc]
aliases: [Đồ đeo, Phụ kiện, Gear, Khe đồ, Giới hạn đeo]
loai: luat
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/pets.js, public/ta-tua/game/js/shared/gear.js, petdex/server/gear.js, petdex/server/game.js, petdex/server/routes.js, petdex/server/elements.js, public/ta-tua/game/js/app.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Trang phục

> [!summary]
> Trang phục (phụ kiện) là đồ đeo vào 5 khe trên người bé: Đầu, Mặt, Cổ, Lưng, Bùa. Có **55 món**, mỗi món có một hành và một cấp yêu cầu để mua. Mỗi món người chơi sở hữu là một **bản** riêng có [[Cấp trang phục|cấp]] (Xanh lam → Đỏ) và 1–4 [[Dòng chỉ số trang phục|dòng chỉ số]]. Trang phục tác động tới: tốc độ lên kỹ năng ([[Hợp mệnh và kỵ mệnh]]), thưởng lương khi gom [[Bộ đồ ngũ hành]], và các dòng % (thu nhập, chỉ số, giao dịch, may mắn).

## Con số
| Khe | Mã | Biểu tượng | Nguồn |
|---|---|---|---|
| Đầu | `head` | 🎩 | `public/ta-tua/game/js/shared/pets.js:360` |
| Mặt | `face` | 👓 | `public/ta-tua/game/js/shared/pets.js:361` |
| Cổ | `neck` | 🧣 | `public/ta-tua/game/js/shared/pets.js:362` |
| Lưng | `back` | 🦋 | `public/ta-tua/game/js/shared/pets.js:363` |
| Bùa | `charm` | 🏮 (lơ lửng bên hông) | `public/ta-tua/game/js/shared/pets.js:364` |

### Giới hạn số món đeo cùng lúc
| Bé | Số món | Nguồn |
|---|---|---|
| Dưới cấp 30 | 3 | `public/ta-tua/game/js/shared/pets.js:372` |
| Từ cấp 30 | 4 | như trên |
| Bé Huyền thoại | +1 (tức 4 dưới cấp 30, 5 từ cấp 30) | `public/ta-tua/game/js/shared/pets.js:372-376` |

`wearLimit(level, rarity) = (level ≥ 30 ? 4 : 3) + (huyenthoai ? 1 : 0)`. Mỗi khe vẫn chỉ một món.

## Cách hoạt động
- **Có đồ bằng cách nào**: mua [[Hộp kín Siêu thị]] (chỉ ra Xanh lam/Xanh lục), rớt từ [[Mini-game]] (3% mỗi ván, mọi cấp), [[Mã quà]], mua lại ở [[Chợ Phiên]]. Không có chế tạo hay nâng cấp đồ cho người chơi; chỉ quản trị viên sửa được cấp và dòng (`updateGear`, `petdex/server/gear.js:175-187`).
- **Đeo**: `POST /pets/:id/equip {gearId}` (`petdex/server/routes.js:254-260`, `equipGear` ở `petdex/server/gear.js:157-172`):
  - phải là chủ món, món không đang bày ở Chợ Phiên ("Món này đang bày bán ở Chợ Phiên."), hộp đã mở ("Mở hộp trước rồi hẵng đeo nhé.");
  - đổi món trong cùng khe không tính thêm; đeo vào khe trống thì số khe khác đang dùng phải < giới hạn, nếu không: "<tên> (cấp L) chỉ đeo được N món cùng lúc. Tháo bớt một món, hoặc lên cấp 30 để đeo thêm." (167);
  - món đang đeo trên bé khác tự gỡ khỏi bé đó (169).
- **Tháo**: `{slot}` tháo một khe, không gửi gì thì tháo hết (`petdex/server/routes.js:261-265`).
- **Chỉ số % của bé** = `sumBonus` các dòng của đồ đang đeo, có giảm dần ([[Dòng chỉ số trang phục]]); máy chủ gắn vào `pet.bonus` mỗi lần đọc bé (`petdex/server/db.js:728-729`).
- Việc chung của cả nhà (mua hộp, giao dịch, nấu bằng bé chính, quà hợp mệnh) dùng chỉ số của [[Thú chính]] (`userBonus`, `petdex/server/gear.js:209-212`).
- Giao diện: nút "🎀 Trang phục" ở màn Nhà; tủ đồ ở Túi đồ; dòng "Đang đeo X/N món, mỗi khe một món. Lên Lv 30 đeo thêm 1 món." (`public/ta-tua/game/js/app.js:108-113`) và tóm tắt hợp mệnh, bộ đồ (`public/ta-tua/game/js/app.js:448-462`).

## Trường hợp đặc biệt
- **Cấp yêu cầu chỉ chặn việc mua ở Siêu thị**, không chặn việc đeo: món cấp 40 rớt từ mini-game hay mã quà vẫn đeo được cho bé cấp 1 (`equipGear` không kiểm tra `minLevel`).
- Đồ đang bày bán ở Chợ Phiên bị tháo và ẩn khỏi tủ đồ (`setGearListed`, `listGear`, `petdex/server/gear.js:90-92,201-204`).
- Bé mất thì đồ trở về tủ (bản trang phục thuộc người chơi).
- Hình vẽ từng món ở `public/ta-tua/game/js/rig.js`; bộ 3 món cùng hành có hiệu ứng sao lấp lánh (`fullSetOf`, `public/ta-tua/game/js/rig.js:1021`).

> [!warning] Lệch tài liệu
> - Nút "🎀 Trang phục" ở màn Nhà vẫn ghi cứng "Đang đeo X/4 món" (`public/ta-tua/game/js/app.js:539`), trong khi giới hạn thật là 3/4/5.
> - `README.md:174` (README gốc) ghi "46 món" và "mỗi loại tối đa 100%"; code hiện có 55 món và cộng dồn có giảm dần, trần 60% (`public/ta-tua/game/js/shared/gear.js:34`). Chú thích hàm `gearBonusLine` (`public/ta-tua/game/js/app.js:440`) cũng còn ghi "tối đa 100%".
> - `petdex/README.md:49` còn ghi "đủ bộ 4 khe cùng hành +5% lương", luật cũ trước commit `152cd2e`.

## Mã nguồn
- `public/ta-tua/game/js/shared/pets.js`: `SLOTS` (359-365), `WEAR_RULES`/`wearLimit` (372-376), `WEARABLES` (394-452), `wearBonus` (310-315), `setOf` (318-326).
- `petdex/server/game.js`: giá, cấp, mô tả từng món trong `CATALOG` (55-112), hàm `wearables` (125-130).
- `petdex/server/gear.js`: tạo, mở, đeo, chuyển chủ.

## Liên quan
- [[Danh mục trang phục]] · [[Cấp trang phục]] · [[Dòng chỉ số trang phục]] · [[Hộp kín Siêu thị]] · [[Bộ đồ ngũ hành]] · [[Hợp mệnh và kỵ mệnh]]
- [[Quản trị trang phục và mã quà]] · [[Module gear]] · [[Hình vật phẩm]]
