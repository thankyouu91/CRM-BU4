// Dựng spritesheet cho từng bé, đồ đang đeo vẽ luôn vào từng khung hình:
// - bé vẽ bằng bộ khung (rig.js): vẽ thẳng từ dữ liệu loài, đúng giai đoạn tuổi;
// - bé khách mời Petdex (ảnh vẽ sẵn): dò điểm neo trên từng khung của ảnh rồi gắn đồ vào đó.
import { makeCanvas } from './pixel.js';
import { RIG_ANIMS, RIG_PIVOT, animSteps, drawFrame, formStage, skeleton, wearImage, wearSpotAt } from './rig.js';
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

// ---------------------------------------------------------------- bé vẽ bằng bộ khung: dựng dần trong lúc rảnh

// Một tấm đủ 14 hàng mất cỡ 70 ms (máy khỏe) tới 500 ms (điện thoại tầm trung), mà công viên dựng một tấm cho mỗi bé lúc vào
// và mỗi lần thay đồ. Nên chỉ khung đầu của idle-S được vẽ ngay (bé hiện ra liền, đứng yên); các khung còn lại xếp hàng chờ,
// trình duyệt rảnh lúc nào vẽ vài khung lúc đó (requestIdleCallback, không có thì setTimeout), xong cả tấm mới thay ảnh một
// lần (cỡ 0,2 giây sau trên máy khỏe). Đo trên máy khỏe (Node, đã nóng máy): một khung 3 - 6 ms; CPU chậm 4 lần thì gấp
// chừng 4 lần. Lần ĐẦU (mỗi loài, giai đoạn, cấp, hướng) mặc bùa (S, E) hoặc đồ lưng (E), khung đó dựng thêm pet một lần để
// quyết món có bị pet che hết không (rig2/index.js hiddenBehind, lưu lại cho mọi món, mọi khung sau): cỡ 8 - 18 ms. Lần đầu
// một loài ở cấp có dáng lớn hơn còn dựng thêm vài khung để chọn cỡ vừa ô (fittedLook, lưu lại). Mỗi việc trong hàng chờ là
// MỘT khung, nên khung nặng nhất vẫn có thể vượt 6 ms của một lượt pump.
const jobs = [];
let pumping = false;
const whenIdle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(() => fn(null), 16));
/** Chạy việc trong hàng chờ: mỗi lần ít nhất 6 ms việc (hoặc một việc), thêm việc khi trình duyệt còn rảnh (chừa 4 ms). */
function pump(deadline) {
  const t0 = performance.now();
  while (jobs.length && (performance.now() - t0 < 6 || (deadline && !deadline.didTimeout && deadline.timeRemaining() > 4))) {
    const job = jobs.shift();
    try {
      job();
    } catch (err) {
      console.error('petsheet: lỗi dựng spritesheet', err);
    }
  }
  if (jobs.length) whenIdle(pump);
  else pumping = false;
}
function later(job) {
  jobs.push(job);
  if (!pumping) {
    pumping = true;
    whenIdle(pump);
  }
}

/** Ảnh canvas → URL (toBlob mã hóa PNG ngoài luồng chính; trình duyệt cũ dùng toDataURL), đã giải mã sẵn để đổi ảnh không nháy. */
async function canvasUrl(c) {
  const blob = c.toBlob ? await new Promise((resolve) => c.toBlob(resolve)) : null;
  const url = blob ? URL.createObjectURL(blob) : c.toDataURL();
  const img = new Image();
  img.src = url;
  await img.decode().catch(() => {});
  return url;
}

/** Vẽ các khung của một hàng vào canvas (khung E lật ngang khi `mirror`). */
function paintRow(g, row, frames, mirror) {
  frames.forEach((frame, i) => {
    if (!mirror) return g.drawImage(frame, i * RIG_FW, row * RIG_FH);
    g.save();
    g.translate((i + 1) * RIG_FW, row * RIG_FH);
    g.scale(-1, 1);
    g.drawImage(frame, 0, 0);
    g.restore();
  });
}

/** Bảng tên play() → { row, frames, fps } từ các hàng đã có (RIG_PLAY: tên cũ của sprite.js trỏ vào hàng nào). */
function playTable(rows) {
  const anims = { ...rows };
  for (const [name, [rowName, fps]] of Object.entries(RIG_PLAY)) anims[name] = { ...rows[rowName], ...(fps ? { fps } : {}) };
  return anims;
}

/**
 * Spritesheet của bé vẽ bằng bộ khung; `level` chọn dáng theo cấp. Trả về NGAY một tấm chỉ có khung đầu của idle-S (mọi tên
 * play() tạm đứng yên ở khung này, giữ fps của mình); các hàng vẽ dần lúc rảnh, xong thì chính đối tượng `sheet` được cập nhật
 * (url, anims), `sheet.pending` thành false và `sheet.ready` hoàn tất: Sprite (sprite.js) tự đổi sang ảnh đủ hàng.
 * Gọi lại với cùng tham số trả về đúng tấm đó (đang dựng dở cũng vậy).
 */
export function rigSheet(speciesId, stageKey, wear = {}, level = 1) {
  const key = `rig|${speciesId}|${stageKey}|${formIndex(level)}|${wearKey(wear)}`;
  if (cache.has(key)) return cache.get(key);
  // 1) Khung đầu của idle-S, ngay bây giờ (hàng 0 của ảnh tạm, rộng đủ số cột để background-size vẫn đúng).
  const [c0, g0] = makeCanvas(RIG_COLS * RIG_FW, RIG_FH);
  g0.drawImage(drawFrame(speciesId, stageKey, RIG_ANIMS.idle.frames[0], wear, 0, { level, view: 'S' }), 0, 0);
  const temp = Object.fromEntries(RIG_ROWS.map(([name, anim]) => [name, { row: 0, frames: 1, fps: RIG_ANIMS[anim].fps }]));
  // Chiều cao phần thân bé (từ đỉnh đầu tới chân), để hiệu ứng bay lên đúng đầu bé.
  const top = skeleton(SPECIES_BY_ID[speciesId], formStage(stageKey, level)).head.top;
  let done;
  const sheet = {
    url: c0.toDataURL(),
    frameW: RIG_FW * ART_PX,
    frameH: RIG_FH * ART_PX,
    cols: RIG_COLS,
    anims: playTable(temp),
    pixelated: true,
    // Vẽ theo điểm ảnh tròn số (petmotion.js PET_PX): mỗi điểm ảnh gốc là đúng N điểm màn hình ở mọi nơi hiện bé.
    pixelPerfect: true,
    artPx: ART_PX,
    bodyH: (RIG_PIVOT.y + 1 - top) * ART_PX,
    padBottom: RIG_PAD_BOTTOM * ART_PX,
    pending: true,
    ready: new Promise((resolve) => { done = resolve; }),
  };
  cache.set(key, sheet);
  // 2) Mỗi khung một việc lúc rảnh; hàng W lật lại cả hàng E (các việc của hàng E xếp trước hàng W).
  const [c, g] = makeCanvas(RIG_COLS * RIG_FW, RIG_ROWS.length * RIG_FH);
  const rows = {};
  const drawn = {};
  RIG_ROWS.forEach(([name, anim, view], row) => {
    const fps = RIG_ANIMS[anim].fps;
    if (view === 'W') {
      later(() => {
        const east = drawn[`${anim}-E`];
        paintRow(g, row, east, true);
        rows[name] = { row, frames: east.length, fps };
      });
      return;
    }
    const steps = animSteps(speciesId, anim, { view });
    const frames = [];
    drawn[`${anim}-${view}`] = frames;
    steps.forEach((st, i) => later(() => {
      frames[i] = drawFrame(speciesId, stageKey, st.pose, wear, st.tick, { level, view: st.view });
      g.drawImage(frames[i], i * RIG_FW, row * RIG_FH);
      if (i === steps.length - 1) rows[name] = { row, frames: steps.length, fps };
    }));
  });
  // 3) Đủ hàng: đổi ảnh một lần (ảnh đã giải mã sẵn). Hàng nào lỗi thì tên của nó đứng yên ở khung đầu như lúc chờ.
  later(() => {
    canvasUrl(c).catch(() => c.toDataURL()).then((url) => {
      sheet.url = url;
      sheet.anims = playTable({ ...temp, ...rows });
      sheet.pending = false;
      done(sheet);
    });
  });
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
      // Cằm = eo cổ dưới khối đầu, dò từ ảnh (không đoán theo tỉ lệ chiều cao): hàng rộng nhất trong nửa trên là giữa
      // đầu; từ đó xuống tới 65% chiều cao, hàng HẸP NHẤT là eo cổ nếu hẹp hơn hẳn (≤ 85%) bề ngang đầu (tay ôm trước ngực
      // nằm dưới eo nên không làm sai). Không có eo (thân liền đầu) thì lấy 52% chiều cao. Chốt đồ cổ thấp hơn cằm 2 điểm
      // ảnh (cả viền trên của dải nằm dưới cằm), và guestSheet cắt mọi điểm trên hàng cằm: món không bao giờ đè lên mặt.
      const widthAt = (y) => {
        let a = -1;
        let b = -1;
        for (let x = 0; x < spec.frameW; x++) if (solid(x0 + x, y0 + y)) { if (a < 0) a = x; b = x; }
        return a < 0 ? 0 : b - a + 1;
      };
      let headW = 0;
      let headY = top;
      for (let y = top; y <= top + h * 0.5; y++) {
        const w = widthAt(y);
        if (w > headW) [headW, headY] = [w, y];
      }
      let minW = Infinity;
      let chin = -1;
      for (let y = headY; y <= top + h * 0.65; y++) {
        const w = widthAt(y);
        if (w < minW) [minW, chin] = [w, y];
      }
      if (!(minW <= headW * 0.85)) chin = -1;
      const neck = chin >= 0 ? { x: Math.round(cx / ART_PX), y: Math.ceil(chin / ART_PX) + 2 } : at(0.52);
      out[name].push({
        anchors: { head: at(0.03), face: at(0.33), neck, back: at(0.45), charm: { ...at(0.6), x: at(0).x + headRx + 2 } },
        headRx,
        chinY: chin >= 0 ? chin : Math.round(top + h * 0.52) - 2 * ART_PX,
      });
    }
  }
  return out;
}

const anchorCache = new Map();
/** Bé khách mời nhìn trước: đồ lưng lấy hình S (dải ló quanh người), không lấy hình túi đồ (N, cả tấm áo choàng). */
const GUEST_BACK = { view: 'S' };

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
  const put = (id, cell, x0, y0, opts = {}) => {
    const pic = id && WEARABLES[id] && wearImage(id, opts);
    if (!pic || !cell) return;
    const { x, y } = wearSpotAt(id, cell.anchors, cell.headRx, opts);
    g.drawImage(pic, x0 + x * ART_PX, y0 + y * ART_PX, pic.width * ART_PX, pic.height * ART_PX);
  };
  for (const [name, a] of Object.entries(PETDEX_SHEET.anims)) {
    for (let f = 0; f < a.frames; f++) {
      const x0 = f * PETDEX_SHEET.frameW;
      const y0 = a.row * PETDEX_SHEET.frameH;
      const cell = anchors[name][f];
      // Đồ lưng sau người (chỉ lộ hai bên). Đồ cổ vẽ TRÊN ảnh của bé, ngay dưới cằm (neo cổ dò từ ảnh): hình đồ cổ Rig 2.0
      // là hình dán cố định cỡ Boba (khăn rộng chừng 12 điểm ảnh), vẽ sau người thì bị thân bé khách mời che mất.
      put(wear.back, cell, x0, y0, GUEST_BACK);
      g.drawImage(img, x0, y0, PETDEX_SHEET.frameW, PETDEX_SHEET.frameH, x0, y0, PETDEX_SHEET.frameW, PETDEX_SHEET.frameH);
      // Đồ cổ chỉ vẽ từ hàng cằm trở xuống (cắt phần trên): cằm dò sai thì món cũng không đè lên mặt, miệng.
      if (wear.neck && cell) {
        g.save();
        g.beginPath();
        g.rect(x0, y0 + cell.chinY, PETDEX_SHEET.frameW, PETDEX_SHEET.frameH - cell.chinY);
        g.clip();
        put(wear.neck, cell, x0, y0);
        g.restore();
      }
      for (const slot of ['face', 'head', 'charm']) put(wear[slot], cell, x0, y0);
    }
  }
  const blob = await new Promise((resolve) => c.toBlob(resolve));
  const sheet = { ...base, url: URL.createObjectURL(blob) };
  cache.set(key, sheet);
  return sheet;
}
