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

## 6. Bổ sung: gợi ý dòng chỉ số, hộp kín ở Chợ Phiên, bán nhanh và đấu giá

### 6.1 Biết trước loại chỉ số (không lộ cấp và %)

Mỗi món có một nhóm 2–3 loại chỉ số công khai: hai loại theo hành, một loại theo khe (`affixPool` trong `shared/gear.js`).

| Hành | Loại theo hành | | Khe | Loại theo khe |
|---|---|---|---|---|
| Kim | Giao dịch, Thu nhập | | Đầu | Chỉ số |
| Mộc | Chỉ số, May mắn | | Mặt | May mắn |
| Thủy | Giao dịch, May mắn | | Cổ | Thu nhập |
| Hỏa | Thu nhập, Chỉ số | | Lưng | Giao dịch |
| Thổ | Thu nhập, May mắn | | Bùa | May mắn |

Đồ Xanh lam/Xanh lục (mọi hộp ở Siêu thị) chỉ ra dòng trong nhóm, nên gợi ý luôn đúng. Đồ Vàng cần 3 dòng: đủ nhóm, thiếu thì thêm loại ngoài nhóm; đồ Đỏ có cả 4 loại. Đồ đã có giữ nguyên dòng cũ.

Ảnh hưởng cân bằng: người chơi giờ chọn được hướng (ví dụ bộ Thổ thiên về Thu nhập/May mắn), nên tổng một loại dễ cao hơn quay ngẫu nhiên. Phần cộng dồn giảm dần ở mục 3.1 vẫn giữ trần 60 %.

### 6.2 Hộp chưa mở bán được ở Chợ Phiên

Giá tham chiếu tính như Xanh lam (×1), để giá không lộ cấp bên trong. Người mua thấy nhóm chỉ số có thể ra; mua về vẫn là hộp kín.

### 6.3 Bán nhanh cho Siêu thị

Thu `giá shop × hệ số cấp × tỷ lệ`, trong đó tỷ lệ = 10 % + 30 % × q, với q là mức trung bình các dòng nằm ở đâu trong biên độ của cấp (thấp nhất = 0, cao nhất = 1). Hộp chưa mở: 10 % giá shop.

Kiểm tra chống lời vô hạn: mua hộp giá P rồi mở và bán nhanh, kỳ vọng thu về ≈ 0,68 × 0,25P + 0,32 × 0,5P ≈ **0,33P** (≈ 0,375P khi May mắn cao). Luôn lỗ, nên không thành vòng in tiền. Đồ Vàng/Đỏ rớt từ mini-game bán nhanh là nguồn xu mới, nhưng tỷ lệ rớt chỉ 3 % mỗi ván.

### 6.4 Đấu giá

Bảng `auctions`, module `petdex/server/auction.js`, luật `AUCTION` trong `rules/production.js`: khởi điểm 10–300 % tham chiếu, 6/12/24 giờ, bước giá 5 %, trả giá trong 5 phút cuối thì gia hạn 5 phút, tối đa 5 phiên mỗi người. Xu trả giá được giữ (ký quỹ) và hoàn ngay khi bị vượt; xu đang giữ vẫn tính vào tổng tài sản. Phiên đóng trong bộ lập lịch (mỗi 30 giây), không đợi nửa đêm. Phí như Chợ Phiên (1 % mở phiên, 5 % giá chốt, một nửa vào ngân sách thị trấn).

## 7. Bổ sung: độ bền, Lò rèn và Tiệm vật liệu

- **Hỏng sau đấu trường.** Sau mỗi trận đấu trường gia tộc, phần gia tộc gọi `breakWornGear(userIds)` (petdex/server/gear.js): mọi món người tham gia đang đeo chuyển sang `broken = 1`. Món vẫn đeo trên bé nhưng không cộng chỉ số và không tính vào bộ cùng hành. Món hỏng hay đang sửa không bày bán được; bán nhanh thì nhận mức thấp nhất (10%).
- **Sửa** (petdex/server/forge.js): trả xu và vật liệu theo cấp, thành công 70%. Thành công thì món ở lò 24 giờ (`repair_until`) rồi mới cộng chỉ số lại; thất bại thì mất xu và vật liệu, món vẫn hỏng.
- **Nâng cấp**: lên cấp kế tiếp, tỉ lệ không bao giờ quá 30% (mặc định Xanh lam 30%, Xanh lục 18%, Vàng 8%). Thành công thì giữ các dòng cũ (giữ vị trí tương đối trong biên độ cấp mới) và thêm một dòng; thất bại thì mất xu và vật liệu, món giữ nguyên, không bị phá.
- **Vật liệu** là hàng thô bất kỳ trong kho, tính bằng lô (10 phần), lấy hàng rẻ nhất trên Sàn trước. Tiệm vật liệu bán hàng thô gấp 2,5 lần giá Sàn.
- Giá mặc định (xu + lô): sửa Xanh lam 120 + 3, Xanh lục 350 + 5, Vàng 900 + 8, Đỏ 2.200 + 12; nâng Xanh lam 2.500 + 15, Xanh lục 8.000 + 30, Vàng 25.000 + 60. Chỉnh ở tab cấu hình trang phục của trang quản lý. Kỳ vọng chi phí cho một lần lên Đỏ từ Vàng là khoảng 25.000 / 8% ≈ 312.000 xu.
- Sổ cái: `gear_repair`, `gear_upgrade`, `forge_materials`.
