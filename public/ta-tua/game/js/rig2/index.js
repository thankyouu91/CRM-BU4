// Rig 2.0: vẽ pet ngũ hành theo phong cách 16-bit nhìn từ trên xuống, 4 hướng (S trước, E ngang phải, N sau, W = lật E).
// File DUY NHẤT nhập mọi sổ đăng ký (dáng khung, tai, đuôi, mặt, hoa văn, đặc điểm, dấu hiệu, đồ đeo) và ghép một khung hình.
// Chủ sở hữu: dev. Họa sĩ KHÔNG cần sửa file này: thêm/sửa mục trong file của mình là pipeline tự dùng.
// Không đụng DOM (chạy được trong Node). js/rig.js bọc lại thành canvas cho game.
//
// Thứ tự ghép một khung (bản mẫu pets-pilot, proposal.txt mục 4; đồ đeo theo WEAR-SPEC D1, D2, D6):
//   bộ phận: đuôi → tai → thân (dáng khung) → đầu → mặt → hoa văn → đặc điểm → dấu hiệu; mắt và nét mặt là điểm tô thẳng
//   → tô bóng (colourise) → viền #2e1d14
//   Đồ đeo có "layer" (wear/stamp.js): front = trên pet, behind = dưới pet, behindNfront = dưới pet ở S/E, trên pet ở N.
//   S/E: hào quang → đồ DƯỚI pet (lưng, bùa, rồi đầu/mặt/cổ nếu có: vầng hào quang) → PET → phần "over" của đồ lưng
//        (quai ba lô) → thân cốc → đồ cổ (cằm che) → ống hút + tay ôm cốc → đồ mặt → đồ đầu (tai mèo vẽ lại lên mũ có
//        earsOver, chỉ S) → bùa (nếu trên pet) → đốm sáng
//   N:   hào quang → đồ DƯỚI pet → PET → đồ mặt → đồ cổ → đồ đầu → đồ lưng (+ over) → bùa → đốm sáng
//   W: vẽ E rồi lật cả khung và điểm neo.
import { LEVEL_FORMS, SPECIES_BY_ID, WEARABLES, formIndex } from '../shared/pets.js';
import {
  FH, FW, INK, NPX, PALETTE, PIVOT, RAMPS, bbox, colourise, crop, groupMask, inPalette, mAbove, mAnd, mirror, newBuf, outline, over, pyRound, setPx,
} from './core.js';
import { clearStampCache } from './wear/stamp.js';
import { MARKS } from './marks.js';
import { rampsOf } from './ramps.js';
import { ANIMS, ARCHETYPES, animPoses, archetypeOf, lookOf, skeleton } from './skeleton.js';
import { EARS, FALLBACK as EARS_FALLBACK, earsFor } from './parts/ears.js';
import { FACES, FALLBACK as FACES_FALLBACK, eyes, faceFor } from './parts/faces.js';
import { FEATURES, FALLBACK as FEATURES_FALLBACK, featureFor } from './parts/features.js';
import { PATTERNS, FALLBACK as PATTERNS_FALLBACK, patternFor } from './parts/patterns.js';
import { TAILS, FALLBACK as TAILS_FALLBACK, tailFor } from './parts/tails.js';
import { BACK, backFor } from './wear/back.js';
import { CHARM, charmFor } from './wear/charm.js';
import { FACE, faceFor as faceWearFor } from './wear/face.js';
import { EARS_OVER, HEAD, headFor } from './wear/head.js';
import { NECK, neckFor } from './wear/neck.js';

export { FW, FH, PIVOT, INK, PALETTE, RAMPS, inPalette, ANIMS, ARCHETYPES, animPoses, archetypeOf, lookOf, skeleton };
export const VIEWS = ['S', 'E', 'N', 'W'];
export const SLOTS = ['head', 'face', 'neck', 'back', 'charm'];

const WEAR_FOR = { head: headFor, face: faceWearFor, neck: neckFor, back: backFor, charm: charmFor };
/** Mục vẽ của món `id` ở khe `slot` (null nếu món lạ). */
export const wearEntry = (slot, id) => (id && WEAR_FOR[slot] ? WEAR_FOR[slot](id) : null);
/** Lớp mặc định của khe khi mục không ghi `layer` (hình cũ dự phòng): đồ lưng dưới pet ở S/E, trên pet ở N. */
const DEFAULT_LAYER = { head: 'front', face: 'front', neck: 'front', back: 'behindNfront', charm: 'front' };
/** Món ở khe `slot` vẽ TRÊN pet ở hướng `v` (S/E/N) không. */
export const wearInFront = (slot, entry, v) => {
  const layer = entry?.layer ?? DEFAULT_LAYER[slot];
  return layer === 'front' || (layer === 'behindNfront' && v === 'N');
};
/** Màu ống hút của cốc trà sữa (features.js cup): ống hút và tay ôm cốc nằm TRÊN đồ cổ (WEAR-SPEC D2). */
const STRAW = '#d9708a';

/** Loài lạ (không có trong shared/pets.js) vẫn vẽ được: một bé biped xám trung tính. */
const UNKNOWN = {
  body: 'biped', ears: 'round', tail: 'none', face: 'plain', pattern: 'belly', feature: 'none',
  colors: ['#c4bcb0', '#fbf1e3', '#f4a3b4'], element: null, rarity: 'thuong',
};
export const speciesOf = (sp) => (typeof sp === 'string' ? SPECIES_BY_ID[sp] ?? { ...UNKNOWN, id: sp } : sp);

const ANCHOR_COLORS = { head: '#ff3b6b', face: '#3bb3ff', neck: '#ffb800', back: '#7a5cff', charm: '#3bd18a' };

/**
 * Vẽ một khung hình 48×48.
 * - species: mã loài hoặc mục SPECIES; stage: mã giai đoạn ('adult'), mục LIFE_STAGES hoặc look;
 * - view: 'S' | 'E' | 'N' | 'W'; pose: xem skeleton.js; wear: { head, face, neck, back, charm } → mã món;
 * - opts: level (cấp, đổi dáng theo LEVEL_FORMS), tick (số khung, cho hiệu ứng đung đưa), anchors (chấm điểm neo để soát),
 *   marks (false: tắt dấu hiệu lão làng/cấp/hào quang, chỉ để so ảnh với bản mẫu).
 * Trả về { img (bộ đệm RGBA), anchors ({ head, face, neck, back, charm } → [x, y] số thực, đã lật nếu W), sk }.
 */
export function renderFrame(species, stage, view = 'S', pose = {}, wear = {}, opts = {}) {
  const sp = speciesOf(species);
  const level = opts.level ?? 1;
  const st = fittedLook(sp, stage, level);
  let r = draw(sp, st, view, pose, wear, opts, level);
  // Nhảy cao (hoặc giãn người) mà chạm mép trên của ô (bé tai dài, bé lớn theo cấp): nhảy thấp lại, giãn ít lại cho vừa ô.
  let lift = pose.lift ?? 0;
  let sq = pose.sq ?? 0;
  while (opts.fit !== false && (lift < 0 || sq > 0) && (bbox(r.img)?.y0 ?? 1) < 1) {
    if (lift < 0) lift += 1;
    else sq -= 1;
    r = draw(sp, st, view, { ...pose, lift, sq }, wear, opts, level);
  }
  return r;
}

const fitCache = new Map();
/**
 * Dáng theo giai đoạn tuổi và cấp, nhưng giữ bé gọn trong ô 48×48: nếu cỡ người theo cấp (LEVEL_FORMS.grow) làm khung đứng yên
 * (S, E, N) chạm mép (chừa 1 hàng trên cho nhịp nhún khi đi) thì lùi về bậc lớn nhỏ hơn. Cấp 1 không bao giờ bị đổi.
 */
function fittedLook(sp, stage, level) {
  const base = lookOf(stage, 1);
  const form = formIndex(level);
  if (form === 0) return base;
  const key = `${sp.id}|${base.scale}|${base.head}|${base.body}|${base.leg}|${form}`;
  if (!fitCache.has(key)) {
    let fit = base;
    for (let f = form; f > 0; f--) {
      const look = { ...base, scale: base.scale * LEVEL_FORMS[f].grow };
      const ok = ['S', 'E', 'N'].every((v) => {
        const b = bbox(draw(sp, look, v, {}, {}, { marks: false }, 1).img);
        return !b || (b.y0 >= 2 && b.x0 >= 1 && b.x1 <= FW - 2);
      });
      if (ok) {
        fit = look;
        break;
      }
    }
    fitCache.set(key, fit);
  }
  return fitCache.get(key);
}

/**
 * ctx của một khung hình (ARTIST-GUIDE mục 4): MỌI hàm trong sổ đăng ký (bộ phận lẫn đồ đeo, kể cả khi wearIcon vẽ hình
 * món đồ cho túi đồ) nhận đúng bộ trường này. `sk`: bộ xương của khung; `opts`: tick, level (mặc định 1).
 */
export function makeCtx(sp, st, sk, view, pose = {}, wear = {}, opts = {}) {
  const level = opts.level ?? 1;
  const arch = archetypeOf(sp);
  const [hcx, hcy, hrx, hry] = sk.head;
  return {
    sp, st, sk, view, pose, wear: wear ?? {}, tick: opts.tick ?? 0, level, form: formIndex(level),
    ramps: rampsOf(sp), parts: [], pixels: [], held: { pixels: [], parts: [] },
    zh: arch.headZ(view), hnrm: [hcx - 1.0, hcy - 1.5, hrx + 1.2, hry + 1.6], headMask: null,
    handsBusy: Boolean(featureFor(sp.feature).holds), chin: null,
  };
}

/** Bước 1 của pipeline: gom bộ phận của pet vào ctx.parts / ctx.pixels (đặt luôn ctx.headMask, ctx.held). */
function collectParts(ctx, marks) {
  const { sp, view: v } = ctx;
  const arch = archetypeOf(sp);
  const feature = featureFor(sp.feature);
  tailFor(sp)[v](ctx);
  const e0 = ctx.parts.length;
  earsFor(sp.ears)[v](ctx);
  ctx.earParts = [e0, ctx.parts.length]; // để vẽ lại tai lên mũ (earsOver)
  arch.body[v](ctx);
  arch.head[v](ctx);
  if (feature.blush) ctx.blush = feature.blush;
  eyes(ctx);
  faceFor(sp.face)[v](ctx);
  patternFor(sp.pattern)[v](ctx);
  feature[v](ctx);
  if (marks) MARKS.body(ctx);
}

function draw(sp, st, view, pose, wear, opts, level) {
  const mirrorW = view === 'W';
  const v = mirrorW ? 'E' : view;
  const sk = skeleton(sp, st, v, pose);
  const feature = featureFor(sp.feature);
  const [, hcy, , hry] = sk.head;
  const ctx = makeCtx(sp, st, sk, v, pose, wear, { tick: opts.tick, level });
  const marks = opts.marks !== false;

  // 1) bộ phận
  collectParts(ctx, marks);

  // 2) tô bóng, viền một lần cho cả khối
  const pet = outline(colourise(ctx.parts, ctx.pixels));

  // Cằm che dải đồ cổ (chừa hàng cằm cuối để dải nhét dưới cằm).
  if (v !== 'N') ctx.chin = mAnd(groupMask(ctx.parts, 'head'), mAbove(hcy + hry - 1.0));

  // 3) ghép
  const img = newBuf();
  const worn = {};
  for (const slot of ['back', 'charm', 'head', 'face', 'neck']) {
    const id = ctx.wear[slot];
    const e = WEARABLES[id]?.slot === slot ? wearEntry(slot, id) : null;
    if (e) worn[slot] = e;
  }
  const front = (slot) => worn[slot] && wearInFront(slot, worn[slot], v);
  const drawSlot = (slot) => {
    worn[slot][v](ctx, img);
    if (slot === 'head' && v === 'S' && worn.head.earsOver && EARS_OVER.has(sp.ears)) earsOverHat(ctx, img, pet);
  };
  if (marks) MARKS.behind(ctx, img);
  // Đồ dưới pet: xa nhất trước (lưng), rồi bùa, rồi món đầu/mặt/cổ có layer behind (vầng hào quang).
  for (const slot of ['back', 'charm', 'head', 'face', 'neck']) if (worn[slot] && !front(slot)) drawSlot(slot);
  over(img, pet);
  if (v === 'N') {
    for (const slot of ['face', 'neck', 'head', 'back']) if (front(slot)) drawSlot(slot);
    worn.back?.over?.(ctx, img);
  } else {
    if (front('back')) drawSlot('back');
    worn.back?.over?.(ctx, img); // WEAR-SPEC D1: quai ba lô, dây áo choàng ôm trước ngực, ngay sau thân pet
    // WEAR-SPEC D2 (Boba ôm cốc): thân cốc → đồ cổ → ống hút + tay ôm cốc (kèm viền của chúng) → kính → mũ.
    const held = heldLayer(ctx, front('neck'));
    if (held) over(img, held.full);
    if (front('neck')) drawSlot('neck');
    if (held && front('neck')) overMasked(img, held.full, held.top);
    if (front('face')) drawSlot('face');
    if (front('head')) drawSlot('head');
  }
  if (front('charm')) drawSlot('charm');
  if (feature.over) feature.over(ctx, img);
  if (marks) MARKS.front(ctx, img);

  let anchors = Object.fromEntries(Object.entries(sk.anchors).map(([k, [x, y]]) => [k, [x, y]]));
  if (opts.anchors) {
    for (const [k, [x, y]] of Object.entries(anchors)) setPx(img, Math.floor(x), Math.floor(y), ANCHOR_COLORS[k]);
  }
  if (!mirrorW) return { img, anchors, sk };
  anchors = Object.fromEntries(Object.entries(anchors).map(([k, [x, y]]) => [k, [FW - x, y]]));
  return { img: mirror(img), anchors, sk };
}

/**
 * Lớp đồ cầm tay (cốc trà sữa của Boba): { full, top } với full = cốc + ống hút + tay ôm cốc, viền chung (như bản mẫu),
 * top = mặt nạ ống hút + tay ôm cốc kèm vòng viền 1 px của chúng (phần phải nằm trên đồ cổ, WEAR-SPEC D2; chỉ tính khi
 * `withTop`, tức là có đồ cổ). Ống hút nhận ra theo màu STRAW của features.js. null nếu không cầm gì.
 */
function heldLayer(ctx, withTop) {
  const { pixels, parts } = ctx.held;
  if (!pixels.length && !parts.length) return null;
  const layer = newBuf();
  const top = newBuf();
  for (const [x, y, c] of pixels) {
    if (x < 0 || x >= FW || y < 0 || y >= FH) continue;
    setPx(layer, x, y, c);
    if (c === STRAW) setPx(top, x, y, c);
  }
  if (parts.length) {
    const paws = colourise(parts, []);
    over(layer, paws);
    over(top, paws);
  }
  if (!withTop) return { full: outline(layer), top: null };
  const ring = outline(top);
  const mask = new Uint8Array(NPX);
  for (let k = 0; k < NPX; k++) mask[k] = ring.data[k * 4 + 3] ? 1 : 0;
  return { full: outline(layer), top: mask };
}

/** Chép các điểm của `src` nằm trong mặt nạ `mask` lên `dst` (điểm trong suốt của src cũng chép: xóa). */
function overMasked(dst, src, mask) {
  for (let k = 0; k < NPX; k++) {
    if (!mask[k]) continue;
    for (let c = 0; c < 4; c++) dst.data[k * 4 + c] = src.data[k * 4 + c];
  }
}

/**
 * earsOver (khe đầu, chỉ hướng S, tai mèo hai bên đầu): vẽ lại tai của pet (kèm viền) lên trên mũ chóp, mũ nồi, mũ lưỡi
 * trai. Mặt nạ tai = những điểm của pet thay đổi khi bỏ phần tai (như hw.py ear_mask của họa sĩ).
 */
function earsOverHat(ctx, img, pet) {
  const [a, b] = ctx.earParts ?? [0, 0];
  if (b <= a) return;
  const bare = outline(colourise([...ctx.parts.slice(0, a), ...ctx.parts.slice(b)], ctx.pixels));
  for (let k = 0; k < NPX; k++) {
    const i = k * 4;
    if (!pet.data[i + 3]) continue;
    if (pet.data[i] === bare.data[i] && pet.data[i + 1] === bare.data[i + 1] && pet.data[i + 2] === bare.data[i + 2] && pet.data[i + 3] === bare.data[i + 3]) continue;
    for (let c = 0; c < 4; c++) img.data[i + c] = pet.data[i + c];
  }
}

/** Mọi khung của hoạt ảnh `anim` (ANIMS) ở hướng `view`: { fps, loop, frames: [{ img, anchors, view }] }. */
export function renderAnim(species, stage, anim, view = 'S', wear = {}, opts = {}) {
  const sp = speciesOf(species);
  const def = ANIMS[anim] ?? ANIMS.idle;
  const frames = animPoses(sp, anim, view).map((p, i) => {
    const { view: fv, ...pose } = p;
    const v = fv ?? view;
    const r = renderFrame(sp, stage, v, pose, wear, { ...opts, tick: (opts.tick ?? 0) + i });
    return { img: r.img, anchors: r.anchors, view: v };
  });
  return { fps: def.fps, loop: def.loop, frames };
}

// ---------------------------------------------------------------- hình món đồ (túi đồ, cửa hàng, bé khách mời Petdex)

const iconCache = new Map();
/**
 * Hình món `id` đúng như vẽ lên người ở hướng S (trên Boba trưởng thành, không có pet), cắt sát. Với món có dữ liệu
 * (gói vẽ phase 2) đó chính là hình dán S đã viền, cỡ 1x (đồ mặt: viền bóng ngoài, tròng kính để trống):
 * { img, pivot: [x, y], lean } với pivot = vị trí điểm neo khe của món trong hình (để đặt món lên bé khách mời) và
 * lean = { side, dx } khi món đội đầu lệch sang một bên theo bề ngang đầu (nơ, hoa cài: hình cũ có `side`), để bé khách
 * mời lệch theo đầu của chính bé (wearSpotAt trong rig.js). Hàm vẽ món nhận đủ ctx như khi vẽ lên pet (makeCtx), trừ
 * ctx.chin = null (hình biểu tượng không bị cằm che). Món vẽ lỗi thì trả về null (túi đồ hiện ô trống), không ném lỗi.
 * opts.grow: vẽ trên Boba to hơn chừng ấy lần (cỡ người, như dáng theo cấp): món vẽ theo bộ xương (khăn quàng) rộng ra,
 * hình cũ cố định thì không đổi. Bé khách mời Petdex dùng cho khe cổ (petsheet.js guestSheet).
 */
export function wearIcon(id, { grow = 1 } = {}) {
  const key = `${id}|${grow}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const slot = WEARABLES[id]?.slot;
  const e = slot && wearEntry(slot, id);
  let out = null;
  if (e) {
    try {
      const sp = SPECIES_BY_ID.boba;
      const adult = lookOf('adult');
      const st = grow === 1 ? adult : { ...adult, scale: adult.scale * grow };
      const sk = skeleton(sp, st, 'S', {});
      const ctx = makeCtx(sp, st, sk, 'S', {}, { [slot]: id });
      collectParts(ctx, false);
      const img = newBuf();
      e.S(ctx, img);
      e.over?.(ctx, img);
      const b = bbox(img);
      if (b) {
        const [ax, ay] = sk.anchors[slot];
        const side = slot === 'head' ? (e.def?.side ?? 0) : 0;
        const dx = side ? pyRound(ax + (e.def.dx ?? 0) + side * sk.head[2]) - pyRound(ax + (e.def.dx ?? 0)) : 0;
        out = {
          img: crop(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1),
          pivot: [pyRound(ax) - b.x0, pyRound(ay) - b.y0],
          lean: { side, dx },
        };
      }
    } catch (err) {
      console.warn(`rig2 wearIcon(${id}):`, err);
      out = null;
    }
  }
  iconCache.set(key, out);
  return out;
}
/** Xóa bộ nhớ đệm hình món (kiểm thử, hoặc pet lab sau khi sửa nóng một món). */
export const clearWearIcons = () => {
  iconCache.clear();
  clearStampCache();
};

// ---------------------------------------------------------------- tình trạng thư viện (cho contact sheet, kiểm thử, hướng dẫn)

/** Những gì đã vẽ theo bản mẫu và những gì còn là hình tạm (fallback / stub). */
export function libraryStatus() {
  const wearDone = { head: HEAD, face: FACE, neck: NECK, back: BACK, charm: CHARM };
  return {
    archetypes: Object.fromEntries(Object.entries(ARCHETYPES).map(([k, a]) => [k, a.stub ? 'stub' : 'done'])),
    ears: { done: Object.keys(EARS), fallback: Object.keys(EARS_FALLBACK) },
    tails: { done: Object.keys(TAILS), fallback: Object.keys(TAILS_FALLBACK) },
    faces: { done: Object.keys(FACES), fallback: Object.keys(FACES_FALLBACK) },
    patterns: { done: Object.keys(PATTERNS), fallback: Object.keys(PATTERNS_FALLBACK) },
    features: { done: Object.keys(FEATURES), fallback: Object.keys(FEATURES_FALLBACK) },
    wear: Object.fromEntries(SLOTS.map((s) => [s, {
      done: Object.keys(wearDone[s]),
      fallback: Object.entries(WEARABLES).filter(([id, w]) => w.slot === s && !wearDone[s][id]).map(([id]) => id),
    }])),
  };
}

/** Kiểm tra nhanh một khung: { offPalette, semi, edge } (số điểm vi phạm). */
export function auditFrame(img) {
  let offPalette = 0;
  let semi = 0;
  let edge = 0;
  for (let k = 0; k < NPX; k++) {
    const a = img.data[k * 4 + 3];
    if (!a) continue;
    if (a !== 255) semi++;
    const hex = `#${[0, 1, 2].map((c) => img.data[k * 4 + c].toString(16).padStart(2, '0')).join('')}`;
    if (!inPalette(hex)) offPalette++;
    const x = k % FW;
    const y = Math.floor(k / FW);
    if (x === 0 || y === 0 || x === FW - 1 || y === FH - 1) edge++;
  }
  return { offPalette, semi, edge };
}
