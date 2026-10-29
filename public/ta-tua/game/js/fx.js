// Hiệu ứng hạt pixel (tim, sao, xu, bụi...) và vật bay theo đường cong, chạy bằng Web Animations.
import { art } from './pixel.js';

const rand = (lo, hi) => lo + Math.random() * (hi - lo);

/**
 * Bắn `count` hạt từ điểm (x, y) trong `layer` (phần tử position: relative/absolute).
 * `px` là kích thước một pixel nghệ thuật; `fall` cho hạt rơi xuống thay vì bay lên.
 */
export function burst(layer, x, y, { icon = 'heart', count = 6, spread = 70, rise = 70, life = 1100, px = 4, fall = false, stagger = 45 } = {}) {
  const sprite = art(icon);
  if (!layer || !sprite) return;
  for (let i = 0; i < count; i++) {
    const img = new Image();
    img.src = sprite.url;
    img.className = 'fx-px';
    img.style.left = `${x}px`;
    img.style.top = `${y}px`;
    img.style.width = `${sprite.w * px}px`;
    layer.append(img);
    const dx = rand(-spread, spread) / 2;
    const dy = fall ? rand(rise * 0.5, rise) : -rand(rise * 0.6, rise * 1.2);
    const wobble = rand(-12, 12);
    const at = (fx, fy, s) => `translate(-50%, -50%) translate(${fx}px, ${fy}px) scale(${s})`;
    img.animate([
      { transform: at(0, 0, 0.3), opacity: 0 },
      { transform: at(dx * 0.35 + wobble, dy * 0.35, 1.1), opacity: 1, offset: 0.2 },
      { transform: at(dx * 0.75 - wobble, dy * 0.75, 1), opacity: 1, offset: 0.7 },
      { transform: at(dx, dy, 0.8), opacity: 0 },
    ], { duration: life * rand(0.8, 1.2), delay: i * stagger, easing: 'cubic-bezier(.2,.7,.35,1)', fill: 'backwards' })
      .onfinish = () => img.remove();
  }
}

/** Chữ nổi lên rồi mờ dần, ví dụ "+6 XP". */
export function floatText(layer, x, y, text, { color = '#fff6d8', size = 18, rise = 46, delay = 0 } = {}) {
  if (!layer) return;
  const el = document.createElement('span');
  el.className = 'fx-text';
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.color = color;
  el.style.fontSize = `${size}px`;
  layer.append(el);
  el.animate([
    { transform: 'translate(-50%, -50%) translateY(6px) scale(.6)', opacity: 0 },
    { transform: 'translate(-50%, -50%) translateY(-8px) scale(1.1)', opacity: 1, offset: 0.2 },
    { transform: `translate(-50%, -50%) translateY(-${rise}px) scale(1)`, opacity: 0 },
  ], { duration: 1300, delay, easing: 'ease-out', fill: 'backwards' }).onfinish = () => el.remove();
}

/** Một vật (emoji/HTML) bay theo đường vòng cung từ `from` tới `to`; resolve khi tới nơi. */
export function flyTo(layer, from, to, html, { arc = 90, duration = 650, size = 40, spin = 260 } = {}) {
  return new Promise((resolve) => {
    if (!layer) return resolve();
    const el = document.createElement('div');
    el.className = 'fx-fly';
    el.innerHTML = html;
    el.style.fontSize = `${size}px`;
    layer.append(el);
    const frames = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t - arc * 4 * t * (1 - t);
      frames.push({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${t * spin}deg) scale(${1 - t * 0.35})` });
    }
    el.animate(frames, { duration, easing: 'linear' }).onfinish = () => {
      el.remove();
      resolve();
    };
  });
}
