// Bản đồ đất của gia tộc: 200 lô là 200 ô lục giác (đỉnh nhọn) xếp thẳng hàng 20 × 10, hàng lẻ lệch nửa ô,
// giữa biển. Trong trình duyệt nền được vẽ bằng pixel art (landpixel.js); khi không có canvas (test trên Node)
// thì vẽ nền vector đơn giản. Lớp tĩnh vẽ một lần (lưu bộ nhớ đệm), lớp lô đất (chủ, chọn) vẽ đè lên.
import { CLIMATES, LAND, MAP_PALETTE as C, PLOTS, ZONES, riverRow } from './shared/clan.js';
import { drawPixelBase } from './landpixel.js';

/** Bề ngang một ô; bán kính (tâm tới đỉnh) và bước giữa hai hàng suy ra từ đó. */
export const TW = 48;
export const HEX_R = TW / Math.sqrt(3);
const ROW_STEP = HEX_R * 1.5;
const PAD = 34; // biển bao quanh
export const MAP_W = Math.round(PAD * 2 + LAND.cols * TW + TW / 2);
export const MAP_H = Math.round(PAD * 2 + HEX_R * 2 + (LAND.rows - 1) * ROW_STEP);

const f1 = (v) => Math.round(v * 10) / 10;
const pts = (list) => list.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');

export const hexCenter = (col, row) => [PAD + TW / 2 + col * TW + (row % 2) * (TW / 2), PAD + HEX_R + row * ROW_STEP];

function hexPoints(cx, cy, r = HEX_R) {
  return Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 180) * (60 * k - 90);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

/** Hình học của mỗi lô: lục giác `hex`, tâm. */
export const GEOMETRY = new Map(PLOTS.map((p) => {
  const [cx, cy] = hexCenter(p.col, p.row);
  return [p.id, { hex: hexPoints(cx, cy), cx, cy }];
}));

/** Sông: nối tâm các ô ven sông từ tây sang, rồi chảy xuống biển phía đông nam. */
function riverPoints() {
  const points = [];
  for (let c = 0; c < LAND.cols; c++) {
    const r = Math.min(LAND.rows - 1, c <= 13 ? riverRow(c) : riverRow(13) + (c - 13));
    const g = GEOMETRY.get(r * LAND.cols + c + 1);
    points.push(c === 0 ? [PAD - 6, g.cy] : [g.cx, g.cy]);
    if (PLOTS[r * LAND.cols + c].zone === 'sea') break;
  }
  return points;
}

// ---------------------------------------------------------------- lớp tĩnh

const cache = new Map();
const pixelBase = typeof document !== 'undefined';

/**
 * Lớp tĩnh của bản đồ cho một chế độ tô màu. `fillFor(plot)` trả màu ô (null = theo địa hình).
 * `key` đổi khi màu đổi (ví dụ chế độ + ngành), để dùng lại bộ nhớ đệm.
 */
export function staticLayer(key, fillFor) {
  if (cache.has(key)) return cache.get(key);
  const svg = pixelBase ? pixelLayer(fillFor) : vectorLayer(fillFor);
  cache.set(key, svg);
  return svg;
}

function pixelLayer(fillFor) {
  const canvas = drawPixelBase({ width: MAP_W, height: MAP_H, geometry: GEOMETRY, heat: fillFor, river: riverPoints() });
  return `<image href="${canvas.toDataURL()}" width="${MAP_W}" height="${MAP_H}" preserveAspectRatio="none" style="image-rendering:pixelated"/>`;
}

function vectorLayer(fillFor) {
  const hexes = PLOTS.map((p) => {
    const fill = fillFor(p) ?? ZONES[p.zone].color;
    return `<polygon points="${pts(GEOMETRY.get(p.id).hex)}" fill="${fill}" stroke="#00000022"/>`;
  }).join('');
  return `<rect width="${MAP_W}" height="${MAP_H}" rx="12" fill="${C.sea}"/>${hexes}
    <polyline points="${pts(riverPoints())}" fill="none" stroke="${C.river}" stroke-width="8" stroke-linejoin="round"/>`;
}

// ---------------------------------------------------------------- lớp lô đất

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Vùng bấm, màu gia tộc, huy hiệu, mã lô; `infos` theo id: { owner, mine }. */
export function plotLayer(infos, { selected = null, showClimate = false, resources = null } = {}) {
  return PLOTS.map((p) => {
    const g = GEOMETRY.get(p.id);
    const info = infos.get(p.id) ?? {};
    const owner = info.owner;
    const shape = pts(g.hex);
    const tint = owner ? `<polygon points="${shape}" fill="${esc(owner.color)}" fill-opacity=".38" stroke="${esc(owner.color)}" stroke-width="2"${info.mine ? ' stroke-dasharray="5 2"' : ''} pointer-events="none"/>` : '';
    const badge = owner ? `<g pointer-events="none"><circle cx="${f1(g.cx)}" cy="${f1(g.cy)}" r="8.5" fill="#fff" stroke="${esc(owner.color)}" stroke-width="2"/><text x="${f1(g.cx)}" y="${f1(g.cy + 4)}" text-anchor="middle" font-size="10">${esc(owner.emblem)}</text></g>` : '';
    const climate = showClimate ? `<text x="${f1(g.cx + 12)}" y="${f1(g.cy + 16)}" text-anchor="middle" font-size="10" pointer-events="none">${CLIMATES[p.climate].icon}</text>` : '';
    const res = resources?.get(p.id) ? `<text x="${f1(g.cx)}" y="${f1(g.cy + (owner ? 20 : 6))}" text-anchor="middle" font-size="${owner ? 9 : 13}" pointer-events="none">${resources.get(p.id)}</text>` : '';
    return `<g class="plot${owner ? ' taken' : ' free'}${info.mine ? ' mine' : ''}${selected === p.id ? ' sel' : ''}" data-plot="${p.id}">
      ${tint}<polygon class="hit" points="${shape}"/>${badge}${climate}${res}
      <text class="code" x="${f1(g.cx)}" y="${f1(g.cy - HEX_R + 12)}" text-anchor="middle">${p.code}</text></g>`;
  }).join('');
}

export function landMapSvg({ key, fillFor, infos, selected, showClimate, resources }) {
  return `<svg class="land-svg" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="Bản đồ 200 lô đất">
    <g class="lm-static">${staticLayer(key, fillFor)}</g>
    <g class="lm-plots">${plotLayer(infos, { selected, showClimate, resources })}</g>
  </svg>`;
}
