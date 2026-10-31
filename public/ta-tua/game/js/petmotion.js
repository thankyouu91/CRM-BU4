// Hướng đi và cỡ điểm ảnh của bé: hàm thuần (không đụng DOM), dùng chung cho sprite.js, park.js và bài kiểm tra.
//
// Hướng nhìn từ trên xuống: S là quay mặt ra người xem (đi xuống màn hình), N là quay lưng (đi lên),
// E sang phải, W sang trái. Spritesheet mới (Rig 2.0) có hàng walkS/E/N/W, có thể có idleE/N/W;
// spritesheet cũ chỉ có idle, runRight, runLeft và các hoạt ảnh cảm xúc. resolveAnim() chọn hàng có thật.

export const DIRS = ['S', 'E', 'N', 'W'];
const isDir = (d) => DIRS.includes(d);
const isSide = (d) => d === 'E' || d === 'W';

/** Nhích ít hơn chừng này (đơn vị của dx, dy) coi như đứng yên, kể cả khi quay ngược chiều. */
const NUDGE = 0.5;

/**
 * Hướng từ véc-tơ di chuyển (dx, dy) theo trục trội, có trễ để đi chéo không giật qua lại:
 * đang đi ngang thì chỉ đổi sang dọc khi |dy| lớn hơn |dx| × `hysteresis` (và ngược lại).
 * Bước quá ngắn (dưới `minStep`) không đổi trục: chỉnh vị trí cuối đường không làm bé quay ngang sang dọc.
 * Nhưng bước ngắn ngược chiều trên cùng trục thì vẫn quay (E và W, S và N), để bé không đi giật lùi.
 */
export function directionOf(dx, dy, prev = 'S', { hysteresis = 1.35, minStep = 0.5 } = {}) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const last = isDir(prev) ? prev : 'S';
  const side = dx > 0 ? 'E' : 'W';
  const updown = dy > 0 ? 'S' : 'N';
  if (!(Math.hypot(ax, ay) >= minStep)) {
    if (isSide(last)) return ax > ay && ax >= NUDGE ? side : last;
    return ay > ax && ay >= NUDGE ? updown : last;
  }
  if (isSide(last)) return ay > ax * hysteresis ? updown : side;
  return ax > ay * hysteresis ? side : updown;
}

/**
 * Tên hoạt ảnh thật trên sheet cho một tên play():
 * - 'walk' → walk<Dir>; sheet cũ: E = runRight, W = runLeft, S/N = chạy theo hướng ngang gần nhất (`side`).
 * - 'idle' → idle<Dir> nếu có, không thì 'idle' (nhìn trước).
 * - tên khác (wave, jump, runRight...) giữ nguyên. Không có hàng nào hợp thì trả về null.
 * Không bao giờ lật ảnh bằng CSS: hướng W luôn lấy hàng W của sheet để đồ đeo không bị ngược.
 */
export function resolveAnim(anims, name, dir = 'S', side = 'E') {
  const has = (k) => Boolean(k && anims?.[k]);
  const d = isDir(dir) ? dir : 'S';
  const h = isSide(side) ? side : 'E';
  if (name === 'walk') {
    const run = (s) => (s === 'E' ? ['walkE', 'runRight'] : ['walkW', 'runLeft']);
    const order = isSide(d) ? [`walk${d}`, ...run(d)] : [`walk${d}`, ...run(h), ...run(h === 'E' ? 'W' : 'E')];
    return order.find(has) ?? (has('idle') ? 'idle' : null);
  }
  if (name === 'idle') {
    if (d !== 'S' && has(`idle${d}`)) return `idle${d}`;
    return has('idle') ? 'idle' : has('idleS') ? 'idleS' : null;
  }
  return has(name) ? name : null;
}

/**
 * Nhịp bước khi bé chạy (công viên): Rig 2.0 có runRight / runLeft là chính hàng walkE / walkW phát nhanh hơn
 * (14 so với 10 fps), để chân theo kịp tốc độ đi trên sân. Trả về tỉ lệ đó để mọi hàng đi (cả S / N) cùng nhịp.
 * Sheet cũ (không có walkE, hoặc runRight là hàng riêng) trả về 1.
 */
export function runPace(anims) {
  const walk = anims?.walkE;
  const run = anims?.runRight;
  if (!walk || !run || walk.row !== run.row || !(walk.fps > 0) || !(run.fps > 0)) return 1;
  return run.fps / walk.fps;
}

/** Sheet có hướng thật (có hàng đi hoặc đứng theo hướng) thì quay bằng setDirection, không lật CSS. */
export const hasDirections = (sheet, kind = 'walk') => ['E', 'W'].every((d) => Boolean(sheet?.anims?.[`${kind}${d}`]));

/** Sheet vẽ cho điểm ảnh tròn số (Rig 2.0 khai báo pixelPerfect: true). Thiếu cờ thì coi như không. */
export const isPixelPerfect = (sheet) => sheet?.pixelPerfect === true;

// ---------------------------------------------------------------- cỡ điểm ảnh theo nơi hiện bé

/** Điện thoại: cùng mốc với phố 16-bit (town16.js) và công viên (park.js: innerWidth < 768). */
export const PHONE_QUERY = '(max-width: 767px)';

/**
 * BẢNG CỠ DUY NHẤT cho sheet pixelPerfect: mỗi điểm ảnh gốc của bé hiện ra bấy nhiêu điểm màn hình
 * (điểm CSS khi chưa zoom; màn hình DPR 2 thì gấp đôi, vẫn tròn số). [máy tính, điện thoại].
 * Bé hiện trong khối đã bù zoom 0.9 của game (lớp .pet-figure.pp, như .t16 của phố), trừ công viên:
 * ở đó thế giới đã được park.js phóng sẵn (PARK_PX đơn vị thế giới = 3 hoặc 2 điểm màn hình), nên bé
 * chỉ cần đúng một điểm ảnh của cảnh công viên.
 * Sheet cũ (không có cờ) giữ nguyên cỡ như trước: `scale` truyền vào createPetFigure × ART_PX.
 */
export const PET_PX = {
  home: [5, 4], //   Nhà: bé là nhân vật chính (trước: 5.4 điểm / điểm ảnh)
  park: [3, 2], //   Công viên: bằng điểm ảnh của cảnh (parkscene.js / park.js pixelTarget); trước 2.88 / 1.92
  auth: [3, 3], //   Màn đăng nhập (trước 3.0)
  pick: [3, 3], //   Thẻ chọn loài khi nhận nuôi (trước 3.46)
  visit: [3, 2], //  Thăm nhà bạn (trước 2.6)
  arena: [2, 2], //  Đấu trường (trước 1.47)
  card: [2, 2], //   Danh sách nhỏ: bạn bè, bảng vàng, Đồi Sao (trước 1.3 tới 1.64)
};

/** Số điểm màn hình cho mỗi điểm ảnh gốc ở `context` (luôn là số nguyên >= 1). */
export function petPx(context, phone = false) {
  const row = PET_PX[context] ?? PET_PX.card;
  return Math.max(1, Math.round(row[phone ? 1 : 0]));
}
