// Bản đồ đất của gia tộc: 200 lô là 200 ô lục giác (đỉnh nhọn) xếp thẳng hàng 20 × 10, hàng lẻ lệch nửa ô,
// giữa biển. Trong trình duyệt nền là tranh pixel art nhìn 3/4 (landpixel.js), vẽ một lần cho mọi chế độ; lưới lô
// mảnh, màu theo chế độ (nền tranh mờ đi), lô chọn, huy hiệu kinh doanh của lô có chủ và mây trôi là SVG vẽ đè. Khi
// không có canvas (test trên Node) thì vẽ nền vector đơn giản. Lớp tĩnh lưu bộ nhớ đệm, lớp lô đất vẽ đè lên.
import { CLIMATES, DESIGN, INDUSTRIES, LAND, MAP_PALETTE as C, PLOTS, ZONES, designSvg, pieceById, riverRow } from './shared/clan.js';
import { drawClouds, drawPixelBase } from './landpixel.js';
import { iconSvg } from './icons/index.js';

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

/**
 * Dấu vân tay của bản đồ: cỡ khung, mã và vùng của 200 lô, đường sông. Tranh 16-bit (scripts/art/build-landmap.py)
 * ghi lại giá trị này vào landmap.json; khác nhau nghĩa là PLOTS đã đổi mà chưa dựng lại tranh, nên dùng tranh cũ.
 */
export function plotsHash() {
  const text = `${MAP_W}x${MAP_H}|${PLOTS.map((p) => `${p.code}:${p.zone}`).join(',')}|${riverPoints().map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ')}`;
  // cyrb53: băm 53 bit, đủ để nhận ra bản đồ đổi; không dùng cho bảo mật.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** Dữ liệu cho script dựng tranh (Node): hình học lô và đường sông đúng như trình duyệt dùng. */
export function mapGeometry() {
  return {
    MAP_W, MAP_H, TW, HEX_R, PAD, LAND, plots_hash: plotsHash(),
    plots: PLOTS.map((p) => ({ id: p.id, code: p.code, zone: p.zone, col: p.col, row: p.row })),
    geo: PLOTS.map((p) => { const g = GEOMETRY.get(p.id); return { id: p.id, cx: g.cx, cy: g.cy, hex: g.hex }; }),
    river: riverPoints(),
  };
}

// ---------------------------------------------------------------- lớp tĩnh

const cache = new Map();
const pixelBase = typeof document !== 'undefined';
let art = null;

/**
 * Tranh nền và mây, vẽ một lần cho mọi chế độ tô màu. `ms`: thời gian vẽ (đo hiệu năng). Ảnh nền được nén PNG bất
 * đồng bộ (toBlob, ngoài luồng chính) rồi gắn vào các thẻ <image class="lm-art"> đang có; trước đó tạm để trống.
 */
export function landArt() {
  if (!pixelBase) return null;
  if (!art) {
    const t0 = performance.now();
    const canvas = drawPixelBase({ width: MAP_W, height: MAP_H, geometry: GEOMETRY, river: riverPoints() });
    const clouds = drawClouds({ width: MAP_W, height: MAP_H }).map((c) => ({ ...c, url: c.cloud.toDataURL(), shadowUrl: c.shadow.toDataURL() }));
    art = { canvas, url: '', clouds, ms: 0 };
    art.ms = Math.round(performance.now() - t0);
    canvas.toBlob((blob) => {
      art.url = blob ? URL.createObjectURL(blob) : canvas.toDataURL();
      document.querySelectorAll('image.lm-art').forEach((el) => el.setAttribute('href', art.url));
    });
  }
  return art;
}
const ART_HREF = '__lm_art__';

// ---------------------------------------------------------------- tranh 16-bit dựng sẵn (scripts/art/build-landmap.py)

/** Bề ngang khung SVG khi dùng tranh 16-bit: 702 điểm ảnh × 1,5 đơn vị (một điểm ảnh tranh = 1,5 đơn vị, nguyên lần). */
const ART_W = 1053;
const LM16_BASE = typeof document !== 'undefined' ? new URL('../assets/landmap/', import.meta.url).href : '';
/**
 * Trạng thái tranh 16-bit: 'pending' (đang tải, vẽ sẵn khung 16-bit), 'ok', 'fail' (lỗi tải hoặc plots_hash khác PLOTS
 * hiện tại: dùng tranh vẽ bằng mã của landpixel.js như trước, ẩn nút phóng to).
 */
let lm16 = null;
const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = LM16_BASE + src;
});
function lm16Load() {
  if (!pixelBase || lm16) return lm16;
  lm16 = { state: 'pending' };
  lm16.ready = fetch(`${LM16_BASE}landmap.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((data) => {
      if (data.plots_hash !== plotsHash()) throw new Error('plots_hash');
      lm16.data = data;
      return Promise.all([loadImage(data.map), loadImage(data.atlas)]);
    })
    .then(([map, atlas]) => Object.assign(lm16, { map, atlas, state: 'ok' }))
    .catch(() => {
      lm16.state = 'fail';
      downgrade();
    });
  return lm16;
}
/** Đang dùng (hoặc đang tải) tranh 16-bit. */
const w16 = () => pixelBase && lm16Load()?.state !== 'fail';

/** Lưới lô: mỗi cạnh lục giác một lần, một đường path (hai nét: bóng sẫm và vạch kem, độ dày theo CSS). */
let gridPath = null;
function grid() {
  if (gridPath == null) {
    const seen = new Set();
    gridPath = '';
    for (const p of PLOTS) {
      const hex = GEOMETRY.get(p.id).hex;
      hex.forEach((a, k) => {
        const b = hex[(k + 1) % 6];
        const key = [a, b].map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).sort().join('|');
        if (seen.has(key)) return;
        seen.add(key);
        gridPath += `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`;
      });
    }
  }
  return `<path class="lm-grid lm-grid-shade" d="${gridPath}"/><path class="lm-grid lm-grid-line" d="${gridPath}"/>`;
}

/** Có tô màu theo chế độ (giá, khí hậu, độ hợp ngành...) hay chỉ xem tranh địa hình. */
const isHeat = (fillFor) => PLOTS.some((p) => fillFor(p));

/**
 * Lớp tĩnh của bản đồ cho một chế độ tô màu. `fillFor(plot)` trả màu ô (null = theo địa hình).
 * `key` đổi khi màu đổi (ví dụ chế độ + ngành), để dùng lại bộ nhớ đệm.
 */
export function staticLayer(key, fillFor) {
  const k = `${w16() ? '16:' : ''}${key}`;
  if (cache.has(k)) return cache.get(k);
  const svg = pixelBase ? pixelLayer(fillFor) : vectorLayer(fillFor);
  cache.set(k, svg);
  return svg;
}

function pixelLayer(fillFor) {
  if (w16()) {
    // Tranh nằm trên canvas "mặt đất" dưới SVG; chế độ tô màu phủ tranh mờ (cùng tệp map.webp) như trước.
    if (!isHeat(fillFor)) return grid();
    const fills = PLOTS.map((p) => `<polygon points="${pts(GEOMETRY.get(p.id).hex)}" fill="${fillFor(p) ?? ZONES[p.zone].color}"/>`).join('');
    return `<rect width="${ART_W}" height="${MAP_H}" rx="12" fill="#fff3e3"/><image class="lm-art faded" href="${LM16_BASE}map.webp" width="${ART_W}" height="${MAP_H}" preserveAspectRatio="none"/><g class="lm-heat">${fills}</g>${grid()}`;
  }
  landArt();
  const image = (cls) => `<image class="lm-art${cls}" href="${ART_HREF}" width="${MAP_W}" height="${MAP_H}" preserveAspectRatio="none"/>`;
  if (!isHeat(fillFor)) return image('') + grid();
  // Chế độ tô màu: tranh mờ và nhạt màu làm nền, màu từng lô phủ lên cho dễ đọc.
  const fills = PLOTS.map((p) => `<polygon points="${pts(GEOMETRY.get(p.id).hex)}" fill="${fillFor(p) ?? ZONES[p.zone].color}"/>`).join('');
  return `<rect width="${MAP_W}" height="${MAP_H}" rx="12" fill="#fff3e3"/>${image(' faded')}<g class="lm-heat">${fills}</g>${grid()}`;
}

function vectorLayer(fillFor) {
  const hexes = PLOTS.map((p) => {
    const fill = fillFor(p) ?? ZONES[p.zone].color;
    return `<polygon points="${pts(GEOMETRY.get(p.id).hex)}" fill="${fill}" stroke="#00000022"/>`;
  }).join('');
  return `<rect width="${MAP_W}" height="${MAP_H}" rx="12" fill="${C.sea}"/>${hexes}
    <polyline points="${pts(riverPoints())}" fill="none" stroke="${C.river}" stroke-width="8" stroke-linejoin="round"/>`;
}

/** Mây trôi và bóng mây: lớp trên cùng, không nhận bấm (CSS), mờ đi khi đang chọn lô. */
function cloudLayer() {
  const a = landArt();
  if (!a) return '';
  return `<g class="lm-clouds" aria-hidden="true">${a.clouds.map((c, k) => {
    const u = (v) => f1(v / c.scale);
    return `<g class="lm-cloud" style="--drift:${[46, 58, 52][k]}s;--delay:-${k * 17}s">
      <image class="lm-cloud-shadow" href="${c.shadowUrl}" x="${u(c.sx)}" y="${u(c.sy)}" width="${u(c.shadow.width)}" height="${u(c.shadow.height)}"/>
      <image href="${c.url}" x="${u(c.x)}" y="${u(c.y)}" width="${u(c.cloud.width)}" height="${u(c.cloud.height)}"/></g>`;
  }).join('')}</g>`;
}

// ---------------------------------------------------------------- lớp lô đất

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- huy hiệu kinh doanh

const placed = (svg, x, y, w, h) => svg.replace('<svg ', `<svg x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" `);
const iconCache = new Map();
/** Biểu tượng pixel của emoji, đặt trong ô vuông `size` có tâm (x, y); emoji thường nếu chưa có icon. */
function icon(emoji, x, y, size) {
  if (!iconCache.has(emoji)) iconCache.set(emoji, iconSvg(emoji));
  const svg = iconCache.get(emoji);
  return svg ? placed(svg, x - size / 2, y - size / 2, size, size) : `<text x="${f1(x)}" y="${f1(y + size * 0.35)}" text-anchor="middle" font-size="${f1(size)}">${esc(emoji)}</text>`;
}

/** Công trình thu nhỏ: cắt khung vẽ 24×20 ô về đúng phần có mảnh (chừa nửa ô) để tòa nhà lấp đầy huy hiệu. */
function miniature(design, x, y, w, h) {
  const cells = design.map((p) => ({ p, piece: pieceById(p.piece) })).filter((d) => d.piece);
  if (!cells.length) return '';
  const k = DESIGN.cell;
  const x0 = Math.min(...cells.map((d) => d.p.x)) * k - k / 2;
  const y0 = Math.min(...cells.map((d) => d.p.y)) * k - k / 2;
  const x1 = Math.max(...cells.map((d) => d.p.x + d.piece.w)) * k + k / 2;
  const y1 = Math.max(...cells.map((d) => d.p.y + d.piece.h)) * k + k / 2;
  return placed(designSvg(design).replace(/viewBox="[^"]*"/, `viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" preserveAspectRatio="xMidYMax meet"`), x, y, w, h);
}

/** Viền huy hiệu: lô của mình viền vàng dày, gia tộc khác viền màu gia tộc; cả hai có nét mực bên ngoài. */
function rim(shape, info) {
  const color = info.mine ? '#f4c24f' : esc(info.owner.color);
  return `${shape(`fill="none" stroke="#2e1d14" stroke-width="${info.mine ? 6 : 4.4}"`)}${shape(`fill="#fff3e3" stroke="${color}" stroke-width="${info.mine ? 3.6 : 2.4}"${info.industry ? '' : ' stroke-dasharray="4 2.5"'}`)}`;
}

/**
 * Huy hiệu kinh doanh giữa ô: thẻ kem có công trình thu nhỏ (kèm biểu tượng ngành ở góc), hoặc chỉ biểu tượng ngành khi
 * chưa xây; lô chưa chọn ngành hiện huy hiệu gia tộc viền đứt. Dấu "!" đỏ khi lô có ngành mà sản lượng 0.
 */
function bizMarker(g, info, biz, compact) {
  const ind = INDUSTRIES[info.industry];
  const warn = biz?.state === 'zero';
  let body;
  if (info.design?.length && !compact) {
    const card = (attrs) => `<rect x="-19" y="-13" width="38" height="32" rx="6" ${attrs}/>`;
    body = `${rim(card, info)}${miniature(info.design, -15, -10, 30, 26)}
      ${ind ? `<circle cx="-17" cy="-12" r="8" fill="#fff3e3" stroke="#2e1d14" stroke-width="1.4"/>${icon(ind.icon, -17, -12, 11)}` : ''}`;
  } else {
    const r = compact ? 10.5 : 12;
    const disc = (attrs) => `<circle cx="0" cy="2" r="${r}" ${attrs}/>`;
    body = `${rim(disc, info)}${icon(ind ? ind.icon : info.owner.emblem, 0, 2, compact ? 13 : 15)}`;
  }
  // dấu "!" vẽ bằng hình (không phụ thuộc phông chữ): vạch và chấm trắng trên tròn đỏ viền mực
  const alert = warn ? `<g class="biz-warn" transform="translate(${compact || !info.design?.length ? '11 -9' : '17 -12'})"><circle class="biz-ping" r="7" fill="none" stroke="#d23b3b" stroke-width="2"/><circle r="7" fill="#d23b3b" stroke="#2e1d14" stroke-width="1.4"/>
    <rect x="-1.25" y="-4.6" width="2.5" height="5.4" rx=".8" fill="#fff"/><rect x="-1.25" y="2.2" width="2.5" height="2.5" rx=".8" fill="#fff"/></g>` : '';
  return `<g class="biz-mark${info.mine ? ' mine' : ''}${warn ? ' warn' : ''}" transform="translate(${f1(g.cx)} ${f1(g.cy)})${info.mine ? ' scale(1.1)' : ''}" pointer-events="none">${body}${alert}</g>`;
}

/**
 * Vùng bấm, màu gia tộc, huy hiệu, mã lô; `infos` theo id: { owner, mine, industry, design }. Có `business`
 * (Map id → trạng thái kinh doanh) thì lô có chủ hiện huy hiệu kinh doanh thay cho lá cờ; `tint: false` bỏ lớp phủ
 * màu gia tộc (chế độ tô màu theo ngành).
 */
export function plotLayer(infos, { selected = null, showClimate = false, resources = null, business = null, tint: tinted = true } = {}) {
  return PLOTS.map((p) => {
    const g = GEOMETRY.get(p.id);
    const info = infos.get(p.id) ?? {};
    const owner = info.owner;
    const shape = pts(g.hex);
    const inner = pts(g.hex.map(([x, y]) => [g.cx + (x - g.cx) * 0.9, g.cy + (y - g.cy) * 0.9]));
    // Lô có chủ: phủ màu gia tộc, viền trong (lô của mình viền vàng dày, gia tộc khác màu gia tộc) và huy hiệu.
    const edge = business && info.mine ? '#f4c24f' : esc(owner?.color);
    const tint = owner ? `<g pointer-events="none">${tinted ? `<polygon points="${shape}" fill="${esc(owner.color)}" fill-opacity=".3"/>` : ''}
      <polygon points="${inner}" fill="none" stroke="#2e1d14" stroke-opacity=".55" stroke-width="${business && info.mine ? 6 : 4}" stroke-linejoin="round"/>
      <polygon points="${inner}" fill="none" stroke="${edge}" stroke-width="${business && info.mine ? 3.4 : 2.4}" stroke-linejoin="round"${info.mine && !business ? ' stroke-dasharray="6 3"' : ''}/></g>` : '';
    const badge = owner && business ? bizMarker(g, info, business.get(p.id), !tinted) : owner ? `<g class="flag" transform="translate(${f1(g.cx - 2)} ${f1(g.cy + 6)})" pointer-events="none">
      <path d="M-3 0h7v2.5h-7zM-0.5 -20h2.5v20h-2.5z" fill="#2e1d14"/><path d="M2 -20h15v11h-15z" fill="#2e1d14"/>
      <path d="M2 -19h14v9h-14z" fill="${esc(owner.color)}"/><text x="9" y="-11.6" text-anchor="middle" font-size="7.5">${esc(owner.emblem)}</text></g>` : '';
    const climate = showClimate ? `<text x="${f1(g.cx + 12)}" y="${f1(g.cy + 16)}" text-anchor="middle" font-size="10" pointer-events="none">${CLIMATES[p.climate].icon}</text>` : '';
    const res = resources?.get(p.id) ? `<text x="${f1(g.cx)}" y="${f1(g.cy + (owner ? 20 : 6))}" text-anchor="middle" font-size="${owner ? 9 : 13}" pointer-events="none">${resources.get(p.id)}</text>` : '';
    const warn = business?.get(p.id)?.state === 'zero';
    return `<g class="plot${owner ? ' taken' : ' free'}${info.mine ? ' mine' : ''}${warn ? ' warn' : ''}${selected === p.id ? ' sel' : ''}" data-plot="${p.id}">
      ${tint}<polygon class="hit" points="${shape}"/><polygon class="ring" points="${shape}"/>${badge}${climate}${res}
      <path class="pin" d="M${f1(g.cx - 15)} ${f1(g.cy - HEX_R - 19)}h30v13h-11l-4 5l-4 -5h-11z"/>
      <text class="code" x="${f1(g.cx)}" y="${f1(g.cy - HEX_R + 12)}" text-anchor="middle">${p.code}</text></g>`;
  }).join('');
}

let myPlots = [];
export function landMapSvg({ key, fillFor, infos, selected, showClimate, resources, business = null, tint = true }) {
  const terrain = pixelBase && !isHeat(fillFor);
  const m16 = w16();
  myPlots = [...infos.entries()].filter(([, v]) => v?.mine).map(([id]) => id);
  const svg = `<svg class="land-svg${terrain ? ' terrain' : ''}" viewBox="0 0 ${m16 ? ART_W : MAP_W} ${MAP_H}" role="img" aria-label="Bản đồ 200 lô đất">
    <g class="lm-static">${staticLayer(key, fillFor).replace(ART_HREF, art?.url ?? '')}</g>
    <g class="lm-plots">${plotLayer(infos, { selected, showClimate, resources, business, tint })}</g>
    ${terrain && !m16 ? cloudLayer() : ''}
  </svg>`;
  if (!m16) return svg;
  // Bản 16-bit: canvas mặt đất (tranh + hiệu ứng mặt đất) dưới SVG trong suốt, canvas trời (mây, hải âu) trên cùng.
  const cv = (cls) => `<canvas class="${cls}" width="702" height="${Math.round(MAP_H / 1.5)}" aria-hidden="true"></canvas>`;
  return `<div class="lm16-stage${terrain ? '' : ' heat'}">${cv('lm16-ground')}${svg}${terrain ? cv('lm16-sky') : ''}</div>`;
}

// ---------------------------------------------------------------- bản đồ nhỏ "Xem nhanh"

let miniOpen = null; // lựa chọn của người chơi (null = theo màn hình), giữ qua các lần vẽ lại

/** Khung bản đồ nhỏ đặt cạnh `.land-scroll` (trong cùng một khung bọc có position: relative); bản 16-bit thêm nút phóng to. */
export function miniMapHtml() {
  if (!pixelBase) return '';
  const zoom = w16() ? `<div class="lm-zoom" role="group" aria-label="Phóng to bản đồ">
    <button type="button" data-lmz="-1" aria-label="Thu nhỏ">−</button><b class="lm-zoom-level" aria-live="polite">1×</b><button type="button" data-lmz="1" aria-label="Phóng to">+</button></div>` : '';
  return `${zoom}<div class="lm-mini"><button type="button" class="lm-mini-toggle" aria-expanded="false">🗺️ <span>Xem nhanh</span><i aria-hidden="true"></i></button>
    <div class="lm-mini-body"><canvas class="lm-mini-map" aria-hidden="true"></canvas><i class="lm-mini-view"></i></div></div>`;
}

/** Vẽ tranh nền vào bản đồ nhỏ: tranh 16-bit khi đã tải, không thì tranh của landpixel.js. */
function paintMini(canvas) {
  const src = lm16?.state === 'ok' ? lm16.map : w16() ? null : landArt()?.canvas;
  if (!src) return;
  const g = canvas.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.drawImage(src, 0, 0, src.naturalWidth || src.width, src.naturalHeight || src.height, 0, 0, canvas.width, canvas.height);
}

/**
 * Gắn hành vi cho bản đồ nhỏ trong khung `wrap`: thu gọn sẵn khi cả bản đồ vừa khung (máy tính), mở sẵn khi bản
 * đồ phải cuộn (điện thoại); khung vàng là phần đang thấy (theo cả cuộn ngang lẫn dọc), chạm vào bản đồ nhỏ để cuộn
 * tới đó; tự dời sang góc trái khi che lô đang chọn. Bản 16-bit: gắn thêm phóng to, canvas tranh và hiệu ứng.
 */
export function bindMiniMap(wrap) {
  const mini = wrap?.querySelector('.lm-mini');
  const scroll = wrap?.querySelector('.land-scroll');
  if (!mini || !scroll || !pixelBase) return;
  const stage = scroll.querySelector('.lm16-stage');
  if (!stage && !landArt()) return;
  const canvas = mini.querySelector('.lm-mini-map');
  canvas.width = 240;
  canvas.height = Math.round((240 * MAP_H) / (stage ? ART_W : MAP_W));
  paintMini(canvas);
  const view = mini.querySelector('.lm-mini-view');
  const toggle = mini.querySelector('.lm-mini-toggle');
  const overflow = () => scroll.scrollWidth > scroll.clientWidth + 2 || scroll.scrollHeight > scroll.clientHeight + 2;
  const setOpen = (open) => {
    mini.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    place();
  };
  const update = () => {
    const w = scroll.scrollWidth || 1;
    const h = scroll.scrollHeight || 1;
    view.style.left = `${(scroll.scrollLeft / w) * 100}%`;
    view.style.width = `${Math.min(1, scroll.clientWidth / w) * 100}%`;
    view.style.top = `${(scroll.scrollTop / h) * 100}%`;
    view.style.height = `${Math.min(1, scroll.clientHeight / h) * 100}%`;
  };
  // Không che lô đang chọn: thử góc phải rồi góc trái.
  const place = () => {
    const sel = scroll.querySelector('.plot.sel .hit');
    mini.classList.remove('left');
    if (!sel) return;
    const hit = (r, s) => r.left < s.right && r.right > s.left && r.top < s.bottom && r.bottom > s.top;
    const s = sel.getBoundingClientRect();
    if (hit(mini.getBoundingClientRect(), s)) mini.classList.add('left');
  };
  toggle.addEventListener('click', () => {
    miniOpen = !mini.classList.contains('open');
    setOpen(miniOpen);
  });
  mini.querySelector('.lm-mini-body').addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    scroll.scrollTo({
      left: ((e.clientX - r.left) / r.width) * scroll.scrollWidth - scroll.clientWidth / 2,
      top: ((e.clientY - r.top) / r.height) * scroll.scrollHeight - scroll.clientHeight / 2,
      behavior: calm() ? 'auto' : 'smooth',
    });
  });
  scroll.addEventListener('scroll', () => {
    update();
    place();
  }, { passive: true });
  scroll.addEventListener('click', () => requestAnimationFrame(place));
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { update(); place(); }).observe(scroll);
  wrap.addEventListener('lm-zoom', () => {
    if (miniOpen == null) setOpen(overflow());
    update();
  });
  wrap.addEventListener('lm-art', () => {
    canvas.height = Math.round((240 * MAP_H) / (wrap.querySelector('.lm16-stage') ? ART_W : MAP_W));
    paintMini(canvas);
  });
  if (stage) bindLand16(wrap, scroll, stage);
  update();
  setOpen(miniOpen ?? overflow());
}

// ---------------------------------------------------------------- tới lô, chú thích khi rê chuột

const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Cuộn bản đồ (khung `wrap`) cho lô `id` vào giữa (cả hai chiều), rồi đưa bản đồ vào màn hình nếu đang khuất. */
export function scrollToPlot(wrap, id) {
  const scroll = wrap?.querySelector('.land-scroll');
  const g = GEOMETRY.get(id);
  if (!scroll || !g) return;
  const behavior = calm() ? 'auto' : 'smooth';
  const w = scroll.querySelector('.lm16-stage') ? ART_W : MAP_W;
  if (scroll.scrollWidth > scroll.clientWidth + 2 || scroll.scrollHeight > scroll.clientHeight + 2) {
    scroll.scrollTo({ left: (g.cx / w) * scroll.scrollWidth - scroll.clientWidth / 2, top: (g.cy / MAP_H) * scroll.scrollHeight - scroll.clientHeight / 2, behavior });
  }
  const r = wrap.getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight) wrap.scrollIntoView({ block: 'nearest', behavior });
}

/**
 * Chú thích nổi khi rê chuột lên lô (chỉ chuột: chạm vẫn chọn lô như cũ, khung bên đã có đủ thông tin).
 * `tipFor(id)` trả HTML của chú thích.
 */
export function bindPlotTips(wrap, tipFor) {
  const scroll = wrap?.querySelector('.land-scroll');
  if (!scroll || typeof document === 'undefined') return;
  const tip = document.createElement('div');
  tip.className = 'lm-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  wrap.append(tip);
  let shown = null;
  const hide = () => {
    tip.hidden = true;
    shown = null;
  };
  scroll.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const plot = e.target.closest?.('[data-plot]');
    if (!plot) return hide();
    const id = Number(plot.dataset.plot);
    if (id !== shown) {
      tip.innerHTML = tipFor(id);
      shown = id;
    }
    tip.hidden = false;
    // Đặt cạnh con trỏ, lật sang trái/lên trên khi sát mép khung bản đồ.
    const box = wrap.getBoundingClientRect();
    const zoom = box.width / wrap.offsetWidth || 1; // bù CSS zoom của game
    const x = (e.clientX - box.left) / zoom;
    const y = (e.clientY - box.top) / zoom;
    const flipX = x + 16 + tip.offsetWidth > wrap.offsetWidth;
    const flipY = y + 16 + tip.offsetHeight > wrap.offsetHeight;
    tip.style.left = `${Math.max(4, flipX ? x - 12 - tip.offsetWidth : x + 16)}px`;
    tip.style.top = `${Math.max(4, flipY ? y - 12 - tip.offsetHeight : y + 16)}px`;
  });
  scroll.addEventListener('pointerleave', hide);
  scroll.addEventListener('scroll', hide, { passive: true });
}

// ---------------------------------------------------------------- bản 16-bit: phóng to, ghim công trình, hiệu ứng

let zoomLevel = null; // null = mặc định theo màn hình; sau đó giữ lựa chọn của người chơi qua các lần vẽ lại
const phone = () => typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches;

/** Tâm mặc định khi mở ở 2× (điện thoại): lô của gia tộc mình gần trọng tâm các lô đó nhất, không có thì E10 (Trung tâm). */
function focusPlot() {
  const list = myPlots.map((id) => GEOMETRY.get(id)).filter(Boolean);
  if (!list.length) return GEOMETRY.get(PLOTS.find((p) => p.code === 'E10')?.id ?? 90);
  const mx = list.reduce((a, g) => a + g.cx, 0) / list.length;
  const my = list.reduce((a, g) => a + g.cy, 0) / list.length;
  return list.reduce((b, g) => (Math.hypot(g.cx - mx, g.cy - my) < Math.hypot(b.cx - mx, b.cy - my) ? g : b));
}

/** Nút + / − và phím + / −: 1×, 2×, 3× nguyên lần (khối cuộn đã bù zoom 0,9 của game); giữ tâm khung nhìn khi đổi mức. */
function bindZoom(wrap, scroll) {
  wrap.classList.add('w16');
  const label = wrap.querySelector('.lm-zoom-level');
  const center = (fx, fy) => scroll.scrollTo({ left: fx * scroll.scrollWidth - scroll.clientWidth / 2, top: fy * scroll.scrollHeight - scroll.clientHeight / 2 });
  const apply = (z, keep = true) => {
    const cx = (scroll.scrollLeft + scroll.clientWidth / 2) / (scroll.scrollWidth || 1);
    const cy = (scroll.scrollTop + scroll.clientHeight / 2) / (scroll.scrollHeight || 1);
    zoomLevel = Math.max(1, Math.min(3, z));
    wrap.style.setProperty('--lmz', zoomLevel);
    wrap.classList.toggle('zin', zoomLevel >= 2);
    if (label) label.textContent = `${zoomLevel}×`;
    wrap.querySelectorAll('[data-lmz]').forEach((b) => {
      b.disabled = (b.dataset.lmz === '1' && zoomLevel === 3) || (b.dataset.lmz === '-1' && zoomLevel === 1);
    });
    if (keep) center(cx, cy);
    scroll.dispatchEvent(new Event('scroll'));
    wrap.dispatchEvent(new Event('lm-zoom'));
  };
  wrap.querySelectorAll('[data-lmz]').forEach((b) => b.addEventListener('click', () => apply(zoomLevel + Number(b.dataset.lmz))));
  scroll.tabIndex = 0;
  scroll.setAttribute('aria-label', 'Bản đồ đất: phím + và − để phóng to, thu nhỏ');
  scroll.addEventListener('keydown', (e) => {
    const d = { '+': 1, '=': 1, '-': -1, _: -1 }[e.key];
    if (!d || e.target !== scroll || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    apply(zoomLevel + d);
  });
  const first = zoomLevel == null;
  if (first) zoomLevel = phone() ? 2 : 1;
  apply(zoomLevel, false);
  if (first && zoomLevel > 1) {
    const g = focusPlot();
    center(g.cx / ART_W, g.cy / MAP_H);
    scroll.dispatchEvent(new Event('scroll'));
  }
}

/** Lô có công trình biểu tượng: huy hiệu bọc thêm một lớp để CSS thu thành ghim góc dưới phải từ 2× (công trình lộ ra). */
function markLandmarks(stage) {
  for (const id of lm16.data.landmark_plots ?? []) {
    const plot = stage.querySelector(`.plot[data-plot="${id}"]`);
    const g = GEOMETRY.get(id);
    if (!plot || !g || plot.classList.contains('lmk')) continue;
    plot.classList.add('lmk');
    const badge = plot.querySelector(':scope > .biz-mark, :scope > .flag');
    if (!badge) continue;
    const wrapEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    wrapEl.setAttribute('class', 'lmk-badge');
    wrapEl.style.transformOrigin = `${f1(g.cx)}px ${f1(g.cy)}px`;
    badge.replaceWith(wrapEl);
    wrapEl.append(badge);
  }
}

let active = null; // vòng hiệu ứng đang chạy (chỉ một bản đồ một lúc)

function bindLand16(wrap, scroll, stage) {
  bindZoom(wrap, scroll);
  const run = () => {
    if (!stage.isConnected || lm16.state !== 'ok') return;
    markLandmarks(stage);
    wrap.dispatchEvent(new Event('lm-art'));
    active?.destroy();
    active = startFx(stage);
  };
  if (lm16.state === 'ok') run();
  else lm16.ready.then(run);
}

/**
 * Hiệu ứng (8 khung/giây, chỉ vẽ lại vùng có hiệu ứng): thác, cối xay, đèn hải đăng, thuyền nhấp nhô, sóng, khói, lấp
 * lánh, cờ trên canvas mặt đất (dưới lưới lô); mây (bóng tối một bậc palette trên mặt đất) và hải âu trên canvas trời.
 * Dừng khi bản đồ ra khỏi màn hình hoặc thẻ ẩn; "giảm chuyển động": một khung tĩnh, không vòng lặp; hủy khi bản đồ bị
 * gỡ khỏi trang (rời màn Gia tộc, vẽ lại bản đồ).
 */
function startFx(stage) {
  const { data, map, atlas } = lm16;
  const [W, H] = data.size;
  const ground = stage.querySelector('.lm16-ground').getContext('2d');
  const skyEl = stage.querySelector('.lm16-sky');
  const sky = skyEl?.getContext('2d');
  ground.imageSmoothingEnabled = false;
  ground.drawImage(map, 0, 0);
  const heat = stage.classList.contains('heat');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const fx = data.ground.flatMap((f) => [f.r.slice(0, 2), ...(f.at ?? [])].map(([x, y], k) => ({ ...f, x, y, w: f.r[2], h: f.r[3], phase: f.phase + k * 410 })));
  const dark = new Map(data.dark);
  // mặt nạ bóng mây = phần đục của hình mây
  const masks = (() => {
    const c = document.createElement('canvas');
    c.width = atlas.naturalWidth;
    c.height = atlas.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(atlas, 0, 0);
    return data.clouds.map(({ a }) => g.getImageData(a[0], a[1], a[2], a[3]).data);
  })();
  const frameAt = (f, t) => {
    const k = Math.floor(((t + f.phase) % (f.f.length * f.ms + f.gap)) / f.ms);
    return k < f.f.length ? f.f[k] : null;
  };
  const cloudX = (c, t) => {
    const span = W + c.a[2] + 40;
    return Math.round(((((c.x + c.a[2] + 20 + (c.v * t) / 1000) % span) + span) % span) - c.a[2] - 20);
  };
  let shadows = []; // vùng bóng mây của khung trước (trả lại tranh gốc ở khung sau)
  function draw(t) {
    for (const [x, y, w, h] of shadows) ground.drawImage(map, x, y, w, h, x, y, w, h);
    shadows = [];
    for (const f of fx) {
      ground.drawImage(map, f.x, f.y, f.w, f.h, f.x, f.y, f.w, f.h);
      const fr = frameAt(f, t);
      if (fr) ground.drawImage(atlas, fr[0], fr[1], f.w, f.h, f.x, f.y, f.w, f.h);
    }
    if (!sky) return;
    sky.clearRect(0, 0, W, H);
    data.clouds.forEach((c, i) => {
      const x = cloudX(c, t);
      const sx = x + c.sh[0];
      const sy = c.y + c.sh[1];
      const x0 = Math.max(0, sx);
      const y0 = Math.max(0, sy);
      const x1 = Math.min(W, sx + c.a[2]);
      const y1 = Math.min(H, sy + c.a[3]);
      if (x1 > x0 && y1 > y0) {
        const img = ground.getImageData(x0, y0, x1 - x0, y1 - y0);
        const px = img.data;
        for (let yy = y0; yy < y1; yy++) {
          for (let xx = x0; xx < x1; xx++) {
            if (!masks[i][((yy - sy) * c.a[2] + (xx - sx)) * 4 + 3]) continue;
            const o = ((yy - y0) * (x1 - x0) + (xx - x0)) * 4;
            const d = dark.get((px[o] << 16) | (px[o + 1] << 8) | px[o + 2]);
            if (d != null) {
              px[o] = d >> 16;
              px[o + 1] = (d >> 8) & 255;
              px[o + 2] = d & 255;
            }
          }
        }
        ground.putImageData(img, x0, y0);
        shadows.push([x0, y0, x1 - x0, y1 - y0]);
      }
      sky.drawImage(atlas, c.a[0], c.a[1], c.a[2], c.a[3], x, c.y, c.a[2], c.a[3]);
    });
    const gf = data.gulls.f;
    for (const fl of data.gulls.flocks) {
      for (let j = 0; j < fl.n; j++) {
        const a = (2 * Math.PI * t) / (fl.t * 1000) + j * 0.55;
        const x = Math.round(fl.cx + fl.rx * Math.cos(a) + j * 7);
        const y = Math.round(fl.cy + fl.ry * Math.sin(a) + 2 * Math.sin(t / 700 + j));
        const fr = gf[(Math.floor(t / data.gulls.ms) + j) % gf.length];
        sky.drawImage(atlas, fr[0], fr[1], fr[2], fr[3], x, y, fr[2], fr[3]);
      }
    }
  }
  let raf = 0;
  let onScreen = true;
  let last = 0;
  const t0 = performance.now();
  const step = 1000 / (data.fps || 8);
  const loop = (now) => {
    if (!stage.isConnected) return destroy();
    raf = requestAnimationFrame(loop);
    if (now - last < step) return;
    last = now;
    draw(Math.max(0, now - t0)); // dấu thời gian của khung đầu có thể sớm hơn t0
  };
  function sync() {
    if (!stage.isConnected) return destroy();
    const go = onScreen && !document.hidden && !motion.matches && !heat;
    if (go && !raf) raf = requestAnimationFrame(loop);
    else if (!go && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    sync();
  }) : null;
  io?.observe(stage);
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  function destroy() {
    cancelAnimationFrame(raf);
    raf = 0;
    io?.disconnect();
    document.removeEventListener('visibilitychange', sync);
    motion.removeEventListener('change', sync);
    if (active?.stage === stage) active = null;
  }
  if (!heat) draw(0); // khung tĩnh (cũng là khung duy nhất khi giảm chuyển động)
  sync();
  return { stage, destroy };
}

/**
 * Tranh 16-bit lỗi tải hoặc không khớp PLOTS: thay tại chỗ các bản đồ đã vẽ sẵn khung 16-bit bằng tranh vẽ bằng mã của
 * landpixel.js (khung SVG 1052 như cũ), bỏ nút phóng to; lần vẽ sau dùng thẳng đường cũ.
 */
function downgrade() {
  cache.clear();
  active?.destroy();
  if (typeof document === 'undefined') return;
  const stages = [...document.querySelectorAll('.lm16-stage')];
  if (!stages.length) return;
  const a = landArt();
  for (const stage of stages) {
    const svg = stage.querySelector('svg.land-svg');
    const wrap = stage.closest('.land-wrap');
    svg.setAttribute('viewBox', `0 0 ${MAP_W} ${MAP_H}`);
    const statics = svg.querySelector('.lm-static');
    statics.querySelector('rect')?.setAttribute('width', MAP_W);
    const old = statics.querySelector('image.lm-art');
    if (old) {
      old.setAttribute('href', a.url);
      old.setAttribute('width', MAP_W);
    } else {
      statics.insertAdjacentHTML('afterbegin', `<image class="lm-art" href="${a.url}" width="${MAP_W}" height="${MAP_H}" preserveAspectRatio="none"/>`);
      svg.insertAdjacentHTML('beforeend', cloudLayer());
    }
    stage.replaceWith(svg);
    if (wrap) {
      wrap.classList.remove('w16', 'zin');
      wrap.style.removeProperty('--lmz');
      wrap.querySelector('.lm-zoom')?.remove();
      wrap.dispatchEvent(new Event('lm-art'));
      wrap.dispatchEvent(new Event('lm-zoom'));
    }
  }
}

lm16Load();
