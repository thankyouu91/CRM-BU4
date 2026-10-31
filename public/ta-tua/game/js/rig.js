// Bộ khung vẽ pet ngũ hành, bản Rig 2.0: lớp bọc canvas cho game quanh js/rig2/ (vẽ thuần trên bộ đệm RGBA, không DOM).
// Bộ xương vẫn là nguồn sự thật duy nhất cho dáng và điểm neo đồ đeo; nay vẽ theo phong cách 16-bit, khóa bảng 48 màu,
// viền #2e1d14, và có 4 hướng: S (trước), E (ngang phải), N (sau), W (lật E). Khung hình 48×48, chân ở (24, 44).
// Giữ nguyên mọi tên mà các file khác đang nhập (skeleton, drawFrame, animFrames, formStage, wearImage, wearSpotAt, RIG_ANIMS...),
// thêm tham số hướng `view` (mặc định 'S'). Hình vẽ thật nằm trong js/rig2/ (mỗi họa sĩ một file, xem ARTIST-GUIDE).
import { makeCanvas } from './pixel.js';
import { ELEMENTS, LEVEL_FORMS, LIFE_STAGES, SPECIES_BY_ID, WEARABLES, formIndex } from './shared/pets.js';
import { ANIMS, FH, FW, PIVOT, animPoses, lookOf, renderFrame, skeleton as skeleton2, speciesOf, wearIcon } from './rig2/index.js';

/** Cỡ một khung hình (đã gồm viền). Trước Rig 2.0 là 44×50 chưa viền; nay là ô 48×48. */
export const RIG_W = FW;
export const RIG_H = FH;
/** Điểm neo của khung: chân, giữa đáy (hàng 44 là viền dưới chân). */
export const RIG_PIVOT = PIVOT;
export const RIG_VIEWS = ['S', 'E', 'N', 'W'];

/** Bộ đệm RGBA của rig2 → canvas. */
export function toCanvas(buf) {
  const [c, g] = makeCanvas(buf.w, buf.h);
  const id = g.createImageData(buf.w, buf.h);
  id.data.set(buf.data);
  g.putImageData(id, 0, 0);
  return c;
}

const xy = ([x, y]) => ({ x, y });
const flipX = (x, view) => (view === 'W' ? FW - x : x);

/**
 * Bộ xương của một khung hình (dạng cũ: { head: { x, y, rx, ry, top }, body, ground, eyeY, eyeDx, anchors: { k: { x, y } } }),
 * theo tọa độ ô 48×48. `stage`: mục LIFE_STAGES (có thể đã qua formStage), mã giai đoạn hoặc look; `view`: 'S' | 'E' | 'N' | 'W'.
 */
export function skeleton(sp, stage, pose = {}, view = 'S') {
  const k = skeleton2(speciesOf(sp), lookOf(stage), view === 'W' ? 'E' : view, pose);
  const [hx, hy, hrx, hry] = k.head;
  const [bx, by, brx, bry] = k.body;
  const anchors = Object.fromEntries(Object.entries(k.anchors).map(([n, [x, y]]) => [n, xy([flipX(x, view), y])]));
  return {
    ground: k.ground, legH: k.legH, eyeY: k.eyeY, eyeDx: k.eyeDx, big: k.big, view,
    head: { x: flipX(hx, view), y: hy, rx: hrx, ry: hry, top: k.htop },
    body: { x: flipX(bx, view), y: by, rx: brx, ry: bry, top: k.btop },
    anchors,
  };
}

// ---------------------------------------------------------------- dáng theo cấp

/** Giai đoạn tuổi `stageKey` đã nhân cỡ người theo dáng của cấp `level` (cứ 10 cấp lớn thêm một chút). */
export function formStage(stageKey, level = 1) {
  const stage = LIFE_STAGES.find((s) => s.key === stageKey) ?? LIFE_STAGES.at(-2);
  const grow = LEVEL_FORMS[formIndex(level)].grow;
  return grow === 1 ? stage : { ...stage, look: { ...stage.look, scale: stage.look.scale * grow } };
}

// ---------------------------------------------------------------- hoạt ảnh

/**
 * Hoạt ảnh của bộ khung: tên → { fps, loop, frames: [pose] } (rig2/skeleton.js ANIMS):
 * idle, walk (đi bộ, mọi hướng), wave, jump, sad, think, busy, spin (quay thật S → E → N → W).
 * 'run' của bản cũ nay là walk (animFrames vẫn nhận 'run').
 */
export const RIG_ANIMS = ANIMS;

/**
 * Vẽ một khung hình: pet `species` ở giai đoạn `stageKey`, dáng `pose`, đeo `wear` ({ head, face, neck, back, charm }).
 * opts: level (cấp: dáng theo LEVEL_FORMS), view ('S' | 'E' | 'N' | 'W'; bản cũ dùng pose.mirror nghĩa là 'W'),
 * anchors (chấm màu ở điểm neo để soát). Trả về canvas 48×48 ở độ phân giải pixel nghệ thuật, chân ở hàng 44.
 */
export function drawFrame(species, stageKey, pose = {}, wear = {}, tick = 0, opts = {}) {
  const { view: poseView, mirror, ...rest } = pose ?? {};
  const view = opts.view ?? poseView ?? (mirror ? 'W' : 'S');
  const stage = typeof stageKey === 'string' ? formStage(stageKey, 1) : stageKey;
  const { img } = renderFrame(speciesOf(species), stage, view, rest, wear ?? {}, { level: opts.level ?? 1, tick, anchors: opts.anchors });
  return toCanvas(img);
}

/**
 * Các khung của một hoạt ảnh, chưa vẽ: [{ pose, view, tick }] (để vẽ dần từng khung, như petsheet.js rigSheet);
 * drawFrame(species, stageKey, pose, wear, tick, { ...opts, view }) cho đúng khung mà animFrames vẽ.
 */
export function animSteps(species, anim, opts = {}) {
  const name = anim === 'run' ? 'walk' : ANIMS[anim] ? anim : 'idle';
  const view = opts.view ?? 'S';
  return animPoses(speciesOf(species), name, view).map((pose, i) => ({ pose, view: pose.view ?? view, tick: i }));
}

/** Toàn bộ khung hình của một hoạt ảnh (đã tính sẵn để chạy mượt); `opts.view` chọn hướng (mặc định S). */
export function animFrames(species, stageKey, anim, wear = {}, opts = {}) {
  const sp = speciesOf(species);
  return animSteps(sp, anim, opts).map(({ pose, view, tick }) => drawFrame(sp, stageKey, pose, wear, tick, { ...opts, view }));
}

// ---------------------------------------------------------------- đồ đeo

const wearCanvas = new Map();
/**
 * Hình món `id` đúng như vẽ lên người (hướng S), dạng canvas (Túi đồ, Siêu thị dùng làm biểu tượng); null nếu chưa có hình.
 * opts.grow: như wearIcon (bé khách mời Petdex dùng khăn rộng hơn để lộ ra hai bên người).
 */
export function wearImage(id, opts = {}) {
  const key = `${id}|${opts.grow ?? 1}`;
  if (!wearCanvas.has(key)) {
    const icon = wearIcon(id, opts);
    wearCanvas.set(key, icon ? toCanvas(icon.img) : null);
  }
  return wearCanvas.get(key);
}

/**
 * Góc trên-trái để đặt hình wearImage(`id`) khi biết các điểm neo (`anchors`: { head: { x, y }, ... }).
 * Dùng cho bé khách mời Petdex (điểm neo dò từ ảnh). Hình đã gồm độ lún của món; món đội đầu lệch một bên (nơ, hoa cài)
 * thì lệch theo `headRx` (nửa bề ngang đầu của chính bé khách mời) như luật cũ: neo + side × headRx + lún − chốt.
 * opts: như wearImage (phải giống nhau để chốt khớp hình).
 */
export function wearSpotAt(id, anchors, headRx, opts = {}) {
  const icon = wearIcon(id, opts);
  const anchor = anchors?.[WEARABLES[id]?.slot];
  if (!icon || !anchor) return { x: 0, y: 0 };
  const { side, dx } = icon.lean ?? { side: 0, dx: 0 };
  const lean = side && Number.isFinite(headRx) ? Math.round(side * headRx) - dx : 0;
  return { x: anchor.x - icon.pivot[0] + lean, y: anchor.y - icon.pivot[1] };
}

// ---------------------------------------------------------------- tiện ích cũ

const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** Trộn hai màu hex (giữ cho tương thích; Rig 2.0 không trộn màu lúc chạy, mọi màu lấy từ bảng 48 màu). */
export function mix(a, b, t) {
  const x = hexRgb(a);
  const y = hexRgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

export const elementOf = (sp) => ELEMENTS[sp.element];
export { SPECIES_BY_ID };
