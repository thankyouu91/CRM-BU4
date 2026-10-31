// Rig 2.0: vẽ pet ngũ hành theo phong cách 16-bit nhìn từ trên xuống, 4 hướng (S trước, E ngang phải, N sau, W = lật E).
// File DUY NHẤT nhập mọi sổ đăng ký (dáng khung, tai, đuôi, mặt, hoa văn, đặc điểm, dấu hiệu, đồ đeo) và ghép một khung hình.
// Chủ sở hữu: dev. Họa sĩ KHÔNG cần sửa file này: thêm/sửa mục trong file của mình là pipeline tự dùng.
// Không đụng DOM (chạy được trong Node). js/rig.js bọc lại thành canvas cho game.
//
// Thứ tự ghép một khung (bản mẫu pets-pilot, proposal.txt mục 4):
//   bộ phận: đuôi → tai → thân (dáng khung) → đầu → mặt → hoa văn → đặc điểm → dấu hiệu; mắt và nét mặt là điểm tô thẳng
//   → tô bóng (colourise) → viền #2e1d14
//   S/E: hào quang → đồ lưng → PET → đồ cổ (cằm che) → đồ cầm tay (lớp riêng, viền riêng) → đồ mặt → đồ đầu → bùa → đốm sáng
//   N:   hào quang → PET → đồ mặt → đồ cổ → đồ đầu → đồ lưng → bùa → đốm sáng
//   W: vẽ E rồi lật cả khung và điểm neo.
import { LEVEL_FORMS, SPECIES_BY_ID, WEARABLES, formIndex } from '../shared/pets.js';
import {
  FH, FW, INK, NPX, PALETTE, PIVOT, RAMPS, bbox, colourise, crop, groupMask, inPalette, mAbove, mAnd, mirror, newBuf, outline, over, pyRound, setPx,
} from './core.js';
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
import { HEAD, headFor } from './wear/head.js';
import { NECK, neckFor } from './wear/neck.js';

export { FW, FH, PIVOT, INK, PALETTE, RAMPS, inPalette, ANIMS, ARCHETYPES, animPoses, archetypeOf, lookOf, skeleton };
export const VIEWS = ['S', 'E', 'N', 'W'];
export const SLOTS = ['head', 'face', 'neck', 'back', 'charm'];

const WEAR_FOR = { head: headFor, face: faceWearFor, neck: neckFor, back: backFor, charm: charmFor };
/** Mục vẽ của món `id` ở khe `slot` (null nếu món lạ). */
export const wearEntry = (slot, id) => (id && WEAR_FOR[slot] ? WEAR_FOR[slot](id) : null);

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
  earsFor(sp.ears)[v](ctx);
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
  const drawSlot = (slot) => {
    const e = wearEntry(slot, ctx.wear[slot]);
    if (e && WEARABLES[ctx.wear[slot]]?.slot === slot) e[v](ctx, img);
  };
  if (marks) MARKS.behind(ctx, img);
  if (v !== 'N') drawSlot('back');
  over(img, pet);
  if (v === 'N') {
    drawSlot('face');
    drawSlot('neck');
    drawSlot('head');
    drawSlot('back');
  } else {
    drawSlot('neck');
    if (ctx.held.pixels.length || ctx.held.parts.length) {
      const layer = newBuf();
      for (const [x, y, c] of ctx.held.pixels) if (x >= 0 && x < FW && y >= 0 && y < FH) setPx(layer, x, y, c);
      if (ctx.held.parts.length) over(layer, colourise(ctx.held.parts, []));
      over(img, outline(layer));
    }
    drawSlot('face');
    drawSlot('head');
  }
  drawSlot('charm');
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
 * Hình món `id` đúng như vẽ lên người ở hướng S (trên Boba trưởng thành, không có pet), cắt sát:
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
export const clearWearIcons = () => iconCache.clear();

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
