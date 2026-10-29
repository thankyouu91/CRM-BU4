// Dữ liệu pet ngũ hành dùng chung cho trình duyệt và server: hành, giai đoạn đời, 50 loài, đồ đeo.
// Chỉ có dữ liệu và hàm thuần, không đụng DOM, để server import được như shared/minigames.js.

export const SKILL_IDS = ['strength', 'agility', 'intellect', 'charm', 'craft'];

/**
 * Ngũ hành: màu, tương sinh (`feeds`: hành này nuôi hành nào), tương khắc (`beats`), và đặc điểm phát triển.
 * `skills`: hệ số tăng kỹ năng. `stats`: hệ số hao/hồi chỉ số (1 = như thường). `perk`: lợi thế khi làm ăn.
 */
export const ELEMENTS = {
  kim: {
    name: 'Kim', icon: '🪙', color: '#b8c2cc', accent: '#f2c14e', feeds: 'thuy', beats: 'moc',
    skills: { craft: 1.3, strength: 1.15 },
    stats: { hygiene: 0.85 },
    perk: 'Xưởng chạy thêm 10% mẻ, món nấu dễ ra loại Ngon',
    temper: 'Cứng cỏi, gọn gàng, ít bẩn',
  },
  moc: {
    name: 'Mộc', icon: '🌿', color: '#6dbb5a', accent: '#a8e07a', feeds: 'hoa', beats: 'tho',
    skills: { intellect: 1.3, charm: 1.1 },
    stats: { healthRegen: 1.3 },
    perk: 'Vườn thu hoạch thêm 15%',
    temper: 'Hiền, ham học, tự hồi sức khỏe nhanh',
  },
  thuy: {
    name: 'Thủy', icon: '💧', color: '#4f8fd6', accent: '#9fd8f0', feeds: 'moc', beats: 'hoa',
    skills: { charm: 1.3, agility: 1.15 },
    stats: { happiness: 0.85 },
    perk: 'Trực quầy hút thêm 5% khách',
    temper: 'Mềm mỏng, vui lâu, khéo giao tiếp',
  },
  hoa: {
    name: 'Hỏa', icon: '🔥', color: '#f0663c', accent: '#ffd75e', feeds: 'tho', beats: 'kim',
    skills: { strength: 1.3, agility: 1.1 },
    stats: { energyRegen: 1.2, fullness: 1.1 },
    perk: 'Ca làm sức lực được thêm 5% lương',
    temper: 'Sôi nổi, hồi sức nhanh nhưng mau đói',
  },
  tho: {
    name: 'Thổ', icon: '⛰️', color: '#c99a4b', accent: '#e6c88a', feeds: 'kim', beats: 'thuy',
    skills: { craft: 1.15, strength: 1.15 },
    stats: { fullness: 0.85, sickness: 0.6 },
    perk: 'Bền bỉ: ít ốm, sống lâu hơn các hành khác',
    temper: 'Điềm đạm, ăn ít, khỏe mạnh',
  },
};

/** Quan hệ của hành `item` (đồ dùng, đồ ăn, bạn chơi) với hành `pet`. */
export function relation(item, pet) {
  if (!ELEMENTS[item] || !ELEMENTS[pet]) return 'none';
  if (item === pet) return 'same';
  if (ELEMENTS[item].feeds === pet) return 'feeds'; // tương sinh: hợp mệnh nhất
  if (ELEMENTS[pet].feeds === item) return 'drains'; // pet nuôi hành kia: hao sức một chút
  if (ELEMENTS[item].beats === pet) return 'beats'; // tương khắc: kỵ mệnh
  return 'beaten';
}

export const RELATIONS = {
  feeds: { label: 'Tương sinh', short: 'Hợp mệnh', bonus: 0.1 },
  same: { label: 'Cùng hành', short: 'Hợp mệnh', bonus: 0.05 },
  drains: { label: 'Sinh xuất', short: 'Bình thường', bonus: 0 },
  beaten: { label: 'Mình khắc', short: 'Bình thường', bonus: 0 },
  beats: { label: 'Tương khắc', short: 'Kỵ mệnh', bonus: -0.05 },
  none: { label: '', short: '', bonus: 0 },
};

export const RARITIES = {
  thuong: { name: 'Thường', stars: 1, skillSum: 50, lifespan: 0, color: '#9b8a7a' },
  hiem: { name: 'Hiếm', stars: 2, skillSum: 60, lifespan: 4, color: '#4f8fd6' },
  quy: { name: 'Quý', stars: 3, skillSum: 72, lifespan: 8, color: '#a55fd0' },
  huyenthoai: { name: 'Huyền thoại', stars: 4, skillSum: 85, lifespan: 12, color: '#e0a21c' },
};

/**
 * 6 giai đoạn đời (1 ngày thật = 1 tuần tuổi), mỗi giai đoạn một dáng vẽ và luật riêng như đời người.
 * `look`: tỉ lệ đầu/thân/chân và cỡ hình cho bộ khung vẽ. Các hệ số còn lại dùng cho luật chơi.
 */
export const LIFE_STAGES = [
  {
    key: 'baby', name: 'Sơ sinh', fromWeek: 0,
    look: { scale: 0.62, head: 1.06, body: 0.72, leg: 0.5, eye: 1.25 },
    rules: { sickness: 2, xp: 1.5, work: 0, school: 0, spend: 0.8 },
    note: 'Chóng lớn nhưng dễ ốm; chưa đi học, chưa đi làm.',
  },
  {
    key: 'kid', name: 'Nhí nhố', fromWeek: 2,
    look: { scale: 0.74, head: 1.02, body: 0.82, leg: 0.7, eye: 1.15 },
    rules: { sickness: 1.4, xp: 1.25, work: 0.6, maxHours: 2, school: 1.3, spend: 0.9 },
    note: 'Học ở trường nhanh hơn 30%; chỉ làm việc nhẹ 2 giờ/ngày, lương 60%.',
  },
  {
    key: 'teen', name: 'Thiếu niên', fromWeek: 8,
    look: { scale: 0.86, head: 0.98, body: 0.92, leg: 0.9, eye: 1.05 },
    rules: { sickness: 1, xp: 1.1, work: 0.85, maxHours: 4, school: 1.15, spend: 1.1, moodDrop: 1.3 },
    note: 'Tuổi ẩm ương: vui vẻ tụt nhanh hơn 30%; làm bán thời gian 4 giờ/ngày, lương 85%.',
  },
  {
    key: 'young', name: 'Thanh niên', fromWeek: 21,
    look: { scale: 0.95, head: 0.95, body: 1, leg: 1, eye: 1 },
    rules: { sickness: 0.9, xp: 1, work: 1, maxHours: 8, school: 1, spend: 1.3 },
    note: 'Làm đủ 8 giờ, lương đủ; ăn tiêu nhiều: đồ ăn và đồ chơi hao nhanh hơn 30%.',
  },
  {
    key: 'adult', name: 'Trưởng thành', fromWeek: 40,
    look: { scale: 1, head: 0.92, body: 1.14, leg: 1, eye: 0.95 },
    // Mốc trung tính: các giai đoạn khác lệch so với giai đoạn này.
    rules: { sickness: 0.8, xp: 1, work: 1, maxHours: 8, school: 1, spend: 1, seniority: true },
    note: 'Sung sức nhất: ít ốm, lương tăng thêm theo thâm niên (số giờ đã làm ở nghề).',
  },
  {
    key: 'elder', name: 'Lão làng', fromWeek: 70,
    look: { scale: 0.97, head: 0.94, body: 1.1, leg: 0.8, eye: 0.85, elder: true },
    rules: { sickness: 2, xp: 0.7, work: 1, maxHours: 4, school: 0.7, spend: 1, seniority: true, energyRegen: 0.8 },
    note: 'Lương thâm niên vẫn cao nhưng chỉ làm 4 giờ/ngày; hay ốm, hồi sức chậm. Tới cuối đời thì bé về với sao trời.',
  },
];

export const stageAt = (weeks) => LIFE_STAGES.findLast((s) => weeks >= s.fromWeek);

/** Hằng số vòng đời: báo trước khi bé già yếu, phí mở lại ô tưởng niệm, trứng tưởng niệm, kỷ vật, thâm niên. */
export const LIFE = {
  warnWeeks: 7, // còn chừng này tuần thì báo trước
  reopenCost: 3000, // mở lại một ô tưởng niệm (nhân chỉ số giá), gấp 15 lần phí nhận nuôi
  memorialEggDays: 3, // bé cuối cùng mất thì được một trứng Thường, nở sau 3 ngày
  heirloom: 5, // kỷ vật: +5 vào kỹ năng sở trường của bé cũ cho bé kế tiếp
  seniorityPer10h: 0.01, // lương thâm niên: +1% mỗi 10 giờ đã làm ở nghề
  seniorityMax: 0.3,
};

/** Thưởng lương thâm niên theo số giờ đã làm ở nghề (chỉ áp dụng từ Trưởng thành). */
export const seniorityBonus = (hours) => Math.min(LIFE.seniorityMax, Math.floor(hours / 10) * LIFE.seniorityPer10h);

/** Tuổi thọ (tuần): nền 90, Thổ +8, độ hiếm cộng thêm, chăm tốt (sức khỏe trung bình cao) sống thêm tới 20 tuần. */
export function lifespanWeeks(species, avgHealth = 70) {
  const base = 90 + (species.element === 'tho' ? 8 : 0) + (RARITIES[species.rarity]?.lifespan ?? 0);
  return Math.round(base + Math.max(-10, Math.min(20, (avgHealth - 70) / 1.5)));
}

// ---------------------------------------------------------------- 50 loài

/**
 * `body`: dáng khung (biped đứng, quad bốn chân, round tròn, bird chim, serpent rồng/bò sát).
 * `ears`, `tail`, `face`, `pattern`, `feature`: bộ phận lắp lên khung. `colors`: [thân, bụng, điểm nhấn].
 * `fav`: kỹ năng sở trường. `appetite`/`stamina`: hệ số hao no bụng / hồi năng lượng riêng của loài.
 */
const S = (id, name, element, rarity, body, ears, tail, face, pattern, feature, colors, fav, appetite = 1, stamina = 1) => ({
  id, name, element, rarity, body, ears, tail, face, pattern, feature, colors, fav, appetite, stamina,
});

export const SPECIES = [
  // Kim: trắng, bạc, vàng kim
  S('meo_bac', 'Mèo Bạc', 'kim', 'thuong', 'quad', 'cat', 'thin', 'plain', 'belly', 'crystal', ['#e6e4df', '#ffffff', '#9fb0c2'], 'craft', 0.95, 1),
  S('chuot_chuong', 'Chuột Chuông', 'kim', 'thuong', 'round', 'mouse', 'thin', 'muzzle', 'belly', 'gem', ['#cfd4dc', '#f6f3ec', '#f2c14e'], 'agility', 0.9, 1.05),
  S('soc_dong', 'Sóc Đồng', 'kim', 'thuong', 'biped', 'cat', 'fluffy', 'muzzle', 'belly', 'gem', ['#c98c4e', '#f3dcb5', '#f2c14e'], 'craft', 1, 1.05),
  S('ga_vang', 'Gà Vàng', 'kim', 'thuong', 'bird', 'crest', 'fan', 'beak', 'belly', 'none', ['#f6d365', '#fff1b8', '#e9883a'], 'charm', 1.05, 1),
  S('te_te', 'Tê Tê Thép', 'kim', 'thuong', 'biped', 'none', 'flat', 'muzzle', 'scales', 'crystal', ['#a9b6c4', '#e4e8ec', '#6f7f91'], 'strength', 1, 0.95),
  S('cu_anh_kim', 'Cú Ánh Kim', 'kim', 'hiem', 'bird', 'tuft', 'none', 'beak', 'belly', 'gem', ['#c4bba9', '#efe7d6', '#f2c14e'], 'intellect', 0.9, 1),
  S('huou_pha_le', 'Hươu Pha Lê', 'kim', 'hiem', 'quad', 'antler', 'puff', 'muzzle', 'spots', 'crystal', ['#dfe7ef', '#ffffff', '#8fd3f0'], 'charm', 0.95, 1.05),
  S('soi_bac', 'Sói Bạc', 'kim', 'hiem', 'quad', 'fox', 'fluffy', 'muzzle', 'mask', 'none', ['#b4bcc6', '#eef1f4', '#6b7787'], 'agility', 1.1, 1.1),
  S('hac_bac', 'Hạc Bạc', 'kim', 'quy', 'bird', 'crest', 'fan', 'beak', 'belly', 'gem', ['#f2f2ee', '#ffffff', '#e2493b'], 'intellect', 0.9, 1.05),
  S('bach_ho', 'Bạch Hổ', 'kim', 'huyenthoai', 'quad', 'round', 'thin', 'muzzle', 'stripes', 'crystal', ['#f3f1ea', '#ffffff', '#4b4f5c'], 'strength', 1.1, 1.15),

  // Mộc: xanh lá, nâu gỗ
  S('tho_la', 'Thỏ Lá', 'moc', 'thuong', 'biped', 'bunny', 'puff', 'plain', 'belly', 'sprout', ['#a8d97f', '#eef7dd', '#5fa04e'], 'agility', 1, 1.05),
  S('ech_sen', 'Ếch Sen', 'moc', 'thuong', 'round', 'none', 'none', 'plain', 'belly', 'sprout', ['#7cc576', '#e3f3c8', '#f3a5c4'], 'charm', 0.95, 1),
  S('khi_tre', 'Khỉ Tre', 'moc', 'thuong', 'biped', 'round', 'thin', 'muzzle', 'belly', 'leafcollar', ['#b48a5a', '#f1dcb8', '#8fcf6a'], 'agility', 1.05, 1.05),
  S('nhim_reu', 'Nhím Rêu', 'moc', 'thuong', 'round', 'round', 'none', 'muzzle', 'spots', 'sprout', ['#9a8a5e', '#efe2c2', '#7fae5d'], 'intellect', 0.95, 0.95),
  S('cun_co', 'Cún Cỏ', 'moc', 'thuong', 'quad', 'floppy', 'curl', 'muzzle', 'belly', 'sprout', ['#c4e39a', '#f6fbe8', '#6db35a'], 'charm', 1.05, 1),
  S('gau_truc', 'Gấu Trúc', 'moc', 'hiem', 'biped', 'round', 'puff', 'muzzle', 'patch', 'sprout', ['#f5f5f0', '#ffffff', '#3b3b42'], 'strength', 1.15, 0.95),
  S('huou_reu', 'Hươu Rêu', 'moc', 'hiem', 'quad', 'antler', 'puff', 'muzzle', 'spots', 'none', ['#b58a5e', '#f2e1c4', '#7fae5d'], 'intellect', 0.95, 1.05),
  S('cao_la', 'Cáo Lá', 'moc', 'hiem', 'quad', 'fox', 'fluffy', 'muzzle', 'belly', 'leafcollar', ['#7fbf6a', '#eef7dd', '#f4c45a'], 'agility', 1, 1.1),
  S('rua_co_thu', 'Rùa Cổ Thụ', 'moc', 'quy', 'quad', 'none', 'puff', 'plain', 'shell', 'sprout', ['#9cc97a', '#efe6c5', '#8a6a45'], 'intellect', 0.85, 0.9),
  S('thanh_long', 'Thanh Long', 'moc', 'huyenthoai', 'serpent', 'antler', 'dragon', 'muzzle', 'scales', 'crest', ['#5fc79c', '#e6f7d9', '#2f8f7a'], 'intellect', 1, 1.15),

  // Thủy: xanh nước, xanh đen
  S('rai_ca', 'Rái Cá', 'thuy', 'thuong', 'biped', 'round', 'flat', 'muzzle', 'belly', 'drop', ['#a06e44', '#f0d9b5', '#5fb3e8'], 'agility', 1, 1.05),
  S('canh_cut', 'Chim Cánh Cụt', 'thuy', 'thuong', 'bird', 'none', 'none', 'beak', 'belly', 'none', ['#3d4a6b', '#ffffff', '#f2a03d'], 'agility', 1.05, 1),
  S('hai_cau', 'Hải Cẩu', 'thuy', 'thuong', 'round', 'none', 'none', 'muzzle', 'belly', 'bubble', ['#9fb4c7', '#e9f1f7', '#5d7891'], 'charm', 1.05, 0.95),
  S('ca_noc', 'Cá Nóc', 'thuy', 'thuong', 'round', 'fin', 'none', 'plain', 'spots', 'bubble', ['#9ad7f0', '#f2fbff', '#f2c14e'], 'charm', 0.9, 1),
  S('meo_mua', 'Mèo Mưa', 'thuy', 'thuong', 'quad', 'cat', 'thin', 'plain', 'belly', 'drop', ['#8fb2e0', '#eef4fc', '#4f7cc4'], 'intellect', 0.95, 1),
  S('ky_giong', 'Kỳ Giông Hồng', 'thuy', 'hiem', 'biped', 'fin', 'thin', 'plain', 'belly', 'bubble', ['#f6b3c8', '#fde4ec', '#e46f96'], 'charm', 0.95, 1.05),
  S('rua_bien', 'Rùa Biển', 'thuy', 'hiem', 'quad', 'none', 'none', 'plain', 'shell', 'drop', ['#7fc3b5', '#eef6e6', '#3f8f86'], 'intellect', 0.9, 0.95),
  S('vit_may', 'Vịt Mây', 'thuy', 'hiem', 'bird', 'none', 'fan', 'beak', 'belly', 'bubble', ['#bfe3f7', '#ffffff', '#f2a03d'], 'agility', 1, 1.05),
  S('ca_chep_rong', 'Cá Chép Rồng', 'thuy', 'quy', 'serpent', 'fin', 'fish', 'plain', 'spots', 'drop', ['#fbf6ee', '#ffffff', '#e9663f'], 'charm', 1, 1.1),
  S('huyen_vu', 'Huyền Vũ', 'thuy', 'huyenthoai', 'quad', 'horns', 'thin', 'plain', 'shell', 'drop', ['#4d6b86', '#cfe2e8', '#9fc9dc'], 'intellect', 0.9, 1),

  // Hỏa: đỏ, cam, hồng
  S('cao_lua', 'Cáo Lửa', 'hoa', 'thuong', 'quad', 'fox', 'fluffy', 'muzzle', 'belly', 'flame', ['#f08a4b', '#fff0dc', '#e2533b'], 'agility', 1.1, 1.1),
  S('ga_trong', 'Gà Trống Lửa', 'hoa', 'thuong', 'bird', 'crest', 'fan', 'beak', 'belly', 'none', ['#f5a64a', '#ffe2b0', '#e2493b'], 'strength', 1.1, 1.05),
  S('gau_meo_do', 'Gấu Mèo Đỏ', 'hoa', 'thuong', 'biped', 'round', 'fluffy', 'muzzle', 'mask', 'ember', ['#d9643a', '#4a302c', '#fff2e0'], 'charm', 1.05, 1.05),
  S('ky_nhong', 'Kỳ Nhông Lửa', 'hoa', 'thuong', 'serpent', 'none', 'dragon', 'plain', 'spots', 'ember', ['#f26b3a', '#ffd38a', '#4a302c'], 'strength', 1.15, 1.1),
  S('heo_than', 'Heo Than', 'hoa', 'thuong', 'round', 'floppy', 'curl', 'snout', 'belly', 'ember', ['#f29a7e', '#ffe0d2', '#e2533b'], 'strength', 1.2, 1),
  S('lan_con', 'Lân Con', 'hoa', 'hiem', 'quad', 'round', 'fluffy', 'muzzle', 'mask', 'flame', ['#f5c04a', '#fff3d0', '#e2493b'], 'charm', 1.05, 1.1),
  S('rong_lua', 'Rồng Lửa Nhí', 'hoa', 'hiem', 'serpent', 'horns', 'dragon', 'muzzle', 'scales', 'flame', ['#e2533b', '#ffd08a', '#7a2e2a'], 'strength', 1.15, 1.15),
  S('ung_lua', 'Chim Ưng Lửa', 'hoa', 'hiem', 'bird', 'crest', 'fan', 'beak', 'belly', 'flame', ['#c8402f', '#f5c04a', '#7a2e2a'], 'agility', 1.1, 1.15),
  S('ngua_lua', 'Ngựa Lửa', 'hoa', 'quy', 'quad', 'cat', 'fluffy', 'muzzle', 'belly', 'flame', ['#f6d4a6', '#fff4e2', '#f0663c'], 'agility', 1.1, 1.2),
  S('chu_tuoc', 'Chu Tước', 'hoa', 'huyenthoai', 'bird', 'crest', 'fan', 'beak', 'belly', 'flame', ['#e8403a', '#f8c25a', '#ffd75e'], 'charm', 1.05, 1.2),

  // Thổ: vàng đất, nâu, đất nung
  S('chuot_chui', 'Chuột Chũi', 'tho', 'thuong', 'round', 'none', 'thin', 'snout', 'belly', 'pebble', ['#7d6253', '#d8bfa5', '#f3a7b5'], 'strength', 0.85, 0.95),
  S('heo_dat', 'Heo Đất', 'tho', 'thuong', 'round', 'floppy', 'curl', 'snout', 'belly', 'gem', ['#d98a5f', '#f2c7a5', '#f2c14e'], 'craft', 0.85, 1),
  S('nghe_dat', 'Nghé Đất', 'tho', 'thuong', 'quad', 'horns', 'thin', 'muzzle', 'belly', 'none', ['#8c7a6b', '#cdbba8', '#efe6d8'], 'strength', 0.95, 1),
  S('lac_da', 'Lạc Đà Nhí', 'tho', 'thuong', 'quad', 'round', 'thin', 'muzzle', 'belly', 'pebble', ['#e2c18c', '#f7e7c8', '#b98a52'], 'agility', 0.8, 1),
  S('cho_vang', 'Chó Vàng', 'tho', 'thuong', 'quad', 'cat', 'curl', 'muzzle', 'belly', 'none', ['#e0b061', '#fbeac8', '#a8743c'], 'agility', 0.95, 1.05),
  S('gau_mat', 'Gấu Mật', 'tho', 'hiem', 'biped', 'round', 'puff', 'muzzle', 'belly', 'gem', ['#9c6b43', '#e2c08f', '#f2b134'], 'strength', 1.05, 0.95),
  S('te_giac_da', 'Tê Giác Đá', 'tho', 'hiem', 'quad', 'horns', 'thin', 'muzzle', 'spots', 'pebble', ['#9a948a', '#d9d3c7', '#6e675e'], 'strength', 0.9, 0.95),
  S('soc_nam', 'Sóc Nấm', 'tho', 'hiem', 'biped', 'cat', 'fluffy', 'muzzle', 'belly', 'mushroom', ['#c98a5a', '#f3dcbc', '#e2493b'], 'craft', 0.9, 1),
  S('ky_lan', 'Kỳ Lân Vàng', 'tho', 'quy', 'quad', 'antler', 'fluffy', 'muzzle', 'belly', 'gem', ['#f2d58a', '#fff6dc', '#c9853f'], 'charm', 0.9, 1.05),
  S('hoang_long', 'Hoàng Long', 'tho', 'huyenthoai', 'serpent', 'antler', 'dragon', 'muzzle', 'scales', 'crest', ['#f2c14e', '#fff1c2', '#c9853f'], 'intellect', 0.95, 1.1),
];

/**
 * Linh vật của Phố Trân Châu, vẽ bằng bộ khung như 50 loài nhưng không nằm trong bộ sưu tập ngũ hành.
 * Boba giữ mã cũ (`boba`) nên các bé Boba đang nuôi tự đổi sang hình mới; nét riêng là ôm cốc trà sữa.
 */
export const MASCOTS = [
  {
    ...S('boba', 'Boba', 'thuy', 'thuong', 'biped', 'round', 'flat', 'muzzle', 'belly', 'cup', ['#9c6a42', '#f3dcb8', '#ff8fb1'], 'craft', 1, 1),
    mascot: true,
    description: 'Bé rái cá nhâm nhi trà sữa, linh vật của Phố Trân Châu.',
  },
];

export const SPECIES_BY_ID = Object.fromEntries([...SPECIES, ...MASCOTS].map((s) => [s.id, s]));

/** Loài khách mời cài từ Petdex (ảnh vẽ sẵn, không dùng bộ khung): hành và độ hiếm gán tay. */
export const GUEST_SPECIES = {};

/** Hành của loài; loài lạ (khách mời chưa gán hành) thì null: không hưởng cũng không chịu ngũ hành. */
/** Thông tin loài (kể cả khách mời); loài lạ thì không hành, độ hiếm Thường. */
export const speciesOrGuest = (id) => SPECIES_BY_ID[id] ?? GUEST_SPECIES[id] ?? { id, element: null, rarity: 'thuong' };

export const elementOfSpecies = (id) => SPECIES_BY_ID[id]?.element ?? GUEST_SPECIES[id]?.element ?? null;

/** Mã băm nhỏ để mỗi loài có số liệu riêng nhưng cố định. */
function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

/**
 * Bảng số liệu của loài: kỹ năng khởi đầu (tổng theo độ hiếm, nghiêng về sở trường và hành),
 * hệ số tăng kỹ năng, hệ số hao/hồi chỉ số, tuổi thọ cơ bản.
 */
export function speciesStats(sp) {
  const el = ELEMENTS[sp.element];
  const weights = Object.fromEntries(SKILL_IDS.map((k) => [k, (el.skills[k] ?? 1) + (k === sp.fav ? 0.6 : 0) + hash(sp.id + k) * 0.4]));
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const sum = RARITIES[sp.rarity].skillSum;
  const skills = Object.fromEntries(SKILL_IDS.map((k) => [k, Math.round((weights[k] / total) * sum)]));
  const growth = Object.fromEntries(SKILL_IDS.map((k) => [k, Math.round(((el.skills[k] ?? 1) + (k === sp.fav ? 0.1 : 0)) * 100) / 100]));
  return {
    skills,
    growth,
    fullness: Math.round(sp.appetite * (el.stats.fullness ?? 1) * 100) / 100,
    energyRegen: Math.round(sp.stamina * (el.stats.energyRegen ?? 1) * 100) / 100,
    happiness: el.stats.happiness ?? 1,
    hygiene: el.stats.hygiene ?? 1,
    sickness: el.stats.sickness ?? 1,
    healthRegen: el.stats.healthRegen ?? 1,
    lifespan: lifespanWeeks(sp),
  };
}

/** Số liệu trung tính cho loài lạ: mọi hệ số bằng 1. */
const NEUTRAL_STATS = {
  skills: Object.fromEntries(SKILL_IDS.map((k) => [k, 10])),
  growth: Object.fromEntries(SKILL_IDS.map((k) => [k, 1])),
  fullness: 1, energyRegen: 1, happiness: 1, hygiene: 1, sickness: 1, healthRegen: 1, lifespan: 90,
};

const statsCache = new Map();
/** Số liệu của loài theo mã (kể cả loài khách mời); loài lạ thì trung tính. */
export function statsOfSpecies(id) {
  if (!statsCache.has(id)) {
    const sp = SPECIES_BY_ID[id] ?? GUEST_SPECIES[id];
    statsCache.set(id, sp ? speciesStats(sp) : NEUTRAL_STATS);
  }
  return statsCache.get(id);
}

// ---------------------------------------------------------------- ngũ hành trong luật chơi

/** Các hệ số của ngũ hành khi vào luật chơi (thiết kế mục 3). */
export const ELEMENT_RULES = {
  fortune: 0.1, // hành vượng trong ngày: +10% XP và lương
  fullSet: 0.05, // đủ 4 khe cùng một hành: +5% lương
  food: 0.2, // ăn món hợp mệnh: +20% XP
  perks: {
    kim: { factory: 0.1, cookCraft: 15 }, // xưởng thêm 10% mẻ khi bé Kim đứng máy; nấu như có thêm 15 Khéo tay
    moc: { harvest: 0.15 }, // thu hoạch thêm 15% khi bé chính hành Mộc
    thuy: { customers: 0.05 }, // quầy thêm 5% khách khi có bé Thủy trực
    hoa: { strengthPay: 0.05 }, // nghề dùng Sức mạnh thêm 5% lương
    tho: {}, // bền bỉ: đã nằm trong hệ số chỉ số (đói chậm, ít ốm)
  },
};

/** Thứ tự tương sinh, cũng là vòng vận khí: mỗi ngày một hành vượng. */
export const FORTUNE_CYCLE = ['moc', 'hoa', 'tho', 'kim', 'thuy'];
/** Hành vượng của ngày `dayKey` ("YYYY-MM-DD", giờ Việt Nam). */
export function fortuneOf(dayKey) {
  const n = Math.floor(Date.parse(`${dayKey}T00:00:00Z`) / 86_400_000);
  return FORTUNE_CYCLE[((n % 5) + 5) % 5];
}

/** Tổng hệ số hợp mệnh của bộ đồ đang mặc (tương sinh +10%, cùng hành +5%, kỵ mệnh −5% mỗi món). */
export function wearBonus(wear, element) {
  return Object.values(wear ?? {})
    .filter((id) => WEARABLES[id])
    .reduce((s, id) => s + RELATIONS[relation(WEARABLES[id].element, element)].bonus, 0);
}

/** Hành của bộ đồ nếu đủ 4 khe cùng một hành, không thì null. */
export function fullSetOf(wear) {
  const ids = ['head', 'face', 'neck', 'back'].map((s) => wear?.[s]);
  if (ids.some((id) => !id || !WEARABLES[id])) return null;
  const el = WEARABLES[ids[0]].element;
  return ids.every((id) => WEARABLES[id].element === el) ? el : null;
}

/** Thưởng XP khi ăn món có hành `food` (hợp mệnh: tương sinh hoặc cùng hành). */
export const foodBonus = (food, element) => (['feeds', 'same'].includes(relation(food, element)) ? ELEMENT_RULES.food : 0);

/** Tỉ lệ độ hiếm khi trứng ngũ hành nở. */
export const EGG_ODDS = { thuong: 0.75, hiem: 0.2, quy: 0.04, huyenthoai: 0.01 };
export const EGG = { hours: 24, price: 600, minLevel: 3 };

/** Bốc loài nở ra từ trứng hành `element`: bốc độ hiếm theo EGG_ODDS rồi bốc đều trong các loài cùng độ hiếm. */
export function rollEggSpecies(element, rand) {
  let r = rand();
  let rarity = 'thuong';
  for (const [k, p] of Object.entries(EGG_ODDS)) {
    if (r < p) {
      rarity = k;
      break;
    }
    r -= p;
  }
  const pool = SPECIES.filter((s) => s.element === element && s.rarity === rarity);
  return pool[Math.floor(rand() * pool.length)].id;
}

// ---------------------------------------------------------------- đồ đeo theo khe

/**
 * Mỗi món gắn vào một khe trên khung: đầu, mặt, cổ, lưng. Món nào cũng có hành để tính hợp mệnh.
 * (Hình vẽ của từng món nằm ở public/js/rig.js.)
 */
export const SLOTS = {
  head: { name: 'Đầu', icon: '🎩' },
  face: { name: 'Mặt', icon: '👓' },
  neck: { name: 'Cổ', icon: '🧣' },
  back: { name: 'Lưng', icon: '🦋' },
};

export const WEARABLES = {
  crown: { name: 'Vương miện', slot: 'head', element: 'kim' },
  bell: { name: 'Vòng chuông', slot: 'neck', element: 'kim' },
  glasses: { name: 'Kính tròn', slot: 'face', element: 'kim' },
  angel: { name: 'Cánh thiên thần', slot: 'back', element: 'kim' },
  flower: { name: 'Hoa cài tóc', slot: 'head', element: 'moc' },
  leafband: { name: 'Vòng lá', slot: 'head', element: 'moc' },
  leafscarf: { name: 'Khăn lá', slot: 'neck', element: 'moc' },
  tophat: { name: 'Mũ quý ông', slot: 'head', element: 'thuy' },
  shades: { name: 'Kính râm', slot: 'face', element: 'thuy' },
  pearls: { name: 'Chuỗi ngọc trai', slot: 'neck', element: 'thuy' },
  bow: { name: 'Nơ hồng', slot: 'head', element: 'hoa' },
  beret: { name: 'Mũ nồi đỏ', slot: 'head', element: 'hoa' },
  scarf: { name: 'Khăn quàng đỏ', slot: 'neck', element: 'hoa' },
  dragonwings: { name: 'Cánh rồng', slot: 'back', element: 'hoa' },
  nonla: { name: 'Nón lá', slot: 'head', element: 'tho' },
  bowtie: { name: 'Nơ cổ nâu', slot: 'neck', element: 'tho' },
  cape: { name: 'Áo choàng', slot: 'back', element: 'tho' },
  leafglasses: { name: 'Kính lá', slot: 'face', element: 'moc' },
  butterfly: { name: 'Cánh bướm', slot: 'back', element: 'moc' },
  wavecape: { name: 'Áo choàng sóng', slot: 'back', element: 'thuy' },
  heartglasses: { name: 'Kính tim', slot: 'face', element: 'hoa' },
  woodglasses: { name: 'Kính gọng gỗ', slot: 'face', element: 'tho' },
};
