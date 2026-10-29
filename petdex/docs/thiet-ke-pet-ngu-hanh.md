# Thiết kế: pet ngũ hành, vòng đời và đồ đeo đồng bộ

Xưởng tạo hình: `/pet-lab.html` (ví dụ http://localhost:3001/pet-lab.html) xem cả 50 loài, 6 giai đoạn và thử đồ. Dữ liệu ở `public/js/shared/pets.js`, bộ khung vẽ ở `public/js/rig.js`, dựng spritesheet ở `public/js/petsheet.js`.

**Trạng thái:** cả ba bước đã vào game, xem mục 10:
- 2.5A: hình mới, đồ đeo 4 khe.
- 2.5B: ngũ hành trong luật chơi, trứng ngũ hành.
- 2.5C: luật theo giai đoạn đời, vòng đời, Đồi Sao.

## 1. Vì sao đồ đeo hiện tại trông "không dính"

- Bé Boba là ảnh vẽ sẵn của Petdex (lưới 192×208, mỗi pixel nghệ thuật khoảng 4,8 pixel màn hình). Game không biết đầu bé nằm ở đâu trong từng khung hình.
- Phụ kiện chỉ dán ở một tọa độ cố định (`top: 8%`), nên khi bé nhảy, chạy hay cúi đầu thì mũ đứng yên.
- Phụ kiện và bé vẽ bởi hai người khác nhau, độ thô, màu viền và cách đổ bóng không khớp.

Muốn có 50 loài và đồ đeo "dính lên người" thì phải tự vẽ pet theo một hệ thống chung, không thể dùng ảnh rời.

## 2. Bộ khung vẽ chung

**Một bộ khung cho mọi loài.** Mỗi pet được lắp từ các bộ phận trên một trong 5 dáng khung:

| Dáng | Ví dụ |
| --- | --- |
| Đứng hai chân | Rái cá, gấu, sóc, gấu trúc |
| Bốn chân | Mèo, cáo, hươu, hổ, rùa |
| Tròn | Hải cẩu, heo đất, ếch, cá nóc |
| Chim | Cú, cánh cụt, gà, Chu Tước |
| Rồng / bò sát | Thanh Long, Hoàng Long, kỳ nhông |

Bộ phận lắp thêm:
- tai: mèo, cáo, thỏ, chuột, cụp, sừng, gạc, vây, mào
- đuôi: mảnh, xù, bông, dẹt, xoăn, quạt, rồng, cá
- mặt: mõm, mỏ, mũi heo
- hoa văn: bụng, mặt nạ, sọc, đốm, mai, vảy
- dấu hiệu hành: mầm lá, ngọn lửa, giọt nước, pha lê, đá cuội, nấm, hạt ngọc

**Đồng bộ nét vẽ:**
- Cùng lưới pixel 44×50, cùng màu viền nâu đậm, cùng kiểu đổ bóng dither từ trên-trái.
- Màu lấy từ 3 màu gốc của loài (thân, bụng, điểm nhấn); sáng/tối tự tính. Nhờ vậy 50 loài trông như một bộ.
- Đồ đeo vẽ cùng lưới và viền, nên đặt lên con nào cũng hợp.

**Điểm neo.** Mỗi khung hình tính lại 4 điểm neo từ vị trí thật của đầu và thân:

| Khe | Điểm neo | Ví dụ đồ |
| --- | --- | --- |
| 🎩 Đầu | Đỉnh đầu (nơ, hoa thì lệch sang một bên) | Mũ, nón lá, vương miện, nơ, hoa |
| 👓 Mặt | Ngang mắt | Kính tròn, kính râm |
| 🧣 Cổ | Ngay dưới cằm | Khăn, vòng chuông, ngọc trai, nơ cổ |
| 🦋 Lưng | Vai | Áo choàng, cánh thiên thần, cánh rồng |

- Bé nhảy, chạy, cúi đầu, vẫy tay thì điểm neo đi theo, nên đồ đeo luôn dính đúng chỗ (bật "Hiện điểm neo" trên trang xưởng để xem).
- Thứ tự lớp: đồ ở lưng → thân bé → mặt → đồ ở cổ → đồ ở mặt → đồ trên đầu.
- Đội mũ thì giấu dấu hiệu hành trên đỉnh đầu (mầm lá, ngọn lửa…), như tóc nằm dưới mũ. Dấu hiệu trên trán vẫn hiện.
- Mỗi bé đeo được cùng lúc 4 món, mỗi khe một món (hiện tại chỉ 1 món).

**Hoạt ảnh:** đứng chơi, vẫy tay, nhảy, chạy, buồn, ngó nghiêng, làm việc. Đủ cho các chỗ game đang dùng (nhà, công viên, đi làm); chạy sang trái là lật hình.

**Bé Boba của Petdex:** giữ lại làm "khách mời" hành Thủy. Đề xuất cho Boba tự dò điểm neo từ ảnh: lấy viền trên của phần có màu ở mỗi khung hình làm đỉnh đầu. Mũ sẽ theo Boba khi nhảy, dù không khít bằng pet vẽ trên khung.

## 3. Ngũ hành

| Hành | Màu | Kỹ năng lên nhanh | Chỉ số | Lợi thế làm ăn | Tính khí |
| --- | --- | --- | --- | --- | --- |
| 🪙 Kim | Trắng, bạc, vàng kim | Khéo tay ×1,3 · Sức mạnh ×1,15 | Bẩn chậm hơn 15% | Xưởng thêm 10% mẻ, món nấu dễ ra loại Ngon | Cứng cỏi, gọn gàng |
| 🌿 Mộc | Xanh lá, nâu gỗ | Thông minh ×1,3 · Duyên dáng ×1,1 | Hồi sức khỏe nhanh hơn 30% | Vườn thu hoạch thêm 15% | Hiền, ham học |
| 💧 Thủy | Xanh nước, xanh đen | Duyên dáng ×1,3 · Nhanh nhẹn ×1,15 | Vui vẻ hao chậm hơn 15% | Trực quầy hút thêm 5% khách | Mềm mỏng, vui lâu |
| 🔥 Hỏa | Đỏ, cam, hồng | Sức mạnh ×1,3 · Nhanh nhẹn ×1,1 | Hồi năng lượng nhanh hơn 20%, nhưng đói nhanh hơn 10% | Ca làm sức lực thêm 5% lương | Sôi nổi |
| ⛰️ Thổ | Vàng đất, nâu | Khéo tay ×1,15 · Sức mạnh ×1,15 | Đói chậm hơn 15%, ốm ít hơn 40% | Sống lâu hơn các hành khác | Điềm đạm, khỏe |

**Tương sinh:** Mộc → Hỏa → Thổ → Kim → Thủy → Mộc. **Tương khắc:** Mộc khắc Thổ, Thổ khắc Thủy, Thủy khắc Hỏa, Hỏa khắc Kim, Kim khắc Mộc.

Ngũ hành dùng ở những chỗ sau:

- **Đồ đeo hợp mệnh:**
  - Mỗi món có một hành.
  - Hành của món nuôi dưỡng hành của bé (tương sinh): kỹ năng lên nhanh hơn 10%. Cùng hành: nhanh hơn 5%. Món khắc bé (kỵ mệnh): chậm hơn 5%.
  - Trang xưởng đã hiện nhãn "Hợp mệnh" và "Kỵ mệnh", và tổng hiệu quả của bộ đồ đang mặc.
- **Bộ đồ ngũ hành:** đủ 4 khe cùng một hành thì thêm hiệu ứng lấp lánh màu hành và +5% lương. Mỗi hành cần có đủ đồ cho cả 4 khe; bản mẫu mới có 17 món, phải vẽ thêm cho đủ 20.
- **Đồ ăn có hành:** cá là Thủy, rau và trà là Mộc, đồ nướng là Hỏa, củ là Thổ, sữa là Kim. Ăn món hợp mệnh được thêm 20% XP.
- **Bạn chơi:** ở công viên, vuốt ve bé có hành được hành mình nuôi dưỡng thì bé kia vui gấp rưỡi. Quầy hoặc xưởng có hai bé trực mà hành tương sinh nhau thì thêm 5% khách hoặc số mẻ.
- **Vận khí ngày:** mỗi ngày một hành vượng (xoay theo lịch). Bé hành đó được thêm 10% XP và lương trong ngày, báo ở Báo Trân Châu.

## 4. Sáu giai đoạn đời

1 ngày thật = 1 tuần tuổi, như hiện tại. Mỗi giai đoạn có dáng vẽ riêng: bé sơ sinh đầu to thân nhỏ, mắt to; lớn dần thì người dài ra; lão làng lông bạc, lông mày và chòm râu trắng, hơi còng, chống gậy. Đồ đeo vẫn vừa ở mọi tuổi vì đi theo điểm neo.

| Giai đoạn | Tuổi | Giống đời người | Luật đề xuất |
| --- | --- | --- | --- |
| Sơ sinh | 0–2 tuần | Em bé | Chóng lớn (XP ×1,5) nhưng dễ ốm gấp đôi. Chưa đi học, chưa đi làm |
| Nhí nhố | 2–8 tuần | Tuổi đi học | Học ở trường nhanh hơn 30%, vẫn hơi dễ ốm. Chỉ làm việc nhẹ 2 giờ/ngày, lương 60% |
| Thiếu niên | 8–21 tuần | Tuổi ẩm ương | Vui vẻ tụt nhanh hơn 30%. Làm bán thời gian 4 giờ/ngày, lương 85% |
| Thanh niên | 21–40 tuần | Mới đi làm | Làm đủ 8 giờ, lương đủ. Ăn tiêu nhiều: no bụng hao nhanh hơn 30%, cần chơi nhiều hơn |
| Trưởng thành | 40–70 tuần | Chín chắn | Ít ốm nhất. Lương thâm niên: +1% cho mỗi 10 giờ đã làm ở nghề, tối đa +30% |
| Lão làng | 70 tuần trở lên | Về hưu | Hay ốm gấp đôi, hồi năng lượng chậm hơn 20%, chỉ làm 4 giờ/ngày nhưng giữ lương thâm niên |

**Cuối đời: "về với sao trời".**
- **Tuổi thọ:** 90 tuần, cộng thêm theo độ hiếm (tới +12) và hành Thổ (+8). Chăm tốt thì sống thêm tới 20 tuần, tính theo sức khỏe trung bình cả đời; chăm kém thì ngắn lại tới 10 tuần. Tổng cộng khoảng 3–4 tháng chơi thật.
- **Báo trước:** từ 7 tuần trước khi hết tuổi thọ, màn Nhà nhắc "Bé đã rất già…" để người chơi kịp chụp ảnh, đeo bộ đồ đẹp nhất, dắt đi chơi lần cuối.
- **Khi bé mất:**
  - Bé lên Đồi Sao (bảng tưởng niệm), giữ tên, ảnh với bộ đồ lúc cuối, số ngày sống và thành tích.
  - Đồ đeo trả về túi.
  - Người chơi nhận một **kỷ vật** cho bé sau: +5 vào kỹ năng sở trường của bé cũ.
- **Mở lại ô nuôi:** ô của bé thành "ô tưởng niệm". Nhận nuôi bé mới vào ô đó tốn **3.000 xu × chỉ số giá**, gấp 15 lần phí nhận nuôi thường.
- **Chống kẹt người chơi:** nếu đó là bé cuối cùng, người chơi được một quả trứng Thường miễn phí sau 3 ngày, để không bị khóa khỏi game.

## 5. 50 loài

Mỗi hành 10 loài: 5 Thường, 3 Hiếm, 1 Quý, 1 Huyền thoại. Huyền thoại là Tứ Tượng cộng Hoàng Long: Bạch Hổ (Kim), Thanh Long (Mộc), Huyền Vũ (Thủy), Chu Tước (Hỏa), Hoàng Long (Thổ).

Độ hiếm cộng thêm tổng điểm kỹ năng khởi đầu (50 / 60 / 72 / 85) và tuổi thọ (0 / 4 / 8 / 12 tuần). Độ hiếm không đổi giới hạn kỹ năng (vẫn 100), để bé Thường chăm kỹ vẫn giỏi được.

Mỗi loài có số liệu riêng: kỹ năng khởi đầu (nghiêng về sở trường và hành), hệ số lên kỹ năng, hao no bụng, hồi năng lượng, tuổi thọ. Bảng dưới sinh từ `public/js/shared/pets.js`:

**🪙 Hành Kim**

| Loài | Độ hiếm | Dáng | Sở trường | Kỹ năng khởi đầu (💪🏃🧠✨🖐️) | Hao no bụng | Hồi năng lượng | Tuổi thọ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mèo Bạc | ★ Thường | Bốn chân | 🖐️ Khéo tay | 10 · 7 · 8 · 9 · 16 | ×0.95 | ×1.00 | 90 tuần |
| Chuột Chuông | ★ Thường | Tròn | 🏃 Nhanh nhẹn | 9 · 13 · 8 · 8 · 12 | ×0.90 | ×1.05 | 90 tuần |
| Sóc Đồng | ★ Thường | Đứng hai chân | 🖐️ Khéo tay | 11 · 9 · 7 · 8 · 15 | ×1.00 | ×1.05 | 90 tuần |
| Gà Vàng | ★ Thường | Chim | ✨ Duyên dáng | 9 · 9 · 8 · 13 · 11 | ×1.05 | ×1.00 | 90 tuần |
| Tê Tê Thép | ★ Thường | Đứng hai chân | 💪 Sức mạnh | 14 · 9 · 8 · 9 · 9 | ×1.00 | ×0.95 | 90 tuần |
| Cú Ánh Kim | ★★ Hiếm | Chim | 🧠 Thông minh | 12 · 9 · 16 · 11 · 12 | ×0.90 | ×1.00 | 94 tuần |
| Hươu Pha Lê | ★★ Hiếm | Bốn chân | ✨ Duyên dáng | 11 · 12 · 9 · 15 · 13 | ×0.95 | ×1.05 | 94 tuần |
| Sói Bạc | ★★ Hiếm | Bốn chân | 🏃 Nhanh nhẹn | 11 · 15 · 10 · 11 · 13 | ×1.10 | ×1.10 | 94 tuần |
| Hạc Bạc | ★★★ Quý | Chim | 🧠 Thông minh | 15 · 11 · 17 · 14 · 14 | ×0.90 | ×1.05 | 98 tuần |
| Bạch Hổ | ★★★★ Huyền thoại | Bốn chân | 💪 Sức mạnh | 23 · 16 · 13 · 15 · 18 | ×1.10 | ×1.15 | 102 tuần |

**🌿 Hành Mộc**

| Loài | Độ hiếm | Dáng | Sở trường | Kỹ năng khởi đầu (💪🏃🧠✨🖐️) | Hao no bụng | Hồi năng lượng | Tuổi thọ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Thỏ Lá | ★ Thường | Đứng hai chân | 🏃 Nhanh nhẹn | 8 · 12 · 10 · 10 · 9 | ×1.00 | ×1.05 | 90 tuần |
| Ếch Sen | ★ Thường | Tròn | ✨ Duyên dáng | 9 · 8 · 10 · 14 · 9 | ×0.95 | ×1.00 | 90 tuần |
| Khỉ Tre | ★ Thường | Đứng hai chân | 🏃 Nhanh nhẹn | 9 · 13 · 10 · 10 · 8 | ×1.05 | ×1.05 | 90 tuần |
| Nhím Rêu | ★ Thường | Tròn | 🧠 Thông minh | 9 · 8 · 15 · 8 · 10 | ×0.95 | ×0.95 | 90 tuần |
| Cún Cỏ | ★ Thường | Bốn chân | ✨ Duyên dáng | 8 · 8 · 11 · 14 · 8 | ×1.05 | ×1.00 | 90 tuần |
| Gấu Trúc | ★★ Hiếm | Đứng hai chân | 💪 Sức mạnh | 16 · 9 · 13 · 12 · 10 | ×1.15 | ×0.95 | 94 tuần |
| Hươu Rêu | ★★ Hiếm | Bốn chân | 🧠 Thông minh | 10 · 10 · 17 · 13 · 11 | ×0.95 | ×1.05 | 94 tuần |
| Cáo Lá | ★★ Hiếm | Bốn chân | 🏃 Nhanh nhẹn | 9 · 17 · 11 · 12 · 10 | ×1.00 | ×1.10 | 94 tuần |
| Rùa Cổ Thụ | ★★★ Quý | Bốn chân | 🧠 Thông minh | 13 · 12 · 21 · 12 · 13 | ×0.85 | ×0.90 | 98 tuần |
| Thanh Long | ★★★★ Huyền thoại | Rồng / bò sát | 🧠 Thông minh | 15 · 15 · 25 · 17 · 13 | ×1.00 | ×1.15 | 102 tuần |

**💧 Hành Thủy**

| Loài | Độ hiếm | Dáng | Sở trường | Kỹ năng khởi đầu (💪🏃🧠✨🖐️) | Hao no bụng | Hồi năng lượng | Tuổi thọ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rái Cá | ★ Thường | Đứng hai chân | 🏃 Nhanh nhẹn | 8 · 16 · 7 · 11 · 8 | ×1.00 | ×1.05 | 90 tuần |
| Chim Cánh Cụt | ★ Thường | Chim | 🏃 Nhanh nhẹn | 9 · 13 · 9 · 11 · 9 | ×1.05 | ×1.00 | 90 tuần |
| Hải Cẩu | ★ Thường | Tròn | ✨ Duyên dáng | 8 · 10 · 9 · 15 · 8 | ×1.05 | ×0.95 | 90 tuần |
| Cá Nóc | ★ Thường | Tròn | ✨ Duyên dáng | 9 · 10 · 9 · 14 · 7 | ×0.90 | ×1.00 | 90 tuần |
| Mèo Mưa | ★ Thường | Bốn chân | 🧠 Thông minh | 8 · 9 · 14 · 11 · 8 | ×0.95 | ×1.00 | 90 tuần |
| Kỳ Giông Hồng | ★★ Hiếm | Đứng hai chân | ✨ Duyên dáng | 11 · 12 · 11 · 16 · 11 | ×0.95 | ×1.05 | 94 tuần |
| Rùa Biển | ★★ Hiếm | Bốn chân | 🧠 Thông minh | 11 · 12 · 14 · 12 · 11 | ×0.90 | ×0.95 | 94 tuần |
| Vịt Mây | ★★ Hiếm | Chim | 🏃 Nhanh nhẹn | 10 · 18 · 10 · 12 · 10 | ×1.00 | ×1.05 | 94 tuần |
| Cá Chép Rồng | ★★★ Quý | Rồng / bò sát | ✨ Duyên dáng | 12 · 14 · 11 · 23 · 12 | ×1.00 | ×1.10 | 98 tuần |
| Huyền Vũ | ★★★★ Huyền thoại | Bốn chân | 🧠 Thông minh | 15 · 18 · 21 · 17 · 13 | ×0.90 | ×1.00 | 102 tuần |

**🔥 Hành Hỏa**

| Loài | Độ hiếm | Dáng | Sở trường | Kỹ năng khởi đầu (💪🏃🧠✨🖐️) | Hao no bụng | Hồi năng lượng | Tuổi thọ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cáo Lửa | ★ Thường | Bốn chân | 🏃 Nhanh nhẹn | 11 · 13 · 9 · 8 · 9 | ×1.21 | ×1.32 | 90 tuần |
| Gà Trống Lửa | ★ Thường | Chim | 💪 Sức mạnh | 14 · 10 · 8 · 9 · 9 | ×1.21 | ×1.26 | 90 tuần |
| Gấu Mèo Đỏ | ★ Thường | Đứng hai chân | ✨ Duyên dáng | 11 · 8 · 8 · 14 · 9 | ×1.16 | ×1.26 | 90 tuần |
| Kỳ Nhông Lửa | ★ Thường | Rồng / bò sát | 💪 Sức mạnh | 15 · 10 · 9 · 8 · 8 | ×1.26 | ×1.32 | 90 tuần |
| Heo Than | ★ Thường | Tròn | 💪 Sức mạnh | 13 · 10 · 9 · 9 · 9 | ×1.32 | ×1.20 | 90 tuần |
| Lân Con | ★★ Hiếm | Bốn chân | ✨ Duyên dáng | 13 · 11 · 11 · 15 · 10 | ×1.16 | ×1.32 | 94 tuần |
| Rồng Lửa Nhí | ★★ Hiếm | Rồng / bò sát | 💪 Sức mạnh | 19 · 12 · 10 · 10 · 9 | ×1.26 | ×1.38 | 94 tuần |
| Chim Ưng Lửa | ★★ Hiếm | Chim | 🏃 Nhanh nhẹn | 12 · 17 · 10 · 10 · 10 | ×1.21 | ×1.38 | 94 tuần |
| Ngựa Lửa | ★★★ Quý | Bốn chân | 🏃 Nhanh nhẹn | 15 · 21 · 13 · 11 · 12 | ×1.21 | ×1.44 | 98 tuần |
| Chu Tước | ★★★★ Huyền thoại | Chim | ✨ Duyên dáng | 18 · 15 · 15 · 22 · 16 | ×1.16 | ×1.44 | 102 tuần |

**⛰️ Hành Thổ**

| Loài | Độ hiếm | Dáng | Sở trường | Kỹ năng khởi đầu (💪🏃🧠✨🖐️) | Hao no bụng | Hồi năng lượng | Tuổi thọ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Chuột Chũi | ★ Thường | Tròn | 💪 Sức mạnh | 15 · 9 · 10 · 7 · 9 | ×0.72 | ×0.95 | 98 tuần |
| Heo Đất | ★ Thường | Tròn | 🖐️ Khéo tay | 11 · 8 · 7 · 9 · 15 | ×0.72 | ×1.00 | 98 tuần |
| Nghé Đất | ★ Thường | Bốn chân | 💪 Sức mạnh | 15 · 9 · 8 · 9 · 9 | ×0.81 | ×1.00 | 98 tuần |
| Lạc Đà Nhí | ★ Thường | Bốn chân | 🏃 Nhanh nhẹn | 10 · 12 · 9 · 9 · 10 | ×0.68 | ×1.00 | 98 tuần |
| Chó Vàng | ★ Thường | Bốn chân | 🏃 Nhanh nhẹn | 9 · 14 · 8 · 10 · 9 | ×0.81 | ×1.05 | 98 tuần |
| Gấu Mật | ★★ Hiếm | Đứng hai chân | 💪 Sức mạnh | 16 · 11 · 12 · 9 · 12 | ×0.89 | ×0.95 | 102 tuần |
| Tê Giác Đá | ★★ Hiếm | Bốn chân | 💪 Sức mạnh | 16 · 11 · 11 · 9 · 13 | ×0.77 | ×0.95 | 102 tuần |
| Sóc Nấm | ★★ Hiếm | Đứng hai chân | 🖐️ Khéo tay | 13 · 11 · 9 · 11 · 17 | ×0.77 | ×1.00 | 102 tuần |
| Kỳ Lân Vàng | ★★★ Quý | Bốn chân | ✨ Duyên dáng | 16 · 11 · 13 · 17 · 15 | ×0.77 | ×1.05 | 106 tuần |
| Hoàng Long | ★★★★ Huyền thoại | Rồng / bò sát | 🧠 Thông minh | 17 · 16 · 23 · 14 · 15 | ×0.81 | ×1.10 | 110 tuần |

## 6. Đồ đeo, vật dụng và quà đồng bộ

- **Đồ đeo:** 17 món trong bản mẫu, chia 4 khe, mỗi món một hành:
  - 🪙 Kim: vương miện, kính tròn, vòng chuông, cánh thiên thần
  - 🌿 Mộc: hoa cài tóc, vòng lá, khăn lá
  - 💧 Thủy: mũ quý ông, kính râm, chuỗi ngọc trai
  - 🔥 Hỏa: nơ hồng, mũ nồi đỏ, khăn quàng đỏ, cánh rồng
  - ⛰️ Thổ: nón lá, nơ cổ nâu, áo choàng
  - Cần vẽ thêm cho đủ bộ 4 khe mỗi hành, ví dụ kính lá cho Mộc, cánh nước cho Thủy, kính đá cho Thổ.
- **Vật dụng và quà:** đồ ăn, đồ chăm sóc, đồ chơi trong Siêu thị đang là emoji. Đề xuất vẽ lại bằng cùng bộ vẽ (lưới pixel, viền, màu), mỗi món ghi hành, để túi đồ, siêu thị và lúc tặng quà ở công viên cùng một phong cách. Lúc cho ăn, món ăn bay vào tay bé (điểm neo tay), không còn bay vào giữa màn hình.
- **Hiển thị khắp game:** cùng một hàm vẽ cho Nhà, công viên, thăm nhà bạn, bảng xếp hạng, Đồi Sao. Nhờ đó người khác thấy đúng bộ đồ bé đang mặc.

## 7. Cách người chơi có pet (đề xuất, cần chốt)

- **Bé đầu tiên:** chọn hành, nhận một bé Thường ngẫu nhiên của hành đó (miễn phí).
- **Trứng ngũ hành:** bán ở Siêu thị (khoảng 600 xu), hoặc làm phần thưởng nhiệm vụ tuần, dự án Hội, sự kiện. Nở sau 1 ngày thật, ra một loài của hành đã chọn với tỉ lệ 75% Thường, 20% Hiếm, 4% Quý, 1% Huyền thoại.
- **Không bán bé:** pet không bán ở Chợ Phiên, để tránh mua bán Huyền thoại bằng tài khoản phụ.

## 8. Đưa vào game và chuyển dữ liệu

- Bảng `pets` thêm cột: `element`, `species` (mã loài mới, Boba giữ `boba`), `avg_health` (sức khỏe trung bình để tính tuổi thọ), `died_at`.
- Bảng mới `pet_wear (pet_id, slot, item_id)` thay cho cột `accessory`. Đồ đang đeo chuyển sang khe tương ứng.
- Giai đoạn tuổi đổi từ 5 lên 6 (thêm Thanh niên 21–40 tuần, Trưởng thành dời tới 40, Lão làng dời tới 70). Bé đang ở Trưởng thành hay Lão làng sẽ tự chuyển theo mốc mới.
- Phía server: luật thuần trong `server/rules/` đọc `public/js/shared/pets.js`, giống mini-game. Mọi hệ số ngũ hành và giai đoạn đều qua mô phỏng kinh tế trước khi chốt.
- Phía client: `createPetFigure` dùng `rig.js` để dựng spritesheet của bé (kèm đồ đang đeo) một lần, rồi dùng lại lớp `Sprite` hiện có.

**Lộ trình đề xuất (chen trước giai đoạn 3 bất động sản):**

| Bước | Nội dung |
| --- | --- |
| **2.5A. Hình mới** ✅ | Nối bộ khung vào Nhà, công viên, thăm nhà; 4 khe đồ đeo; vẽ lại đồ trong Siêu thị; Boba tự dò điểm neo |
| **2.5B. Ngũ hành** ✅ | Hành và số liệu 50 loài vào luật chơi; hợp mệnh, đồ ăn có hành, vận khí ngày; trứng ngũ hành |
| **2.5C. Vòng đời** ✅ | 6 giai đoạn với luật riêng; lương thâm niên; tuổi thọ, báo trước, Đồi Sao, kỷ vật, phí mở lại ô |

## 9. Cần bạn chốt

1. Giữ Boba làm khách mời, hay đổi hẳn sang 50 loài mới?
2. Cách có pet: trứng ngẫu nhiên theo hành như mục 7, hay cho chọn thẳng loài?
3. Tuổi thọ khoảng 3–4 tháng chơi thật có hợp không? Phí mở lại ô 3.000 xu (gấp 15 lần nhận nuôi) có quá nặng không?
4. Khi bé mất có nhận kỷ vật cho bé sau không, hay để mất trắng cho "đời" hơn?

## 10. Nhật ký triển khai

### Bước 2.5A

- **Đã làm:**
  - Nhà, công viên, thăm nhà bạn, bảng vàng và màn nhận nuôi đều vẽ bé bằng bộ khung, đúng dáng theo tuổi. Đồ đang đeo vẽ thẳng vào từng khung hình nên đi theo người khi nhảy, chạy, vẫy tay.
  - Tủ đồ 4 khe (đầu, mặt, cổ, lưng), ghi "Hợp mệnh" hay "Kỵ mệnh" theo hành. Siêu thị có 17 món đồ đeo (thêm 12 món mới).
  - Đồ ăn, đồ chăm sóc, đồ chơi vẽ lại bằng pixel cùng phong cách; đồ đeo dùng chính hình vẽ lên người.
  - Giai đoạn tuổi phía server thành 6 (thêm Thanh niên 21–40 tuần; Trưởng thành từ 40, Lão làng từ 70 tuần). Luật chơi theo giai đoạn chưa đổi.
- **Chốt tạm, cần bạn xác nhận ở mục 9:**
  - Giữ Boba làm khách mời hành Thủy.
  - Màn nhận nuôi mở Boba và 25 loài Thường. Loài Hiếm, Quý, Huyền thoại chờ trứng ngũ hành (2.5B); server từ chối nhận nuôi trực tiếp.
- **Khác thiết kế:**
  - Boba tự dò điểm neo trên ảnh: mũ, kính, cánh theo đúng từng khung. Riêng **đồ ở cổ vẽ khuất sau người**, vì Boba luôn ôm cốc trà sữa ngang cổ: đặt trước thì che cốc hoặc miệng. Tủ đồ của bé khách mời có ghi chú việc này.
  - Kỹ năng khởi đầu của bé mới vẫn bốc ngẫu nhiên như cũ; số liệu riêng của từng loài (mục 5) áp dụng ở bước 2.5B.
- **Dữ liệu:** bảng mới `pet_wear`; bước chuyển `wear_v1` đưa phụ kiện cũ vào khe tương ứng. Cột `pets.accessory` để lại cho dữ liệu cũ, không còn dùng.
- **API đổi:** `POST /pets/:id/equip`:
  - `{ itemId }` đeo món vào khe của nó.
  - `{ slot }` tháo khe đó.
  - Không gửi gì thì tháo hết.

  Thông tin bé (`/me`, công viên, bạn bè, bảng vàng) trả `wear: { head, face, neck, back }` và `element` thay cho `accessory`.

### Bước 2.5B

- **Số liệu loài vào luật chơi:**
  - Bé mới (nhận nuôi hoặc nở từ trứng) có kỹ năng khởi đầu theo loài.
  - Kỹ năng lên nhanh theo hệ số của loài: khi đi làm, trực quầy, đứng máy, đi học, chơi mini-game.
  - Hao no bụng, hồi năng lượng, hao vui vẻ, hao sạch sẽ, hồi sức khỏe, khả năng ốm đều theo hệ số của loài và hành.
- **Hợp mệnh:**
  - Mỗi món đồ đang đeo cộng vào tốc độ lên kỹ năng: tương sinh +10%, cùng hành +5%, kỵ mệnh −5% (chậm nhất là một nửa tốc độ thường).
  - Đủ 4 khe cùng một hành thì +5% lương ca làm, và có sao lấp lánh màu hành quanh bé.
  - Vẽ thêm 5 món cho đủ bộ: Kính lá và Cánh bướm (Mộc), Áo choàng sóng (Thủy), Kính tim (Hỏa), Kính gọng gỗ (Thổ). Tổng 22 món.
- **Đồ ăn có hành:**
  - Trà sữa là Mộc; cá và sushi là Thủy; cơm nắm là Thổ; bánh kem là Hỏa; nước tăng lực và vitamin là Kim; tắm bong bóng là Thủy.
  - Món nấu cũng có hành.
  - Ăn món hợp mệnh (cùng hành hoặc tương sinh) được thêm 20% XP. Hộp chọn món ghi rõ món nào được thưởng.
- **Vận khí ngày:**
  - Mỗi ngày (giờ Việt Nam) một hành vượng, xoay theo vòng tương sinh Mộc → Hỏa → Thổ → Kim → Thủy.
  - Bé hành đó được +10% XP mọi hoạt động và +10% lương ca làm.
  - Bản đồ phố báo hành vượng hôm nay; màn Nhà gắn huy hiệu cho bé đang vượng.
- **Lợi thế làm ăn theo hành:**
  - Kim: xưởng thêm 10% mẻ khi bé Kim đứng máy; nấu ăn như có thêm 15 Khéo tay.
  - Mộc: bé chính hành Mộc thì thu hoạch thêm 15%.
  - Thủy: quầy có bé Thủy trực thì thêm 5% khách.
  - Hỏa: nghề dùng Sức mạnh thêm 5% lương.
  - Thổ: đói chậm, ít ốm (nằm trong hệ số chỉ số).
- **Trứng ngũ hành:**
  - Mỗi hành một loại trứng, bán ở Siêu thị 600 xu (theo chỉ số giá), cần bé cấp 3.
  - Ấp 24 giờ. Loài được bốc ngay lúc bắt đầu ấp (75% Thường, 20% Hiếm, 4% Quý, 1% Huyền thoại), để ấp xong không bốc lại được.
  - Trứng đang ấp giữ một ô nuôi.
  - Nở thì đặt tên, bé nhận kỹ năng theo loài.
  - Loài Hiếm, Quý, Huyền thoại chỉ có từ trứng.
  - Trứng là đồ dùng một lần như đồ thường, bán lại được ở Chợ Phiên. Loài chưa bốc khi trứng còn trong túi, nên không mua bán được Huyền thoại.
- **Loài lạ không có hành:** bé thuộc loài không có trong danh sách (khách mời Petdex chưa gán hành) có số liệu trung tính và không hưởng ngũ hành. Các test cũ dùng loài lạ để giữ nguyên con số; luật ngũ hành có test riêng.
- **Mô phỏng 45 bot × 30 ngày** (bot nuôi xoay vòng 25 loài Thường, so với loài trung tính):
  - Lương trung bình mỗi bot mỗi ngày 184 xu (trung tính 178); tài sản ròng trung bình cao hơn khoảng 3%.
  - Lượt khám bệnh 34 (trung tính 40).
  - Sổ cái khớp, không ai âm tiền.
  - Ngũ hành tạo khác biệt nhỏ, không làm vỡ cân bằng.
- **API mới:**
  - `POST /eggs/incubate { itemId }`: đem trứng đi ấp.
  - `POST /eggs/:id/hatch { name }`: cho trứng nở.
  - `/me` có thêm `eggs` (trứng đang ấp) và `fortune` (hành vượng hôm nay).

### Bước 2.5C

- **Luật theo giai đoạn** (hệ số ở `LIFE_STAGES` trong `public/js/shared/pets.js`):
  - **Trưởng thành là mốc trung tính:** hệ số ăn, XP, học, lương đều bằng 1. Thiết kế cũ để Trưởng thành học và lên XP chậm hơn chút; mình bỏ, để mốc so sánh rõ ràng.
  - **Sơ sinh:** XP ×1,5, ốm gấp đôi, chưa đi học, chưa đi làm.
  - **Nhí nhố:** học nhanh hơn 30%, làm tối đa 2 giờ/ngày, lương nghề 60%.
  - **Thiếu niên:** vui vẻ tụt nhanh hơn 30%, làm tối đa 4 giờ/ngày, lương 85%.
  - **Thanh niên:** làm đủ 8 giờ, no bụng hao nhanh hơn 30%.
  - **Trưởng thành:** ít ốm nhất. Lương thâm niên +1% cho mỗi 10 giờ đã làm ở nghề, tối đa +30%.
  - **Lão làng:** ốm gấp đôi, hồi năng lượng chậm hơn 20%, làm tối đa 4 giờ/ngày, giữ lương thâm niên, XP ×0,7.
  - Giới hạn giờ áp cho mọi ca (nghề, quầy, xưởng). Hệ số lương theo tuổi và thâm niên chỉ áp cho lương nghề; lương làm thuê ở quầy và xưởng do chủ đặt.
- **Tuổi thọ:**
  - Mỗi nửa đêm ghi sức khỏe vào trung bình cả đời.
  - Tuổi thọ = 90 tuần + độ hiếm (tới +12) + Thổ (+8) + phần chăm sóc (từ −10 tới +20 tuần theo sức khỏe trung bình).
  - Còn 7 tuần thì màn Nhà báo trước.
- **Về với sao trời:**
  - Đêm bé hết tuổi thọ (mà không đang dở ca làm), bé lên Đồi Sao.
  - Lương các ca chưa nhận vẫn trả về ví chủ.
  - Bia ghi tên, loài, hành, cấp, số tuần sống, bộ đồ lúc cuối, kỹ năng.
  - Báo Trân Châu đưa tin; màn Nhà báo trong 3 ngày.
- **Đồi Sao:** tab mới trong Bảng vàng, xem bia của mọi người chơi; bé được vẽ ở dáng lão làng với bộ đồ lúc cuối.
- **Kỷ vật:** bé nuôi kế tiếp (nhận nuôi hoặc nở từ trứng) được +5 vào kỹ năng sở trường của bé cũ. Loài lạ thì lấy kỹ năng cao nhất của bé.
- **Ô tưởng niệm:**
  - Ô của bé mất bị khóa; nhận nuôi và ấp trứng đều tính ô khóa vào giới hạn 4.
  - Mở lại tốn 3.000 xu × chỉ số giá (khoản chi `slot_reopen`), qua nút 🕯️ trên thanh chọn bé.
  - Nếu đó là bé cuối cùng thì không khóa ô, mà tặng một trứng Thường cùng hành, nở sau 3 ngày.
- **Dữ liệu:**
  - Bảng `memorials`.
  - Cột `pets.health_avg`, `pets.health_days`, `users.locked_slots`.
  - Bé mất thì xóa khỏi bảng `pets` (kỹ năng, nghề, ca làm, đồ đeo xóa theo bằng khóa ngoại); mọi thông tin cần nhớ nằm ở bia.
- **API mới:**
  - `GET /memorials?scope=mine|all`
  - `POST /slots/reopen`
  - `/me` có thêm `slots` (tối đa, đang dùng, còn trống, ô khóa, giá mở lại) và `memorials` (bé mất trong 3 ngày).
  - Thông tin bé có thêm `life` (tuổi thọ, số tuần còn lại, có báo trước không).
- **Test và mô phỏng:**
  - Bé thử nghiệm trong test cũ ở tuổi Trưởng thành (mốc trung tính); test mới cho giới hạn giờ, lương theo tuổi, thâm niên, mất, kỷ vật, ô tưởng niệm, trứng tưởng niệm.
  - Bot mô phỏng bắt đầu ở 30 tuần. Lương trung bình 205 xu/bot/ngày (có thâm niên), sổ cái khớp.

### Boba vẽ bằng bộ khung

- **Linh vật:** Boba thành linh vật của Phố Trân Châu, vẽ bằng bộ khung như 50 loài.
  - Dữ liệu ở `MASCOTS` trong `public/js/shared/pets.js`. Boba không tính vào bộ sưu tập 50 loài ngũ hành.
  - Vẫn là hành Thủy, độ hiếm Thường, sở trường Khéo tay, số liệu như trước.
- **Giữ mã `boba`:** các bé Boba đang nuôi tự đổi sang hình mới, không cần chuyển dữ liệu. Đồ đeo ở cổ giờ hiện bình thường, nằm sau cốc.
- **Nét riêng:** ôm cốc trà sữa trước bụng.
  - Cốc có nắp trắng, trà caramel, trân châu ở đáy. Ống hút hồng nối từ nắp lên miệng.
  - Bé sơ sinh và nhí nhố ôm cốc nhỏ.
  - Tay nào giơ lên (vẫy tay, nhảy) thì rời cốc.
- **Nhẹ hơn:** trình duyệt không tải ảnh Petdex 2,4 MB nữa.
  - Đã xóa ảnh cũ ở `public/pets/boba/`. Muốn có lại thì cài bằng `npx petdex install boba` rồi `npm run import-pets`; game vẫn ưu tiên bản vẽ bằng bộ khung vì trùng mã.
  - Cơ chế khách mời Petdex vẫn giữ cho loài khác nếu cài thêm.

### Hào quang cho bé quý hiếm

- **Ai có hào quang:** bé Quý ★★★ và Huyền thoại ★★★★, để nhìn là nhận ra. Bé Thường, bé Hiếm và linh vật Boba không có.
  - **Quý:** vầng sáng tím quanh người, đốm sáng tím dưới chân, 3 hạt sáng bay lên.
  - **Huyền thoại:** vầng sáng vàng kim đậm hơn, đốm sáng vàng dưới chân, 5 hạt sáng bay lên.
- **Cách vẽ:** nằm trong bộ khung (`drawAura`, `drawMotes` trong `public/js/rig.js`), nên hiện ở mọi nơi có bé: Nhà, công viên, thăm nhà, Bảng vàng, Đồi Sao.
  - Vầng sáng vẽ sau lưng bé và sau đồ ở lưng, lốm đốm kiểu pixel. To nhỏ theo nhịp khung hình như đang thở.
  - Hạt sáng vẽ trước mặt, bay lên dần qua từng khung hình.
- **Xưởng tạo hình** có thêm bộ lọc theo độ hiếm, và mở thẳng được bằng địa chỉ, ví dụ `/pet-lab.html?rarity=hiem&stage=adult&wear=0`.

