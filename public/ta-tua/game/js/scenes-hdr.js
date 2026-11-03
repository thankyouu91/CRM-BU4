// Cảnh đầu trang 16-bit: một dải tranh pixel 320x80 ngay dưới tiêu đề màn (Khu công nghiệp, Phố Ngân hàng,
// Siêu thị, Bếp, Vườn, Trường học, Phòng khám). Chỉ để trang trí: không bấm được, trình đọc màn hình bỏ qua.
// Ảnh và hoạt cảnh do scripts/art/build-scenes.py dựng vào assets/scenes/ (scenes.json là bảng khung);
// cỡ hiển thị (3x / 2x, cắt giữa trên điện thoại) nằm ở css/scenes.css. Thiếu ảnh thì khung tự gập lại.

const BASE = new URL('../assets/scenes/', import.meta.url).href;

/** HTML của cảnh `name` (factory, bank, shop, kitchen, garden, school, clinic), đặt ngay sau viewHead(). */
export function sceneHdr(name) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) return '';
  return `
    <figure class="scene-hdr" data-scene="${name}" aria-hidden="true"><div class="scene-hdr-art">
      <img src="${BASE}${name}.webp" alt="" width="320" height="80" loading="lazy" decoding="async">
    </div></figure>`;
}

let table = null;
/** scenes.json, tải một lần khi cảnh đầu tiên hiện ra (chỉ cần cho hoạt cảnh). */
const loadTable = () => (table ??= fetch(`${BASE}scenes.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));

const watched = new Set();
let io = null;
/** Hoạt cảnh dừng khi cảnh ra khỏi màn hình; thẻ ẩn thì trình duyệt tự dừng hoạt ảnh CSS. */
function watch(fig) {
  for (const old of watched) {
    if (!old.isConnected) {
      io?.unobserve(old);
      watched.delete(old);
    }
  }
  if (typeof IntersectionObserver !== 'function') return;
  io ??= new IntersectionObserver((entries) => {
    for (const e of entries) e.target.classList.toggle('is-off', !e.isIntersecting);
  });
  watched.add(fig);
  io.observe(fig);
}

/** Khói ống khói…: dải khung lặp bằng CSS steps(), đặt theo điểm ảnh 1x của cảnh (tính từ giữa vì điện thoại cắt giữa). */
async function addFx(fig) {
  if (fig.querySelector('.scene-fx') || fig.classList.contains('fx-done')) return;
  fig.classList.add('fx-done');
  const fx = (await loadTable())?.scenes?.[fig.dataset.scene]?.fx;
  const art = fig.querySelector('.scene-hdr-art');
  if (!fx?.length || !art || !fig.isConnected) return;
  for (const f of fx) {
    const el = document.createElement('i');
    el.className = 'scene-fx';
    for (const [key, value] of Object.entries({ x: f.x, y: f.y, w: f.w, h: f.h, n: f.frames })) el.style.setProperty(`--${key}`, value);
    el.style.setProperty('--dur', `${f.frames * f.ms}ms`);
    el.style.backgroundImage = `url("${BASE}${f.src}")`;
    art.append(el);
  }
  watch(fig);
}

if (typeof document !== 'undefined') {
  // load / error của <img> không nổi bọt: bắt ở pha capture cho mọi cảnh, kể cả cảnh vẽ lại bằng innerHTML.
  document.addEventListener('error', (e) => {
    const fig = e.target instanceof HTMLImageElement ? e.target.closest('.scene-hdr') : null;
    if (fig) fig.hidden = true;
  }, true);
  document.addEventListener('load', (e) => {
    const fig = e.target instanceof HTMLImageElement ? e.target.closest('.scene-hdr') : null;
    if (fig) addFx(fig);
  }, true);
}
