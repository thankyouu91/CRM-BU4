// Hoạt ảnh spritesheet: ảnh Petdex/Codex v2 vẽ sẵn, hoặc spritesheet dựng từ bộ khung pet ngũ hành (petsheet.js).
import { art } from './pixel.js';
import { ART_PX, PETDEX_SHEET, guestSheet, rigSheet } from './petsheet.js';
import { levelForm } from './shared/pets.js';
import { DIRS, PHONE_QUERY, isPixelPerfect, petPx, resolveAnim, runPace } from './petmotion.js';

export { ART_PX };
export { PET_PX, isPixelPerfect } from './petmotion.js';

const live = new Set();
const media = (q) => (typeof matchMedia === 'function' ? matchMedia(q) : { matches: false, addEventListener() {} });
const motionMq = media('(prefers-reduced-motion: reduce)');
const phoneMq = media(PHONE_QUERY);
/** Giảm chuyển động: không chạy vòng hoạt ảnh (đứng yên ở khung đầu), đi thì hiện dáng đứng. */
const calm = () => motionMq.matches;

function loop(now) {
  // Tab ẩn thì trình duyệt tự dừng vòng này; bé đã gỡ khỏi trang (màn khác) thì bỏ qua.
  if (!document.hidden) for (const sprite of live) if (sprite.el.isConnected) sprite.update(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
motionMq.addEventListener('change', () => {
  // refresh() bỏ qua bé đang vẫy tay, nhảy... (chạy một lần): hết lượt, update() tự về dáng `then` theo cờ mới.
  for (const sprite of live) sprite.refresh();
});
/** Hàng đi bốn hướng của sheet mới (Rig 2.0), phát nhanh hơn khi bé chạy trên sân (Sprite.runWalk). */
const WALK_ROWS = new Set(DIRS.map((d) => `walk${d}`));

/**
 * Một bé đang chạy hoạt ảnh. `sheet` là URL ảnh Petdex, hoặc một spritesheet
 * { url, frameW, frameH, cols, anims: { tên: { row, frames, fps } }, pixelated }.
 */
export class Sprite {
  constructor(sheet, scale = 1) {
    this.el = document.createElement('div');
    this.el.className = 'sprite';
    this.anim = null;
    this.frame = 0;
    this.scale = scale;
    this.dir = 'S'; // hướng đang nhìn: S / E / N / W
    this.side = 'E'; // hướng ngang gần nhất (sheet cũ chỉ có chạy sang phải / trái)
    this.want = null; // tên đã gọi play() ('walk', 'idle', 'wave'...), trước khi đổi ra hàng thật của sheet
    this.runWalk = false; // chạy trên sân (công viên): hàng đi phát theo nhịp chạy của sheet (runPace)
    this.setSheet(sheet);
    this.play('idle');
    live.add(this);
  }

  /** Đổi ảnh (ví dụ khi bé thay đồ) mà vẫn giữ hoạt ảnh đang chạy. */
  setSheet(sheet) {
    this.sheet = typeof sheet === 'string' ? { ...PETDEX_SHEET, url: sheet } : sheet;
    this.el.style.backgroundImage = this.sheet.url ? `url("${this.sheet.url}")` : 'none';
    this.el.classList.toggle('px', Boolean(this.sheet.pixelated));
    this.refresh(); // sheet mới có thể có hàng khác (walkE, idleN...): chọn lại hàng cho tên đang chạy
    this.setScale(this.scale);
  }

  /** Đang chạy hoạt ảnh một lần (vẫy tay, nhảy...) thì chưa nên đổi sang dáng đi. */
  get busy() {
    return this.once;
  }

  setScale(scale) {
    this.scale = scale;
    const { frameW, frameH, cols } = this.sheet;
    const s = this.el.style;
    s.width = `${frameW * scale}px`;
    s.height = `${frameH * scale}px`;
    s.backgroundSize = `${cols * frameW * scale}px auto`;
    this.draw();
  }

  /**
   * Quay bé sang hướng `dir` (S/E/N/W); đang đi hay đứng thì đổi luôn sang hàng của hướng mới.
   * `side` (E/W, tùy chọn): hướng ngang gần nhất, để sheet cũ (chỉ chạy ngang) biết chạy về phía nào khi đi lên / xuống.
   */
  setDirection(dir, side) {
    const next = DIRS.includes(dir) ? dir : this.dir;
    const isSide = (d) => d === 'E' || d === 'W';
    const h = isSide(next) ? next : isSide(side) ? side : this.side;
    if (next === this.dir && h === this.side) return;
    this.dir = next;
    this.side = h;
    if (!this.once) this.refresh();
  }

  /** Chọn lại hàng cho tên đã gọi (đổi hướng, đổi sheet, bật tắt giảm chuyển động). Đang chạy một lần thì thôi. */
  refresh() {
    if (this.want && !this.once) this.play(this.want, { then: this.then });
  }

  /**
   * Chạy hoạt ảnh. 'walk' và 'idle' theo hướng đang nhìn (walkE, idleN...; sheet cũ: runRight / runLeft / idle);
   * tên khác (wave, jump...) chạy đúng hàng đó. `once`: chạy một lần rồi về `then`.
   */
  play(want, { once = false, then = 'idle' } = {}) {
    const name = resolveAnim(this.sheet.anims, want === 'walk' && calm() ? 'idle' : want, this.dir, this.side);
    if (!name || (name === this.anim && !once && !this.once)) {
      if (name && !this.once) this.want = want;
      return;
    }
    this.want = want;
    this.anim = name;
    this.once = once;
    this.then = then;
    this.frame = 0;
    this.started = performance.now();
    this.draw();
  }

  update(now) {
    const anim = this.sheet.anims[this.anim];
    if (!anim) return;
    const fps = this.runWalk && WALK_ROWS.has(this.anim) ? anim.fps * runPace(this.sheet.anims) : anim.fps;
    const step = this.once || !calm() ? Math.floor(((now - this.started) / 1000) * fps) : 0;
    if (this.once && step >= anim.frames) {
      this.once = false;
      this.play(this.then);
      return;
    }
    const frame = step % anim.frames;
    if (frame !== this.frame) {
      this.frame = frame;
      this.draw();
    }
  }

  draw() {
    const anim = this.anim && this.sheet.anims[this.anim];
    if (!anim) return;
    const { frameW, frameH } = this.sheet;
    this.el.style.backgroundPosition = `${-this.frame * frameW * this.scale}px ${-anim.row * frameH * this.scale}px`;
  }

  destroy() {
    live.delete(this);
    this.el.remove();
  }
}

/** Cả game thu nhỏ bằng `zoom` trên <html> (css/style.css, --zoom 0.9). */
function pageZoom() {
  const z = parseFloat(getComputedStyle(document.documentElement).zoom);
  return z > 0 ? z : 1;
}
/** Điểm CSS (ở tỉ lệ 1) cho mỗi điểm ảnh gốc của sheet: rigSheet dựng frameW = điểm ảnh × ART_PX. */
const artPxOf = (sheet) => (typeof sheet === 'object' && sheet?.artPx > 0 ? sheet.artPx : ART_PX);
const crisp = new Set(); // các bé pixelPerfect đang hiện: đổi cỡ khi qua mốc điện thoại / máy tính
phoneMq.addEventListener('change', () => {
  for (const figure of crisp) figure.fit();
});

/**
 * Thú cưng kèm bóng đổ, đồ đeo vẽ sẵn vào từng khung hình.
 * - `wear`: { head, face, neck, back, charm } → mã món đang đeo.
 * - `stage`: giai đoạn tuổi (bé vẽ bằng bộ khung tự đổi dáng theo tuổi).
 * - `level`: cấp của bé; cứ 10 cấp bé đổi dáng (bé khách mời Petdex chỉ lớn thêm cỡ người).
 * - `ageScale`: chỉ dùng cho bé khách mời Petdex, vì ảnh vẽ sẵn không có dáng theo tuổi.
 * - `px`: nơi hiện bé, tra trong bảng PET_PX (petmotion.js). Chỉ dùng cho sheet pixelPerfect: khi đó bé có cỡ
 *   số nguyên điểm màn hình cho mỗi điểm ảnh gốc, `scale` bị bỏ qua. Sheet cũ vẫn dùng `scale` như trước.
 * - `screenPx`: bé nằm trong một thế giới đã phóng sẵn (công viên): số điểm màn hình cho mỗi điểm CSS của
 *   thế giới, hoặc hàm trả về số đó. Bỏ trống thì bé tự bù zoom của game (lớp .pp-zoom, như .t16 của phố).
 * - `run`: bé chạy trên sân (công viên): hàng đi bốn hướng phát theo nhịp chạy của sheet (runPace, petmotion.js).
 */
export function createPetFigure(species, scale, wear = {}, { stage = 'young', ageScale = 1, level = 1, px = 'card', screenPx = 0, run = false } = {}) {
  const rig = Boolean(species?.rig);
  const looseScale = rig ? scale : scale * ageScale * levelForm(level).grow;
  const el = document.createElement('div');
  el.className = 'pet-figure';
  const shadowArt = art('shadow');
  const shadow = new Image();
  shadow.className = 'pet-shadow';
  shadow.alt = '';
  shadow.src = shadowArt.url;
  const body = document.createElement('div');
  body.className = 'pet-body';
  const sheetFor = (w) => (rig ? rigSheet(species.id, stage, w ?? {}, level) : species?.sprite ?? '');
  const sprite = new Sprite(sheetFor(wear), looseScale);
  sprite.runWalk = run;
  body.append(sprite.el);
  el.append(shadow, body);
  let alive = true;
  let wearing = 0;
  let s = looseScale;
  let outer = 1; // điểm CSS của chỗ đặt bé cho mỗi điểm CSS bên trong bé (khác 1 khi bé tự bù zoom)

  const figure = {
    el,
    body,
    sprite,
    get scale() {
      return s;
    },
    /** Sheet này có được vẽ theo điểm ảnh tròn số không. */
    get crisp() {
      return isPixelPerfect(sprite.sheet);
    },
    /** Chiều cao thân bé (từ chân tới đỉnh đầu) theo điểm CSS của chỗ đặt bé, để đặt hiệu ứng lên đầu bé. */
    get height() {
      return (sprite.sheet.bodyH ?? sprite.sheet.frameH * 0.9) * s * outer;
    },
    /** Tính lại cỡ: sheet pixelPerfect lấy số nguyên trong PET_PX, sheet cũ giữ `scale` như trước. */
    fit() {
      const sheet = sprite.sheet;
      const pp = isPixelPerfect(sheet);
      const world = typeof screenPx === 'function' ? screenPx() : screenPx;
      const unit = petPx(px, phoneMq.matches); // điểm màn hình cho mỗi điểm ảnh gốc
      const zoomFix = pp && !(world > 0);
      s = pp ? unit / (world > 0 ? world : 1) / artPxOf(sheet) : looseScale;
      outer = zoomFix ? 1 / pageZoom() : 1;
      el.classList.toggle('pp', pp);
      el.classList.toggle('pp-zoom', zoomFix);
      shadow.style.width = `${shadowArt.w * artPxOf(sheet) * s}px`;
      if (sprite.scale !== s) sprite.setScale(s);
      if (pp && alive) crisp.add(figure);
      else crisp.delete(figure);
    },
    /** Quay bé sang S / E / N / W (sheet có hàng theo hướng thì đổi hàng, không lật ảnh). */
    setDirection(dir, side) {
      sprite.setDirection(dir, side);
    },
    setWear(next) {
      if (rig) {
        sprite.setSheet(sheetFor(next));
        return figure.fit();
      }
      // Bé khách mời: dò điểm neo và vẽ đồ vào ảnh mất một nhịp, xong mới thay.
      const ticket = ++wearing;
      guestSheet(species?.sprite ?? '', next ?? {}).then((sheet) => {
        if (alive && ticket === wearing) sprite.setSheet(sheet);
      }).catch(() => {});
    },
    destroy() {
      alive = false;
      crisp.delete(figure);
      sprite.destroy();
      el.remove();
    },
  };
  figure.fit();
  if (!rig && Object.values(wear ?? {}).some(Boolean)) figure.setWear(wear);
  return figure;
}
