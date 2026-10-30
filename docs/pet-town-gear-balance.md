# Pet Town: cân bằng trang phục khi đeo 3–5 món

Ngày 30/10/2026. Áp dụng trên nền commit 5cfbd34 (khe Bùa, giới hạn đeo 3/4/5 món, hộp kín ở Siêu thị).

## 1. Luật trước khi chỉnh

- Bé dưới cấp 30 đeo 3 món, từ cấp 30 đeo 4 món, bé Huyền thoại thêm 1 món (tối đa 5).
- Mỗi món có cấp Xanh lam / Xanh lục / Vàng / Đỏ với 1 / 2 / 3 / 4 dòng chỉ số; biên độ một dòng 2–5 / 4–8 / 7–12 / 10–20 %.
- Các dòng **cộng thẳng**, trần 100 % mỗi loại.
- Hợp mệnh: mỗi món tương sinh +10 % tốc độ lên kỹ năng, cùng hành +5 %, kỵ mệnh −5 %, **không có trần**.
- Bộ đồ: chỉ khi **đủ 4 khe Đầu/Mặt/Cổ/Lưng cùng hành** thì +5 % lương.
- Món nào cũng quay chỉ số như nhau; cấp yêu cầu cao nhất là 15 (Cánh phượng hoàng) dù bé lên tới cấp 50.

## 2. Mô phỏng (20.000 lần mỗi kịch bản, chỉ số "Thu nhập ca làm")

Script `petdex/scripts/gear-balance-sim.mjs` quay đúng hàm `rollShopGear` / `rollGear` / `sumBonus` của game. "Đỏ chọn lọc" = người chơi giữ món có dòng thu nhập cao nhất trong 5 món Đỏ (mô phỏng người chơi cày Chợ Phiên).

| Kịch bản | 3 món: trước → sau | 4 món: trước → sau | 5 món: trước → sau |
|---|---|---|---|
| Siêu thị (lam/lục) | 4,7 → 4,7 | 6,2 → 6,2 | 7,8 → 7,8 |
| Rớt mini-game | 7,1 → 7,1 | 9,5 → 9,4 | 11,9 → 11,7 |
| Toàn Vàng | 21,4 → 20,6 | 28,4 → 25,6 | 35,6 → 29,9 |
| Toàn Đỏ | 45,0 → 35,0 | 60,0 → 42,5 | 74,9 → 50,0 |
| Đỏ chọn lọc | 55,9 → 40,4 | 74,5 → 49,8 | **93,1 → 58,8** |

(Giá trị trung bình, %.) Ba loại còn lại (Chỉ số, Giao dịch, May mắn) cho số gần như y hệt vì luật quay đối xứng.

### Vấn đề phát hiện

1. **Bé 5 món Đỏ gần như gấp đôi lương.** Hệ số lương trần cũ: 1 + 0,93 (đồ) + 0,10 (vận khí) + 0,05 (bộ) ≈ **2,08×**, trong khi người chơi đồ Siêu thị chỉ ≈ 1,08×. Khoảng cách 10 lần giữa người mới và người cày lâu.
2. **Cộng thẳng làm món thứ 5 mạnh nhất:** thêm một món Đỏ cho +15 %, lớn hơn cả bộ 3 món Siêu thị. Bé Huyền thoại (vốn hiếm, đã có khe thêm) bị cộng dồn lợi thế.
3. **Vòng lặp May mắn:** May mắn vừa tăng tỷ lệ ra Đỏ (100 % May mắn: Đỏ 2 % → 9,1 %), vừa là một dòng trên chính món Đỏ, nên càng giàu đồ càng dễ ra đồ.
4. **Hợp mệnh không trần:** 5 món tương sinh = +50 % tốc độ kỹ năng, nhân thêm dòng "Chỉ số" (tới 75 % với 5 món Đỏ) = **2,63×** tốc độ lên kỹ năng.
5. **Lỗi thiết kế do giới hạn đeo mới:** bé dưới cấp 30 chỉ đeo 3 món nên **không bao giờ đạt được thưởng "đủ 4 khe cùng hành"**, và khe Bùa không được tính vào bộ.
6. Món đắt (Vương miện 500 xu) và món rẻ (Nơ cổ 60 xu) quay chỉ số **giống hệt nhau**; cấp yêu cầu dồn hết ở cấp 1–8, cấp 15–50 không còn gì để mở khóa.

## 3. Thay đổi

### 3.1 Cộng dồn có giảm dần (`STACKING` trong `shared/gear.js`)

Mỗi loại chỉ số: tính đủ tới **25 %**, phần vượt tính **một nửa**, tổng tối đa **60 %**.

```
thực nhận = min(60, thô ≤ 25 ? thô : 25 + (thô − 25) × 0,5)
```

- Người chơi đồ Siêu thị và mini-game (thô dưới 25 %) **không bị ảnh hưởng**.
- Món thứ 5 vẫn có giá trị (+7,5 % với Đỏ) nhưng không còn lấn át.
- Trần May mắn hiệu dụng 60 % → tỷ lệ ra Đỏ tối đa ≈ 5,9 % thay vì 9,1 %, cắt bớt vòng lặp.
- Một dòng đơn lẻ vẫn được tới 100 % (giữ nguyên kiểm tra nhập liệu của trang quản trị, để cấu hình cũ không bị đặt lại).

### 3.2 Bộ đồ tính theo số món cùng hành (`setOf` trong `shared/pets.js`)

| Số món cùng hành | Thưởng lương |
|---|---|
| 3 món | +3 % |
| 4 món | +5 % (như cũ) |
| 5 món | +8 % |

Tính trên cả 5 khe, kể cả Bùa. Bé dưới cấp 30 nay có mục tiêu bộ 3 món. Hiệu ứng sao lấp lánh hiện từ bộ 3 món.

### 3.3 Trần hợp mệnh

Cả bộ đồ cộng tối đa **+30 %** tốc độ lên kỹ năng (phần trừ do kỵ mệnh giữ nguyên, sàn 50 % như cũ).

Hệ số tối đa sau chỉnh: lương ≈ 1 + 0,59 + 0,10 + 0,08 = **1,77×** (trước 2,08×); kỹ năng ≈ 1,3 × 1,5 = **1,95×** (trước 2,63×).

### 3.4 Cấp độ yêu cầu (điều chỉnh)

Giãn các món cao cấp theo mốc dáng trưởng thành (cứ 10 cấp đổi dáng), để cấp 10–40 có thứ mở khóa:

| Món | Cấp cũ → mới |
|---|---|
| Cánh thiên thần, Cánh dơi | 6 / 7 → 10 |
| Huy chương vàng | 8 → 12 |
| Cánh tiên | 8 → 15 |
| Vương miện, Cánh rồng | 8 → 20 |
| Vầng hào quang | 10 → 30 |
| Cánh phượng hoàng | 15 → 40 |

Giá giữ nguyên. Người đã sở hữu không mất gì; cấp yêu cầu chỉ chặn việc mua mới.

**Bậc món:** món yêu cầu cấp cao mở hộp Siêu thị dễ ra Xanh lục hơn: cứ 10 cấp yêu cầu được +10 May mắn khi quay hộp (`gradeLuck`). Siêu thị vẫn chỉ ra Xanh lam/Xanh lục; Vàng và Đỏ vẫn chỉ từ mini-game, mã quà, Chợ Phiên.

### 3.5 Món mới (9 món, có hình pixel)

| Món | Khe | Hành | Cấp | Giá |
|---|---|---|---|---|
| Kính thợ mỏ | Mặt | Thổ | 10 | 180 |
| Khăn đóng | Đầu | Thủy | 20 | 300 |
| Áo tơi lá | Lưng | Mộc | 20 | 520 |
| Sáo trúc | Bùa | Mộc | 20 | 260 |
| Hoa sen cài | Đầu | Mộc | 30 | 340 |
| Mặt nạ vàng | Mặt | Kim | 30 | 380 |
| Quạt lông phượng | Bùa | Hỏa | 30 | 360 |
| Trống đồng | Bùa | Thổ | 40 | 480 |
| Áo choàng tinh tú | Lưng | Thủy | 40 | 900 |

Chọn để lấp chỗ thưa (Mặt hành Thổ, Lưng hành Mộc, Bùa mỗi hành chỉ 1–2 món) và tạo mốc cấp 10–40. Tổng cộng 55 món.

## 4. Ảnh hưởng tới người chơi hiện có

- Ai đang đeo nhiều món Vàng/Đỏ sẽ thấy % trên thẻ bé **giảm** (ví dụ 4 món Đỏ: trung bình 60 % → 42,5 %). Nên báo trước trong bản tin cập nhật.
- Đồ đã có giữ nguyên cấp và dòng chỉ số; chỉ cách cộng dồn thay đổi.
- Thưởng giao dịch có thể ra số lẻ (ví dụ "+32.5% trang phục"); số xu vẫn làm tròn xuống.

## 5. Theo dõi sau khi phát hành

- Tỷ lệ bé đạt bộ 3/4/5 món theo hành.
- Phân bố tổng % thực nhận theo nhóm cấp (dưới 30, 30+, Huyền thoại).
- Tỷ lệ món Đỏ rớt từ mini-game theo tuần, để xác nhận vòng lặp May mắn đã hãm.
- Nếu 25/0,5/60 vẫn quá mạnh, chỉnh `STACKING` (một chỗ, dùng chung máy chủ và trình duyệt).
