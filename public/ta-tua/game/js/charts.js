// Biểu đồ kiểu pixel: vẽ ở nửa độ phân giải rồi phóng to sắc nét, nhãn chữ là HTML để luôn rõ.
const PIX = 2;

export const COLORS = {
  up: '#3fae7a',
  down: '#e0606f',
  line: '#c8915f',
  fill: 'rgba(200, 145, 95, 0.18)',
  grid: 'rgba(74, 51, 38, 0.10)',
  income: '#58b98d',
  expense: '#ef8a7a',
  gold: '#e7b53c',
  blue: '#58b9d6',
};

/** Tạo canvas vừa khung `host`, trả về { g, w, h } theo đơn vị pixel biểu đồ. */
function setup(host, height) {
  host.classList.add('chart');
  host.style.height = `${height}px`;
  let canvas = host.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    host.prepend(canvas);
  }
  const cssW = Math.max(40, host.clientWidth);
  canvas.width = Math.round(cssW / PIX);
  canvas.height = Math.round(height / PIX);
  canvas.style.width = `${canvas.width * PIX}px`;
  canvas.style.height = `${canvas.height * PIX}px`;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, canvas.width, canvas.height);
  host.querySelectorAll('.chart-label').forEach((el) => el.remove());
  return { g, w: canvas.width, h: canvas.height };
}

function label(host, text, { left, right, top, bottom }) {
  const el = document.createElement('span');
  el.className = 'chart-label';
  el.textContent = text;
  Object.assign(el.style, {
    left: left !== undefined ? `${left}px` : '', right: right !== undefined ? `${right}px` : '',
    top: top !== undefined ? `${top}px` : '', bottom: bottom !== undefined ? `${bottom}px` : '',
  });
  host.append(el);
}

/** Đường thẳng bằng các khối pixel. */
function pixelLine(g, x0, y0, x1, y1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) g.fillRect(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), 1, 1);
}

const range = (values) => {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
};

/**
 * Biểu đồ đường có tô nền. `values` là mảng số; `format` định dạng nhãn min/max;
 * `color` tùy chọn, mặc định xanh nếu đi lên, đỏ nếu đi xuống.
 */
export function lineChart(host, values, { height = 160, format = (v) => v.toFixed(1), color } = {}) {
  const { g, w, h } = setup(host, height);
  if (values.length < 2) return;
  const [lo, hi] = range(values);
  const x = (i) => Math.round((i / (values.length - 1)) * (w - 1));
  const y = (v) => Math.round((1 - (v - lo) / (hi - lo)) * (h - 1));
  const stroke = color ?? (values.at(-1) >= values[0] ? COLORS.up : COLORS.down);

  g.fillStyle = COLORS.grid;
  for (let k = 1; k < 4; k++) g.fillRect(0, Math.round((h * k) / 4), w, 1);
  g.fillStyle = `${stroke}2e`;
  for (let i = 0; i < values.length - 1; i++) {
    for (let px = x(i); px <= x(i + 1); px++) {
      const t = (px - x(i)) / Math.max(1, x(i + 1) - x(i));
      const py = Math.round(y(values[i]) + (y(values[i + 1]) - y(values[i])) * t);
      g.fillRect(px, py, 1, h - py);
    }
  }
  g.fillStyle = stroke;
  for (let i = 0; i < values.length - 1; i++) pixelLine(g, x(i), y(values[i]), x(i + 1), y(values[i + 1]));
  g.fillRect(x(values.length - 1) - 1, y(values.at(-1)) - 1, 3, 3);
  label(host, format(Math.max(...values)), { right: 4, top: 2 });
  label(host, format(Math.min(...values)), { right: 4, bottom: 2 });
}

/** Biểu đồ nến: candles = [{ open, high, low, close }]. */
export function candleChart(host, candles, { height = 180, format = (v) => v.toFixed(1) } = {}) {
  const { g, w, h } = setup(host, height);
  if (!candles.length) return;
  const [lo, hi] = range(candles.flatMap((c) => [c.high, c.low]));
  const y = (v) => Math.round((1 - (v - lo) / (hi - lo)) * (h - 1));
  const slot = w / candles.length;
  const body = Math.max(1, Math.floor(slot) - 1);
  g.fillStyle = COLORS.grid;
  for (let k = 1; k < 4; k++) g.fillRect(0, Math.round((h * k) / 4), w, 1);
  candles.forEach((c, i) => {
    const cx = Math.round(i * slot + slot / 2);
    g.fillStyle = c.close >= c.open ? COLORS.up : COLORS.down;
    g.fillRect(cx, y(c.high), 1, Math.max(1, y(c.low) - y(c.high)));
    const top = y(Math.max(c.open, c.close));
    g.fillRect(cx - Math.floor(body / 2), top, body, Math.max(1, y(Math.min(c.open, c.close)) - top));
  });
  label(host, format(Math.max(...candles.map((c) => c.high))), { right: 4, top: 2 });
  label(host, format(Math.min(...candles.map((c) => c.low))), { right: 4, bottom: 2 });
}

/** Cột đôi thu/chi theo ngày: rows = [{ income, expense }]. */
export function barChart(host, rows, { height = 150 } = {}) {
  const { g, w, h } = setup(host, height);
  if (!rows.length) return;
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]));
  const slot = w / rows.length;
  const bar = Math.max(1, Math.floor(slot / 2) - 1);
  g.fillStyle = COLORS.grid;
  g.fillRect(0, h - 1, w, 1);
  rows.forEach((r, i) => {
    const x0 = Math.round(i * slot + (slot - bar * 2 - 1) / 2);
    const ih = Math.round((r.income / max) * (h - 2));
    const eh = Math.round((r.expense / max) * (h - 2));
    g.fillStyle = COLORS.income;
    g.fillRect(x0, h - 1 - ih, bar, ih);
    g.fillStyle = COLORS.expense;
    g.fillRect(x0 + bar + 1, h - 1 - eh, bar, eh);
  });
  label(host, max.toLocaleString('vi-VN'), { left: 4, top: 2 });
}

/** Đường nhỏ trong bảng giá. */
export function sparkline(host, values, { height = 28 } = {}) {
  const { g, w, h } = setup(host, height);
  if (values.length < 2) return;
  const [lo, hi] = range(values);
  g.fillStyle = values.at(-1) >= values[0] ? COLORS.up : COLORS.down;
  const x = (i) => Math.round((i / (values.length - 1)) * (w - 1));
  const y = (v) => Math.round((1 - (v - lo) / (hi - lo)) * (h - 1));
  for (let i = 0; i < values.length - 1; i++) pixelLine(g, x(i), y(values[i]), x(i + 1), y(values[i + 1]));
}
