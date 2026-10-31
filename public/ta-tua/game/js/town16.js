// Phố Trân Châu 16-bit: một con phố ngang nhìn từ trên xuống (góc 3/4), dãy nhà hàng 0 phía trên đường,
// hàng 1 phía dưới, theo đúng thứ tự `slot` của PLACES. Thế giới vẽ ở 1× trên một canvas rồi phóng nguyên
// lần bằng CSS (3× máy tính, 2× điện thoại, image-rendering: pixelated). Nhãn, huy hiệu và nút bấm là HTML
// phủ lên đúng khung từng toà. Ảnh lấy từ assets/town/ (atlas WebP + town.json, dựng bằng
// scripts/art/build-town.py); nơi nào chưa có tranh thì vẽ tạm toà nhà thủ tục cũ. Nạp ảnh lỗi thì
// dùng lại cả bản đồ thủ tục cũ (townmap.js).

const ASSETS = new URL('../assets/town/', import.meta.url);
const T = 16;
const FPS = 12;
const SHADOW = 'rgba(46, 29, 20, 0.28)';
const PHONE = '(max-width: 767px)';
const REDUCED = '(prefers-reduced-motion: reduce)';
const TOP = 14; // chừa trên nóc dãy trên cho chip tên
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
  if (missing.length) console.debug('Phố 16-bit: thiếu ô Wang', missing.slice(0, 12));
}

// ---------------------------------------------------------------- bố cục phố

const STANDERS = { shopkeeper: 'shop', clerk: 'bank', chef: 'kitchen', farmer: 'garden', student: 'school', postman: 'news', grandpa: 'park', child: 'arcade' };

function pick(list, rand) {
  return list.length ? list[Math.floor(rand() * list.length)] : null;
}

/**
 * Tính vị trí mọi thứ ở toạ độ 1×. Trả về { W, H, ter, buildings, statics, walkers, standers, fx, lanes }.
 * `art(place)` trả về { sprite, locked?: Sprite } cho từng nơi.
 */
function layout(A, places, art) {
  const rand = seeded(20261031);
  const rows = [0, 1].map((r) => places.filter((p) => p.row === r).sort((a, b) => a.slot - b.slot));
  // Quảng trường đài phun nước sau Siêu thị (như phố mẫu), hồ nước cạnh Công viên.
  const withFeature = (list, afterId, feature, width) => {
    const items = list.map((place) => ({ place, art: art(place) }));
    const at = Math.max(0, items.findIndex((it) => it.place.id === afterId) + 1) || Math.min(2, items.length);
    items.splice(at, 0, { feature, width });
    return items;
  };
  const rowItems = [withFeature(rows[0], 'shop', 'plaza', 9 * T), withFeature(rows[1], 'park', 'pond', 8 * T)];
  const width = (it) => it.width ?? Math.max(7 * T, Math.ceil((it.art.sprite.w + 14) / 2) * 2);
  const MARGIN = 3 * T;
  const rowW = rowItems.map((items) => items.reduce((s, it) => s + width(it), 0));
  const W = Math.ceil((Math.max(...rowW) + MARGIN * 2) / T) * T;
  for (const [r, items] of rowItems.entries()) {
    // dàn đều phần dư cho hai dãy cùng dài
    const extra = (W - MARGIN * 2 - rowW[r]) / items.length;
    let x = MARGIN;
    for (const it of items) {
      it.x0 = Math.round(x);
      it.w = Math.round(width(it) + extra);
      it.cx = it.x0 + Math.round(it.w / 2);
      x += width(it) + extra;
    }
  }
  // Chiều dọc gọn nhất có thể (điện thoại 2× vẫn thấy gần trọn cả hai dãy):
  // chip → dãy trên → sân 1 ô → đường 3 ô → mái dãy dưới chạm mép đường → dãy dưới → mép cửa.
  const hOf = (items) => Math.max(96, ...items.filter((it) => it.art).map((it) => it.art.sprite.h));
  // Toà cao hơn CHIP_H (Tòa thị chính) không đẩy cả phố xuống: chip của nó đè lên đỉnh mái.
  const B0 = Math.max(TOP + Math.min(hOf(rowItems[0]), CHIP_H), hOf(rowItems[0]) + 2);
  const roadV = Math.ceil((B0 + 10) / T); // hàng đỉnh lưới đầu tiên của mặt đường
  const roadTop = (roadV - 0.5) * T;
  const roadBottom = (roadV + 2.5) * T;
  const B1 = roadBottom - 8 + hOf(rowItems[1]);
  const H = B1 + 8;
  const cols = W / T;
  const ter = makeTerrain(A, cols, Math.ceil(H / T));
  const lastV = ter.rows;
  for (let y = roadV; y <= roadV + 2; y++) for (let x = 0; x <= cols; x++) ter.set(x, y, 'p');

  const buildings = [];
  const statics = []; // { sprite, x, y, flip?, shadow?: [rx, ry] }
  const fx = [];
  const prop = (name) => A.data.props[name] && A.frame(A.data.props[name].frame, A.data.props[name].anchor);
  const props = (kind) => Object.entries(A.data.props).filter(([, p]) => p.kind === kind).map(([n]) => n);
  const put = (name, x, y, opts = {}) => {
    const sprite = typeof name === 'string' ? prop(name) : name;
    if (!sprite) return null;
    const s = { name, sprite, x: Math.round(x), y: Math.round(y), shadow: opts.shadow ?? [Math.max(4, Math.round(sprite.w / 2.4)), 2], flip: opts.flip };
    statics.push(s);
    return s;
  };
  const fxDef = (name) => A.data.fx[name];
  // Chân cửa theo toạ độ thế giới: điểm móc `door` của gói nhà, mặc định giữa đáy.
  const doorX = (it, baseY) => {
    const door = A.data.buildings[it.place.id]?.hooks?.door;
    if (!door || !it.art.real) return it.cx;
    const sp = it.art.sprite;
    return sp.rect(it.cx, baseY).x - sp.ox + door[0];
  };
  const yardKinds = props('yard').filter((n) => !/busstop|signpost|crates-barrels|bench/.test(n));
  const bushes = props('bush').filter((n) => !/hedge|tuft/.test(n));
  const trees = props('tree').filter((n) => !/palm|bamboo/.test(n));
  const lamps = props('lamp');
  const lamp = lamps.includes('lamp') ? 'lamp' : lamps[0];

  // ---- dãy trên (hàng 0): cửa nhìn ra đường
  for (const [i, it] of rowItems[0].entries()) {
    if (it.feature === 'plaza') {
      const x0 = Math.round(it.x0 / T) + 1;
      const x1 = Math.round((it.x0 + it.w) / T) - 1;
      const y0 = Math.max(1, roadV - 6);
      for (let y = y0; y < roadV; y++) for (let x = x0; x <= x1; x++) ter.set(x, y, 'p');
      for (let y = y0 + 1; y < roadV - 1; y++) for (let x = x0 + 1; x <= x1 - 1; x++) ter.set(x, y, 's');
      const fy = Math.round(((y0 + roadV - 1) / 2) * T + 24);
      if (fxDef('fountain')) fx.push({ kind: 'fountain', x: it.cx, y: fy, def: fxDef('fountain'), shadow: [19, 4] });
      put('bench', it.cx - 26, (y0 + 1) * T + 16);
      put('bench', it.cx + 26, (y0 + 1) * T + 16);
      put(trees[0], x0 * T - 12, y0 * T + 12, { shadow: [16, 3] });
      put(trees[1] ?? trees[0], x1 * T + 12, y0 * T + 16, { shadow: [16, 3] });
      // Cờ đuôi nheo hai góc sau, dây đèn lồng giăng giữa hai cột đèn phía trước.
      for (const [x, name] of [[(x0 + 1) * T + 2, 'flag-red'], [(x1 - 1) * T - 2, 'flag-teal']]) {
        if (fxDef(name)) fx.push({ kind: 'loop', def: fxDef(name), x, y: (y0 + 1) * T + 10, z: (y0 + 1) * T + 10, shadow: [3, 1] });
      }
      const la = put(lamp, x0 * T + 6, roadTop + 4, { shadow: [5, 2] });
      const lb = put(lamp, x1 * T - 6, roadTop + 4, { shadow: [5, 2] });
      if (la && lb && fxDef('lantern')) {
        const top = la.y - la.sprite.h + 5;
        fx.push({ kind: 'festoon', def: fxDef('lantern'), x0: la.x + 4, x1: lb.x - 4, y: top, z: la.y + 1, n: 2 });
      }
      if (fxDef('bird-hop')) fx.push({ kind: 'loop', def: fxDef('bird-hop'), x: it.cx + 34, y: fy + 6, z: fy + 6, flip: true });
      it.fountainY = fy;
      continue;
    }
    const b = { place: it.place, art: it.art, x: it.cx, y: B0, row: 0, hooks: it.art.real ? A.data.buildings[it.place.id]?.hooks : null };
    buildings.push(b);
    const door = Math.round(doorX(it, B0) / T - 0.5);
    for (let y = Math.floor(B0 / T) - 1; y < roadV; y++) { ter.set(door, y, 'p'); ter.set(door + 1, y, 'p'); }
    const left = (door - 0.5) * T;
    const right = (door + 1.5) * T;
    put('sign', left - 18, B0 + 10);
    put(i % 3 === 1 ? 'flowerbed' : pick(yardKinds, rand), right + 18, B0 + 9);
    if (i % 2 === 0) put(lamp, it.x0 + it.w, roadTop + 6, { shadow: [5, 2] });
    else put(pick(bushes, rand), it.x0 + it.w, B0 - 1);
  }

  // ---- dãy dưới (hàng 1): lưng tựa đường, cửa nhìn xuống lối nhỏ phía dưới
  for (const [i, it] of rowItems[1].entries()) {
    if (it.feature === 'pond') {
      // hồ chữ nhật bo góc, tràn qua mép dưới (lưới đỉnh thô nên giữ hình đơn giản cho bờ đẹp)
      const top = roadV + 4; // chừa ≥ 1 đỉnh cỏ giữa nước và đường đất
      const xa = Math.round(it.x0 / T) + 1;
      const xb = Math.round((it.x0 + it.w) / T) - 1;
      for (let y = top; y <= lastV; y++) {
        for (let x = xa; x <= xb; x++) {
          const corner = y === top && (x === xa || x === xb);
          if (!corner) ter.set(x, y, 'w', ['g']);
        }
      }
      const cxv = (xa + xb) / 2;
      const rx = (xb - xa) / 2;
      // gợn nước, lấp lánh: chỉ đặt trên ô nước thuần (đủ 4 góc là nước)
      const spots = [];
      for (let y = top; y < lastV; y++) {
        for (let x = Math.floor(cxv - rx); x < Math.ceil(cxv + rx); x++) {
          const v = ter.V;
          if (v[y][x] === 'w' && v[y][x + 1] === 'w' && v[y + 1]?.[x] === 'w' && v[y + 1]?.[x + 1] === 'w') {
            const sy = y * T + T / 2;
            if (sy < H - 6) spots.push([x * T + T / 2, sy]);
          }
        }
      }
      if (spots.length) {
        if (fxDef('pond-ripple')) fx.push({ kind: 'event', def: fxDef('pond-ripple'), spots });
        if (fxDef('pond-sparkle')) for (let k = 0; k < 3; k++) fx.push({ kind: 'event', def: fxDef('pond-sparkle'), spots });
      }
      put(pick(props('rock'), rand) ?? 'crate', it.x0 + 14, roadBottom + 18);
      put('log', it.x0 + it.w - 22, roadBottom + 20);
      put(trees.find((n) => /cherry/.test(n)) ?? trees[0], it.x0 + it.w - 6, H + 2, { shadow: [16, 3] });
      if (fxDef('bird-hop-sparrow')) fx.push({ kind: 'loop', def: fxDef('bird-hop-sparrow'), x: it.x0 + 34, y: roadBottom + 16, z: roadBottom + 16 });
      continue;
    }
    const hooks = it.art.real ? A.data.buildings[it.place.id]?.hooks : null;
    const b = { place: it.place, art: it.art, x: it.cx, y: B1, row: 1, hooks };
    buildings.push(b);
    const door = Math.round(doorX(it, B1) / T - 0.5);
    // cổng vòm (lòng trong suốt): lối đất chạy xuyên từ đường xuống
    const from = hooks?.through ? roadV + 2 : Math.floor(B1 / T);
    for (let y = from; y <= lastV; y++) { ter.set(door, y, 'p'); ter.set(door + 1, y, 'p'); }
    const left = (door - 0.5) * T;
    const right = (door + 1.5) * T;
    put(i % 2 ? pick(bushes, rand) : 'flowerbed', left - 18, H - 1);
    put(i % 2 ? 'flowerbed' : pick(props('flower').concat(bushes), rand), right + 18, H - 1);
    if (i % 2 === 1) put(lamp, it.x0 + it.w, roadBottom + 4, { shadow: [5, 2] });
    else put(pick(bushes.concat(props('flower')), rand), it.x0 + it.w, roadBottom + 14);
    if (it.place.id === 'colosseum' && it.place.unlocked) {
      for (const dx of [-26, 26]) if (fxDef('flag-gold')) fx.push({ kind: 'loop', def: fxDef('flag-gold'), x: b.x + dx, y: H - 2, z: H - 2, shadow: [3, 1] });
    }
  }

  // ---- hai đầu phố: cây cối
  const ends = [[16, B0 - 34], [34, B0 + 4], [W - 16, B0 - 30], [W - 30, B0 + 6], [18, B1 - 30], [W - 18, B1 - 34], [30, H + 4], [W - 28, H + 4]];
  for (const [x, y] of ends) put(pick(trees, rand), x, y, { shadow: [16, 3] });

  // ---- ống khói, lò rèn: theo điểm móc của toà (toạ độ ảnh gốc)
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
    if (def && rand() < 0.6) fx.push({ kind: 'drift', def, x: s.x, y: s.y - s.sprite.h + 14, fall: s.sprite.h - 10, z: s.y + 2, ph: rand() * 5000 });
  }
  for (const name of ['bird-fly-side', 'bird-fly-side-sparrow']) {
    if (fxDef(name)) fx.push({ kind: 'flyer', def: fxDef(name), W, yMax: B0 - 30, z: 1e6, next: 2000 + rand() * 9000 });
  }

  // ---- người đi đường: hai làn, mỗi làn một chiều; ai chưa có khung đi bộ thì đứng trước nhà mình
  const lanes = [(roadV + 0.55) * T, (roadV + 1.75) * T];
  const walkers = [];
  const standers = [];
  const movers = Object.entries(A.data.npcs).filter(([, n]) => n.walk.east || n.walk.west);
  for (const [k, [id, npc]] of movers.entries()) {
    const dir = k % 2 ? -1 : 1;
    const speed = /jog/.test(id) ? 34 : 15 + rand() * 7;
    walkers.push({ id, npc, dir, x: Math.round(((k + 0.3 + rand() * 0.4) / movers.length) * W), lane: dir > 0 ? 0 : 1, speed, phase: rand() * 1000, pause: 0, rest: 3 + rand() * 9 });
  }
  for (const [id, npc] of Object.entries(A.data.npcs)) {
    if (npc.walk.east || npc.walk.west || !STANDERS[id]) continue;
    const b = buildings.find((bb) => bb.place.id === STANDERS[id]);
    if (b) standers.push({ id, npc, x: b.x + (b.row ? -30 : 30), y: b.row ? H - 1 : B0 + 14 });
  }
  return { W, H, ter, buildings, statics, walkers, standers, fx, lanes, B0, B1, roadTop, roadBottom };
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
    <div class="t16-scroll">
      <div class="t16-world">
        <canvas class="t16-canvas" aria-hidden="true"></canvas>
        <div class="t16-ui" role="group" aria-label="Các toà nhà trên phố"></div>
      </div>
    </div>
    <button type="button" class="t16-nav prev" aria-label="Xem phía bên trái phố" hidden>‹</button>
    <button type="button" class="t16-nav next" aria-label="Xem phía bên phải phố" hidden>›</button>
    <p class="t16-hint" aria-hidden="true">Vuốt ngang <span>→</span></p>`;
  const scroller = root.querySelector('.t16-scroll');
  const world = root.querySelector('.t16-world');
  const cv = root.querySelector('.t16-canvas');
  const ui = root.querySelector('.t16-ui');
  const prevBtn = root.querySelector('.t16-nav.prev');
  const nextBtn = root.querySelector('.t16-nav.next');
  const g = cv.getContext('2d');

  const phoneMq = matchMedia(PHONE);
  const motionMq = matchMedia(REDUCED);
  let places = initialPlaces;
  let L = null; // bố cục hiện tại
  let ground = null; // canvas địa hình + bóng tĩnh
  let scale = 3;
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

  function build() {
    L = layout(A, places, artFor);
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

  // ---- lớp HTML: nút, chip tên, huy hiệu, ổ khoá
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
      btn.classList.toggle('row1', b.row === 1);
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
  }

  function applyScale() {
    scale = phoneMq.matches ? 2 : 3;
    root.style.setProperty('--s', scale);
    world.style.width = `${L.W * scale}px`;
    world.style.height = `${L.H * scale}px`;
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
    root.style.setProperty('--hint-top', `${Math.round((L.roadTop + 10) * scale)}px`);
    requestAnimationFrame(fitChips);
    updateNav();
  }

  /** Đẩy chip ở hai đầu phố vào trong cho khỏi bị cắt. */
  function fitChips() {
    if (!L) return;
    const max = L.W * scale;
    for (const b of L.buildings) {
      const chip = b.btn.firstElementChild;
      const half = chip.offsetWidth / 2;
      const cx = (b.rect.x + b.rect.w / 2) * scale;
      const dx = Math.max(0, 6 - (cx - half)) + Math.min(0, max - 6 - (cx + half));
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
      const flip = !npc.walk[dir];
      const seq = npc.walk[dir] ?? npc.walk[dir === 'east' ? 'west' : 'east'];
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
      const y = L.lanes[w.lane];
      const dir = w.dir > 0 ? 'east' : 'west';
      const mode = still || w.pause > 0 ? 'idle' : 'walk';
      const face = mode === 'idle' && !still ? (w.lane === 0 ? 'north' : 'south') : dir;
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
      w.x += w.dir * w.speed * dt;
      w.rest -= dt;
      if (w.rest <= 0) {
        // thỉnh thoảng dừng lại ngắm phố một lúc
        w.pause = 1.5 + Math.random() * 2.5;
        w.rest = 6 + Math.random() * 10;
      }
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

  // ---- cuộn ngang: gợi ý "Vuốt ngang", mũi tên trên máy tính
  function updateNav() {
    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    prevBtn.hidden = scroller.scrollLeft <= 4;
    nextBtn.hidden = scroller.scrollLeft >= maxScroll - 4;
    root.classList.toggle('t16-scrollable', maxScroll > 4);
  }
  const onScroll = () => {
    if (scroller.scrollLeft > 24) root.classList.add('t16-scrolled');
    updateNav();
  };
  scroller.addEventListener('scroll', onScroll, { passive: true });
  const page = (dir) => scroller.scrollBy({ left: dir * scroller.clientWidth * 0.8, behavior: motionMq.matches ? 'auto' : 'smooth' });
  prevBtn.addEventListener('click', () => page(-1));
  nextBtn.addEventListener('click', () => page(1));

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
   * Máy tính: phố tràn ra hai bên cột nội dung (cách mép cửa sổ 16 px) để thấy được nhiều nhà nhất,
   * không rộng hơn chính con phố. Điện thoại giữ đúng bề ngang cột.
   */
  function bleed() {
    root.style.marginLeft = '';
    root.style.width = '';
    if (phoneMq.matches || !L) return;
    const z = root.currentCSSZoom || 1; // đổi px màn hình ra px của chính khối (khối đã bù zoom game)
    const r = root.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const gutter = 16;
    const roomL = Math.max(0, r.left - gutter);
    const roomR = Math.max(0, vw - gutter - r.right);
    const extra = Math.min(roomL + roomR, (L.W * scale + 4) * z - r.width);
    if (extra < 8) return;
    const left = Math.min(roomL, Math.max(extra / 2, extra - roomR)); // chia đều, bên nào hẹp thì bên kia bù
    root.style.marginLeft = `${-left / z}px`;
    root.style.width = `${(r.width + extra) / z}px`;
    updateNav();
  }
  const onMedia = () => {
    applyScale();
    bleed();
    sync();
  };
  phoneMq.addEventListener('change', onMedia);
  motionMq.addEventListener('change', onMedia);
  const ro = new ResizeObserver(() => updateNav());
  ro.observe(scroller);
  window.addEventListener('resize', bleed);

  container.replaceChildren(root);
  build();
  bleed();
  document.fonts?.ready.then(() => root.isConnected && fitChips());
  sync();

  return {
    update(next = []) {
      places = Array.isArray(next) ? next : [];
      build();
      sync();
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', bleed);
      phoneMq.removeEventListener('change', onMedia);
      motionMq.removeEventListener('change', onMedia);
      ui.removeEventListener('click', onClick);
      scroller.removeEventListener('scroll', onScroll);
      for (const id of tips.values()) clearTimeout(id);
      root.remove();
      L = null;
    },
  };
}
