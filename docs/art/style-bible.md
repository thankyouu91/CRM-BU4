# Pet Farm: Style bible 16-bit (Phase 0)

> Bản chép từ style bible Phase 0 (đã duyệt). Trong repo: tài sản chạy của phố ở `public/ta-tua/game/assets/town/` (atlas WebP + `town.json`), dựng lại bằng `python3 -I scripts/art/build-town.py [thư-mục-scratch]`; nguồn gốc từng tài sản ở `docs/art/asset-manifest.json`. Ảnh gốc PNG và các script `scripts/*.py` nói tới dưới đây nằm trong thư mục làm việc của nhóm vẽ, không nằm trong `public/`.


Phạm vi: thay toàn bộ hình vẽ của thị trấn sang phong cách RPG nhìn từ trên xuống, 16-bit. Lối chơi giữ nguyên: người chơi vẫn chạm vào tòa nhà để vào khu đó (hướng "A").
Tài liệu này đi kèm `palette.json`, `palette.png`, `asset-manifest.json`, `contact-sheet.png`, phố mẫu `slice-*.png` và `slice-anim.gif`. Các script nằm trong `scripts/`.

---

## 1. Bảng màu khóa (48 màu)

Nguồn gốc của bảng màu: các token trong `:root` của `css/style.css` (bg, line, tea, pink, mint, gold, sky…) và bộ icon `set-samples.js` (viền `#2e1d14`, vàng `#f4c24f/#d79c1c`, cỏ `#6dbb5a/#4e9a45`, mái `#e86f6f`). Từ đó dựng thêm các dải màu (ramp) 3 đến 6 bậc cho từng chất liệu.

| Nhóm | Hex |
|---|---|
| Mực & bóng | `#2e1d14` (viền) `#3d2a1f` `#4a3326` |
| Cỏ & lá | `#2f5a3a` `#3e7a3f` `#4e9a45` `#6dbb5a` `#8fcf6a` `#c4e89a` |
| Đất & đường | `#7a4e2c` `#9b6238` `#c8915f` `#dcb07c` `#ecd2a2` |
| Nước | `#2f6f9a` `#3f8fc0` `#58b9d6` `#8fd0e8` `#bfe3f2` `#eef8fb` |
| Đá (xám ấm) | `#6e6660` `#9c948a` `#c4bcb0` |
| Gỗ | `#5c3a24` `#6e2e24` `#8c3f2a` `#8a5a34` `#b87d4b` |
| Mái | `#a84848` `#d65f5f` `#d9708a` `#f4a3b4` `#ffd1dc` |
| Tường kem | `#dcc0a0` `#ecd8bf` `#fbf1e3` `#fffaf3` |
| Da | `#c88a62` `#f2c49b` |
| Điểm nhấn vải | `#2f7f73` `#4fae93` `#8fd3bf` `#d79c1c` `#f4c24f` `#fff3c4` `#f39b4a` `#b4643a` `#e84a5f` |

Quy tắc:
- Mọi điểm ảnh đục của tài sản xuất xưởng phải nằm trong `palette.json`. Kiểm tra bằng `scripts/audit.py`: phải ra `off-palette=0` và `semi-alpha=0`.
- Ngoại lệ duy nhất là lớp bóng đổ trong suốt, vẽ lúc chạy (runtime), không nằm trong sprite.
- Muốn thêm màu thì phải bỏ một màu khác: giữ tối đa 48 màu và ghi lại vào mục 8.

## 2. Lưới và tỉ lệ

- **Ô (tile):** 16×16 px. Đơn vị bản đồ là ô.
- **Tỉ lệ hiển thị:** 3× trên máy tính, 2× trên điện thoại (< 768 px). Chỉ dùng số nguyên.
  - Vẽ thế giới lên canvas ở 1× rồi phóng bằng CSS `image-rendering: pixelated`. Cách này giữ bóng và mép sắc nét.
- **Ngoại lệ: bản đồ đất gia tộc** (chủ game duyệt 2026-10-31). Tranh 702 × 332 điểm ảnh, xem ở 1×, 2×, 3× nguyên lần (khối cuộn bù zoom 0,9 của game như phố).
  - Máy tính mặc định **1×**: thấy đủ 200 lô một lúc; 2× và 3× bằng nút + / −.
  - Điện thoại (≤ 720 px) mặc định **2×**: ô chạm 64 × 74 điểm, mở quanh lô của gia tộc mình (không có thì E10), "Xem nhanh" mở sẵn.
  - Lý do: bản đồ là trang để chọn lô nên cần thấy toàn cảnh; mức 3× vẫn có và đúng cỡ điểm ảnh của phố 16-bit.
- **Góc nhìn: `low top-down` (~20°, kiểu 3/4 RPG) cho mọi thứ.** Lý do:
  - Mặt tiền nhà (cửa, mái hiên, cột) nhìn thấy được. Đó là thứ giúp người chơi nhận ra Siêu thị hay Ngân hàng và có chỗ để chạm.
  - Đây là góc mặc định của `create_character`, và pro tileset cũng hỗ trợ.
  - Tileset standard luôn vẽ `high top-down`. Vì vậy chỉ dùng nó cho mặt đất phẳng (đá lát, đất); bờ và vách thì dùng pro ở `low top-down`.
- **Nhân vật:** khung 48×48, người cao khoảng 44 px (≈ 2,75 ô).
  - Khung đi bộ lớn lên 64×64 (skeleton-v3).
  - **Neo ở chân, giữa đáy**, tính theo bbox của khung 0, không theo khung hình.
- **Tòa nhà (footprint):**
  - Khung 128×128 (+1 px đệm cho viền = 130). Phần nhìn thấy rộng 96 đến 100 px, cao 100 đến 115 px.
  - Chân nhà chiếm **6 ô ngang × 2 ô sâu**.
  - Phía trước có 1 ô sân cho biển gỗ, cùng lối đi đất rộng 2 ô. Cửa nằm giữa một cặp cột ô.
  - Mỗi nhà chiếm một suất 7 ô, tính cả 1 ô khoảng cách.
  - Công trình lớn (Tòa thị chính, Đấu trường) dùng khung 160 đến 192 px, tức 9 đến 10 ô.
- **Đạo cụ:** 32×32 (thùng), 48×32 (ghế, bồn hoa, rào, biển), 32×64 (đèn), 64×64 (cây).
- **Thứ tự vẽ (depth):** sắp theo y của chân.

## 3. Ánh sáng, viền, bóng

- **Ánh sáng từ trên-trái.** Mặt phải và đáy tối hơn, đúng như bộ icon hiện có.
- **Viền: viền ngoài thống nhất 1 px `#2e1d14`** cho tòa nhà, đạo cụ và nhân vật.
  - Script `remap.py --outline` áp viền này ở bước hậu kỳ: mép đã tối thì đổi sang `#2e1d14`, mép sáng thì thêm 1 px viền ra ngoài.
  - Nét bên trong là "selective": dùng bậc tối của chính dải màu đó, không dùng đen.
  - Địa hình không có viền.
  - Vì sao không tin prompt: cùng một prompt mà PixelLab trả về nhà có viền, nhà không viền và nhà viền mảnh. Hậu kỳ mới làm cả bộ đồng nhất.
- **Bóng đổ:** `#2e1d14` với độ mờ **28 %**.
  - Hình elip pixel cạnh cứng, vẽ ở 1×, rộng gần bằng vật, cao 2 đến 4 px, lệch +2 px sang phải.
  - Vẽ dưới vật, không nướng (bake) vào sprite.
- **Nền tối:** viền `#2e1d14` gần như biến mất trên nền tối (xem contact sheet). Game dùng nền kem nên không sao. Nếu sau này có chế độ tối thì cần một tấm nền sáng dưới sprite.

## 4. Mẫu prompt (PixelLab)

Không bao giờ đưa vào prompt tên game, studio, thương hiệu, nhân vật hay họa sĩ khác. Không yêu cầu chữ.

Đuôi chung `TAIL` = `, chunky simple shapes, soft light from top-left, dark brown outline`

| Loại | Công cụ / mode | Tham số chuẩn | Chi phí đo được |
|---|---|---|---|
| Địa hình chính / bờ nước | `create_topdown_tileset` mode=`pro` | tile 16, view `low top-down`, `palette` = tập con của palette.json, detail medium, shading basic, transition 0 (phẳng) hoặc 0.25 + step_slope 0.6 (bờ), roundness 0.85 đến 1 | **15** |
| Địa hình phẳng phụ | `create_topdown_tileset` mode=`standard` | xâu chuỗi `lower_base_tile_id`, shape_style `square` cho đá lát; remap palette sau | **1** |
| Tòa nhà | `create_map_object` (basic) | 128×128, view `low top-down`, outline `single color outline`, shading `medium`, detail `medium` | **1** |
| Đạo cụ | `create_map_object` (basic) | 32 đến 64 px, cùng tham số | **1** |
| NPC | `create_character` mode=`v3` | size 48, view `low top-down`, outline `single color outline` (8 hướng) | **2** |
| Đi bộ NPC | `animate_character` mode=`skeleton-v3`, `template_animation_id=walking` | mỗi lần 1 đến 4 hướng | **3 / hướng** |
| Hoạt cảnh môi trường | `create_map_object` + `animate_image` (64×64, 8 khung) | `no_background=true` | **1 + 1** |

Mẫu (thay phần `{…}`):

- **Tòa nhà:** `cute cozy small village {loại} building, {chất liệu/màu} walls, {màu} {kiểu} roof, {một chi tiết nhận diện: awning sọc / cột + huy hiệu xu / ống khói…}, {cửa}, front facade facing the viewer` + TAIL + `, no text, no letters`
  - Mỗi nhà một màu mái khác nhau, lấy từ nhóm Mái hoặc nhóm Điểm nhấn.
  - Tường luôn là kem `#fff3c4` hoặc `#fbf1e3`.
- **Đạo cụ:** `cute cozy village {đồ vật}, {chất liệu + màu}` + TAIL
- **Biển gỗ:** dùng chung một sprite biển trống. Nhãn tiếng Việt là HTML.
- **Tileset pro:** lower/upper mô tả chất liệu, thêm "cozy village". Ví dụ grass: `soft fresh green meadow grass, short tufts, a few tiny pale flowers, cozy village lawn`.
- **NPC:** `cute friendly {tuổi/giới} villager {nghề}, {tóc}, {áo màu từ nhóm Điểm nhấn}, {tạp dề/quần}, little brown shoes, warm cozy farm town style, chunky readable shapes, dark brown outline`
- **Hoạt cảnh:** `{chuyển động}, looping, the {vật} itself stays perfectly still`. Phát tới-lui (ping-pong) ở 8 đến 10 fps.
- **Không dùng:**
  - `mode="pro"` cho nhân vật hoặc vật (tốn 10 đến 25 mỗi cái);
  - `create_1_direction_object` (tốn 10+);
  - `confirm_cost=true`.

## 5. Quy trình giữ nhất quán

### 5.1 Xâu chuỗi tileset (một ô Wang chỉ chứa được 2 địa hình)

1. **A** (pro): cỏ (lower) → đường đất (upper). Base tile **cỏ `9b437f4f-d61e-4005-8cd6-846421b7ad6f`**, **đất `54b5fd1d-74d2-42c8-a370-5934501d1dc4`**.
2. **B** (pro): nước (lower) → cỏ (upper, `upper_base_tile_id` = cỏ). Nước `eaf19d42-e8ce-4662-aa29-507805d76b7a`.
3. **C** (standard): đất (`lower_base_tile_id` = đất) → đá lát. Đá `d8d75ec1-e76e-4f65-806c-e0bfb835e772`.
4. Phase 1: mọi địa hình mới đều nối từ base tile cỏ hoặc đất, ví dụ cỏ→cát, cỏ→vườn hoa, đất→sàn gỗ.

Quy tắc ghép:
- Ô thuần lấy từ bộ đã tạo ra địa hình đó: cỏ và đất từ A, nước từ B, đá từ C. Ô chuyển tiếp lấy từ bộ chứa đúng cặp địa hình.
- Bố cục phải chừa ít nhất 1 đỉnh đệm, ví dụ đá không bao giờ chạm trực tiếp cỏ. Compositor báo danh sách `missing` nếu vi phạm.
- **Kiểm tra hướng Wang trước khi ghép:** ô `llll` phải trông như terrain *lower*.
  - Ánh xạ luôn suy ra từ mô tả lower/upper của chính bộ đó.
  - Cả 3 bộ ở đây đều ánh xạ thẳng, không bị đảo.
  - Lần thử trước bị "đảo" vì đã gán cỏ = upper trong khi cỏ là lower.

### 5.2 Khóa bảng màu

- **Pro tileset:** truyền `palette` (tập con của palette.json) cùng `palette_name`.
- **Standard tileset, vật thể, nhân vật, khung hoạt hình:** chạy `scripts/remap.py palette.json in.png out.png [--outline] [--tile]`.
  - Cách làm: màu gần nhất trong không gian OKLab, sắc độ (a, b) nặng gấp 2 độ sáng để vàng không thành xanh lá; ngưỡng alpha 128.
  - Miễn phí và cho kết quả lặp lại được.
  - Phương án trên mây là `reduce_colors` với `palette-strip.png` (0,1 lượt), nhưng cần URL tải lên.
- **Đổi màu theo vai trò (chỉ trong bảng):** `scripts/swap.py`. Đã dùng để:
  - nâng dải màu đất một bậc;
  - cho tường Nhà về cùng màu kem với Siêu thị và Ngân hàng;
  - đổi biển gỗ từ hồng sang gỗ.
- **Kết quả:** ô cỏ thuần của bộ A và bộ B **trùng từng điểm ảnh**. Lỗi cỏ olive so với cỏ xanh của lần thử trước đã hết.

### 5.3 Hoạt hình

1. Nhân vật gốc: `create_character` v3, 8 hướng.
2. Đi bộ: **`skeleton-v3` + `template_animation_id=walking`** (3 lượt/hướng). Mode này đặt khung xương lên chính nhân vật, không vẽ lại.
3. Đo độ lệch bằng `scripts/drift.py base.png frames…`. Ngưỡng đạt: |Δ chiều cao| ≤ 6 % và Δ RGB trung bình mỗi dải (đầu/thân/chân) ≤ 18.
   - **Template thường (1/hướng):** khung đông thấp hơn 7 % (41 so với 44 px), váy và tạp dề bị vẽ lại. Đây đúng là lỗi của lần thử trước, nên bị **loại**.
   - **skeleton-v3:** chiều cao 0 đến +2 %, Δ màu ≤ 15, nên **đạt**.
4. Hướng tây = lật ngang hướng đông. Mỗi nhân vật tiết kiệm được 3 lượt; dùng khi trang phục đối xứng.
5. Vật đứng yên (map object) không dùng được `animate_object`. Hoạt cảnh môi trường đi qua `animate_image`, sau đó remap từng khung cùng bảng màu.

## 6. Pipeline tài sản (đề xuất, chưa tạo trong repo)

```
public/ta-tua/game/assets/town/
  palette.json
  asset-manifest.json
  tiles/terrain.webp + terrain.json      # mọi bộ Wang trong một atlas; json: set, corners NW/NE/SW/SE, rect
  buildings/{place-id}.webp              # 1 file/nhà, id = PLACES.id (home, shop, bank…), tải lười theo vùng nhìn
  props/props.webp + props.json          # atlas đạo cụ, mỗi khung có anchor
  npc/{npc-id}.webp + .json              # hàng = hướng (S, E, N; W lật), cột = khung; cột 0 = đứng yên
  fx/{fx-id}.webp + .json                # đài phun nước, đèn lồng, khói…
```

- **Bản gốc** (PNG từ PixelLab, PNG đã remap) để ngoài `public/`, ví dụ `art/town-src/`, để không phải tải xuống client.
- **Tên file:** kebab-case theo dạng `{loại}-{id}[-{trạng thái}][-{hướng}]`. Loại gồm `bld`, `prop`, `npc`, `fx`, `tiles`. Khung trong atlas đặt tên `{anim}-{dir}-{i}`.
- **PNG → WebP:** chỉ dùng lossless, ví dụ `cwebp -lossless -z 9 -exact` hoặc sharp `lossless:true`. Không dùng lossy vì nó làm nhòe bảng màu. Alpha nhị phân.
- **Atlas:** đệm 1 px trong suốt giữa các khung; tile thì extrude 2 px để không lem mép. JSON dạng `{frames:{name:{x,y,w,h,ax,ay}}}`, trong đó (ax, ay) là điểm neo chân.
- **Ngân sách dung lượng:** ≤ 200 KB mỗi file, ≤ 400 KB cho cả thị trấn.
  - Đo thực tế lát mẫu này (39 hình, cả khung hoạt hình): PNG 58 KB, **WebP lossless 20 KB**.
  - Ước tính cả thị trấn (24 nhà, khoảng 30 đạo cụ, 6 NPC, 6 hoạt cảnh): **120 đến 160 KB**.
- **Hiển thị:**
  - Lớp canvas thế giới vẽ ở 1×, phóng 3× hoặc 2× bằng CSS.
  - Lớp HTML phủ lên trên chứa: chip tên (Baloo 2 800, nền `--surface`, viền `--line-strong`, bóng `0 3px 0`), huy hiệu (badge), và `<button aria-label>` phủ đúng bbox tòa nhà.
  - Vùng chạm đo được: 188×202 px trên điện thoại và khoảng 290×300 px trên máy tính, vượt xa mức tối thiểu 40 px. Có vòng focus-visible.
- **Schema `asset-manifest.json`** (xem file mẫu): mỗi tài sản có:
  - `id`, `role`, `path` (`#name` = khung trong atlas), `status` (planned / sample / approved / rejected);
  - `technical` (kích thước, neo, số khung, lọc nearest);
  - `visual_locks`;
  - **`provenance`**: `tool`, `mode`, `pixellab_id`, `prompt`, `params`, `created_at`, `generation_cost`, `postprocess[]`, `license`;
  - `verification`.
  - Bản bị loại vẫn ghi lại để chi phí cộng đúng.

## 7. Chi phí đo được và dự toán Phase 1

| Loại | Chi phí / cái | Ghi chú Phase 0 |
|---|---|---|
| Pro tileset | 15 | 2 bộ, không phải làm lại |
| Standard tileset | 1 | 1 bộ |
| Tòa nhà (map object) | 1 | 3/3 đạt ngay, chỉ cần hậu kỳ |
| Đạo cụ (map object) | 1 | 7 cái + 1 làm lại (rào) |
| Hoạt cảnh (object + animate_image) | 2 | đài phun nước làm lại 1 lần (+1) |
| NPC gốc v3 | 2 | |
| Đi bộ skeleton-v3 | 3 / hướng | template 1/hướng bị loại (2 lượt bỏ đi) |
| **Tổng Phase 0** | **55** | Trong đó 5 lượt là bản bị loại (≈ 9 %) |

Dự toán Phase 1 (21 nhà còn lại, cùng thư viện đạo cụ, NPC và hoạt cảnh), đã tính 50 % làm lại cho nhà và 30 % cho đạo cụ:

| Hạng mục | Lượt |
|---|---|
| Nhà: 21 × 1 × 1,5 | ≈ 32 |
| Đạo cụ: 25 × 1,3 | ≈ 33 |
| Địa hình thêm (1 pro + 3 standard) | ≈ 18 |
| 5 NPC mới × (2 + 3 hướng × 3) + hướng bắc cho NPC mẫu | ≈ 58 |
| 8 hoạt cảnh × 2 | ≈ 16 |
| Biến thể trạng thái nhà (khóa / có quà), tùy chọn, 24 × 1 | ≈ 24 |
| **Cộng** | **≈ 180** |
| **Cộng thêm 20 % dự phòng** | **≈ 220** |

Kế hoạch cũ ước 400 đến 500 lượt. **Đề xuất mức trần 300.**

## 8. Nhật ký tự rà soát (2 vòng)

**Vòng 1**
- Huy hiệu xu của Ngân hàng chuyển sang olive khi remap OKLab thường. Sửa: cho sắc độ nặng gấp 2.
- Mái mint thiếu bậc tối. Sửa: thêm `#2f7f73`.
- Tóc NPC bị xỉn. Sửa: thêm `#6e2e24`, `#8c3f2a`, `#b4643a`, và bỏ `#6b4a36`, `#ffdcbc`, `#e3ddd2`, `#7a6bb0` để giữ đủ 48 màu.
- Đá lát xám xanh lạnh. Sửa: chuyển sang dải xám ấm.
- Khung đi bộ template bị lệch. Sửa: chuyển sang skeleton-v3.

**Vòng 2**
- Đường đất quá tối và nhiễu so với UI kem. Sửa: nâng dải màu đất một bậc.
- Tường Nhà trắng lệch tông với hai nhà kia. Sửa: đưa về cùng màu kem.
- Rào bản 1 nhạt và nhiễu. Sửa: làm lại.
- Biển gỗ bị hồng. Sửa: đổi sang màu gỗ.
- Vòi đài phun nước bản 1 khó đọc. Sửa: làm lại thành đài 2 tầng.
- Đèn đè lên NPC và lên biển của Ngân hàng. Sửa: dời vị trí.
- Khung đi bộ lớn lên 64 px. Sửa: neo theo chân.

**Còn mở**
- Mép ao còn vuông vức vì lưới đỉnh thô. Phase 1 dùng mặt nạ ao hữu cơ, có thể vẽ tay bằng mảng đỉnh.
- Cỏ hơi "rộn" ở 3×. Nếu chủ game muốn dịu hơn, có thể đổi `#3e7a3f` → `#4e9a45` trong ô cỏ (không tốn lượt).
- Siêu thị (mái ngói có vân) chi tiết hơn Ngân hàng (mái phẳng). Hai nhà vẫn cùng một họ phong cách, nhưng nếu muốn khít hơn thì dùng `create_object_pro_flash` với `style_image` (5 đến 6 lượt/nhà). Đề xuất: chưa cần.
