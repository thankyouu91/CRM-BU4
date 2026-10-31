// Dựng spritesheet cho từng bé, đồ đang đeo vẽ luôn vào từng khung hình:
// - bé vẽ bằng bộ khung (rig.js): vẽ thẳng từ dữ liệu loài, đúng giai đoạn tuổi;
// - bé khách mời Petdex (ảnh vẽ sẵn): dò điểm neo trên từng khung của ảnh rồi gắn đồ vào đó.
import { makeCanvas } from './pixel.js';
import { RIG_ANIMS, RIG_PIVOT, animFrames, formStage, skeleton, wearImage, wearSpotAt } from './rig.js';
import { SLOT_IDS, SPECIES_BY_ID, WEARABLES, formIndex } from './shared/pets.js';

/** Cỡ một pixel nghệ thuật trên màn hình ở tỉ lệ 1 (bằng độ thô của Boba và cảnh pixel). */
export const ART_PX = 4.8;

// Khung hình bộ khung Rig 2.0: ô 48×48, chân (viền dưới chân) ở hàng 44, nên dưới chân còn 3 hàng trống.
const RIG_FW = 48;
const RIG_FH = 48;
/** Số hàng trống dưới chân trong mỗi ô (sprite.js kéo hình xuống chừng ấy để chân chạm đất như trước). */
const RIG_PAD_BOTTOM = RIG_FH - 1 - RIG_PIVOT.y;

/**
 * Hàng của spritesheet bộ khung: [tên hàng, hoạt ảnh của bộ khung, hướng]. Bốn hướng cho đứng và đi
 * (W là E lật, nhưng vẫn có hàng riêng để chạy như mọi hàng khác), rồi các hoạt ảnh cảm xúc nhìn trước (S).
 */
const RIG_ROWS = [
  ['idle-S', 'idle', 'S'], ['idle-E', 'idle', 'E'], ['idle-N', 'idle', 'N'], ['idle-W', 'idle', 'W'],
  ['walk-S', 'walk', 'S'], ['walk-E', 'walk', 'E'], ['walk-N', 'walk', 'N'], ['walk-W', 'walk', 'W'],
  ['wave', 'wave', 'S'], ['jump', 'jump', 'S'], ['sad', 'sad', 'S'], ['think', 'think', 'S'], ['busy', 'busy', 'S'], ['spin', 'spin', 'S'],
];
/**
 * Tên play() của sprite.js → [hàng, fps riêng (nếu khác)]. idle = idle-S; walkS/E/N/W đi bộ 4 hướng;
 * runRight/runLeft (công viên, phố) = đi hướng E/W ở 14 fps; wait = think (như bản cũ).
 */
const RIG_PLAY = {
  idle: ['idle-S'], idleS: ['idle-S'], idleE: ['idle-E'], idleN: ['idle-N'], idleW: ['idle-W'],
  walkS: ['walk-S'], walkE: ['walk-E'], walkN: ['walk-N'], walkW: ['walk-W'],
  runRight: ['walk-E', 14], runLeft: ['walk-W', 14],
  wave: ['wave'], jump: ['jump'], sad: ['sad'], wait: ['think'], busy: ['busy'], think: ['think'], spin: ['spin'],
};
const RIG_COLS = Math.max(...RIG_ROWS.map(([, a]) => RIG_ANIMS[a].frames.length));

/** Spritesheet Petdex/Codex v2: lưới 8 cột, khung 192×208, mỗi hàng một trạng thái. */
export const PETDEX_SHEET = {
  frameW: 192,
  frameH: 208,
  cols: 8,
  anims: {
    idle: { row: 0, frames: 7, fps: 6 },
    runRight: { row: 1, frames: 8, fps: 12 },
    runLeft: { row: 2, frames: 8, fps: 12 },
    wave: { row: 3, frames: 4, fps: 6 },
    jump: { row: 4, frames: 5, fps: 9 },
    sad: { row: 5, frames: 8, fps: 4 },
    wait: { row: 6, frames: 6, fps: 6 },
    busy: { row: 7, frames: 6, fps: 8 },
    think: { row: 8, frames: 6, fps: 4 },
    spin: { row: 9, frames: 8, fps: 10 },
  },
};

const wearKey = (wear) => SLOT_IDS.map((s) => wear?.[s] ?? '-').join(',');
const hasWear = (wear) => Object.values(wear ?? {}).some((id) => id && WEARABLES[id]);
const cache = new Map();

/** Spritesheet của bé vẽ bằng bộ khung (tức thì, vài chục khung hình nhỏ); `level` chọn dáng theo cấp. */
export function rigSheet(speciesId, stageKey, wear = {}, level = 1) {
  const key = `rig|${speciesId}|${stageKey}|${formIndex(level)}|${wearKey(wear)}`;
  if (cache.has(key)) return cache.get(key);
  const [c, g] = makeCanvas(RIG_COLS * RIG_FW, RIG_ROWS.length * RIG_FH);
  const rows = {};
  const drawn = {};
  RIG_ROWS.forEach(([name, anim, view], row) => {
    // Hướng W là hướng E lật ngang: lật lại các khung E vừa vẽ thay vì vẽ lại.
    const east = view === 'W' ? drawn[`${anim}-E`] : null;
    const frames = east ?? animFrames(speciesId, stageKey, anim, wear, { level, view });
    drawn[`${anim}-${view}`] = frames;
    frames.forEach((frame, i) => {
      if (!east) return g.drawImage(frame, i * RIG_FW, row * RIG_FH);
      g.save();
      g.translate((i + 1) * RIG_FW, row * RIG_FH);
      g.scale(-1, 1);
      g.drawImage(frame, 0, 0);
      g.restore();
    });
    rows[name] = { row, frames: frames.length, fps: RIG_ANIMS[anim].fps };
  });
  const anims = { ...rows };
  for (const [name, [rowName, fps]] of Object.entries(RIG_PLAY)) anims[name] = { ...rows[rowName], ...(fps ? { fps } : {}) };
  // Chiều cao phần thân bé (từ đỉnh đầu tới chân), để hiệu ứng bay lên đúng đầu bé.
  const top = skeleton(SPECIES_BY_ID[speciesId], formStage(stageKey, level)).head.top;
  const sheet = {
    url: c.toDataURL(),
    frameW: RIG_FW * ART_PX,
    frameH: RIG_FH * ART_PX,
    cols: RIG_COLS,
    anims,
    pixelated: true,
    bodyH: (RIG_PIVOT.y + 1 - top) * ART_PX,
    padBottom: RIG_PAD_BOTTOM * ART_PX,
  };
  cache.set(key, sheet);
  return sheet;
}

// ---------------------------------------------------------------- bé khách mời Petdex

const images = new Map();
function loadImage(url) {
  if (!images.has(url)) {
    images.set(url, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    }));
  }
  return images.get(url);
}

/**
 * Dò điểm neo trên từng khung của ảnh vẽ sẵn: đỉnh đầu là hàng trên cùng có màu,
 * tâm ngang lấy từ dải 30% trên cùng; mặt, cổ, vai tính theo tỉ lệ chiều cao bé.
 * Trả về điểm neo theo pixel nghệ thuật (chia ART_PX) để dùng chung hàm đặt đồ với bộ khung.
 */
function guestAnchors(img, spec) {
  const [c, g] = makeCanvas(img.width, img.height);
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, img.width, img.height).data;
  const solid = (x, y) => data[(y * img.width + x) * 4 + 3] > 60;
  const out = {};
  for (const [name, a] of Object.entries(spec.anims)) {
    out[name] = [];
    for (let f = 0; f < a.frames; f++) {
      const x0 = f * spec.frameW;
      const y0 = a.row * spec.frameH;
      let top = -1;
      let bottom = -1;
      for (let y = 0; y < spec.frameH && y0 + y < img.height; y++) {
        let n = 0;
        for (let x = 0; x < spec.frameW; x += 2) if (solid(x0 + x, y0 + y)) n++;
        if (n >= 2) {
          if (top < 0) top = y;
          bottom = y;
        }
      }
      if (top < 0) {
        out[name].push(null);
        continue;
      }
      const h = bottom - top;
      let sum = 0;
      let count = 0;
      let minX = spec.frameW;
      let maxX = 0;
      for (let y = top; y < top + h * 0.3; y++) {
        for (let x = 0; x < spec.frameW; x++) {
          if (!solid(x0 + x, y0 + y)) continue;
          sum += x;
          count++;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
      const cx = sum / Math.max(1, count);
      const at = (fy) => ({ x: Math.round(cx / ART_PX), y: Math.round((top + h * fy) / ART_PX) });
      const headRx = Math.round((maxX - minX) / 2 / ART_PX);
      out[name].push({
        anchors: { head: at(0.03), face: at(0.33), neck: at(0.47), back: at(0.45), charm: { ...at(0.6), x: at(0).x + headRx + 2 } },
        headRx,
      });
    }
  }
  return out;
}

const anchorCache = new Map();

/** Spritesheet của bé khách mời kèm đồ đeo; không đeo gì thì dùng nguyên ảnh gốc. */
export async function guestSheet(sprite, wear = {}) {
  const base = { ...PETDEX_SHEET, url: sprite };
  if (!hasWear(wear)) return base;
  const key = `guest|${sprite}|${wearKey(wear)}`;
  if (cache.has(key)) return cache.get(key);
  const img = await loadImage(sprite);
  if (!anchorCache.has(sprite)) anchorCache.set(sprite, guestAnchors(img, PETDEX_SHEET));
  const anchors = anchorCache.get(sprite);
  const [c, g] = makeCanvas(img.width, img.height);
  g.imageSmoothingEnabled = false;
  const put = (id, cell, x0, y0) => {
    const pic = id && WEARABLES[id] && wearImage(id);
    if (!pic || !cell) return;
    const { x, y } = wearSpotAt(id, cell.anchors, cell.headRx);
    g.drawImage(pic, x0 + x * ART_PX, y0 + y * ART_PX, pic.width * ART_PX, pic.height * ART_PX);
  };
  for (const [name, a] of Object.entries(PETDEX_SHEET.anims)) {
    for (let f = 0; f < a.frames; f++) {
      const x0 = f * PETDEX_SHEET.frameW;
      const y0 = a.row * PETDEX_SHEET.frameH;
      const cell = anchors[name][f];
      // Ảnh vẽ sẵn thường có tay ôm đồ trước ngực (Boba ôm cốc trà sữa), nên đồ ở cổ vẽ sau người, chỉ lộ hai bên.
      put(wear.back, cell, x0, y0);
      put(wear.neck, cell, x0, y0);
      g.drawImage(img, x0, y0, PETDEX_SHEET.frameW, PETDEX_SHEET.frameH, x0, y0, PETDEX_SHEET.frameW, PETDEX_SHEET.frameH);
      for (const slot of ['face', 'head', 'charm']) put(wear[slot], cell, x0, y0);
    }
  }
  const blob = await new Promise((resolve) => c.toBlob(resolve));
  const sheet = { ...base, url: URL.createObjectURL(blob) };
  cache.set(key, sheet);
  return sheet;
}
