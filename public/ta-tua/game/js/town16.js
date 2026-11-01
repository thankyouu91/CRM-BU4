// Phố Trân Châu 16-bit: lưới khu phố nhìn từ trên xuống (góc 3/4). Năm khu (lô 3 ô) và quảng trường
// đài phun nước xếp giữa các đường ngang, đường dọc; cách xếp đổi theo bề ngang khung (town-plan.js:
// rộng 9 ô x 3 dãy, vừa 6 ô x 4 dãy, hẹp 3 ô x 9 dãy cuộn dọc). Thế giới vẽ ở 1x trên một canvas, phóng
// nguyên lần bằng CSS (1x cả phố trong một khung, nút "Phóng to" 2x; image-rendering: pixelated). Nhãn,
// huy hiệu, bảng tên khu và nút bấm là HTML phủ lên đúng khung từng toà. Ảnh lấy từ assets/town/ (atlas
// WebP + town.json, dựng bằng scripts/art/build-town.py); nơi nào chưa có tranh thì vẽ tạm toà nhà thủ
// tục cũ. Nạp ảnh lỗi thì dùng lại cả bản đồ thủ tục cũ (townmap.js).

import { T, planTown, townMode } from './town-plan.js';

const ASSETS = new URL('../assets/town/', import.meta.url);
const FPS = 12;
const SHADOW = 'rgba(46, 29, 20, 0.28)';
const PHONE = '(max-width: 767px)';
const REDUCED = '(prefers-reduced-motion: reduce)';
const CHIP_H = 114; // chip tên không bao giờ cao hơn chân toà quá chừng này (px 1×)

// ---------------------------------------------------------------- nạp ảnh (một lần cho cả phiên)

let assetsPromise = null;

function loadAssets() {
  if (!assetsPromise) {
    assetsPromise = (async () => {
      const res = await fetch(new URL('town.json', ASSETS));
      if (!res.ok) throw new Error(`town.json: HTTP ${res.status}`);
      const data = await res.json();
      const atlases = await Promise.all(data.atlases.map(async (name) => {
        const img = new Image();
        img.src = new URL(name, ASSETS).href;
        await img.decode();
        return img;
      }));
      return { data, atlases };
    })();
    assetsPromise.catch(() => { assetsPromise = null; });
  }
  return assetsPromise;
}

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false;
  return [c, g];
}

// ---------------------------------------------------------------- sprite

/**
 * Một khung vẽ được: ảnh nguồn (atlas hoặc canvas), vùng cắt, vị trí phần cắt trong ảnh gốc (ox, oy),
 * kích thước ảnh gốc (sw, sh) và điểm neo chân (ax, ay) theo toạ độ ảnh gốc.
 */
class Sprite {
  constructor(img, sx, sy, w, h, ox, oy, sw, sh, ax, ay) {
    Object.assign(this, { img, sx, sy, w, h, ox, oy, sw, sh, ax, ay });
  }

  /** Khung trên canvas khi chân đặt ở (fx, fy). */
  rect(fx, fy, flip = false) {
    const ox = flip ? this.sw - this.ox - this.w : this.ox;
    const ax = flip ? this.sw - this.ax : this.ax;
    return { x: Math.round(fx - ax + ox), y: Math.round(fy - this.ay + this.oy), w: this.w, h: this.h };
  }

  draw(g, fx, fy, flip = false) {
    const r = this.rect(fx, fy, flip);
    if (!flip) {
      g.drawImage(this.img, this.sx, this.sy, this.w, this.h, r.x, r.y, this.w, this.h);
    } else {
      g.save();
      g.translate(r.x + this.w, r.y);
      g.scale(-1, 1);
      g.drawImage(this.img, this.sx, this.sy, this.w, this.h, 0, 0, this.w, this.h);
      g.restore();
    }
    return r;
  }

  /** Bản sao trên canvas riêng (để chỉnh điểm ảnh: làm xám, viền sáng). */
  toCanvas() {
    const [c, g] = canvas(this.w, this.h);
    g.drawImage(this.img, this.sx, this.sy, this.w, this.h, 0, 0, this.w, this.h);
    return [c, g];
  }
}

function makeAtlas({ data, atlases }) {
  const cache = new Map();
  const frame = (name, anchor) => {
    const f = data.frames[name];
    if (!f) return null;
    const key = `${name}|${anchor ?? ''}`;
    if (!cache.has(key)) {
      const [a, x, y, w, h, ox, oy, sw, sh] = f;
      const [ax, ay] = anchor ?? [ox + w / 2, oy + h];
      cache.set(key, new Sprite(atlases[a], x, y, w, h, ox, oy, sw ?? w, sh ?? h, ax, ay));
    }
    return cache.get(key);
  };
  return { data, frame };
}

/** Toà nhà còn khoá khi gói chưa có bản "Sắp mở": bỏ bớt màu, tối nhẹ (giữ viền tối). */
function dimmed(sprite) {
  const [c, g] = sprite.toCanvas();
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    for (let k = 0; k < 3; k++) d[i + k] = Math.round((l * 0.75 + d[i + k] * 0.25) * 0.86 + 10);
  }
  g.putImageData(img, 0, 0);
  return new Sprite(c, 0, 0, sprite.w, sprite.h, sprite.ox, sprite.oy, sprite.sw, sprite.sh, sprite.ax, sprite.ay);
}

/** Viền sáng 1 px quanh hình (khi rê chuột / chọn bằng bàn phím). */
function halo(sprite) {
  const [src] = sprite.toCanvas();
  const [c, g] = canvas(sprite.w + 2, sprite.h + 2);
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) g.drawImage(src, dx, dy);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#fff3c4';
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
  return new Sprite(c, 0, 0, c.width, c.height, sprite.ox - 1, sprite.oy - 1, sprite.sw, sprite.sh, sprite.ax, sprite.ay);
}

/** Toà nhà thủ tục cũ (chưa có tranh 16-bit): cắt sát, phóng 2× cho cùng cỡ với nhà mới. */
function placeholderSprite(renderBuilding, place, seed) {
  const { art } = renderBuilding(place.kind, { locked: !place.unlocked, time: 'day', seed });
  const g0 = art.getContext('2d', { willReadFrequently: true });
  const d = g0.getImageData(0, 0, art.width, art.height).data;
  let x0 = art.width;
  let y0 = art.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < art.height; y++) {
    for (let x = 0; x < art.width; x++) {
      if (d[(y * art.width + x) * 4 + 3]) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) return null;
  const w = (x1 - x0 + 1) * 2;
  const h = (y1 - y0 + 1) * 2;
  const [c, g] = canvas(w, h);
  g.drawImage(art, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, w, h);
  return new Sprite(c, 0, 0, w, h, 0, 0, w, h, w / 2, h);
}

function shadow(g, cx, cy, rx, ry) {
  g.fillStyle = SHADOW;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + 0.5)) ** 2)));
    if (w > 0) g.fillRect(Math.round(cx - w + 2), Math.round(cy + y), w * 2, 1);
  }
}

// ---------------------------------------------------------------- địa hình (ô Wang theo đỉnh lưới)

function makeTerrain(A, cols, rows) {
  const V = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill('g'));
  const set = (x, y, t, only) => {
    if (y < 0 || y > rows || x < 0 || x > cols) return;
    if (!only || only.includes(V[y][x])) V[y][x] = t;
  };
  return { V, cols, rows, set };
}

function drawTerrain(A, ter, g) {
  const { terrain, terrainInfo } = A.data;
  const bySet = new Map();
  for (const [name, s] of Object.entries(terrain)) bySet.set([s.lower, s.upper].sort().join(''), s);
  const pure = (t) => terrain[terrainInfo.pure[t]] ?? terrain[terrainInfo.pure.g];
  const missing = [];
  for (let y = 0; y < ter.rows; y++) {
    for (let x = 0; x < ter.cols; x++) {
      const k = [ter.V[y][x], ter.V[y][x + 1], ter.V[y + 1][x], ter.V[y + 1][x + 1]];
      const kinds = [...new Set(k)].sort().join('');
      let s = kinds.length === 1 ? pure(kinds) : bySet.get(kinds);
      let key = k.join('');
      if (!s || !s.tiles[key]) {
        missing.push(`${x},${y}:${key}`);
        // ghép thiếu cặp: lấy ô thuần của địa hình chiếm nhiều góc nhất
        const top = [...k].sort((a, b) => k.filter((v) => v === b).length - k.filter((v) => v === a).length)[0];
        s = pure(top);
        key = top.repeat(4);
      }
      const spr = A.frame(s.frame);
      const [tx, ty] = s.tiles[key];
      g.drawImage(spr.img, spr.sx + tx - spr.ox, spr.sy + ty - spr.oy, T, T, x * T, y * T, T, T);
    }
  }
  if (missing.length) console.debug('Phố 16-bit: thiếu ô Wang', missing.length, missing.slice(0, 12).join(' '));
}

// ---------------------------------------------------------------- bố cục phố (lưới khu phố, xem town-plan.js)

const STANDERS = { shopkeeper: 'shop', clerk: 'bank', chef: 'kitchen', farmer: 'garden', student: 'school', postman: 'news', grandpa: 'park', child: 'arcade' };
// Đồ trước sân hợp với từng nơi (nếu gói đạo cụ có), còn lại chọn ngẫu nhiên theo hạt giống cố định.
const YARD = { home: 'hydrant', shop: 'flowerbed', jobs: 'notice-board', bank: 'flowerbed', market: 'crates-barrels', news: 'newsstand', townhall: 'planter', school: 'bikerack', clinic: 'potted-plant', garden: 'well', bazaar: 'market-umbrella', boba: 'food-cart', factory: 'crates-barrels-tall', forge: 'crate', matshop: 'crates-barrels', arcade: 'flowers' };

function pick(list, rand) {
  return list.length ? list[Math.floor(rand() * list.length)] : null;
}

/** Phần toà nhà nằm bên trái / phải điểm chân (px 1×), để town-plan.js dàn khe giữa các toà. */
function extent(sprite) {
  const l = sprite.ax - sprite.ox;
  return { l, r: sprite.w - l };
}

/**
 * Tính vị trí mọi thứ ở toạ độ 1×. Trả về { W, H, ter, buildings, statics, walkers, standers, fx, districts, mode }.
 * `art(place)` trả về { sprite, real } cho từng nơi; `mode`, `width` chọn cách xếp (town-plan.js).
 */
function layout(A, places, art, mode, width) {
  const rand = seeded(20261101);
  const byId = new Map(places.map((p) => [p.id, p]));
  const plan = planTown(mode, places.map((p) => p.id), { width, sizeOf: (id) => extent(art(byId.get(id)).sprite) });
  const { W, H, rows, vroads, cells, roadH } = plan;
  const narrow = plan.mode === 'narrow';
  const cols = Math.ceil(W / T);
  const ter = makeTerrain(A, cols, Math.ceil(H / T));
  // Mặt phố lát đá cuội nếu gói địa hình có đủ cặp nối (cỏ–cuội, đất–cuội); không thì đường đất như phố mẫu.
  const has = (a, b) => Object.values(A.data.terrain).some((t) => [t.lower, t.upper].sort().join('') === [a, b].sort().join(''));
  const ROAD = has('g', 'c') && has('p', 'c') ? 'c' : 'p';
  const vx = (px) => Math.round(px / T);
  for (const ry of rows) {
    for (let v = vx(ry.roadTop + 8); v <= vx(ry.roadBottom - 8); v++) for (let x = 0; x <= cols; x++) ter.set(x, v, ROAD);
  }
  for (const vr of vroads) {
    for (let v = vx(rows[0].top + 4); v <= vx(H); v++) for (let x = vx(vr.x0 + 8); x <= vx(vr.x1 - 8); x++) ter.set(x, v, ROAD);
  }

  const buildings = [];
  const statics = []; // { sprite, x, y, flip?, shadow?: [rx, ry] }
  const fx = [];
  const prop = (name) => A.data.props[name] && A.frame(A.data.props[name].frame, A.data.props[name].anchor);
  const props = (kind) => Object.entries(A.data.props).filter(([, p]) => p.kind === kind).map(([n]) => n);
  const put = (name, x, y, opts = {}) => {
    const sprite = typeof name === 'string' ? prop(name) : name;
    if (!sprite) return null;
    const s = { name, sprite, x: Math.round(x), y: Math.round(y), shadow: 'shadow' in opts ? opts.shadow : [Math.max(4, Math.round(sprite.w / 2.4)), 2], flip: opts.flip };
    statics.push(s);
    return s;
  };
  const fxDef = (name) => A.data.fx[name];
  const bushes = props('bush').filter((n) => !/hedge|tuft/.test(n));
  const trees = props('tree').filter((n) => !/palm|bamboo/.test(n));
  const lamps = props('lamp');
  const lamp = lamps.includes('lamp') ? 'lamp' : lamps[0];
  const yardProp = (id) => (A.data.props[YARD[id]] ? YARD[id] : null);
  const tree = (re) => trees.find((n) => re.test(n)) ?? trees[0];
  // Chân cửa theo toạ độ thế giới: điểm móc `door` của gói nhà, mặc định giữa đáy.
  const doorX = (b) => {
    const door = b.hooks?.door;
    if (!door) return b.x;
    const sp = b.art.sprite;
    return sp.rect(b.x, b.y).x - sp.ox + door[0];
  };

  /** Quảng trường đài phun nước: lát đá, viền cuội nối với các ngả đường, ghế, cờ, dây đèn lồng. */
  function plaza(x0, x1, ry) {
    const xa = vx(x0 + 4);
    const xb = vx(x1 - 4);
    const ya = vx(ry.top + 6);
    // nền cùng chất liệu với mặt phố (bộ Wang chỉ ghép 2 địa hình mỗi ô: tránh ngã ba cỏ–đất–cuội)
    for (let v = ya; v <= vx(ry.roadTop + 8); v++) for (let x = xa; x <= xb; x++) ter.set(x, v, ROAD);
    for (let v = ya + 1; v < vx(ry.roadTop + 8); v++) for (let x = xa + 1; x <= xb - 1; x++) ter.set(x, v, 's');
    const cx = Math.round((x0 + x1) / 2);
    const fy = Math.round((ry.top + ry.roadTop) / 2 + (narrow ? 22 : 26));
    if (fxDef('fountain')) fx.push({ kind: 'fountain', x: cx, y: fy, def: fxDef('fountain'), shadow: [19, 4] });
    for (const dx of [-60, 60]) {
      put('bench', cx + dx, fy - 6);
      if (!narrow) put('bench', cx + dx, fy + 30);
    }
    put('tree-cherry', xa * T + 16, ya * T + 42, { shadow: [16, 3] });
    put(tree(/^tree$/), xb * T - 16, ya * T + 42, { shadow: [16, 3] });
    for (const [x, name] of [[(xa + 2) * T, 'flag-red'], [(xb - 2) * T, 'flag-teal']]) {
      if (fxDef(name)) fx.push({ kind: 'loop', def: fxDef(name), x, y: (ya + 2) * T, z: (ya + 2) * T, shadow: [3, 1] });
    }
    const la = put(lamp, cx - 30, ry.roadTop - 2, { shadow: [5, 2] });
    const lb = put(lamp, cx + 30, ry.roadTop - 2, { shadow: [5, 2] });
    if (la && lb && fxDef('lantern')) fx.push({ kind: 'festoon', def: fxDef('lantern'), x0: la.x + 4, x1: lb.x - 4, y: la.y - la.sprite.h + 5, z: la.y + 1, n: 2 });
    if (fxDef('bird-hop')) fx.push({ kind: 'loop', def: fxDef('bird-hop'), x: cx + 34, y: fy + 10, z: fy + 10, flip: true });
  }

  for (const c of cells) {
    const ry = rows[c.row];
    const { B } = ry;
    if (c.kind === 'plaza') {
      plaza(c.x0, c.x1, ry);
    } else if (c.kind === 'plot') {
      // luống rau: đất xới, hàng rào, cây cam
      const { cx } = c;
      for (let v = vx(B - 60); v <= vx(B - 12); v++) for (let x = vx(cx - 40); x <= vx(cx + 40); x++) ter.set(x, v, 't', ['g']);
      put('fence', cx - 22, B + 2);
      put('fence', cx + 20, B + 2);
      put('flowers', cx - 30, B - 66);
      put('tree-orange', cx + 30, B - 60, { shadow: [14, 3] });
    } else if (c.kind === 'stalls') {
      const { cx } = c;
      for (let v = vx(B - 70); v <= vx(B); v++) for (let x = vx(cx - 46); x <= vx(cx + 46); x++) ter.set(x, v, ROAD);
      put('market-umbrella', cx - 22, B - 34);
      put('food-cart', cx + 24, B - 6);
      put('crates-barrels', cx - 28, B - 2);
      put('lantern-red', cx + 26, B - 50, { shadow: null });
    } else if (c.kind === 'pond') {
      // hồ chữ nhật bo góc; gợn nước, lấp lánh chỉ trên ô nước thuần
      const { cx } = c;
      const xa = vx(cx - 42);
      const xb = vx(cx + 42);
      const ya = vx(B - 78);
      const yb = vx(B - 10);
      for (let v = ya; v <= yb; v++) {
        for (let x = xa; x <= xb; x++) if (!((v === ya || v === yb) && (x === xa || x === xb))) ter.set(x, v, 'w', ['g']);
      }
      const spots = [];
      for (let v = ya + 1; v < yb - 1; v++) for (let x = xa + 1; x < xb - 1; x++) spots.push([x * T + T / 2, v * T + T / 2]);
      if (spots.length) {
        if (fxDef('pond-ripple')) fx.push({ kind: 'event', def: fxDef('pond-ripple'), spots });
        if (fxDef('pond-sparkle')) for (let q = 0; q < 2; q++) fx.push({ kind: 'event', def: fxDef('pond-sparkle'), spots });
        const [bx, by] = spots[Math.floor(spots.length / 2)];
        put('rowboat', bx, by + 8, { shadow: null });
      }
      put('log', cx + 34, B + 2);
      if (fxDef('bird-hop-sparrow')) fx.push({ kind: 'loop', def: fxDef('bird-hop-sparrow'), x: cx - 46, y: B, z: B });
    } else if (c.kind === 'empty') {
      put(pick(trees, rand), c.cx, B - 20, { shadow: [16, 3] });
      put(pick(bushes, rand), c.cx + 30, B);
    } else {
      const place = byId.get(c.id);
      const a = art(place);
      const b = { place, art: a, x: c.x, y: B, row: c.row, district: c.district, hooks: a.real ? A.data.buildings[c.id]?.hooks : null };
      buildings.push(b);
      // lối từ cửa xuống đường
      const door = Math.round(doorX(b) / T - 0.5);
      for (let v = vx(B - 8); v <= vx(ry.roadTop + 8); v++) {
        ter.set(door, v, ROAD);
        ter.set(door + 1, v, ROAD);
      }
      const rect = a.sprite.rect(b.x, B);
      // đồ trước sân cạnh cửa, đèn ở mép lô (khung hẹp chật nên bớt)
      if (!narrow || buildings.length % 2) put(yardProp(c.id) ?? pick(bushes, rand), Math.min(rect.x + rect.w - 6, (door + 1.5) * T + 18), B + 3);
      if (c.id === 'colosseum' && place.unlocked) {
        for (const dx of [-30, 30]) if (fxDef('flag-gold')) fx.push({ kind: 'loop', def: fxDef('flag-gold'), x: b.x + dx, y: B + 4, z: B + 4, shadow: [3, 1] });
      }
    }
  }
  // đèn đường ở chỗ giao đường dọc, cây ở hai mép mỗi dãy
  for (const vr of vroads) {
    for (const [r, ry] of rows.entries()) {
      if (!cells.some((c) => c.kind === 'plaza' && c.row === r && c.x0 < vr.x && c.x1 > vr.x)) put(lamp, vr.x0 + 4, ry.roadTop + 2, { shadow: [5, 2] });
    }
  }
  for (const ry of rows) {
    put(pick(trees, rand), 8, ry.B - 40, { shadow: [16, 3] });
    put(pick(trees, rand), W - 8, ry.B - 44, { shadow: [16, 3] });
  }

  // ---- ống khói, lò rèn, ánh kính: theo điểm móc của toà (toạ độ ảnh gốc)
  for (const b of buildings) {
    if (!b.hooks || !b.place.unlocked) continue;
    const r = b.art.sprite.rect(b.x, b.y);
    const ox = r.x - b.art.sprite.ox;
    const oy = r.y - b.art.sprite.oy;
    for (const [name, at] of Object.entries(b.hooks)) {
      if (name === 'door' || !Array.isArray(at)) continue;
      if (name === 'glint') {
        if (fxDef('window-glint')) fx.push({ kind: 'event', def: fxDef('window-glint'), spots: [[ox + at[0], oy + at[1]]], z: b.y + 0.5 });
        continue;
      }
      const def = fxDef({ smoke: 'chimney-smoke', 'smoke-lg': 'chimney-smoke-lg', fire: 'forge-fire', flames: 'forge-flames' }[name] ?? name);
      if (def) fx.push({ kind: 'loop', def, x: ox + at[0], y: oy + at[1], z: b.y + 0.5 });
    }
  }

  // ---- bướm quanh bồn hoa, cánh hoa / lá rơi dưới tán cây, chim bay ngang trời
  const beds = statics.filter((s) => /flower/.test(s.name ?? ''));
  for (const [k, color] of ['yellow', 'pink', 'blue'].entries()) {
    const bed = beds[Math.floor(((k + 0.5) / 3) * beds.length)];
    if (bed && fxDef(`butterfly-${color}`)) fx.push({ kind: 'flutter', def: fxDef(`butterfly-${color}`), x: bed.x, y: bed.y - 18, z: bed.y + 2, ph: k * 2.1 });
  }
  for (const s of statics.filter((st) => trees.includes(st.name))) {
    const def = fxDef(/cherry/.test(s.name) ? 'petal-pink' : rand() < 0.5 ? 'leaf-green' : 'leaf-autumn');
    if (def && rand() < 0.5) fx.push({ kind: 'drift', def, x: s.x, y: s.y - s.sprite.h + 14, fall: s.sprite.h - 10, z: s.y + 2, ph: rand() * 5000 });
  }
  for (const name of ['bird-fly-side', 'bird-fly-side-sparrow']) {
    if (fxDef(name)) fx.push({ kind: 'flyer', def: fxDef(name), W, yMax: Math.max(16, rows[0].top), z: 1e6, next: 2000 + rand() * 9000 });
  }

  // ---- người đi đường: chia đều cho các đường ngang (hai làn ngược chiều); cứ 4 người thì 1 người đi đường
  // dọc (nếu có khung đi lên / xuống). Ai chưa có khung đi bộ thì đứng cạnh cửa toà của mình.
  const walkers = [];
  const movers = Object.entries(A.data.npcs).filter(([, n]) => n.walk.east || n.walk.west);
  for (const [k, [id, npc]] of movers.entries()) {
    const speed = /jog/.test(id) ? 30 : 14 + rand() * 6;
    const common = { id, npc, speed, phase: rand() * 1000, pause: 0, rest: 3 + rand() * 9 };
    if (vroads.length && k % 4 === 3 && npc.walk.north && npc.walk.south) {
      const vr = vroads[Math.floor(k / 4) % vroads.length];
      const dir = k % 8 === 3 ? 1 : -1;
      walkers.push({ ...common, axis: 'v', x: Math.round(vr.x + (dir > 0 ? -7 : 7)), y: vr.y0 + rand() * (vr.y1 - vr.y0), y0: vr.y0, y1: vr.y1, dir });
      continue;
    }
    const ry = rows[k % rows.length];
    const dir = k % 2 ? -1 : 1;
    walkers.push({ ...common, axis: 'h', y: dir > 0 ? ry.roadTop + 11 : ry.roadTop + roadH - 4, x: Math.round(rand() * W), dir });
  }
  const standers = [];
  for (const [id, npc] of Object.entries(A.data.npcs)) {
    if (npc.walk.east || npc.walk.west || !STANDERS[id]) continue;
    const b = buildings.find((bb) => bb.place.id === STANDERS[id]);
    if (b) standers.push({ id, npc, x: b.x - 30, y: b.y + 6 });
  }
  return { W, H, ter, buildings, statics, walkers, standers, fx, districts: plan.districts, mode: plan.mode };
}

// ---------------------------------------------------------------- gắn vào trang

/**
 * Gắn phố vào `container` (thay danh sách nút dự phòng khi ảnh đã sẵn sàng).
 * `places`: [{ id, name, icon, row, slot, kind, unlocked, lockText, badge? }], `onSelect(id)` khi bấm nơi đã mở.
 * Trả về ngay { ready, update(places), destroy() }; `ready` xong khi phố (hoặc bản đồ cũ thay thế) đã vẽ.
 */
export function mountTown(container, { places = [], onSelect } = {}) {
  let inner = null;
  let dead = false;
  const fallback = async (err) => {
    if (dead) return;
    console.warn('Phố 16-bit chưa nạp được ảnh, dùng bản đồ vẽ tay cũ.', err);
    const { mountTownMap } = await import('./townmap.js');
    if (dead) return;
    container.replaceChildren();
    inner = mountTownMap(container, { places, onSelect });
  };
  const ready = loadAssets()
    .then(async (assets) => {
      const A = makeAtlas(assets);
      // Nơi chưa có tranh: mượn toà nhà thủ tục của bản đồ cũ (nạp lười, chỉ khi cần).
      const needOld = places.some((p) => !A.data.buildings[p.id]);
      const old = needOld ? await import('./townmap.js') : null;
      if (dead) return;
      const street = buildStreet(container, A, places, onSelect, old?.renderBuilding);
      inner = street;
    })
    .catch(fallback)
    .catch((err) => console.warn('Không nạp được bản đồ pixel, dùng danh sách nút.', err));
  return {
    ready,
    update: (next) => inner?.update(next),
    destroy() {
      dead = true;
      inner?.destroy();
    },
  };
}

function buildStreet(container, A, initialPlaces, onSelect, renderBuilding) {
  const root = document.createElement('div');
  root.className = 't16';
  root.innerHTML = `
    <nav class="t16-jump" aria-label="Đi tới khu"></nav>
    <div class="t16-scroll">
      <div class="t16-world">
        <canvas class="t16-canvas" aria-hidden="true"></canvas>
        <div class="t16-signs" aria-hidden="true"></div>
        <div class="t16-ui" role="group" aria-label="Các toà nhà trên phố"></div>
      </div>
    </div>
    <button type="button" class="t16-zoom" aria-pressed="false"></button>`;
  const scroller = root.querySelector('.t16-scroll');
  const world = root.querySelector('.t16-world');
  const cv = root.querySelector('.t16-canvas');
  const ui = root.querySelector('.t16-ui');
  const signs = root.querySelector('.t16-signs');
  const jump = root.querySelector('.t16-jump');
  const zoomBtn = root.querySelector('.t16-zoom');
  const g = cv.getContext('2d');

  const phoneMq = matchMedia(PHONE);
  const motionMq = matchMedia(REDUCED);
  let places = initialPlaces;
  let L = null; // bố cục hiện tại
  let ground = null; // canvas địa hình + bóng tĩnh
  let scale = 1;
  let zoomed = false; // nút "Phóng to": 2× (máy tính), khung tự cuộn hai chiều
  let hot = null;
  let running = false;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let onScreen = true;
  const tips = new Map();
  const artCache = new Map();
  const haloCache = new Map();

  function artFor(place) {
    const key = `${place.id}|${place.unlocked ? 1 : 0}`;
    if (artCache.has(key)) return artCache.get(key);
    const def = A.data.buildings[place.id];
    let out = null;
    if (def) {
      const sprite = A.frame(def.frame, def.anchor);
      let shown = sprite;
      if (!place.unlocked) shown = def.locked ? A.frame(def.locked, def.locked_anchor) : dimmed(sprite);
      out = { sprite: shown, real: true };
    } else if (renderBuilding) {
      const seed = 11 + place.row * 31 + place.slot * 7;
      const sprite = placeholderSprite(renderBuilding, place, seed);
      if (sprite) out = { sprite, real: false };
    }
    if (!out) {
      // không có cả nhà thủ tục: một lô đất trống có biển gỗ
      const sign = A.frame(A.data.props.sign.frame, A.data.props.sign.anchor);
      out = { sprite: sign, real: false, lot: true };
    }
    artCache.set(key, out);
    return out;
  }

  /** Lề hai bên khối phố: máy tính 16 px tới mép cửa sổ, điện thoại 4 px (phố được tràn ra ngoài cột nội dung). */
  const gutter = () => (phoneMq.matches ? 4 : 16);
  /** Bề ngang dành cho phố, theo px của chính khối phố (khối đã bù zoom của game). */
  function avail() {
    const z = root.currentCSSZoom || 1;
    return (document.documentElement.clientWidth - 2 * gutter()) / z;
  }
  function modeNow() {
    const a = avail();
    const mode = phoneMq.matches ? 'narrow' : townMode(a);
    return { mode, width: mode === 'narrow' ? Math.floor(a) - 4 : undefined };
  }
  const keyOf = (m) => `${m.mode}|${m.width ?? ''}`;
  let shape = null;

  function build() {
    shape = modeNow();
    L = layout(A, places, artFor, shape.mode, shape.width);
    root.dataset.mode = L.mode;
    if (L.mode === 'narrow') zoomed = false;
    cv.width = L.W;
    cv.height = L.H;
    const [c, gg] = canvas(L.W, L.H);
    drawTerrain(A, L.ter, gg);
    for (const s of L.statics) if (s.shadow) shadow(gg, s.x, s.y - 2, s.shadow[0], s.shadow[1]);
    for (const b of L.buildings) shadow(gg, b.x, b.y - 2, Math.round(b.art.sprite.w / 2), 4);
    for (const f of L.fx) if (f.shadow) shadow(gg, f.x, f.y - 3, f.shadow[0], f.shadow[1]);
    ground = c;
    const t0 = performance.now();
    for (const f of L.fx) {
      f.t0 = t0 - Math.random() * 2000;
      f.spot = f.spots ? f.spots[Math.floor(Math.random() * f.spots.length)] : null;
    }
    buildUi();
    applyScale();
    draw(t0);
  }

  // ---- lớp HTML: nút, chip tên, huy hiệu, ổ khoá; bảng tên khu; thanh nhảy tới khu (điện thoại)
  function buildUi() {
    ui.replaceChildren();
    for (const b of L.buildings) {
      const { place } = b;
      const r = b.art.sprite.rect(b.x, b.y);
      b.rect = r;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 't16-place';
      btn.dataset.place = place.id;
      const locked = !place.unlocked;
      btn.classList.toggle('locked', locked);
      btn.setAttribute('aria-label', locked
        ? `${place.name} (đang khoá${place.lockText ? `: ${place.lockText}` : ''})`
        : `${place.name}${place.badge ? ` – ${place.badge}` : ''}`);
      if (locked) btn.setAttribute('aria-disabled', 'true');
      btn.innerHTML = `
        <span class="t16-chip" aria-hidden="true">
          <span class="t16-name"></span>
          ${place.badge && !locked ? '<span class="t16-badge"></span>' : ''}
        </span>
        ${locked ? '<span class="t16-lock" aria-hidden="true"></span>' : ''}`;
      btn.querySelector('.t16-name').textContent = locked ? `🔒 ${place.name}` : place.name;
      if (place.badge && !locked) btn.querySelector('.t16-badge').textContent = place.badge;
      if (locked) btn.querySelector('.t16-lock').textContent = place.lockText || 'Sắp mở';
      btn.addEventListener('pointerenter', () => setHot(place.id));
      btn.addEventListener('pointerleave', () => setHot(null));
      btn.addEventListener('focus', () => btn.matches(':focus-visible') && setHot(place.id));
      btn.addEventListener('blur', () => setHot(null));
      b.btn = btn;
      ui.append(btn);
    }
    // Bảng tên khu: chữ HTML trên nền gỗ màu theo khu (không có chữ trong ảnh); chỉ để đọc, không bấm.
    signs.replaceChildren();
    for (const d of L.districts) {
      const el = document.createElement('span');
      el.className = `t16-district tone-${d.tone}${d.center ? ' center' : ''}`;
      el.dataset.district = d.id;
      el.innerHTML = '<i></i> <b></b>';
      el.firstElementChild.textContent = d.icon;
      el.lastElementChild.textContent = d.name;
      d.el = el;
      signs.append(el);
    }
    jump.replaceChildren(...(L.mode === 'narrow' ? L.districts : []).map((d) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tone-${d.tone}`;
      btn.innerHTML = '<i aria-hidden="true"></i> <span></span>';
      btn.firstElementChild.textContent = d.icon;
      btn.lastElementChild.textContent = d.short;
      btn.setAttribute('aria-label', `Khu ${d.name}`);
      btn.addEventListener('click', () => d.el.scrollIntoView({ block: 'start', behavior: motionMq.matches ? 'auto' : 'smooth' }));
      return btn;
    }));
    jump.hidden = L.mode !== 'narrow';
    zoomBtn.hidden = L.mode === 'narrow';
  }

  /** Phóng to: khung cao tới gần đáy cửa sổ (tính từ chỗ khung đang đứng), ít nhất 320 px. */
  function zoomHeight() {
    const z = root.currentCSSZoom || 1;
    const top = Math.max(0, scroller.getBoundingClientRect().top);
    return `${Math.round(Math.max(320, (window.innerHeight - top - 20) / z))}px`;
  }

  function applyScale() {
    scale = zoomed ? 2 : 1;
    root.style.setProperty('--s', scale);
    root.classList.toggle('t16-zoomed', zoomed);
    zoomBtn.setAttribute('aria-pressed', String(zoomed));
    zoomBtn.textContent = zoomed ? '🗺️ Cả phố' : '➕ Phóng to';
    zoomBtn.title = zoomed ? 'Xem cả phố trong một khung' : 'Phóng to gấp đôi để ngắm chi tiết';
    world.style.width = `${L.W * scale}px`;
    world.style.height = `${L.H * scale}px`;
    // phóng to: khung cao vừa màn hình, tự cuộn hai chiều (trang không bao giờ cuộn ngang)
    scroller.style.maxHeight = zoomed ? zoomHeight() : '';
    for (const b of L.buildings) {
      const r = b.rect;
      Object.assign(b.btn.style, {
        left: `${r.x * scale}px`,
        top: `${r.y * scale}px`,
        width: `${r.w * scale}px`,
        height: `${r.h * scale}px`,
      });
      b.btn.style.setProperty('--drop', `${Math.max(0, b.y - CHIP_H - r.y) * scale}px`);
    }
    for (const d of L.districts) Object.assign(d.el.style, { left: `${d.x * scale}px`, top: `${d.y * scale}px` });
    requestAnimationFrame(fitChips);
  }

  /** Đẩy chip ở hai mép phố vào trong cho khỏi bị cắt. */
  function fitChips() {
    if (!L) return;
    const max = L.W * scale;
    for (const b of L.buildings) {
      const chip = b.btn.firstElementChild;
      const half = chip.offsetWidth / 2;
      const cx = (b.rect.x + b.rect.w / 2) * scale;
      const dx = Math.max(0, 4 - (cx - half)) + Math.min(0, max - 4 - (cx + half));
      chip.style.setProperty('--dx', `${Math.round(dx)}px`);
    }
  }

  function setHot(id) {
    if (hot === id) return;
    hot = id;
    if (!running) draw(performance.now());
  }

  // ---- vẽ một khung hình
  /** Khung đang chiếu của một hoạt cảnh; `ms` là một số hoặc danh sách thời lượng từng khung. */
  function frameAt(def, t, t0 = 0) {
    const n = def.frames.length;
    const ms = Array.isArray(def.ms) ? def.ms : null;
    if (ms) {
      const cycle = ms.reduce((a, b) => a + b, 0);
      let r = (((t - t0) % cycle) + cycle) % cycle;
      for (let i = 0; i < n; i++) {
        r -= ms[i] ?? ms[0];
        if (r < 0) return def.frames[i];
      }
      return def.frames[n - 1];
    }
    const step = Math.floor((t - t0) / def.ms);
    if (def.playback === 'pingpong' && n > 2) {
      const cyc = 2 * n - 2;
      const i = ((step % cyc) + cyc) % cyc;
      return def.frames[i < n ? i : cyc - i];
    }
    return def.frames[((step % n) + n) % n];
  }

  const msOf = (def) => (Array.isArray(def.ms) ? def.ms.reduce((a, b) => a + b, 0) / def.ms.length : def.ms);

  function npcSprite(npc, mode, dir, t, phase) {
    if (mode === 'walk') {
      // đi ngang thiếu một phía thì lật phía kia; đi dọc dùng đúng khung bắc / nam
      const side = dir === 'east' || dir === 'west';
      const flip = side && !npc.walk[dir];
      const seq = npc.walk[dir] ?? (side ? npc.walk[dir === 'east' ? 'west' : 'east'] : npc.walk.south) ?? npc.walk.east ?? npc.walk.west;
      const i = Math.floor((t + phase) / 115) % seq.frames.length;
      return [A.frame(seq.frames[i], seq.anchor), flip];
    }
    const anim = npc.idleAnim?.[dir];
    if (anim && !motionMq.matches) {
      const i = Math.floor((t + phase) / 220) % anim.frames.length;
      return [A.frame(anim.frames[i], anim.anchor), false];
    }
    const idle = npc.idle[dir] ?? npc.idle.south ?? Object.values(npc.idle)[0];
    if (idle) return [A.frame(idle.frame, idle.anchor), false];
    const seq = npc.walk.east ?? npc.walk.west;
    return [A.frame(seq.frames[0], seq.anchor), !npc.walk.east];
  }

  function draw(t) {
    if (!L) return;
    const still = motionMq.matches;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, L.W, L.H);
    g.drawImage(ground, 0, 0);
    const list = [];
    for (const s of L.statics) list.push({ y: s.y, draw: () => s.sprite.draw(g, s.x, s.y, s.flip) });
    for (const b of L.buildings) {
      list.push({
        y: b.y,
        draw: () => {
          const lift = hot === b.place.id ? 1 : 0;
          if (lift) {
            const key = `${b.place.id}|${b.place.unlocked ? 1 : 0}`;
            if (!haloCache.has(key)) haloCache.set(key, halo(b.art.sprite));
            haloCache.get(key).draw(g, b.x, b.y - lift);
          }
          b.art.sprite.draw(g, b.x, b.y - lift);
        },
      });
    }
    for (const f of L.fx) {
      const sprite = (name) => A.frame(name, f.def.anchor);
      if (f.kind === 'fountain' || f.kind === 'loop') {
        // vòng lặp tại chỗ; giảm chuyển động thì đứng ở khung đầu (khói, lửa thì ẩn hẳn)
        if (still && f.def.frames.length && /smoke|fire|flame/.test(f.def.frames[0])) continue;
        const name = still ? f.def.frames[0] : frameAt(f.def, t, f.t0);
        const y = f.z ?? f.y;
        list.push({ y, draw: () => sprite(name).draw(g, f.x, f.y, f.flip) });
      } else if (f.kind === 'festoon') {
        // dây đèn lồng võng giữa hai cột đèn
        const n = f.n;
        const pts = Array.from({ length: n }, (_, k) => {
          const u = (k + 1) / (n + 1);
          return [Math.round(f.x0 + (f.x1 - f.x0) * u), Math.round(f.y + Math.sin(Math.PI * u) * 7)];
        });
        list.push({
          y: f.z,
          draw: () => {
            g.fillStyle = '#3d2a1f';
            for (let x = f.x0; x <= f.x1; x++) {
              const u = (x - f.x0) / (f.x1 - f.x0);
              g.fillRect(x, Math.round(f.y + Math.sin(Math.PI * u) * 7), 1, 1);
            }
            for (const [k, [x, y]] of pts.entries()) sprite(still ? f.def.frames[0] : frameAt(f.def, t, k * 400)).draw(g, x, y);
          },
        });
      } else if (still) {
        continue;
      } else if (f.kind === 'event') {
        // chạy một lượt, nghỉ một quãng ngẫu nhiên (gap_ms), rồi hiện lại ở chỗ khác
        const n = f.def.frames.length;
        const cycle = n * msOf(f.def);
        const [a, bb] = f.def.gap ?? [800, 2000];
        f.next ??= f.t0 + cycle + a + Math.random() * (bb - a);
        let age = t - f.t0;
        if (age < 0 || age >= cycle) {
          if (t < f.next) continue;
          f.t0 = t;
          f.next = t + cycle + a + Math.random() * (bb - a);
          f.spot = f.spots[Math.floor(Math.random() * f.spots.length)];
          age = 0;
        }
        const name = f.def.frames[Math.min(n - 1, Math.floor(age / msOf(f.def)))];
        const [x, y] = f.spot;
        list.push({ y: f.z ?? -1, draw: () => sprite(name).draw(g, x, y) });
      } else if (f.kind === 'flutter') {
        // bướm lượn quanh bồn hoa
        const s = t / 1000 + f.ph;
        const x = Math.round(f.x + Math.sin(s * 0.9) * 16 + Math.sin(s * 2.3) * 4);
        const y = Math.round(f.y + Math.cos(s * 1.3) * 6 - Math.abs(Math.sin(s * 3.1)) * 3);
        list.push({ y: f.z, draw: () => sprite(frameAt(f.def, t, f.ph * 1000)).draw(g, x, y) });
      } else if (f.kind === 'drift') {
        // cánh hoa / lá rơi chéo theo gió dưới tán cây, mỗi lượt ~4 giây, nghỉ một lúc
        const life = 4200;
        const u = ((t + f.ph) % (life * 1.6)) / life;
        if (u >= 1) continue;
        const x = Math.round(f.x - 10 + u * 26 + Math.sin(u * 9) * 4);
        const y = Math.round(f.y + u * f.fall);
        list.push({ y: f.z, draw: () => sprite(frameAt(f.def, t)).draw(g, x, y) });
      } else if (f.kind === 'flyer') {
        // chim bay ngang trời thỉnh thoảng
        if (!f.go || t > f.go.end) {
          if (!f.go) f.go = { end: (f.t0 ?? t) + f.next };
          if (t < f.go.end) continue;
          const dir = Math.random() < 0.5 ? 1 : -1;
          const speed = 46 + Math.random() * 18;
          f.go = { start: t, dir, speed, y: 8 + Math.random() * Math.max(8, f.yMax - 8), end: t + ((f.W + 40) / speed) * 1000 + 6000 + Math.random() * 9000 };
        }
        const run = (t - f.go.start) / 1000;
        const x = f.go.dir > 0 ? -20 + run * f.go.speed : f.W + 20 - run * f.go.speed;
        if (x < -24 || x > f.W + 24) continue;
        const y = Math.round(f.go.y + Math.sin(run * 2.2) * 3);
        list.push({ y: f.z, draw: () => sprite(frameAt(f.def, t)).draw(g, Math.round(x), y, f.go.dir < 0) });
      }
    }
    for (const s of L.standers) {
      const [spr] = npcSprite(s.npc, 'idle', 'south', still ? 0 : t, s.x * 7);
      list.push({ y: s.y, draw: () => { shadow(g, s.x - 1, s.y - 1, 7, 2); spr.draw(g, s.x, s.y); } });
    }
    for (const w of L.walkers) {
      const y = Math.round(w.y);
      const vertical = w.axis === 'v';
      const dir = vertical ? (w.dir > 0 ? 'south' : 'north') : w.dir > 0 ? 'east' : 'west';
      const mode = still || w.pause > 0 ? 'idle' : 'walk';
      // dừng chân: người đi đường ngang ngắm dãy nhà phía trên (làn trên) hoặc phía dưới (làn dưới)
      const face = mode === 'idle' && !still ? (vertical ? 'south' : w.dir > 0 ? 'north' : 'south') : dir;
      const [spr, flip] = npcSprite(w.npc, mode, still ? 'south' : face, t, w.phase);
      const x = Math.round(w.x);
      list.push({ y, draw: () => { shadow(g, x - 1, y - 1, 7, 2); spr.draw(g, x, y, flip); } });
    }
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.draw();
  }

  function step(dt) {
    for (const w of L.walkers) {
      if (w.pause > 0) {
        w.pause -= dt;
        continue;
      }
      w.rest -= dt;
      if (w.rest <= 0) {
        // thỉnh thoảng dừng lại ngắm phố một lúc
        w.pause = 1.5 + Math.random() * 2.5;
        w.rest = 6 + Math.random() * 10;
      }
      if (w.axis === 'v') {
        // đường dọc: quay đầu ở hai đầu đường
        w.y += w.dir * w.speed * dt;
        if (w.y > w.y1) { w.y = w.y1; w.dir = -1; }
        if (w.y < w.y0) { w.y = w.y0; w.dir = 1; }
        continue;
      }
      // đường ngang: ra khỏi mép thì vào lại từ mép bên kia
      w.x += w.dir * w.speed * dt;
      if (w.dir > 0 && w.x > L.W + 24) w.x = -24;
      if (w.dir < 0 && w.x < -24) w.x = L.W + 24;
    }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - last < 1000 / FPS) return;
    const dt = Math.min(0.25, (now - (last || now)) / 1000);
    last = now;
    clock = now;
    step(dt);
    draw(now);
  }

  function sync() {
    const want = onScreen && !document.hidden && !motionMq.matches && root.isConnected;
    if (want && !running) {
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    } else if (!want && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
    if (!running) draw(clock || performance.now());
  }

  // ---- nút "Phóng to": 2× quanh tâm khung đang xem, bấm lại về cả phố 1×
  function toggleZoom() {
    if (!L || L.mode === 'narrow') return;
    const k = zoomed ? 0.5 : 2;
    const cx = (scroller.scrollLeft + scroller.clientWidth / 2) * k;
    const cy = (scroller.scrollTop + scroller.clientHeight / 2) * k;
    zoomed = !zoomed;
    applyScale();
    fit();
    scroller.scrollLeft = Math.max(0, cx - scroller.clientWidth / 2);
    scroller.scrollTop = Math.max(0, cy - scroller.clientHeight / 2);
  }
  zoomBtn.addEventListener('click', toggleZoom);

  // ---- bấm vào toà nhà
  function onClick(ev) {
    const btn = ev.target.closest('.t16-place');
    if (!btn) return;
    ev.stopPropagation(); // map.js nghe [data-place] cho danh sách dự phòng; ở đây tự xử lý
    const place = places.find((p) => p.id === btn.dataset.place);
    if (!place) return;
    if (place.unlocked) {
      onSelect?.(place.id);
      return;
    }
    clearTimeout(tips.get(btn));
    btn.classList.remove('shake');
    void btn.offsetWidth; // chạy lại hoạt ảnh lắc
    btn.classList.add('shake', 'tip');
    tips.set(btn, setTimeout(() => btn.classList.remove('shake', 'tip'), 2000));
  }
  ui.addEventListener('click', onClick);

  const io = new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting);
    sync();
  });
  io.observe(scroller);
  const onVisibility = () => sync();
  document.addEventListener('visibilitychange', onVisibility);

  /**
   * Khung phố vừa khít thế giới: cột nội dung rộng hơn thì canh giữa; hẹp hơn thì tràn ra hai bên
   * (cách mép cửa sổ `gutter()` px), không bao giờ rộng hơn cửa sổ.
   */
  function fit() {
    Object.assign(root.style, { marginLeft: '', marginRight: '', width: '', maxWidth: '' });
    if (!L) return;
    const z = root.currentCSSZoom || 1; // đổi px màn hình ra px của chính khối (khối đã bù zoom game)
    // thanh nhảy khu dính ngay dưới thanh trên (sticky) của game; bảng tên khu cuộn tới dưới cả hai
    const bar = document.querySelector('.topbar');
    const stick = bar && getComputedStyle(bar).position === 'sticky' ? bar.getBoundingClientRect().height : 0;
    root.style.setProperty('--t16-stick', `${Math.round(stick / z)}px`);
    root.style.setProperty('--t16-jump-h', `${jump.offsetHeight}px`);
    const need = L.W * scale + 4; // thế giới + viền khung
    const r = root.getBoundingClientRect();
    const have = r.width / z;
    if (have >= need) {
      Object.assign(root.style, { maxWidth: `${need}px`, marginLeft: 'auto', marginRight: 'auto' });
      return;
    }
    const vw = document.documentElement.clientWidth;
    const roomL = Math.max(0, r.left - gutter());
    const roomR = Math.max(0, vw - gutter() - r.right);
    const extra = Math.min(roomL + roomR, (need - have) * z);
    if (extra < 1) return;
    const left = Math.min(roomL, Math.max(extra / 2, extra - roomR)); // chia đều, bên nào hẹp thì bên kia bù
    root.style.marginLeft = `${-left / z}px`;
    root.style.width = `${(r.width + extra) / z}px`;
  }

  /** Đổi cỡ cửa sổ: qua ngưỡng bố cục thì dựng lại phố, không thì chỉ canh lại khung. */
  function onResize() {
    if (!L) return;
    if (keyOf(modeNow()) !== keyOf(shape)) build();
    if (zoomed) scroller.style.maxHeight = zoomHeight();
    fit();
  }
  const onMedia = () => {
    onResize();
    sync();
  };
  phoneMq.addEventListener('change', onMedia);
  motionMq.addEventListener('change', onMedia);
  window.addEventListener('resize', onResize);
  // cột nội dung đổi bề ngang mà cửa sổ không đổi (thanh cuộn dọc hiện ra, thanh bên...)
  const ro = new ResizeObserver(() => onResize());
  ro.observe(container);

  container.replaceChildren(root);
  build();
  fit();
  document.fonts?.ready.then(() => root.isConnected && fitChips());
  sync();

  return {
    update(next = []) {
      places = Array.isArray(next) ? next : [];
      build();
      fit();
      sync();
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      phoneMq.removeEventListener('change', onMedia);
      motionMq.removeEventListener('change', onMedia);
      ui.removeEventListener('click', onClick);
      zoomBtn.removeEventListener('click', toggleZoom);
      for (const id of tips.values()) clearTimeout(id);
      root.remove();
      L = null;
    },
  };
}
