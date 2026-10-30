---
tags: [petfarm, van-hanh, quan-tri, trang-phuc, ma-qua]
loai: van-hanh
trang-thai: dang-chay
nguon: [app/(app)/ta-tua/quan-ly/gear.tsx, petdex/server/internal.js, petdex/server/gear.js, petdex/server/gifts.js, public/ta-tua/game/js/shared/gear.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Quản trị trang phục và mã quà

> [!summary]
> Hai tab của [[Bảng quản lý Pet Town]] và một thẻ trong ngăn người chơi điều khiển hệ thống [[Cấp trang phục]] và [[Mã quà]]: tab **Trang phục & rớt đồ** chỉnh tỷ lệ ra cấp, biên độ từng dòng chỉ số và tỷ lệ rớt của mini-game; thẻ **Trang phục** của người chơi cho tặng, sửa, xóa từng món; tab **Mã quà** tạo một mã hoặc cả loạt mã với phần quà cố định, ngẫu nhiên, hợp mệnh hoặc cho chọn. Cấu hình chỉ áp cho đồ quay **mới**, đồ đã có giữ nguyên.

## Tab Trang phục & rớt đồ (`GearConfigTab`)
Đọc `GET gear-config` trả `{config, defaults, tiers, affixes}`; lưu bằng `POST gear-config {config}` (`petdex/server/internal.js:261-272`, `app/(app)/ta-tua/quan-ly/gear.tsx:85-248`).

### Thẻ 1: Tỷ lệ ra cấp khi quay đồ
- Một ô trọng số cho mỗi cấp (0–100, bước 0,1). "Đây là trọng số: tổng không bắt buộc bằng 100, hệ thống tự quy ra phần trăm." (`app/(app)/ta-tua/quan-ly/gear.tsx:133-139`).
- Áp cho đồ mua ở cửa hàng, rớt từ mini-game và mã quà để cấp ngẫu nhiên.
- Bảng **Tỷ lệ thực tế** cho May mắn 0, 20, 50, 100%, tính bằng đúng công thức `rollTier`: trọng số cấp thứ i nhân `(1 + May mắn/100)^i` (`app/(app)/ta-tua/quan-ly/gear.tsx:76-82`, `public/ta-tua/game/js/shared/gear.js:106-116`).
- Phải có ít nhất một cấp lớn hơn 0 (`public/ta-tua/game/js/shared/gear.js:80`).

Với cấu hình mặc định (`odds` 60 : 28 : 10 : 2, `public/ta-tua/game/js/shared/gear.js:53`):

| May mắn | Xanh lam | Xanh lục | Vàng | Đỏ |
|---|---|---|---|---|
| 0% | 60,0% | 28,0% | 10,0% | 2,0% |
| 20% | 53,8% | 30,1% | 12,9% | 3,1% |
| 50% | 45,7% | 32,0% | 17,1% | 5,1% |
| 100% | 34,9% | 32,6% | 23,3% | 9,3% |

(Tính từ công thức trên; đồ mua ở Siêu thị chỉ quay giữa Xanh lam và Xanh lục, xem [[Cấp trang phục]].)

### Thẻ 2: Biên độ mỗi dòng chỉ số (%)
Bảng cấp × loại dòng (Thu nhập ca làm, Chỉ số, Thu nhập giao dịch, May mắn), mỗi ô một cặp [thấp nhất, cao nhất]. Ràng buộc 0–`BONUS_CAP` (100) và thấp ≤ cao, sai thì lỗi "Biên độ … phải trong 0–100% và thấp nhất ≤ cao nhất." (`public/ta-tua/game/js/shared/gear.js:81-92`). Mô tả trên thẻ nhắc luật cộng dồn trên một bé: đủ 25%, phần vượt tính 50%, tổng tối đa 60% (`STACKING`, `public/ta-tua/game/js/shared/gear.js:34`).

| Cấp | Mặc định mỗi dòng | Nguồn |
|---|---|---|
| Xanh lam | 2–5% | `public/ta-tua/game/js/shared/gear.js:56` |
| Xanh lục | 4–8% | `public/ta-tua/game/js/shared/gear.js:57` |
| Vàng | 7–12% | `public/ta-tua/game/js/shared/gear.js:58` |
| Đỏ | 10–20% | `public/ta-tua/game/js/shared/gear.js:59` |

### Thẻ 3: Phần thưởng thêm của mini-game
| Ô | Mặc định | Giới hạn | Nguồn |
|---|---|---|---|
| Tỷ lệ rớt vật liệu (% mỗi ván) | 50 | 0–100 | `public/ta-tua/game/js/shared/gear.js:62` |
| Số lô ít nhất / nhiều nhất | 1 / 3 | 1–20, ít ≤ nhiều | `public/ta-tua/game/js/shared/gear.js:64`, `public/ta-tua/game/js/shared/gear.js:99-101` |
| Tỷ lệ rớt trang phục (% mỗi ván) | 3 | 0–100 | `public/ta-tua/game/js/shared/gear.js:66` |

Hai tỷ lệ nhân thêm (1 + May mắn %) của bé đang chơi (`app/(app)/ta-tua/quan-ly/gear.tsx:201`). Xem [[Mini-game]].

Thanh dưới cùng: "Có thay đổi chưa lưu", *Về mặc định* (nạp `defaults` vào form, chưa lưu), *Hoàn tác*, *Lưu cấu hình* (`app/(app)/ta-tua/quan-ly/gear.tsx:211-217`). Lưu ghi `gear_config` vào nhật ký game và `tatua.gear_config` vào WorkHub.

## Thẻ Trang phục của một người chơi (`PlayerGear`)
| Thao tác | API | Luật | Nguồn |
|---|---|---|---|
| Tặng | `POST players/<id>/gear {itemId, tier, affixes?}` | món chọn sẵn hoặc "Ngẫu nhiên"; cấp chọn sẵn hoặc "Quay theo tỷ lệ"; tự nhập dòng chỉ số thì **bắt buộc** chọn cấp ("Tự nhập dòng chỉ số thì chọn luôn cấp.") | `petdex/server/internal.js:275-290`, `app/(app)/ta-tua/quan-ly/gear.tsx:285-312` |
| Sửa | `POST gear/<id> {tier, affixes}` | cần ít nhất một dòng; nhật ký lưu cả trước và sau | `petdex/server/internal.js:293-304`, `app/(app)/ta-tua/quan-ly/gear.tsx:373-392` |
| Xóa | `POST gear/<id>/delete` | không xóa được món đang bày ở Chợ Phiên ("Món này đang bày bán ở Chợ Phiên, chờ tin hết hạn hoặc người chơi gỡ tin.") | `petdex/server/internal.js:306-317` |

- Danh sách hiện cả hộp kín chưa mở (admin thấy cấp và dòng bên trong) và nguồn: "Mua ở cửa hàng", "Rớt từ mini-game", "Mã quà", "Quản trị tặng", "Đồ cũ chuyển sang" (`app/(app)/ta-tua/quan-ly/gear.tsx:29`, `petdex/server/internal.js:400`).
- Khe: Đầu, Mặt, Cổ, Lưng, Bùa (`app/(app)/ta-tua/quan-ly/gear.tsx:28`). Xem [[Trang phục]].

## Tab Mã quà (`GiftCodesTab`)

### Form tạo
| Ô | Luật | Nguồn |
|---|---|---|
| Nhãn | người chơi thấy khi nhận; ≤ 60 ký tự, trống là "Mã quà" | `petdex/server/gifts.js:186` |
| Mã | trống = tự sinh dạng `XXXX-XXXX` từ bảng chữ bỏ I, O, 0, 1; tự đặt thì 4–32 ký tự `A-Z 0-9 - _`, tự viết hoa | `petdex/server/gifts.js:28-29`, `petdex/server/gifts.js:45-48`, `petdex/server/gifts.js:178-182` |
| Số mã | 1–200 mỗi lần; tạo nhiều thì phải để trống ô mã | `petdex/server/internal.js:334-335` |
| Lượt mỗi mã | 1–100.000, trống = không giới hạn; là **tổng số người** được nhận mỗi mã | `petdex/server/gifts.js:183`, `app/(app)/ta-tua/quan-ly/gear.tsx:581` |
| Hạn dùng | phải ở tương lai | `petdex/server/gifts.js:184` |
| Luôn nhận: Xu | 0–1.000.000 | `petdex/server/gifts.js:30` |
| Luôn nhận: các món | tối đa 12 món | `petdex/server/gifts.js:31`, `petdex/server/gifts.js:108` |
| Cho chọn 1 trong | 0 hoặc 2–6 món (xu, vật phẩm, trang phục) | `petdex/server/gifts.js:109` |
| Trang phục mỗi mã | tối đa 10 món | `petdex/server/gifts.js:32`, `petdex/server/gifts.js:110` |

Mỗi món vật phẩm hoặc trang phục chọn theo ba cách (`PICKS`, `petdex/server/gifts.js:42`): cố định một món, ngẫu nhiên trong một nhóm (Đồ ăn, Đồ chăm sóc, Đồ chơi, Trứng ngũ hành, Vật phẩm; trang phục), hoặc **hợp mệnh bé chính** của người nhận (cùng hành hoặc hành sinh ra hành của bé; chưa có bé hay nhóm không có món hợp thì quay ngẫu nhiên). Đồ chơi không có hành nên không chọn hợp mệnh được (`petdex/server/gifts.js:35-41`, `petdex/server/gifts.js:78`). Xem [[Hợp mệnh và kỵ mệnh]].

### Danh sách và thao tác
- Bảng: Mã (nút chép), Nhãn · phần quà, Đã nhận, Hạn, Tạo bởi, Trạng thái ("Đã thu hồi", "Hết lượt hoặc hết hạn"); tối đa 200 mã mới nhất (`petdex/server/gifts.js:18`).
- Tạo xong hiện khung "N mã vừa tạo" với nút chép tất cả (mỗi mã một dòng).
- *Người đã nhận*: `GET gift-codes/<id>`, tối đa 200 lượt nhận mới nhất (`petdex/server/internal.js:346-350`, `petdex/server/gifts.js:23-25`).
- *Thu hồi*: "Mã … sẽ không nhận thêm được nữa. Quà đã trao vẫn giữ nguyên." (`app/(app)/ta-tua/quan-ly/gear.tsx:689`).

### Người chơi nhập mã gặp gì
| Thông báo | Nguồn |
|---|---|
| "Mã quà không đúng." | `petdex/server/gifts.js:232-235` |
| "Mã quà này đã bị thu hồi." / "…đã hết hạn." / "…đã hết lượt." | `petdex/server/gifts.js:236-239` |
| "Bạn đã nhận quà của mã này rồi." | `petdex/server/gifts.js:238` |
| "Bạn nhập mã nhiều quá, thử lại sau một phút nhé." (10 lần/phút) | `petdex/server/gifts.js:220` |

Mã có lượt chọn: lần nhập đầu chỉ trả danh sách để chọn, **chưa tính lượt**; chọn xong mới trao và trừ lượt (`petdex/server/gifts.js:225-258`).

## Liên quan
- [[Cấp trang phục]]
- [[Trang phục]]
- [[Mã quà]]
- [[Bảng quản lý Pet Town]]
- [[Nhật ký quản trị]]
- [[Module gear]]
- [[Module gifts]]
- [[MOC Vận hành]]
