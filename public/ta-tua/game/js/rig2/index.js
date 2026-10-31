// Rig 2.0: vẽ pet ngũ hành theo phong cách 16-bit nhìn từ trên xuống, 4 hướng (S trước, E ngang phải, N sau, W = lật E).
// File DUY NHẤT nhập mọi sổ đăng ký (dáng khung, tai, đuôi, mặt, hoa văn, đặc điểm, dấu hiệu, đồ đeo) và ghép một khung hình.
// Chủ sở hữu: dev. Họa sĩ KHÔNG cần sửa file này: thêm/sửa mục trong file của mình là pipeline tự dùng.
// Không đụng DOM (chạy được trong Node). js/rig.js bọc lại thành canvas cho game.
//
// Thứ tự ghép một khung (bản mẫu pets-pilot, proposal.txt mục 4; đồ đeo theo WEAR-SPEC D1, D2, D6):
//   bộ phận: đuôi → tai → thân (dáng khung) → đầu → mặt → hoa văn → đặc điểm → dấu hiệu; mắt và nét mặt là điểm tô thẳng
//   → tô bóng (colourise) → viền #2e1d14
//   Đồ đeo có "layer" (wear/stamp.js): front = trên pet, behind = dưới pet, behindNfront = dưới pet ở S/E, trên pet ở N;
//   áo choàng, áo tơi (`drape`) trên thú bốn chân nhìn ngang: trên pet (WEAR-SPEC D4, phủ lưng từ gáy).
//   S/E: hào quang → đồ DƯỚI pet (lưng, bùa, rồi đầu/mặt/cổ nếu có: vầng hào quang) → PET (nhìn ngang: đồ lưng dưới pet
//        vẽ lại lên phần đuôi thò ra ngoài thân, backOverTail) → phần "over" của đồ lưng
//        (quai ba lô) → thân cốc → đồ cổ (cằm che) → ống hút + tay ôm cốc → đồ mặt → đồ đầu (tai mèo vẽ lại lên mũ có
//        earsOver, chỉ S) → bùa (nếu trên pet) → đốm sáng
//   N:   hào quang → đồ DƯỚI pet → PET → đồ mặt → đồ cổ → đồ đầu → đồ lưng (+ over) → bùa → đốm sáng
//   W: vẽ E rồi lật cả khung và điểm neo.
import { LEVEL_FORMS, SPECIES_BY_ID, WEARABLES, formIndex } from '../shared/pets.js';
import {
  FH, FW, INK, NPX, PALETTE, PIVOT, RAMPS, bbox, colourise, crop, groupMask, inPalette, mAbove, mAnd, mirror, newBuf, outline, over, pyRound, setPx,
} from './core.js';
import { anchorPixel, clearStampCache } from './wear/stamp.js';
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
/**
 * Món ở khe `slot` vẽ TRÊN pet ở hướng `v` (S/E/N) không. `arch`: mã dáng khung của pet (skeleton.js ARCHETYPES):
 * áo choàng, áo tơi (`drape`) trên thú bốn chân nhìn ngang thì vẽ trên pet, phủ lưng từ gáy tới mông (WEAR-SPEC D4:
 * neo lưng đã dời lên vai; vẽ dưới thân dài thì chỉ lộ cổ áo và một mẩu vạt sau mông).
 */
export const wearInFront = (slot, entry, v, arch) => {
  if (entry?.drape && arch === 'quad' && v === 'E') return true;
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
  // Bẹp người (lấy đà, tiếp đất) mà chạm mép trái/phải (rồng dài nhìn ngang ở cấp cao): bẹp ít lại.
  let lift = pose.lift ?? 0;
  let sq = pose.sq ?? 0;
  while (opts.fit !== false) {
    const b = bbox(r.img);
    if (b && b.y0 < 1 && (lift < 0 || sq > 0)) {
      if (lift < 0) lift += 1;
      else sq -= 1;
    } else if (b && (b.x0 < 1 || b.x1 > FW - 2) && sq < 0) {
      sq = Math.min(0, sq + 0.5);
    } else break;
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
    handsBusy: Boolean(featureFor(sp.feature).holds), chin: null, headTopCovered: headTopCovered(wear?.head),
  };
}

/**
 * ctx.headTopCovered: bé đang đội một món che ĐỈNH đầu (vương miện, mũ...). false khi không đội gì hoặc món chừa đỉnh
 * đầu (`openTop`: vầng hào quang lơ lửng phía trên, hoa cài và nơ ở một bên), để đặc điểm trên đỉnh đầu (mầm lá, ngọn
 * lửa...) chỉ giấu khi thật sự bị che. Hình cũ dự phòng coi như che.
 */
function headTopCovered(id) {
  const e = id && WEARABLES[id]?.slot === 'head' ? wearEntry('head', id) : null;
  return Boolean(e) && !e.openTop;
}

/** Bước 1 của pipeline: gom bộ phận của pet vào ctx.parts / ctx.pixels (đặt luôn ctx.headMask, ctx.held). */
function collectParts(ctx, marks) {
  const { sp, view: v } = ctx;
  const arch = archetypeOf(sp);
  const feature = featureFor(sp.feature);
  // Dáng tự vẽ đuôi (rồng: thân nối liền thành đuôi, `ownsTail`) thì bỏ qua parts/tails.js (SERP-01).
  if (!arch.ownsTail) tailFor(sp)[v](ctx);
  ctx.tailParts = [0, ctx.parts.length]; // để vẽ đồ lưng lên phần đuôi thò ra ngoài thân (backOverTail)
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
  const ctx = makeCtx(sp, st, sk, v, pose, wear, { tick: opts.tick, level });
  const marks = opts.marks !== false;

  // 1) bộ phận
  collectParts(ctx, marks);

  // 2) tô bóng, viền một lần cho cả khối
  const pet = outline(colourise(ctx.parts, ctx.pixels));

  // Cằm che dải đồ cổ (chừa hàng cằm cuối để dải nhét dưới cằm). Tính theo điểm neo cổ: dáng thường có cổ ở
  // hcy + hry − 0.2 nên y hệt elip đầu (hcy + hry − 1.0); dáng tròn nâng cổ của bé nhỏ tuổi lên theo khối (round.js).
  if (v !== 'N') ctx.chin = mAnd(groupMask(ctx.parts, 'head'), mAbove(sk.anchors.neck[1] - 0.8));
  // Thăm dò của hiddenBehind: chỉ cần pet đã tô và ctx (đã có cằm), không ghép đồ đeo.
  if (opts.probe) return { ctx, pet };

  // 3) ghép
  const img = newBuf();
  const worn = {};
  for (const slot of ['back', 'charm', 'head', 'face', 'neck']) {
    const id = ctx.wear[slot];
    // Dáng không có cổ (tròn, rồng: `neckN: false`): nhìn sau, neo cổ nằm giữa lưng, dải cổ vắt ngang lưng như thắt
    // lưng, nên không vẽ đồ cổ ở N (S, E vẫn vẽ dưới cằm).
    if (slot === 'neck' && v === 'N' && ARCHETYPES[sk.arch]?.neckN === false) continue;
    const e = WEARABLES[id]?.slot === slot ? wearEntry(slot, id) : null;
    if (e) worn[slot] = e;
  }
  const front = (slot) => worn[slot]
    && (wearInFront(slot, worn[slot], v, sk.arch) || hiddenBehind(sp, st, v, slot, ctx.wear[slot], level));
  const drawSlot = (slot, dst = img) => {
    worn[slot][v](ctx, dst);
    if (slot === 'head' && v === 'S' && worn.head.earsOver && EARS_OVER.has(sp.ears)) earsOverHat(ctx, dst, pet);
  };
  if (marks) MARKS.behind(ctx, img);
  // Đồ dưới pet: xa nhất trước (lưng), rồi bùa, rồi món đầu/mặt/cổ có layer behind (vầng hào quang).
  // Đồ lưng dưới pet ở hướng ngang vẽ riêng một lớp để sau đó đè lên phần đuôi thò ra ngoài thân (backOverTail).
  const backBehindE = v === 'E' && worn.back && !front('back') ? newBuf() : null;
  for (const slot of ['back', 'charm', 'head', 'face', 'neck']) {
    if (!worn[slot] || front(slot)) continue;
    if (slot === 'back' && backBehindE) {
      drawSlot('back', backBehindE);
      over(img, backBehindE);
    } else drawSlot(slot);
  }
  over(img, pet);
  if (backBehindE) backOverTail(ctx, img, backBehindE, pet);
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

/** Món đeo phải lộ ra ít nhất chừng này điểm (khớp kiểm thử "món nào đang đeo cũng hiện ra"). */
export const VISIBLE_MIN = 8;
const hiddenCache = new Map();
/** Pet đã tô + ctx của dáng đứng yên theo loài, giai đoạn, cấp, hướng (thăm dò của hiddenBehind). */
const probeCache = new Map();
/**
 * Món bùa (S, E) hoặc đồ lưng (E) vốn vẽ DƯỚI pet nhưng gần như bị pet che hết (đuôi rồng cuộn, đuôi xòe của chim, thân
 * cá chép to): vẽ lên TRÊN pet thay vì để món đã mua biến mất. "Gần như hết" = lộ ra ít hơn VISIBLE_MIN điểm (cánh nhìn
 * ngang vốn chỉ ló chóp sau thân: vẫn đủ điểm, giữ dưới pet). Quyết theo dáng đứng yên (pose {}, tick 0) của loài, giai đoạn, cấp và hướng, rồi dùng
 * cho mọi khung (đi, nhảy...): không nhấp nháy trước / sau giữa các khung. Bùa vẫn nấp sau đuôi khi còn lộ đủ (báo cáo
 * khe bùa). Nhìn trước, đồ lưng dùng phần "over" (khóa áo, quai ba lô) thay cho luật này.
 */
function hiddenBehind(sp, st, v, slot, id, level = 1) {
  if (!(slot === 'charm' && (v === 'S' || v === 'E')) && !(slot === 'back' && v === 'E')) return false;
  const base = `${sp.id}|${st.scale}|${st.head}|${st.body}|${st.leg}|${st.eye}|${st.elder ? 1 : 0}|${v}|${formIndex(level)}`;
  const key = `${base}|${slot}|${id}`;
  if (hiddenCache.has(key)) return hiddenCache.get(key);
  // MỘT lần dựng pet (dáng đứng yên, không dấu hiệu) cho mỗi loài, giai đoạn, cấp, hướng, dùng chung cho mọi món; mỗi món
  // chỉ còn dán hình món lên một bộ đệm rồi ghép đúng thứ tự như draw() (đồ dưới pet, pet, đồ lưng trên đuôi, cốc của
  // Boba; hoặc pet rồi món trên cùng). Trước đây mỗi món dựng lại cả pet 3 lần ngay trong khung đầu tiên (33 - 297 ms).
  let probe = probeCache.get(base);
  if (!probe) {
    const { ctx, pet } = draw(sp, st, v, {}, {}, { marks: false, probe: true }, level);
    const held = heldLayer(ctx, false);
    const bare = newBuf();
    over(bare, pet);
    if (held) over(bare, held.full);
    probe = { ctx, pet, held, bare };
    probeCache.set(base, probe);
  }
  const entry = WEARABLES[id]?.slot === slot ? wearEntry(slot, id) : null;
  // Món vốn đã vẽ trên pet ở hướng này (áo choàng trên thú bốn chân nhìn ngang, D4): không có gì để kéo lên.
  if (!entry || wearInFront(slot, entry, v, probe.ctx.sk.arch)) {
    hiddenCache.set(key, false);
    return false;
  }
  const { ctx, pet, held, bare } = probe;
  const layer = newBuf();
  entry[v](ctx, layer);
  // Vẽ dưới pet (như draw(): đồ lưng nhìn ngang còn phủ lên phần đuôi thò ra ngoài thân).
  const behind = newBuf();
  over(behind, layer);
  over(behind, pet);
  if (slot === 'back' && v === 'E') backOverTail(ctx, behind, layer, pet);
  entry.over?.(ctx, behind); // WEAR-SPEC D1: phần "over" luôn vẽ ngay sau pet
  if (held) over(behind, held.full);
  // Vẽ trên pet: đồ lưng nằm dưới cốc của Boba, bùa trên cùng.
  const ahead = newBuf();
  over(ahead, pet);
  if (slot === 'back') {
    over(ahead, layer);
    entry.over?.(ctx, ahead);
    if (held) over(ahead, held.full);
  } else {
    if (held) over(ahead, held.full);
    over(ahead, layer);
  }
  const diff = (a) => {
    let n = 0;
    for (let k = 0; k < NPX * 4; k += 4) if ([0, 1, 2, 3].some((c) => a.data[k + c] !== bare.data[k + c])) n++;
    return n;
  };
  // Đồ đeo vẽ trước pet mà cũng không đổi gì (món rỗng, ngoài ô) thì giữ lớp của món.
  const hidden = diff(behind) < VISIBLE_MIN && diff(ahead) >= VISIBLE_MIN;
  hiddenCache.set(key, hidden);
  return hidden;
}

/** Món `id` (khe `slot`) trên loài, giai đoạn, cấp này có bị kéo lên trên pet vì vẽ dưới pet thì gần như khuất hết không. */
export function wearHidden(species, stage, view, slot, id, level = 1) {
  const sp = speciesOf(species);
  return hiddenBehind(sp, fittedLook(sp, stage, level), view === 'W' ? 'E' : view, slot, id, level);
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
 * Nhìn ngang, đồ lưng vẽ dưới pet (cánh, ba lô, áo choàng trên dáng không phải bốn chân) nằm TRÊN phần đuôi thò ra ngoài
 * thân: đuôi to (sóc, gấu mèo đỏ, chim xòe đuôi) mọc ở mông, xa người xem hơn món đeo ở vai, và nếu vẽ đè thì che mất cả
 * món. Ở những điểm chỉ có đuôi (pet khác với pet bỏ đuôi, và bỏ đuôi thì ở đó trống hoặc là viền của thân), lấy hình
 * "món lưng dưới pet bỏ đuôi" (`layer` = lớp món lưng): món phủ lên đuôi, viền của thân vẫn nằm trên món. Đuôi vắt
 * trước thân giữ nguyên. Bùa không theo luật này (bùa nấp sau đuôi, báo cáo khe bùa).
 */
function backOverTail(ctx, img, layer, pet) {
  const [a, b] = ctx.tailParts ?? [0, 0];
  if (b <= a) return;
  const bare = outline(colourise([...ctx.parts.slice(0, a), ...ctx.parts.slice(b)], ctx.pixels));
  const ink = [1, 3, 5].map((i) => parseInt(INK.slice(i, i + 2), 16));
  for (let k = 0; k < NPX; k++) {
    const i = k * 4;
    if (!layer.data[i + 3] || !pet.data[i + 3]) continue;
    if ([0, 1, 2, 3].every((c) => pet.data[i + c] === bare.data[i + c])) continue; // không phải điểm của đuôi
    const isInk = bare.data[i + 3] && ink.every((c, j) => bare.data[i + j] === c);
    if (bare.data[i + 3] && !isInk) continue; // đuôi vắt trước thân ở đây
    const src = isInk ? bare : layer;
    for (let c = 0; c < 4; c++) img.data[i + c] = src.data[i + c];
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
 * Hình món `id` đúng như vẽ lên người (trên Boba trưởng thành, không có pet), cắt sát, cỡ 1x: hình dán đã viền (đồ mặt:
 * viền bóng ngoài, tròng kính để trống) ở hướng `icon` của món: S (nhìn trước) trừ món mà hình S chỉ là dải ló ra quanh
 * người (áo choàng, áo tơi, ba lô: N, thấy cả món; khăn quàng: N, dải khăn và hai đuôi). opts.view ép một hướng ('S',
 * 'E', 'N'), ví dụ bé khách mời Petdex nhìn trước muốn hình S của đồ lưng.
 * Trả về { img, pivot: [x, y], lean, view } với pivot = điểm ảnh của hình rơi đúng chỗ luật đặt của khe đặt nó trên pet
 * (wear/stamp.js anchorPixel: đầu, cổ floor(x + .5); mặt theo ô mắt; lưng floor; bùa pyRound) để đặt món lên bé khách
 * mời, và lean = { side, dx } (chỉ hình cũ dự phòng: nơ, hoa cài lệch theo bề ngang đầu; hình dữ liệu đặt cố định theo
 * chốt như trên pet, nên side 0). Hàm vẽ món nhận đủ ctx như khi vẽ lên pet (makeCtx), trừ ctx.chin = null (hình biểu
 * tượng không bị cằm che). Món vẽ lỗi thì trả về null (túi đồ hiện ô trống), không ném lỗi.
 * opts.grow: vẽ trên Boba to hơn chừng ấy lần (cỡ người, như dáng theo cấp): món vẽ theo bộ xương rộng ra, hình dán cố
 * định thì không đổi (cả 55 món hiện nay). Bé khách mời Petdex vẽ đồ cổ đè lên ảnh của bé (petsheet.js guestSheet).
 */
export function wearIcon(id, { grow = 1, view } = {}) {
  const slot = WEARABLES[id]?.slot;
  const e = slot && wearEntry(slot, id);
  const v = ['S', 'E', 'N'].includes(view) ? view : e?.icon ?? 'S';
  const key = `${id}|${grow}|${v}`;
  if (iconCache.has(key)) return iconCache.get(key);
  let out = null;
  if (e) {
    try {
      const sp = SPECIES_BY_ID.boba;
      const adult = lookOf('adult');
      const st = grow === 1 ? adult : { ...adult, scale: adult.scale * grow };
      const sk = skeleton(sp, st, v, {});
      const ctx = makeCtx(sp, st, sk, v, {}, { [slot]: id });
      collectParts(ctx, false);
      const img = newBuf();
      e[v](ctx, img);
      // Phần "over" nhìn trước nằm ở neo cổ, xa hình chính (wear/stamp.js): hình túi đồ S chỉ là hình chính.
      if (v !== 'S') e.over?.(ctx, img);
      const b = bbox(img);
      if (b) {
        const [ax, ay] = sk.anchors[slot];
        const [px, py] = e.legacy ? [pyRound(ax), pyRound(ay)] : anchorPixel(slot, ctx);
        const side = e.legacy && slot === 'head' ? (e.def?.side ?? 0) : 0;
        const dx = side ? pyRound(ax + (e.def.dx ?? 0) + side * sk.head[2]) - pyRound(ax + (e.def.dx ?? 0)) : 0;
        out = {
          img: crop(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1),
          pivot: [px - b.x0, py - b.y0],
          lean: { side, dx },
          view: v,
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
  hiddenCache.clear();
  probeCache.clear();
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
