// Bản đồ đất của gia tộc theo phong cách bản đồ thành phố phẳng: nền xám, phố trắng uốn lượn giữa các khu,
// vài trục đường lớn màu cam có vòng xoay, sông xanh có cầu, đồng bằng kẻ sọc, đồi núi có đường đồng mức,
// rừng chấm cây, biển và bãi cát. Trong trình duyệt nền được vẽ bằng pixel art như Phố Trân Châu (landpixel.js). 200 lô là 200 khu phố; lưới 20×10 được bẻ cong bằng nhiễu cố định
// nên ai cũng thấy cùng một bản đồ. Lớp tĩnh vẽ một lần (lưu bộ nhớ đệm), lớp lô đất (chủ, chọn) vẽ đè lên.
import { CLIMATES, LAND, MAP_PALETTE as C, PLOTS, ZONES, riverRow, seeded } from './shared/clan.js';
import { drawPixelBase } from './landpixel.js';

export const TW = 48;
export const TH = 40;
const PAD = 8;
export const MAP_W = LAND.cols * TW + PAD * 2;
export const MAP_H = LAND.rows * TH + PAD * 2;
const GAP = 3.2; // nửa bề rộng phố

// ---------------------------------------------------------------- hình học

/** Góc lưới (i, j) đã bẻ cong; mép ngoài giữ thẳng. */
function corner(i, j) {
  const edgeX = i === 0 || i === LAND.cols;
  const edgeY = j === 0 || j === LAND.rows;
  const dx = edgeX ? 0 : 7 * Math.sin(j * 1.3 + i * 0.45) + 3.5 * Math.sin(i * 2.1 + j);
  const dy = edgeY ? 0 : 5.5 * Math.sin(i * 0.9 + j * 0.7) + 2.5 * Math.cos(j * 2.3 + i * 1.7);
  return [PAD + i * TW + dx, PAD + j * TH + dy];
}

const f1 = (v) => Math.round(v * 10) / 10;
const pts = (list) => list.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');

function inset(poly, d) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map(([x, y]) => {
    const len = Math.hypot(cx - x, cy - y) || 1;
    return [x + ((cx - x) / len) * d * 1.35, y + ((cy - y) / len) * d * 1.35];
  });
}

/** Hình học của mỗi lô: đa giác khu phố, tâm, góc nghiêng. */
export const GEOMETRY = new Map(PLOTS.map((p) => {
  const quad = [corner(p.col, p.row), corner(p.col + 1, p.row), corner(p.col + 1, p.row + 1), corner(p.col, p.row + 1)];
  const cx = quad.reduce((s, q) => s + q[0], 0) / 4;
  const cy = quad.reduce((s, q) => s + q[1], 0) / 4;
  const angle = (Math.atan2(quad[1][1] - quad[0][1], quad[1][0] - quad[0][0]) * 180) / Math.PI;
  return [p.id, { quad, block: p.zone === 'sea' ? quad : inset(quad, GAP), cx, cy, angle }];
}));

// ---------------------------------------------------------------- trang trí từng địa hình

function buildings(g, rand, count, color = C.building) {
  let s = `<g transform="rotate(${f1(g.angle)} ${f1(g.cx)} ${f1(g.cy)})">`;
  for (let k = 0; k < count; k++) {
    const w = 6 + rand() * 9;
    const h = 5 + rand() * 7;
    const x = g.cx - TW / 2 + 7 + rand() * (TW - 14 - w);
    const y = g.cy - TH / 2 + 7 + rand() * (TH - 14 - h);
    s += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="${color}"/>`;
    if (rand() < 0.35) s += `<rect x="${f1(x + w - 3)}" y="${f1(y + h)}" width="3" height="${f1(3 + rand() * 3)}" fill="${color}"/>`;
  }
  return `${s}</g>`;
}

function decoration(p, g) {
  const rand = seeded(p.id * 7919);
  const { cx, cy } = g;
  switch (p.zone) {
    case 'urban': return buildings(g, rand, 5 + Math.floor(rand() * 3));
    case 'coast': return buildings(g, rand, 2) + `<circle cx="${f1(cx + 9)}" cy="${f1(cy + 6)}" r="2.2" fill="#e9c46a"/>`;
    case 'river': return buildings(g, rand, 2);
    case 'plain': {
      if (rand() < 0.28) {
        // công viên: mảng xanh mềm
        return `<ellipse cx="${f1(cx - 3)}" cy="${f1(cy + 1)}" rx="${f1(12 + rand() * 4)}" ry="${f1(8 + rand() * 3)}" fill="${C.park}"/>${buildings(g, rand, 1)}`;
      }
      return rand() < 0.5 ? buildings(g, rand, 1) : '';
    }
    case 'hill': {
      const r = 6 + rand() * 4;
      let s = '';
      for (let k = 3; k >= 1; k--) s += `<ellipse cx="${f1(cx)}" cy="${f1(cy + 2)}" rx="${f1(r * k * 0.75)}" ry="${f1(r * k * 0.5)}" fill="none" stroke="${C.contour}" stroke-width="1"/>`;
      if (rand() < 0.6) s += `<path d="M${f1(cx - 4)} ${f1(cy + 1)} L${f1(cx)} ${f1(cy - 5)} L${f1(cx + 4)} ${f1(cy + 1)}Z" fill="${C.peak}"/>`;
      return s;
    }
    case 'forest': {
      let s = '';
      for (let k = 0; k < 9; k++) s += `<circle cx="${f1(cx - 15 + rand() * 30)}" cy="${f1(cy - 11 + rand() * 22)}" r="${f1(2.6 + rand() * 2)}" fill="${C.tree}"/>`;
      return s;
    }
    case 'sea': return `<path d="M${f1(cx - 12)} ${f1(cy - 4)} q4 -3 8 0 t8 0 M${f1(cx - 6)} ${f1(cy + 7)} q4 -3 8 0 t8 0" fill="none" stroke="${C.wave}" stroke-width="1.6"/>`;
    default: return '';
  }
}

function terrainFill(zone) {
  return {
    urban: C.urban, river: C.field, coast: C.sand, sea: C.sea, hill: 'url(#lm-mountain)', forest: C.forest, plain: 'url(#lm-field)',
  }[zone];
}

// ---------------------------------------------------------------- sông & trục đường

function smooth(points) {
  if (points.length < 2) return '';
  let d = `M${f1(points[0][0])} ${f1(points[0][1])}`;
  for (let k = 1; k < points.length - 1; k++) {
    const mx = (points[k][0] + points[k + 1][0]) / 2;
    const my = (points[k][1] + points[k + 1][1]) / 2;
    d += ` Q${f1(points[k][0])} ${f1(points[k][1])} ${f1(mx)} ${f1(my)}`;
  }
  const last = points.at(-1);
  return `${d} L${f1(last[0])} ${f1(last[1])}`;
}

const zoneAt = (c, r) => PLOTS[r * LAND.cols + c]?.zone;

function riverPoints() {
  const points = [];
  for (let c = 0; c < LAND.cols; c++) {
    const r = Math.min(LAND.rows - 1, c <= 13 ? riverRow(c) : riverRow(13) + (c - 13));
    const g = GEOMETRY.get(r * LAND.cols + c + 1);
    points.push([c === 0 ? PAD : g.cx, g.cy]);
    if (zoneAt(c, r) === 'sea') break;
  }
  return points;
}

/** Trục đường lớn đi theo đường phố giữa các khu, bỏ phần nằm hẳn trên biển. */
function arterialPoints(path) {
  const keep = [];
  for (const [i, j] of path) {
    const near = [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]].some(([c, r]) => {
      const z = zoneAt(c, r);
      return z && z !== 'sea';
    });
    if (!near) break;
    keep.push(corner(i, j));
  }
  return keep;
}

const ARTERIALS = [
  Array.from({ length: LAND.cols + 1 }, (_, i) => [i, 5]),
  Array.from({ length: LAND.rows + 1 }, (_, j) => [7, j]),
  Array.from({ length: LAND.rows + 1 }, (_, j) => [14, j]),
  Array.from({ length: 11 }, (_, k) => [k, 2 + Math.round(k / 4)]),
];
const ROUNDABOUTS = [[7, 5], [14, 5]];

// ---------------------------------------------------------------- lớp tĩnh

const cache = new Map();

/**
 * Lớp tĩnh của bản đồ cho một chế độ tô màu. `fillFor(plot)` trả màu khu (null = màu địa hình kèm trang trí).
 * `key` đổi khi màu đổi (ví dụ chế độ + ngành), để dùng lại bộ nhớ đệm.
 */
export function staticLayer(key, fillFor) {
  if (cache.has(key)) return cache.get(key);
  const svg = typeof document === 'undefined' ? vectorLayer(fillFor) : pixelLayer(fillFor);
  cache.set(key, svg);
  return svg;
}

/** Nền pixel art (trình duyệt): canvas nửa độ phân giải, phóng to sắc nét. */
function pixelLayer(fillFor) {
  const canvas = drawPixelBase({
    width: MAP_W, height: MAP_H, geometry: GEOMETRY, heat: fillFor,
    river: riverPoints(), roads: ARTERIALS.map(arterialPoints).filter((r) => r.length > 1),
    roundabouts: ROUNDABOUTS.map(([i, j]) => corner(i, j)),
  });
  return `<image href="${canvas.toDataURL()}" width="${MAP_W}" height="${MAP_H}" preserveAspectRatio="none" style="image-rendering:pixelated"/>`;
}

/** Nền vector (khi không có canvas, ví dụ khi chạy test trên Node). */
function vectorLayer(fillFor) {
  const blocks = PLOTS.map((p) => {
    const g = GEOMETRY.get(p.id);
    const heat = fillFor(p);
    const fill = heat ?? terrainFill(p.zone);
    const join = p.zone === 'sea' ? '' : ` stroke="${heat ?? (p.zone === 'plain' ? C.field : p.zone === 'hill' ? C.mountain : fill)}" stroke-width="3" stroke-linejoin="round"`;
    return `<polygon points="${pts(g.block)}" fill="${fill}"${join}/>${heat ? '' : decoration(p, g)}`;
  }).join('');
  const roads = ARTERIALS.map((a) => smooth(arterialPoints(a))).filter(Boolean);
  const river = smooth(riverPoints());
  return `
    <defs>
      <pattern id="lm-field" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="${C.field}"/><rect width="2" height="6" fill="${C.fieldHatch}"/>
      </pattern>
      <radialGradient id="lm-mountain"><stop offset="0" stop-color="${C.mountain}"/><stop offset="1" stop-color="${C.mountainLow}"/></radialGradient>
    </defs>
    <rect width="${MAP_W}" height="${MAP_H}" rx="12" fill="${C.street}"/>
    ${blocks}
    <path d="${river}" fill="none" stroke="${C.riverEdge}" stroke-width="17" stroke-linecap="round"/>
    <path d="${river}" fill="none" stroke="${C.river}" stroke-width="12" stroke-linecap="round"/>
    ${roads.map((d) => `<path d="${d}" fill="none" stroke="${C.arterialEdge}" stroke-width="11" stroke-linecap="round"/>`).join('')}
    ${roads.map((d) => `<path d="${d}" fill="none" stroke="${C.arterial}" stroke-width="7" stroke-linecap="round"/>`).join('')}
    ${ROUNDABOUTS.map(([i, j]) => {
      const [x, y] = corner(i, j);
      return `<circle cx="${f1(x)}" cy="${f1(y)}" r="10" fill="${C.arterialEdge}"/><circle cx="${f1(x)}" cy="${f1(y)}" r="8.5" fill="${C.arterial}"/><circle cx="${f1(x)}" cy="${f1(y)}" r="4.5" fill="${C.park}"/>`;
    }).join('')}`;
}

// ---------------------------------------------------------------- lớp lô đất

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Vùng bấm, màu gia tộc, huy hiệu, mã lô; `info` theo id: { owner, mine }. */
export function plotLayer(infos, { selected = null, showClimate = false } = {}) {
  return PLOTS.map((p) => {
    const g = GEOMETRY.get(p.id);
    const info = infos.get(p.id) ?? {};
    const owner = info.owner;
    const tint = owner ? `<polygon points="${pts(g.block)}" fill="${esc(owner.color)}" fill-opacity=".38" stroke="${esc(owner.color)}" stroke-width="2"${info.mine ? ' stroke-dasharray="5 2"' : ''} pointer-events="none"/>` : '';
    const badge = owner ? `<g pointer-events="none"><circle cx="${f1(g.cx)}" cy="${f1(g.cy)}" r="8.5" fill="#fff" stroke="${esc(owner.color)}" stroke-width="2"/><text x="${f1(g.cx)}" y="${f1(g.cy + 4)}" text-anchor="middle" font-size="10">${esc(owner.emblem)}</text></g>` : '';
    const climate = showClimate ? `<text x="${f1(g.cx + 14)}" y="${f1(g.cy + 15)}" text-anchor="middle" font-size="10" pointer-events="none">${CLIMATES[p.climate].icon}</text>` : '';
    return `<g class="plot${owner ? ' taken' : ' free'}${info.mine ? ' mine' : ''}${selected === p.id ? ' sel' : ''}" data-plot="${p.id}">
      ${tint}<polygon class="hit" points="${pts(g.block)}"/>${badge}${climate}
      <text class="code" x="${f1(g.quad[0][0] + 5)}" y="${f1(g.quad[0][1] + 11)}">${p.code}</text></g>`;
  }).join('');
}

export function landMapSvg({ key, fillFor, infos, selected, showClimate }) {
  return `<svg class="land-svg" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="Bản đồ 200 lô đất">
    <g class="lm-static">${staticLayer(key, fillFor)}</g>
    <g class="lm-plots">${plotLayer(infos, { selected, showClimate })}</g>
  </svg>`;
}

export const zoneSwatch = (zone) => ZONES[zone].color;
