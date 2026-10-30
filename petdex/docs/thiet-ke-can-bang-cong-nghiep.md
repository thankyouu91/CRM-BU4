# Kế hoạch thiết kế: ngành hạ tầng tăng trưởng, chống thao túng thị trường và vòng đời vật phẩm thiết yếu

Tài liệu này mở rộng hệ thống Gia tộc & chuỗi sản xuất (`server/clans.js`, `server/industry.js`, `public/ta-tua/game/js/shared/industry.js`). Nó có ba phần:

1. Ngành hạ tầng tăng trưởng: Trị thủy, Năng lượng gió.
2. Cơ chế giữ thị trường cân bằng khi các ngành này bị thao túng.
3. Vòng đời vật phẩm thiết yếu: giai đoạn đầu NPC cung cấp, giai đoạn sau người chơi tự chế biến và bán lại cho chợ.

Mọi con số dưới đây là **mặc định đề xuất**. Quản trị viên chỉnh được trên bảng "Gia tộc & Đất". Trước khi bật, phải chạy kiểm chứng bằng mô phỏng (mục 8).

---

## 1. Nguyên tắc cân bằng

| # | Nguyên tắc | Lý do |
|---|---|---|
| N1 | Buff hạ tầng là **hàng công cộng theo vùng**: mọi lô trong vùng phủ đều được hưởng, kể cả lô của gia tộc đối thủ. Chủ hạ tầng không bật/tắt riêng cho ai. | Chặn việc dùng buff làm vũ khí: không thể chỉ cho mình hưởng và bỏ đói đối thủ. |
| N2 | Chủ hạ tầng kiếm tiền bằng **phí hạ tầng có trần**, không bằng độc quyền buff. | Lợi nhuận ổn định nhưng có giới hạn, không thành máy in tiền. |
| N3 | **Một gia tộc không được nắm cùng lúc 2 ngành hạ tầng chiến lược.** Mỗi ngành chiến lược có tối đa 3 gia tộc. | Đúng yêu cầu: không ai thao túng đồng thời cả nước lẫn năng lượng. |
| N4 | Tổng buff cộng dồn từ mọi nguồn có **trần mềm** (lợi ích giảm dần). | Chống cộng chồng buff vô hạn. |
| N5 | Buff vào **sản lượng** trước, vào **xu** sau; phần xu lấy từ quỹ có sẵn, không in thêm. | Chống lạm phát. |
| N6 | NPC luôn giữ một **phần thị trường sàn** (mặc định 20%) cho vật phẩm thiết yếu, kèm giá trần và giá sàn. | Không ai làm cạn nguồn cung để ép giá người chơi mới. |
| N7 | Mọi cơ chế đều có **chỉ số theo dõi** trên bảng quản trị và có **cảnh báo** khi vượt ngưỡng. | Quản trị viên phát hiện và xử lý sớm. |

---

## 2. Ngành hạ tầng tăng trưởng (nhóm "Chiến lược")

Thêm nhóm ngành thứ sáu, `SECTORS.strategic` ("Hạ tầng chiến lược"). Ngành trong nhóm này **không làm ra hàng**: nó tạo buff cho một vùng trên bản đồ lục giác.

### 2.1 Trị thủy (thủy lợi, đê điều, kênh tưới)

- **Đặt được ở:** lô Ven sông, Đồng bằng, Đồi núi giáp sông. Không đặt ở Trung tâm hay Trên biển.
- **Buff:** **+10% đến +40%** sản lượng cho:
  - các ngành Nông nghiệp, Chăn nuôi, Lâm nghiệp trong vùng phủ;
  - **Vườn** của người chơi (giai đoạn 2: hạt giống, thời gian lớn, sản lượng thu hoạch).
- **Vùng phủ:** các ô trong bán kính R quanh lô công trình, tính theo khoảng cách lục giác. R = 1 ở cấp 1, R = 2 ở cấp 3.
- **Mức buff theo cấp công trình:**

  | Cấp | Chi phí nâng | Buff tại tâm | Bán kính |
  |---|---|---|---|
  | 1 | (mặc định khi thâu tóm) | +10% | 1 |
  | 2 | 150.000 | +20% | 1 |
  | 3 | 400.000 | +30% | 2 |
  | 4 | 900.000 | +40% | 2 |

- **Suy giảm theo khoảng cách:** ô tâm hưởng 100% mức buff, vòng 1 hưởng 70%, vòng 2 hưởng 40%.
- **Tác dụng phụ có chủ đích:** giảm 50% thiệt hại sản lượng do thời tiết "Nắng nóng kéo dài" và "Mưa lớn nhiều ngày" trong vùng phủ.

### 2.2 Năng lượng gió (trang trại gió)

- **Đặt được ở:** lô có khí hậu Lộng gió, hoặc Ven biển / Trên biển.
- **Buff:** **+10% đến +40%** cho:
  - (a) số mẻ của mọi nhà máy (công nghiệp nhẹ, công nghiệp nặng, năng lượng) trong vùng phủ;
  - (b) **thu nhập xu** của gia tộc trong vùng: tiền bán hàng cho NPC và tiền bán trên sàn. Phần (b) có quy tắc riêng, xem 3.4.
- **Bảng cấp và bán kính:** giống Trị thủy.
- **Phụ thuộc thời tiết:** ngày "Trời yên biển lặng" buff chỉ còn 50%; ngày "Bão biển" buff tạm tắt và công trình hư nhẹ (sửa tốn 2% chi phí cấp hiện tại).

### 2.3 Luật sở hữu

| Luật | Mặc định |
|---|---|
| Phí thâu tóm ngành chiến lược | 50.000 (trần của khoảng 20.000–50.000). Không áp hệ số ×10. |
| Số ngành chiến lược tối đa mỗi gia tộc | **1**. Đã nắm Trị thủy thì không được nắm Năng lượng gió, và ngược lại. |
| Số gia tộc tối đa trên mỗi ngành chiến lược | 3 |
| Ngành chiến lược có tính vào giới hạn 3 ngành của gia tộc không? | Có |
| Số công trình tối đa mỗi gia tộc | 2 lô cho ngành chiến lược đã chọn |
| Khoảng cách giữa hai công trình cùng loại (của mọi gia tộc) | Tối thiểu 4 ô. Chặn việc dồn buff vào một chỗ. |
| Thuế suất | Theo luật chung (35% + 5 điểm mỗi ngành thêm), cộng **phụ thu chiến lược 5%** trên phí hạ tầng |

### 2.4 Phí hạ tầng: chủ công trình kiếm tiền thế nào

- Mỗi đêm, gia tộc hưởng buff trả phí cho chủ công trình. Phí = **20% phần giá trị tăng thêm do buff**, tính theo giá NPC.
- Chủ công trình hưởng buff ở lô của chính mình nhưng không tự trả phí cho mình.
- **Trần phí:** tổng phí một công trình thu mỗi đêm tối đa 1,5% giá trị công trình.
- **Không trả được phí** (quỹ cạn): gia tộc vẫn được buff, ghi nợ hạ tầng, trả dần.
  - Nợ quá 7 đêm thì gia tộc mất buff trong vùng đó. Đây là ngoại lệ duy nhất của N1, áp cho người chây ì, không phải do chủ công trình chọn.

---

## 3. Chống thao túng khi cả hai ngành bị chi phối

### 3.1 Các kịch bản rủi ro

| Mã | Kịch bản | Hậu quả nếu không chặn |
|---|---|---|
| R1 | Gia tộc X nắm cả Trị thủy và Năng lượng gió | Buff cộng dồn, sản lượng và thu nhập vượt xa mọi gia tộc khác |
| R2 | **Hai gia tộc liên minh**, mỗi bên nắm một ngành, dồn công trình vào cùng một vùng | Giống R1, nhưng lách luật sở hữu |
| R3 | Chủ công trình tắt hoặc phá công trình đột ngột để làm sụp sản lượng đối thủ trong vùng | Giá nông sản và hàng công nghiệp sốc, đối thủ lỗ |
| R4 | Gia tộc nắm buff đẩy sản lượng nông sản lên rất cao rồi bán phá giá trên sàn | Đè bẹp nông dân khác, rồi nâng giá khi đã độc chiếm |
| R5 | Gia tộc găm hàng thiết yếu (mua sạch trên sàn) rồi nâng giá | Người chơi mới không mua nổi đồ ăn |
| R6 | Buff thu nhập xu của Năng lượng gió làm phình lượng xu | Lạm phát, Ngân hàng Trung ương phải siết, cả server thiệt |
| R7 | Gia tộc dùng nhiều tài khoản phụ lập nhiều gia tộc để lách giới hạn | Mọi giới hạn mất tác dụng |

### 3.2 Biện pháp và kịch bản được xử lý

| Biện pháp | Chặn | Chi tiết |
|---|---|---|
| **M1. Giới hạn 1 ngành chiến lược/gia tộc** | R1 | Kiểm tra ở `enterIndustry` |
| **M2. Trần mềm cho buff cộng dồn** | R1, R2 | Mỗi nhóm hiệu ứng có trần mềm C = 40%. Buff hiệu dụng = C × (1 − e^(−Σbuff / C)). Ví dụ: hai buff 40% cộng lại chỉ ra khoảng 35%, không phải 80%. Trị thủy và Năng lượng gió tác động lên hai nhóm hiệu ứng khác nhau (nông/lâm và nhà máy/thu nhập), nên lô nông nghiệp không hưởng buff gió và ngược lại. |
| **M3. Khoảng cách tối thiểu giữa công trình cùng loại** | R2 | 4 ô, chặn chồng vùng phủ |
| **M4. Buff là hàng công cộng theo vùng** | R2, R3 | Đối thủ trong vùng cũng hưởng, nên liên minh không độc quyền được lợi ích |
| **M5. Suy giảm dần khi công trình ngừng** | R3 | Buff giảm 1/3 mỗi đêm trong 3 đêm, không tắt ngay. Phá công trình mà không báo trước 3 ngày thì bị phạt 20% chi phí cấp và −50 uy tín gia tộc. |
| **M6. Chống bán phá giá** | R4 | Giá đăng sàn đã có sàn 50% giá tham chiếu. Thêm: một gia tộc bán quá 40% khối lượng của một mặt hàng trên sàn trong 7 ngày thì phần vượt chịu **thuế chống độc quyền +10%**, và giá tham chiếu của mặt hàng đó tạm khóa (không giảm thêm) trong 3 ngày. |
| **M7. NPC giữ phần thị trường sàn và giá trần** | R5 | Vật phẩm thiết yếu: NPC luôn bán tối thiểu 20% nhu cầu ở giá trần = giá tham chiếu × 1,3 (đã có `importMarkup`). Không ai đẩy giá vượt trần được, vì người mua luôn có lối thoát. |
| **M8. Giới hạn mua gom** | R5 | Một gia tộc mua tối đa 30% số hàng đang niêm yết của một mặt hàng trong 24 giờ |
| **M9. Buff xu lấy từ "Quỹ năng lượng"** | R6 | Phần (b) của Năng lượng gió **không in xu mới**. Nó trả từ Quỹ năng lượng, quỹ này được nạp bằng 50% thuế doanh nghiệp của ngành năng lượng và 50% phí sàn. Quỹ cạn thì buff (b) tạm ngưng, buff (a) vẫn chạy. Trần chi mỗi đêm là 10% số dư quỹ. |
| **M10. Gắn với Ngân hàng Trung ương** | R6 | Khi lượng xu tăng hơn mục tiêu (10%/tuần), hiệu suất buff (b) giảm cùng tỉ lệ với mức siết lãi suất |
| **M11. Liên kết tài khoản** | R7 | Gắn cờ các tài khoản cùng IP hoặc cùng link mời đang ở các gia tộc khác nhau cùng nắm ngành chiến lược. Sở Công Thương (bảng quản trị) xem và xử lý. Không tự động phạt. |

### 3.3 Chỉ số đo độ thao túng (hiện trên bảng quản trị)

- **HHI theo mặt hàng:** tổng bình phương thị phần các gia tộc trên sàn trong 7 ngày. Cảnh báo vàng khi > 2.500, đỏ khi > 4.000.
- **Tỉ lệ sản lượng có buff:** phần sản lượng toàn server đến từ lô được buff. Cảnh báo khi > 60%.
- **Biến động giá thiết yếu:** độ lệch giá 7 ngày so với giá tham chiếu. Cảnh báo khi > 25%.
- **Mức độ chồng buff:** số lô hưởng cả hai loại buff (lẽ ra bằng 0 nhờ M2–M3).
- **Quỹ năng lượng:** số dư, thu, chi mỗi đêm.

### 3.4 Công thức tổng (mỗi lô, mỗi đêm)

```
sản_lượng = gốc × (1 + tốc_độ_lô) × hệ_số_môi_trường × thời_tiết × chu_kỳ × cấp_gia_tộc × công_trình
            × (1 + buff_hiệu_dụng(nhóm_của_ngành))       ← M2: trần mềm 40%

thu_nhập_xu = bán_NPC + bán_sàn
              + min(buff_gió_b × (bán_NPC + bán_sàn), 10% quỹ năng lượng còn lại)   ← M9
phí_hạ_tầng = 20% × (sản_lượng_tăng_thêm × giá_NPC), trần 1,5% giá trị công trình/đêm
```

---

## 4. Vòng đời vật phẩm thiết yếu (đồ ăn, đồ chăm sóc)

### 4.1 Ba giai đoạn theo **chỉ số phát triển D** của server

D = công suất người chơi cung cấp vật phẩm thiết yếu ÷ nhu cầu thiết yếu toàn server (trung bình 7 ngày), giới hạn trong 0–100%.

- Nhu cầu: mỗi bé còn sống tiêu khoảng 3 suất ăn/ngày.
- Công suất người chơi: tổng số suất ăn người chơi làm ra từ chuỗi Nông nghiệp/Chăn nuôi → Chế biến thực phẩm, cộng món nấu trong Bếp.

| Giai đoạn | D | NPC (Siêu thị) | Người chơi |
|---|---|---|---|
| **1. Khai hoang** | < 20% | Bán đủ đồ ăn cơ bản (trà sữa, cá, cơm nắm). Đồ NPC hồi no và vui, **XP thấp** (bằng 50% XP hiện tại). | Mới bắt đầu sản xuất; thực phẩm chế biến của người chơi cho XP gấp 2 lần đồ NPC. |
| **2. Phát triển** | 20–80% | Chỉ cung cấp **phần còn thiếu**: lượng NPC bán = (1 − D) × nhu cầu, tối thiểu 10%. XP đồ NPC giảm dần về 25%. Giá NPC tăng nhẹ theo D (tối đa +30%). | Siêu thị **mua hàng của người chơi trước** để bán lại: giá thu mua = giá tham chiếu. Hàng người chơi xếp trên kệ, gắn nhãn gia tộc. |
| **3. Tự chủ** | ≥ 80% | Giữ đúng **10% sàn** (M7) ở giá trần, là nguồn cung cuối cùng. Đồ NPC chỉ hồi chỉ số, gần như không có XP. | Chợ do người chơi chi phối. Món cao cấp (chất lượng Ngon / Tuyệt hảo) cho XP và hiệu ứng tốt hơn hẳn. |

Đúng với yêu cầu: phần thị trường **do người chơi tự sản xuất bằng D%**, phần còn lại (100% − D) **vẫn là NPC tự sản xuất**. Phần NPC không bao giờ dưới 10% (chủ game chốt).

### 4.2 Dòng chảy

```
Ruộng/trại (Nông nghiệp, Chăn nuôi, có buff Trị thủy)
   → Kho gia tộc → Nhà máy Chế biến thực phẩm (có buff Năng lượng gió)
   → Sàn công nghiệp / bán cho Siêu thị
   → Người chơi mua ở Siêu thị → cho bé ăn → no, vui, XP
```

- Siêu thị có **sổ đặt mua** mỗi đêm. Nó mua hàng thiết yếu của các gia tộc theo nhu cầu × D, theo giá tham chiếu và theo thứ tự giá chào thấp trước.
- Không gia tộc nào bán cho Siêu thị quá 40% lượng thu mua của một đêm (M6). Như vậy một gia tộc có buff cũng không độc chiếm được nguồn cung đồ ăn.

### 4.3 Bảo vệ người chơi mới

- 7 ngày đầu của tài khoản: Siêu thị bán đồ ăn cơ bản theo giá giai đoạn 1, bất kể D. Trợ cấp tân thủ vẫn giữ.
- Khi D tăng nhanh hơn 10 điểm/ngày, hệ thống tự hoãn chuyển giai đoạn 2 ngày, để không sốc giá.

---

## 5. Thay đổi dữ liệu

| Bảng / file | Thay đổi |
|---|---|
| `shared/industry.js` | Thêm `SECTORS.strategic`, ngành `irrigation` (Trị thủy) và `wind_farm` (Năng lượng gió) với `buff: { group, levels, radius }`; `STRATEGIC_RULES` (phí, trần, khoảng cách) |
| `land_plots` | Thêm cột `infra_level` (cấp công trình hạ tầng) và `infra_since` |
| `infra_buffs` (mới) | Ảnh chụp buff từng lô mỗi đêm (lô, nhóm, mức, nguồn): để hiển thị và kiểm toán |
| `infra_fees` (mới) | Phí hạ tầng mỗi đêm (người trả, người nhận, số tiền, nợ) |
| `accounts` | Tài khoản `energy_fund` (Quỹ năng lượng) |
| `market_stats` (mới) | Thị phần, HHI, khối lượng theo mặt hàng và gia tộc, 7 ngày |
| `essentials` (mới) | D theo ngày, nhu cầu, cung của người chơi, cung NPC, giá |
| `clan_config` | Toàn bộ tham số ở mục 2–4 để quản trị viên chỉnh |

---

## 6. Thay đổi giao diện

- **Bản đồ:** thêm lớp "Vùng hạ tầng" tô vùng phủ của Trị thủy (xanh nước) và Năng lượng gió (trắng xanh), đậm nhạt theo mức buff. Bảng lô hiện các buff đang hưởng và phí phải trả.
- **Tab Sản xuất:** cột "Buff" trong nhật ký đêm, khoản "Phí hạ tầng" phải trả hoặc được nhận.
- **Siêu thị:** nhãn "Hàng gia tộc X" trên món do người chơi làm. Thanh "Tự chủ thực phẩm D%" ở đầu trang.
- **Bảng quản trị:** thêm thẻ "Sở Công Thương" gồm:
  - HHI, thị phần, biến động giá, Quỹ năng lượng, cờ tài khoản liên kết (M11);
  - các nút: khóa giá tham chiếu một mặt hàng, tạm dừng buff của một công trình, truy thu phí.

---

## 7. Lộ trình triển khai (đề xuất)

| Đợt | Nội dung | Phụ thuộc |
|---|---|---|
| 1 | Nhóm Hạ tầng chiến lược, 2 ngành, luật sở hữu (M1, M3), cấp công trình, vùng phủ trên bản đồ lục giác, buff sản lượng với trần mềm (M2), suy giảm khi ngừng (M5) | Chuỗi sản xuất hiện tại |
| 2 | Phí hạ tầng và nợ; Quỹ năng lượng; buff thu nhập xu (M9, M10) | Đợt 1 |
| 3 | Chống bán phá giá, giới hạn mua gom, thuế chống độc quyền (M6, M8); thống kê thị trường | Sàn công nghiệp hiện tại |
| 4 | Vòng đời thiết yếu: chỉ số D, Siêu thị mua của người chơi, XP theo giai đoạn, bảo vệ tân thủ | Đợt 3 |
| 5 | Thẻ Sở Công Thương, cảnh báo, cờ tài khoản liên kết (M11) | Đợt 1–4 |
| 6 | Mô phỏng và tinh chỉnh số (mục 8) | Chạy song song từ đợt 2 |

Mỗi đợt là một PR riêng, có test và kết quả mô phỏng kèm theo.

---

## 8. Kiểm chứng bằng mô phỏng

Mở rộng `scripts/simulate-economy.js` với bot gia tộc (8 gia tộc, 60 người chơi, 60 ngày). Chạy các kịch bản:

1. **Cơ sở:** không có ngành chiến lược.
2. **Bình thường:** 3 gia tộc Trị thủy, 3 gia tộc Năng lượng gió, đặt công trình ngẫu nhiên.
3. **Thao túng R2:** hai gia tộc liên minh, đặt công trình sát nhau nhất mà luật cho phép, bán phá giá rồi găm hàng.
4. **Phá hoại R3:** chủ công trình phá công trình vào ngày 30.
5. **Lạm phát R6:** bỏ trần Quỹ năng lượng, để so sánh.

**Tiêu chí đạt:**

- Kịch bản 3 so với kịch bản 2:
  - HHI không vượt 4.000;
  - lợi nhuận của liên minh không vượt 1,6 lần gia tộc trung bình;
  - giá thiết yếu không lệch quá ±25%.
- Kịch bản 4: sản lượng vùng giảm tối đa 40% trong 3 đêm, không giảm đột ngột.
- Lượng xu tăng mỗi tuần nằm trong mục tiêu 10% ±3 điểm, ở mọi kịch bản có M9.
- Thời gian để D đạt 50% nằm trong khoảng 14–30 ngày với 60 người chơi.

### 4.4 Bản đã làm (đợt 4)

- **D** chốt mỗi nửa đêm cho ngày hôm sau = suất ăn gia tộc bán cho Siêu thị ÷ suất đồ ăn người chơi mua (7 ngày), kẹp 0–90%, mỗi ngày dịch tối đa 10 điểm.
- **Siêu thị thu mua**: trong lúc chốt sổ đêm, Thực phẩm chế biến của gia tộc được Siêu thị mua **trước** theo giá tham chiếu (tính vào doanh thu chịu thuế), 1 đơn vị = 5 **Suất ăn gia tộc 🍱**. Siêu thị chỉ mua đủ kho cho khoảng 1,5 ngày phần người chơi; mỗi gia tộc tối đa 40% lượng thu mua của đêm. Phần thừa bán NPC như cũ.
- **Suất ăn gia tộc**: +50 no, +12 vui, 22 XP (đủ XP, không giới hạn), giá = giá tham chiếu Thực phẩm chế biến ÷ 5 × 1,15; hết kho thì không mua được.
- **Đồ ăn NPC** (người chơi cũ hơn 7 ngày): hạn mức mỗi ngày = ⌈số bé × 3 × max(10%, 1 − D)⌉ + 2 món; XP còn 50% (D < 20%) → 25% (D = 80%) → 10%; giá × (1 + 30% theo D từ 20% đến 80%).
- **Tài khoản mới 7 ngày**: đồ ăn NPC không giới hạn, đủ XP, giá gốc.
- Giao diện: Siêu thị hiện thanh "Tự chủ thực phẩm D%", hạn mức NPC còn lại, kho và giá suất ăn gia tộc.

### 4.5 Đồ chăm sóc và hạng chất lượng (đợt 5)

- **Đồ chăm sóc** có vòng đời riêng, D riêng (bảng `essentials_care_days`): gia tộc **Dược phẩm** làm Thuốc, Siêu thị mua trước theo giá tham chiếu, 1 Thuốc = 10 **Bộ chăm sóc gia tộc 🧴** (+15 vui, +25 năng lượng, +15 sức khỏe, +30 sạch sẽ, 14 XP). Hạn mức đồ chăm sóc NPC = ⌈số bé × 2 × max(10%, 1 − D)⌉ + 2 món/ngày, tách khỏi hạn mức đồ ăn. XP và giá đồ chăm sóc NPC theo cùng đường cong với đồ ăn.
- **Hạng chất lượng** Thường / Ngon / Tuyệt hảo cho cả Suất ăn và Bộ chăm sóc: hiệu ứng, XP, giá Siêu thị trả gia tộc và giá bán lẻ nhân 1 / 1,2 / 1,5.
- **Điểm chất lượng** của gia tộc (0–1) = 40% cấp gia tộc + 30% nhà xưởng (số mảnh công trình của ngành chế biến ÷ 20) + 30% nếu gia tộc tự chạy một ngành đầu vào (Nông nghiệp hoặc Chăn nuôi cho thực phẩm; Hóa chất hoặc Nông nghiệp cho thuốc).
- **Tỉ lệ hạng** mỗi đêm: Tuyệt hảo = 35% × điểm, Ngon = 20% + 40% × điểm, còn lại Thường. Gia tộc mới (điểm 0) ra 80% Thường, 20% Ngon; gia tộc tối đa ra 5% / 60% / 35%.
- Siêu thị chỉ hiện thẻ hạng Ngon / Tuyệt hảo khi còn hàng; thanh tự chủ hiện kho từng hạng.

### 4.6 Sổ chào giá thấp trước (đợt 6)

- Tộc trưởng / trưởng lão đặt **lệnh chào bán** Thực phẩm chế biến hoặc Thuốc từ kho cho Siêu thị: số lượng tối đa và giá **70–100% giá tham chiếu** (bảng `essentials_asks`, mỗi gia tộc một lệnh mỗi nhóm). Đặt lệnh thì mặt hàng chuyển sang "Giữ trong kho" để không bị tự bán NPC.
- Lúc nửa đêm, sau khi Siêu thị tính lượng cần mua, **sổ được khớp trước khi các gia tộc chạy sản xuất**: giá thấp trước; cùng giá thì điểm chất lượng cao trước; rồi lệnh đặt trước (đổi giá thì mất thứ tự). Trần 40% mỗi gia tộc tính chung cho sổ và hàng tự bán.
- Siêu thị trả giá chào × hệ số hạng chất lượng; tiền vào quỹ gia tộc, ghi vào giao dịch ("Siêu thị") và tính thuế đêm đó như giao dịch trên sàn. Lệnh còn lại sau khớp được giữ cho đêm sau.
- Hàng vừa làm ra mà không có lệnh vẫn được Siêu thị mua sau sổ, ở giá 100% tham chiếu. Như vậy giá thấp hơn đổi lấy chắc chắn bán được khi Siêu thị cần ít hàng.

---

## 9. Quyết định của chủ game (30/10/2026) và trạng thái

| # | Quyết định | Trạng thái |
|---|---|---|
| 1 | Buff áp cho **toàn bộ thị trấn** (không theo vùng). Người chơi/gia tộc hưởng buff thì bị thu phí; hết tiền thì dừng buff. | Đã làm (`server/strategic.js`): `buffFor`, `chargeInfraFee`. Gia tộc chủ không tự trả phí. |
| 2 | Phí hạ tầng 20% phần tăng thêm; gia tộc chủ xây và nâng cấp hạ tầng để buff +10% → +40%. | Đã làm: 4 cấp (miễn phí, 150.000, 400.000, 900.000). Nhiều gia tộc cùng ngành: lấy mức cao nhất + 25% phần còn lại, trần 60%. |
| 3 | Phần NPC giữ cho vật phẩm thiết yếu được xuống **10%**. | Đã làm (`server/essentials.js`, luật `ESSENTIALS` ở `shared/industry.js`), xem mục 4.4. |
| 4 | Năng lượng gió buff cả thu nhập mua bán **cá nhân**; thành viên gia tộc chủ **+10%**; **pet huyền thoại đứng máy** thêm 10–30% theo hành. | Đã làm: Sàn Nguyên Liệu, Chợ Phiên; số mẻ nhà máy và xu bán hàng của gia tộc. Pet đứng máy: Kim 30%, Hỏa 25%, Mộc 20%, Thủy 15%, Thổ 10%. |
| 5 | Thêm ngành nhà nước: **Ngân hàng**, **Thuế** (đi truy thu). | Đã làm: Ngân hàng nhà nước (buff lãi tiết kiệm, kỳ hạn) và Thuế vụ (xem hồ sơ khai thiếu của gia tộc khác, truy thu thuế trốn + 50% phạt, hưởng hoa hồng 10–40%). Mỗi ngành chỉ 1 gia tộc nắm. |

Phần đã làm ở trên tương ứng đợt 1–2 (bản theo toàn server thay cho theo vùng). Vùng phủ, khoảng cách công trình (M3) không còn cần vì buff áp cho toàn thị trấn.

## 10. Câu hỏi ban đầu (đã trả lời ở mục 9)

1. Buff +10–40% áp cho **vùng phủ** (đề xuất) hay cho **toàn bộ lô** của gia tộc chủ, bất kể vị trí?
2. Phí hạ tầng 20% phần tăng thêm có phù hợp không? Hay muốn hạ tầng hoàn toàn miễn phí, chủ chỉ hưởng buff ở lô của mình?
3. Sàn NPC 20% cho thiết yếu: giữ mức này hay cho phép về 10% khi server đông?
4. Có cho Năng lượng gió buff cả **thu nhập xu từ mua bán** của thành viên (Sàn Nguyên Liệu, Chợ Phiên), hay chỉ thu nhập của gia tộc như đề xuất?
5. Ngoài Trị thủy và Năng lượng gió, có muốn thêm các ngành chiến lược khác theo cùng khung (ví dụ Giao thông: giảm phí sàn; Viễn thông: tăng XP học)?
