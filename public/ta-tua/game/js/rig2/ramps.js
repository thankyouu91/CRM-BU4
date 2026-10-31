// Bảng dải màu của 51 loài (50 loài ngũ hành + linh vật Boba): MỘT bảng duy nhất. Chủ sở hữu: họa sĩ màu.
// Mỗi loài: main (lông thân, đầu, tai, chân), belly (bụng, mõm, mặt nạ, bàn chân), accent (điểm nhấn: mỏ, chân chim,
// hoa văn, mai rùa, mào), inner (lòng tai, mặc định 'pink'), limb (tay, chân của dáng biped và quad, mặc định = main;
// chỉ gấu trúc có tay chân khác màu thân). Giá trị là tên dải trong core.js RAMPS (5 bậc, toàn màu trong bảng 48 màu).
//
// Cách chọn (đã chạy một lần rồi chép cố định vào bảng, để họa sĩ sửa tay từng dòng):
//   nearestRamp(hex) = dải có bậc giữa gần màu loài nhất trong OKLab, độ sáng nặng gấp 2 và sắc độ (a, b) nặng gấp 3,
//   để giữ cả SẮC lẫn ĐỘ SÁNG của màu trong shared/pets.js (cánh cụt #3d4a6b là xanh đen, không phải xanh lam tươi).
//   Lưu ý: thân to tô chừng một nửa bằng bậc tối (bậc 1), nên lông trông tối hơn bậc giữa; dải có bậc tối gần màu viền
//   (#3d2a1f, #4a3326) làm bé thân to gần như đen. Luôn xem lại trên contact sheet (rig2-dirs.png) rồi sửa tay dòng đó.
// Ngoại lệ có chủ ý (ghi bên cạnh): bản mẫu pets-pilot đã được duyệt cho boba, meo_bac (mèo xám-trắng), tho_la.
// Loài mới chưa có dòng trong bảng thì tự chọn bằng nearestRamp() lúc chạy (không bao giờ lỗi).
import { RAMPS, oklab } from './core.js';

/** Dải có bậc giữa gần `hex` nhất (OKLab; ΔL × 2, Δa và Δb × 3). `pool`: danh sách tên dải được xét. */
export function nearestRamp(hex, pool = Object.keys(RAMPS)) {
  const [L, a, b] = oklab(hex);
  let best = null;
  let d0 = Infinity;
  for (const name of pool) {
    if (EXCLUDE.has(name)) continue;
    const [L2, a2, b2] = oklab(RAMPS[name][2]);
    const d = (2 * (L - L2)) ** 2 + (3 * (a - a2)) ** 2 + (3 * (b - b2)) ** 2;
    if (d < d0) {
      d0 = d;
      best = name;
    }
  }
  return best;
}
/** Dải chỉ dùng cho đúng loài của bản mẫu (không cho tự chọn). */
const EXCLUDE = new Set(['fur_blue']);

/**
 * id → { main, belly, accent, inner? }. Chú thích: màu gốc trong shared/pets.js [thân, bụng, điểm nhấn].
 */
export const SPECIES_RAMPS = {
  // ---- linh vật
  boba: { main: 'fur_brown', belly: 'cream', accent: 'pink' }, // #9c6a42 #f3dcb8 #ff8fb1 (bản mẫu; tự chọn bụng ra wheat)
  // ---- Kim: trắng, bạc, vàng kim
  meo_bac: { main: 'fur_silver', belly: 'white', accent: 'fur_silver' }, // #e6e4df #ffffff #9fb0c2 (bản mẫu: mèo xám-trắng; tự chọn ra white)
  chuot_chuong: { main: 'pearl', belly: 'white', accent: 'gold' }, // #cfd4dc #f6f3ec #f2c14e (tự chọn ra ice: xanh quá; fur_silver tối quá, L 0.75 so với 0.87)
  soc_dong: { main: 'tan', belly: 'wheat', accent: 'gold' }, // #c98c4e #f3dcb5 #f2c14e
  ga_vang: { main: 'gold', belly: 'butter', accent: 'orange' }, // #f6d365 #fff1b8 #e9883a
  te_te: { main: 'fur_silver', belly: 'snow', accent: 'slate' }, // #a9b6c4 #e4e8ec #6f7f91
  cu_anh_kim: { main: 'fur_silver', belly: 'white', accent: 'gold' }, // #c4bba9 #efe7d6 #f2c14e
  huou_pha_le: { main: 'snow', belly: 'white', accent: 'sky' }, // #dfe7ef #ffffff #8fd3f0 (hươu pha lê: trắng ánh băng)
  soi_bac: { main: 'fur_silver', belly: 'snow', accent: 'slate' }, // #b4bcc6 #eef1f4 #6b7787
  hac_bac: { main: 'pearl', belly: 'white', accent: 'red' }, // #f2f2ee #ffffff #e2493b
  bach_ho: { main: 'white', belly: 'pearl', accent: 'charcoal' }, // #f3f1ea #ffffff #4b4f5c (vằn tối)
  // ---- Mộc: xanh lá, nâu gỗ
  tho_la: { main: 'fur_green', belly: 'mint', accent: 'leaf' }, // #a8d97f #eef7dd #5fa04e (bản mẫu)
  ech_sen: { main: 'fur_green', belly: 'mint', accent: 'pink' }, // #7cc576 #e3f3c8 #f3a5c4
  khi_tre: { main: 'tan', belly: 'wheat', accent: 'fur_green' }, // #b48a5a #f1dcb8 #8fcf6a
  nhim_reu: { main: 'tan', belly: 'wheat', accent: 'grass' }, // #9a8a5e #efe2c2 #7fae5d (tự chọn ra stone: xám quá)
  cun_co: { main: 'sprout', belly: 'mint', accent: 'grass' }, // #c4e39a #f6fbe8 #6db35a
  gau_truc: { main: 'pearl', belly: 'white', accent: 'charcoal', limb: 'charcoal' }, // #f5f5f0 #ffffff #3b3b42 (tay chân, tai, mảng mắt đen)
  huou_reu: { main: 'tan', belly: 'wheat', accent: 'grass' }, // #b58a5e #f2e1c4 #7fae5d
  cao_la: { main: 'grass', belly: 'mint', accent: 'gold' }, // #7fbf6a #eef7dd #f4c45a
  rua_co_thu: { main: 'fur_green', belly: 'wheat', accent: 'fur_brown' }, // #9cc97a #efe6c5 #8a6a45 (mai nâu)
  thanh_long: { main: 'teal', belly: 'white', accent: 'lagoon' }, // #5fc79c #e6f7d9 #2f8f7a (aqua có bậc sáng gần trắng: rồng trông như phủ sương)
  // ---- Thủy: xanh nước, xanh đen
  rai_ca: { main: 'fur_brown', belly: 'wheat', accent: 'sky' }, // #a06e44 #f0d9b5 #5fb3e8
  canh_cut: { main: 'navy', belly: 'snow', accent: 'orange' }, // #3d4a6b #ffffff #f2a03d (sửa so với bản mẫu: xanh đen, không phải fur_blue)
  hai_cau: { main: 'fur_silver', belly: 'snow', accent: 'navy' }, // #9fb4c7 #e9f1f7 #5d7891 (tự chọn ra sky: xanh quá)
  ca_noc: { main: 'sky', belly: 'snow', accent: 'gold' }, // #9ad7f0 #f2fbff #f2c14e
  meo_mua: { main: 'sky', belly: 'snow', accent: 'navy' }, // #8fb2e0 #eef4fc #4f7cc4
  ky_giong: { main: 'pink', belly: 'blossom', accent: 'rose' }, // #f6b3c8 #fde4ec #e46f96
  rua_bien: { main: 'aqua', belly: 'white', accent: 'teal' }, // #7fc3b5 #eef6e6 #3f8f86
  vit_may: { main: 'ice', belly: 'pearl', accent: 'orange' }, // #bfe3f7 #ffffff #f2a03d
  ca_chep_rong: { main: 'white', belly: 'pearl', accent: 'orange' }, // #fbf6ee #ffffff #e9663f (flame: vây, đuôi ra nâu gỉ, không phải cam cá chép)
  huyen_vu: { main: 'fur_blue', belly: 'ice', accent: 'sky' }, // #4d6b86 #cfe2e8 #9fc9dc (tạm dùng fur_blue chờ D5: bậc tối nâu đen của 'navy' làm đầu, ngực gần đen, mất mặt)
  // ---- Hỏa: đỏ, cam, hồng
  cao_lua: { main: 'orange', belly: 'white', accent: 'flame' }, // #f08a4b #fff0dc #e2533b
  ga_trong: { main: 'orange', belly: 'butter', accent: 'red' }, // #f5a64a #ffe2b0 #e2493b
  gau_meo_do: { main: 'rust', belly: 'charcoal', accent: 'white' }, // #d9643a #4a302c #fff2e0 (flame: dải hồng ngang đầu)
  ky_nhong: { main: 'orange', belly: 'cream', accent: 'charcoal' }, // #f26b3a #ffd38a #4a302c (flame: dải hồng ngang đầu)
  heo_than: { main: 'piglet', belly: 'blossom', accent: 'flame' }, // #f29a7e #ffe0d2 #e2533b (salmon: bậc sáng màu đào, heo hai màu)
  lan_con: { main: 'gold', belly: 'butter', accent: 'red' }, // #f5c04a #fff3d0 #e2493b
  rong_lua: { main: 'scarlet', belly: 'cream', accent: 'maroon' }, // #e2533b #ffd08a #7a2e2a (flame: dải hồng ngang đầu)
  ung_lua: { main: 'vermilion', belly: 'gold', accent: 'maroon' }, // #c8402f #f5c04a #7a2e2a (brick: bậc sáng hồng)
  ngua_lua: { main: 'cream', belly: 'white', accent: 'flame' }, // #f6d4a6 #fff4e2 #f0663c
  chu_tuoc: { main: 'scarlet', belly: 'gold', accent: 'butter' }, // #e8403a #f8c25a #ffd75e (red: bậc sáng hồng)
  // ---- Thổ: vàng đất, nâu, đất nung
  chuot_chui: { main: 'taupe', belly: 'latte', accent: 'pink' }, // #7d6253 #d8bfa5 #f3a7b5 (slate: bậc tối #4a3326 sát màu viền, gần đen; stone: xám sáng quá, L 0.64 so với 0.52)
  heo_dat: { main: 'terracotta', belly: 'peach', accent: 'gold' }, // #d98a5f #f2c7a5 #f2c14e (tan: vàng quá, không ra đất nung)
  nghe_dat: { main: 'taupe', belly: 'latte', accent: 'white' }, // #8c7a6b #cdbba8 #efe6d8 (như chuot_chui: slate ra gần đen; stone ra xám trung tính, lẫn với te_giac_da)
  lac_da: { main: 'sand', belly: 'wheat', accent: 'tan' }, // #e2c18c #f7e7c8 #b98a52
  cho_vang: { main: 'sand', belly: 'wheat', accent: 'fur_brown' }, // #e0b061 #fbeac8 #a8743c
  gau_mat: { main: 'fur_brown', belly: 'sand', accent: 'gold' }, // #9c6b43 #e2c08f #f2b134
  te_giac_da: { main: 'stone', belly: 'wheat', accent: 'slate' }, // #9a948a #d9d3c7 #6e675e
  soc_nam: { main: 'tan', belly: 'wheat', accent: 'red' }, // #c98a5a #f3dcbc #e2493b
  ky_lan: { main: 'cream', belly: 'white', accent: 'tan' }, // #f2d58a #fff6dc #c9853f
  hoang_long: { main: 'gold', belly: 'butter', accent: 'tan' }, // #f2c14e #fff1c2 #c9853f
};

/** Dải màu của loài `sp` (dòng trong bảng, thiếu thì tự chọn). */
export function rampsOf(sp) {
  const row = SPECIES_RAMPS[sp.id];
  const [mainHex, belly, accent] = sp.colors ?? ['#9c6a42', '#f3dcb8', '#ff8fb1'];
  const main = row?.main ?? nearestRamp(mainHex);
  return {
    main,
    belly: row?.belly ?? nearestRamp(belly),
    accent: row?.accent ?? nearestRamp(accent),
    inner: row?.inner ?? 'pink',
    limb: row?.limb ?? main,
  };
}
