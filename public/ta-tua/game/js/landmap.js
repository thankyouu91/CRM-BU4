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
  if (cache.has(key)) return cache.get(key);
  const svg = pixelBase ? pixelLayer(fillFor) : vectorLayer(fillFor);
  cache.set(key, svg);
  return svg;
}

function pixelLayer(fillFor) {
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

export function landMapSvg({ key, fillFor, infos, selected, showClimate, resources, business = null, tint = true }) {
  const terrain = pixelBase && !isHeat(fillFor);
  return `<svg class="land-svg${terrain ? ' terrain' : ''}" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="Bản đồ 200 lô đất">
    <g class="lm-static">${staticLayer(key, fillFor).replace(ART_HREF, art?.url ?? '')}</g>
    <g class="lm-plots">${plotLayer(infos, { selected, showClimate, resources, business, tint })}</g>
    ${terrain ? cloudLayer() : ''}
  </svg>`;
}

// ---------------------------------------------------------------- bản đồ nhỏ "Xem nhanh"

let miniOpen = null; // lựa chọn của người chơi (null = theo màn hình), giữ qua các lần vẽ lại

/** Khung bản đồ nhỏ đặt cạnh `.land-scroll` (trong cùng một khung bọc có position: relative). */
export function miniMapHtml() {
  if (!pixelBase) return '';
  return `<div class="lm-mini"><button type="button" class="lm-mini-toggle" aria-expanded="false">🗺️ <span>Xem nhanh</span><i aria-hidden="true"></i></button>
    <div class="lm-mini-body"><canvas class="lm-mini-map" aria-hidden="true"></canvas><i class="lm-mini-view"></i></div></div>`;
}

/**
 * Gắn hành vi cho bản đồ nhỏ trong khung `wrap`: thu gọn sẵn khi cả bản đồ vừa khung (máy tính), mở sẵn khi bản
 * đồ phải cuộn ngang (điện thoại); khung vàng là phần đang thấy, chạm vào bản đồ nhỏ để cuộn tới đó; tự dời sang
 * góc trái khi che lô đang chọn.
 */
export function bindMiniMap(wrap) {
  const mini = wrap?.querySelector('.lm-mini');
  const scroll = wrap?.querySelector('.land-scroll');
  const a = landArt();
  if (!mini || !scroll || !a) return;
  const canvas = mini.querySelector('.lm-mini-map');
  canvas.width = 240;
  canvas.height = Math.round((240 * MAP_H) / MAP_W);
  const g = canvas.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(a.canvas, 0, 0, canvas.width, canvas.height);
  const view = mini.querySelector('.lm-mini-view');
  const toggle = mini.querySelector('.lm-mini-toggle');
  const overflow = () => scroll.scrollWidth > scroll.clientWidth + 2;
  const setOpen = (open) => {
    mini.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    place();
  };
  const update = () => {
    const w = scroll.scrollWidth || 1;
    view.style.left = `${(scroll.scrollLeft / w) * 100}%`;
    view.style.width = `${Math.min(1, scroll.clientWidth / w) * 100}%`;
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
    scroll.scrollTo({ left: ((e.clientX - r.left) / r.width) * scroll.scrollWidth - scroll.clientWidth / 2, behavior: 'smooth' });
  });
  scroll.addEventListener('scroll', () => {
    update();
    place();
  }, { passive: true });
  scroll.addEventListener('click', () => requestAnimationFrame(place));
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { update(); place(); }).observe(scroll);
  update();
  setOpen(miniOpen ?? overflow());
}

// ---------------------------------------------------------------- tới lô, chú thích khi rê chuột

const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Cuộn bản đồ (khung `wrap`) cho lô `id` vào giữa, rồi đưa bản đồ vào màn hình nếu đang khuất (điện thoại). */
export function scrollToPlot(wrap, id) {
  const scroll = wrap?.querySelector('.land-scroll');
  const g = GEOMETRY.get(id);
  if (!scroll || !g) return;
  const behavior = calm() ? 'auto' : 'smooth';
  if (scroll.scrollWidth > scroll.clientWidth + 2) scroll.scrollTo({ left: (g.cx / MAP_W) * scroll.scrollWidth - scroll.clientWidth / 2, behavior });
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
