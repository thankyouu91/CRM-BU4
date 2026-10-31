// Rig 2.0, bộ xương: nguồn sự thật duy nhất cho dáng (pose) và điểm neo đồ đeo. Chủ sở hữu: dev rig (tư thế, hoạt ảnh).
// skeleton(sp, stage, view, pose) → khối thân, khối đầu, mặt đất, mắt, và 5 điểm neo { head, face, neck, back, charm }
// đã dịch theo dáng (nhún thở, bước đi, nhảy, bẹp, lệch đầu, lắc lạch bạch). Đồ đeo và bộ phận chỉ đọc từ đây.
// Port nguyên từ pets-pilot/scripts/rig2.py (skeleton, ANIMS, anim_frames).
import { LEVEL_FORMS, LIFE_STAGES, formIndex } from '../shared/pets.js';
import { CX, G } from './core.js';
import biped from './archetypes/biped.js';
import bird from './archetypes/bird.js';
import quad from './archetypes/quad.js';
import round from './archetypes/round.js';
import serpent from './archetypes/serpent.js';

/** Dáng khung theo `species.body` (shared/pets.js). Loài có dáng lạ thì dùng biped. */
export const ARCHETYPES = { biped, quad, bird, round, serpent };
export const archetypeOf = (sp) => ARCHETYPES[sp?.body] ?? biped;

/**
 * Giai đoạn tuổi: nhận mã ('adult'), mục của LIFE_STAGES, hoặc thẳng `look`.
 * `level` (cấp của bé) nhân cỡ người theo LEVEL_FORMS[].grow, như formStage() của rig.js cũ.
 */
export function lookOf(stage, level = 1) {
  let look;
  if (typeof stage === 'string' || stage === undefined || stage === null) {
    look = (LIFE_STAGES.find((s) => s.key === stage) ?? LIFE_STAGES.at(-2)).look;
  } else {
    look = stage.look ?? stage;
  }
  const grow = LEVEL_FORMS[formIndex(level)].grow;
  return grow === 1 ? look : { ...look, scale: look.scale * grow };
}

/**
 * Bộ xương của một khung hình. `view`: 'S' (trước), 'E' (ngang, quay phải), 'N' (sau); 'W' hãy vẽ 'E' rồi lật.
 * `pose`: lift (nhảy, âm là lên), bob, by (nhún thở), sway (lắc ngang), sq (bẹp/giãn), hx/hy (lệch đầu)...
 * Trả về số thực theo tọa độ ô 48×48 (xem core.js). body/head = [cx, cy, rx, ry].
 */
export function skeleton(sp, stage, view, pose = {}) {
  const arch = archetypeOf(sp);
  // Móc của dáng khung: cỡ gốc riêng cho một loài (dáng tròn: ếch thấp, bè ngang, mắt trên đỉnh). Mặc định arch.dims.
  const A = arch.dimsOf?.(sp) ?? arch.dims;
  const st = stage && stage.scale !== undefined ? stage : lookOf(stage);
  const hk = Math.sqrt(st.scale) * st.head;
  const bk = st.scale * st.body;
  const legH = Math.max(1.0, A.leg * st.leg);
  const ground = G + (pose.lift ?? 0);
  const bob = pose.bob ?? 0;
  const by = pose.by ?? 0;
  const sx = pose.sway ?? 0;
  const sq = pose.sq ?? 0;
  let [brx, bry] = view === 'E' ? A.side : A.body;
  brx = Math.max(3.6, brx * bk) - sq * 0.5;
  bry = Math.max(3.0, bry * bk) + sq;
  const hrx = A.head[0] * hk;
  const hry = A.head[1] * hk;
  let bcx;
  let hcx;
  if (view === 'E') {
    bcx = CX - A.eShift * Math.min(1, bk + 0.3) + sx;
    hcx = CX + A.fwd * Math.min(1, bk + 0.25) + sx + (pose.hx ?? 0);
  } else {
    bcx = CX + sx;
    hcx = CX + sx + (pose.hx ?? 0);
  }
  const bot = ground - legH + bob; // đáy thân
  const bcy = bot - bry + by * 0.5;
  const bryEff = bry - by * 0.5;
  const btop = bcy - bryEff;
  const overlap = A.overlap * Math.min(1.0, bk + 0.2);
  let hcy = btop + overlap - hry + (pose.hy ?? 0);
  if (st.elder) hcy += 1; // lão làng hơi còng
  const htop = hcy - hry;
  const eyeY = hcy + hry * (A.eyeK ?? 0.16); // eyeK: độ cao hàng mắt theo bán kính đầu (âm = trên tâm đầu)
  const eyeDx = Math.max(3.0, hrx * 0.43);
  const big = st.eye > 1.1;
  let face;
  let headA;
  let neck;
  if (view === 'E') {
    face = [hcx + hrx * 0.46, eyeY];
    headA = [hcx - 1.0, htop];
    neck = [A.neckE === 'head' ? hcx - 2.0 : (bcx + hcx) / 2 + 1.0, hcy + hry - 0.2];
  } else {
    face = [hcx, eyeY];
    headA = [hcx, htop];
    neck = [bcx + (hcx - bcx) * 0.5, hcy + hry - 0.2];
  }
  // Vai. Nhìn ngang, thú bốn chân thân dài: neo dời lên phía vai, ngay sau gáy (hcx − hrx × 0.8), để áo choàng buộc ở
  // đường cổ chứ không ở giữa lưng (WEAR-SPEC D4); dáng khác giữ chỗ cũ (bcx − brx × 0.45).
  let back;
  if (view !== 'E') back = [bcx, btop + 1.0];
  else if (arch.id === 'quad') back = [Math.max(bcx - brx * 0.45, hcx - hrx * 0.8), btop + 1.5];
  else back = [bcx - brx * 0.45, btop + 1.5];
  // Bùa lơ lửng bên hông, ngoài cả đầu lẫn thân: bên phải khi nhìn trước, bên trái khi nhìn sau, sau mông khi nhìn ngang
  // (ngoài cả bề ngang ĐẦY ĐỦ của đầu: WEAR-SPEC D6, đầu to của bé nhỏ tuổi không che bùa).
  let charm;
  if (view === 'S') charm = [Math.max(bcx + brx, hcx + hrx * 0.8) + 3.0, bcy - 2.0];
  else if (view === 'N') charm = [Math.min(bcx - brx, hcx - hrx * 0.8) - 3.0, bcy - 2.0];
  else charm = [Math.min(bcx - brx, hcx - hrx) - 2.5, bcy - 2.0];
  const result = {
    arch: arch.id, st, hk, bk, legH, ground, bob, by, view,
    body: [bcx, bcy, brx, bryEff], head: [hcx, hcy, hrx, hry], htop, btop, eyeY, eyeDx, big,
    anchors: { head: headA, face, neck, back, charm },
  };
  // Móc của dáng khung: điểm neo theo hình thật của dáng (dáng tròn: cổ, lưng theo khối bóng; dáng rồng: lưng nhìn ngang
  // lùi về sau). Hàm thuần, trả về bộ điểm neo mới (hoặc không trả gì thì giữ nguyên).
  const a = arch.anchors?.(result, sp);
  if (a) result.anchors = a;
  return result;
}

// ---------------------------------------------------------------- hoạt ảnh (tên play() của sprite.js)

/**
 * Bảng dáng: tên → { fps, loop, frames: [pose] }. Khung nào có `view` thì vẽ theo hướng đó (spin = quay thật 4 hướng).
 * idle 6 khung (thở, chớp mắt khung 3, vẫy đuôi); walk 6 khung (chân so le, nhún 1 px ở khung 1 và 4);
 * wait = think (như RIG_ROWS cũ); runRight/runLeft = walk hướng E/W ở 14 fps (petsheet.js).
 */
export const ANIMS = {
  idle: {
    fps: 5, loop: true,
    frames: [{ tail: 0 }, { tail: 1 }, { by: 1, tail: 1 }, { by: 1, blink: 1, tail: 0 }, { by: 1, tail: -1, ear: 1 }, { tail: -1 }],
  },
  walk: {
    fps: 10, loop: true,
    frames: [[0, -1, 0], [0, -1, 1], [0, 0, 1], [0, 1, 0], [0, 1, -1], [0, 0, -1]].map(([bob, tail, flutter], step) => ({ step, bob, tail, flutter })),
  },
  wave: {
    fps: 6, loop: false,
    frames: [{ armR: 1, mouth: 'open', flap: 0 }, { armR: 2, mouth: 'open' }, { armR: 1, mouth: 'open' }, { armR: 2, mouth: 'open', blink: 1 }],
  },
  jump: {
    fps: 9, loop: false,
    frames: [
      { sq: -1, by: 1 }, { lift: -3, sq: 1 }, { lift: -6, sq: 1, armL: 1, armR: 1, mouth: 'open', tail: 1 },
      { lift: -6, armL: 1, armR: 1, mouth: 'open', tail: -1 }, { lift: -3 }, { sq: -1, by: 1 },
    ],
  },
  sad: {
    fps: 3, loop: true,
    frames: [{ hy: 1, ear: 1, mouth: 'sad' }, { hy: 1, ear: 1, mouth: 'sad', tear: 1 }, { hy: 2, ear: 1, mouth: 'sad', tear: 2 }, { hy: 1, ear: 1, mouth: 'sad' }],
  },
  think: {
    fps: 3, loop: true,
    frames: [{ look: -1 }, { look: -1, hx: -1 }, { look: 0 }, { look: 1, hx: 1 }, { look: 1 }, { look: 0, blink: 1 }],
  },
  busy: { fps: 6, loop: true, frames: [{ armL: 1, by: 1 }, { armR: 1 }, { armL: 1 }, { armR: 1, by: 1 }] },
  // Quay thật qua 4 hướng (bộ khung cũ chỉ lật được hướng trước).
  spin: { fps: 8, loop: true, frames: [{ view: 'S', mouth: 'open' }, { view: 'E', mouth: 'open' }, { view: 'N' }, { view: 'W', mouth: 'open' }] },
};

/**
 * Dáng từng khung của hoạt ảnh `anim` ở hướng `view` cho loài `sp`: thêm nhún 1 px ở khung 1 và 4 của dáng đi,
 * và phần riêng của dáng khung (chim đi lạch bạch, cá nóc và ếch nảy cao: archetype.walkPose(i, view, sp)).
 * Khung có `view` riêng thì giữ nguyên.
 */
export function animPoses(sp, anim, view) {
  const def = ANIMS[anim] ?? ANIMS.idle;
  const arch = archetypeOf(sp);
  return def.frames.map((p, i) => {
    const pose = { ...p };
    if (anim === 'walk' && (i === 1 || i === 4)) pose.lift = -1;
    if (anim === 'walk' && arch.walkPose) Object.assign(pose, arch.walkPose(i, view, sp));
    return pose;
  });
}
