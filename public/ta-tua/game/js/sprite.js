// Hoạt ảnh spritesheet: ảnh Petdex/Codex v2 vẽ sẵn, hoặc spritesheet dựng từ bộ khung pet ngũ hành (petsheet.js).
import { art } from './pixel.js';
import { ART_PX, PETDEX_SHEET, guestSheet, rigSheet } from './petsheet.js';
import { levelForm } from './shared/pets.js';

export { ART_PX };

const live = new Set();

function loop(now) {
  for (const sprite of live) sprite.update(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

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
    this.setSheet(sheet);
    this.play('idle');
    live.add(this);
  }

  /** Đổi ảnh (ví dụ khi bé thay đồ) mà vẫn giữ hoạt ảnh đang chạy. */
  setSheet(sheet) {
    this.sheet = typeof sheet === 'string' ? { ...PETDEX_SHEET, url: sheet } : sheet;
    this.el.style.backgroundImage = this.sheet.url ? `url("${this.sheet.url}")` : 'none';
    this.el.classList.toggle('px', Boolean(this.sheet.pixelated));
    this.setScale(this.scale);
    // Tấm của bộ khung còn đang dựng dở (petsheet.js rigSheet: mới có hàng đứng thở): đủ hàng thì lắp ảnh mới vào.
    const s = this.sheet;
    if (s.pending) s.ready.then(() => {
      if (this.sheet === s && live.has(this)) this.setSheet(s);
    });
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
    // Ô của bộ khung Rig 2.0 còn vài hàng trống dưới chân: kéo hình xuống để chân chạm đất (bóng, chỗ đứng) như trước.
    // Lề âm này phải nằm trong một khối flow-root (.pet-body trong style.css), nếu không nó tràn ra ngoài khung bé.
    s.marginBottom = this.sheet.padBottom ? `${-this.sheet.padBottom * scale}px` : '';
    this.draw();
  }

  play(name, { once = false, then = 'idle' } = {}) {
    if (!this.sheet.anims[name] || (name === this.anim && !once && !this.once)) return;
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
    const step = Math.floor(((now - this.started) / 1000) * anim.fps);
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

/**
 * Thú cưng kèm bóng đổ, đồ đeo vẽ sẵn vào từng khung hình.
 * - `wear`: { head, face, neck, back, charm } → mã món đang đeo.
 * - `stage`: giai đoạn tuổi (bé vẽ bằng bộ khung tự đổi dáng theo tuổi).
 * - `level`: cấp của bé; cứ 10 cấp bé đổi dáng (bé khách mời Petdex chỉ lớn thêm cỡ người).
 * - `ageScale`: chỉ dùng cho bé khách mời Petdex, vì ảnh vẽ sẵn không có dáng theo tuổi.
 */
export function createPetFigure(species, scale, wear = {}, { stage = 'young', ageScale = 1, level = 1 } = {}) {
  const rig = Boolean(species?.rig);
  const s = rig ? scale : scale * ageScale * levelForm(level).grow;
  const el = document.createElement('div');
  el.className = 'pet-figure';
  const shadowArt = art('shadow');
  const shadow = new Image();
  shadow.className = 'pet-shadow';
  shadow.alt = '';
  shadow.src = shadowArt.url;
  shadow.style.width = `${shadowArt.w * ART_PX * s}px`;
  const body = document.createElement('div');
  body.className = 'pet-body';
  const sheetFor = (w) => (rig ? rigSheet(species.id, stage, w ?? {}, level) : species?.sprite ?? '');
  const sprite = new Sprite(sheetFor(wear), s);
  body.append(sprite.el);
  el.append(shadow, body);
  let alive = true;
  let wearing = 0;

  const figure = {
    el,
    body,
    sprite,
    scale: s,
    /** Chiều cao thân bé trên màn hình (từ chân tới đỉnh đầu), để đặt hiệu ứng lên đầu bé. */
    get height() {
      return (sprite.sheet.bodyH ?? sprite.sheet.frameH * 0.9) * s;
    },
    setWear(next) {
      if (rig) return sprite.setSheet(sheetFor(next));
      // Bé khách mời: dò điểm neo và vẽ đồ vào ảnh mất một nhịp, xong mới thay.
      const ticket = ++wearing;
      guestSheet(species?.sprite ?? '', next ?? {}).then((sheet) => {
        if (alive && ticket === wearing) sprite.setSheet(sheet);
      }).catch(() => {});
    },
    destroy() {
      alive = false;
      sprite.destroy();
      el.remove();
    },
  };
  if (!rig && Object.values(wear ?? {}).some(Boolean)) figure.setWear(wear);
  return figure;
}
