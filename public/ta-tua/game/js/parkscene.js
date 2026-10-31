// Công viên 16-bit nhìn từ trên xuống: nền đất vẽ một lần lên canvas, đồ vật đứng (cây, đèn, đài phun nước...)
// là các ô ảnh xếp chồng theo y cùng các bé, cộng ánh nước, khách dạo và đèn đêm. Ảnh và bố cục do
// scripts/art/build-park.py dựng vào assets/park/. Kèm bản đồ đi lại (navigation) để bé không lội xuống ao
// hay đi xuyên đồ vật.
import { makeCanvas } from './pixel.js';
import { TINTS, timeOfDay } from './scenes.js';

const ASSETS = new URL('../assets/park/', import.meta.url);
/** Tên-bé cao chừng này đơn vị thế giới dưới chân: chừa chỗ ở mép dưới để tên không bị cắt. */
const TAG_ROOM = 40;
const SHADOW = 'rgba(46, 29, 20, 0.28)';

// ---------------------------------------------------------------- tải ảnh (một lần cho cả phiên)

let artPromise = null;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(img));
    img.onerror = () => reject(new Error(`không tải được ${url}`));
    img.src = url;
  });
}

/** park.json + nền + atlas; giải mã một lần, lần sau vào công viên dùng lại. Lỗi thì trả về null. */
export function loadParkArt() {
  artPromise ??= fetch(new URL('park.json', ASSETS))
    .then((res) => {
      if (!res.ok) throw new Error(`park.json ${res.status}`);
      return res.json();
    })
    .then(async (data) => {
      const [ground, atlas] = await Promise.all([loadImage(new URL(data.ground, ASSETS)), loadImage(new URL(data.atlas, ASSETS))]);
      return { data, ground, atlas };
    })
    .catch((err) => {
      artPromise = null;
      console.warn('Công viên 16-bit: dùng cảnh cũ.', err);
      return null;
    });
  return artPromise;
}

// ---------------------------------------------------------------- bản đồ đi lại

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

/**
 * Lưới đi lại theo đơn vị thế giới: vùng `walk` (đa giác) trừ các ô `blocked` (chữ nhật [x0,y0,x1,y1] hoặc đa giác).
 * Máy chủ chỉ biết một khung chữ nhật (world.minX..maxY); `toDisplay`/`toLogical` ánh xạ khung đó vào vùng cỏ
 * thật sự đi được, rồi `snap` kéo điểm rơi vào ao hay đồ vật ra chỗ trống gần nhất. Mọi máy cùng tính một kiểu
 * nên ai cũng thấy bé đứng cùng một chỗ.
 */
export function createNav({ width, height, walk, rect = null, blocked = [], cell = 12, inset = 0 }) {
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const open = new Uint8Array(cols * rows);
  const rects = blocked.filter((b) => typeof b[0] === 'number');
  const polys = blocked.filter((b) => Array.isArray(b[0]));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * cell;
      const y = (r + 0.5) * cell;
      open[r * cols + c] = pointInPolygon(x, y, walk)
        && !rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)
        && !polys.some((p) => pointInPolygon(x, y, p)) ? 1 : 0;
    }
  }
  // Ô bị chặn -> ô trống gần nhất (loang BFS từ mọi ô trống), để snap chạy O(1). Loang từ hàng dưới lên: khi hai phía
  // xa bằng nhau, bé đứng trước đồ vật (dễ thấy) thay vì khuất sau nó.
  const nearest = new Int32Array(cols * rows).fill(-1);
  const queue = [];
  for (let i = open.length - 1; i >= 0; i--) if (open[i]) { nearest[i] = i; queue.push(i); }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const c = i % cols;
    const r = (i / cols) | 0;
    for (const [dc, dr] of DIRS.slice(0, 4)) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = nr * cols + nc;
      if (nearest[ni] !== -1) continue;
      nearest[ni] = nearest[i];
      queue.push(ni);
    }
  }

  const xs = walk.map((p) => p[0]);
  const ys = walk.map((p) => p[1]);
  // Khung nhận tọa độ máy chủ: `rect` của cảnh (park-1: safe rect, dưới hàng đèn/ghế) hoặc khung bao của vùng đi.
  const [rx0, ry0, rx1, ry1] = rect ?? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const box = { x0: rx0, y0: ry0, x1: rx1, y1: Math.min(ry1, height - inset) };
  let logical = { minX: box.x0, maxX: box.x1, minY: box.y0, maxY: box.y1 };

  const cellOf = (x, y) => clamp(Math.floor(y / cell), 0, rows - 1) * cols + clamp(Math.floor(x / cell), 0, cols - 1);
  const isOpen = (x, y) => open[cellOf(x, y)] === 1;

  function snap(x, y) {
    x = clamp(x, 0, width - 1);
    y = clamp(y, 0, height - 1);
    const i = cellOf(x, y);
    if (open[i]) return { x, y };
    const n = nearest[i];
    if (n < 0) return { x, y };
    const c = n % cols;
    const r = (n / cols) | 0;
    return { x: clamp(x, c * cell + 1, (c + 1) * cell - 1), y: clamp(y, r * cell + 1, (r + 1) * cell - 1) };
  }

  const openCell = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && open[r * cols + c] === 1;
  /** Đoạn thẳng a->b chỉ đi qua ô trống? Duyệt đúng mọi ô đoạn thẳng cắt qua (kể cả đi sát góc). */
  function clear(ax, ay, bx, by) {
    let c = Math.floor(ax / cell);
    let r = Math.floor(ay / cell);
    const ec = Math.floor(bx / cell);
    const er = Math.floor(by / cell);
    const dx = bx - ax;
    const dy = by - ay;
    const sc = Math.sign(dx);
    const sr = Math.sign(dy);
    const stepX = dx ? Math.abs(cell / dx) : Infinity;
    const stepY = dy ? Math.abs(cell / dy) : Infinity;
    let tx = dx ? (sc > 0 ? (c + 1) * cell - ax : ax - c * cell) / Math.abs(dx) : Infinity;
    let ty = dy ? (sr > 0 ? (r + 1) * cell - ay : ay - r * cell) / Math.abs(dy) : Infinity;
    for (let n = cols + rows; n >= 0; n--) {
      if (!openCell(c, r)) return false;
      if (c === ec && r === er) return true;
      if (Math.abs(tx - ty) < 1e-9) {
        if (!openCell(c + sc, r) || !openCell(c, r + sr)) return false;
        tx += stepX;
        ty += stepY;
        c += sc;
        r += sr;
      } else if (tx < ty) {
        tx += stepX;
        c += sc;
      } else {
        ty += stepY;
        r += sr;
      }
    }
    return true;
  }

  function astar(start, goal) {
    const n = cols * rows;
    const g = new Float32Array(n).fill(Infinity);
    const from = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    const heap = [];
    const gc = goal % cols;
    const gr = (goal / cols) | 0;
    const h = (i) => {
      const dx = Math.abs((i % cols) - gc);
      const dy = Math.abs(((i / cols) | 0) - gr);
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    };
    const push = (f, i) => {
      heap.push([f, i]);
      for (let k = heap.length - 1; k > 0;) {
        const p = (k - 1) >> 1;
        if (heap[p][0] <= heap[k][0]) break;
        [heap[p], heap[k]] = [heap[k], heap[p]];
        k = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let k = 0; ;) {
          const l = 2 * k + 1;
          const r = l + 1;
          let m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top[1];
    };
    g[start] = 0;
    push(h(start), start);
    while (heap.length) {
      const cur = pop();
      if (cur === goal) break;
      if (done[cur]) continue;
      done[cur] = 1;
      const c = cur % cols;
      const r = (cur / cols) | 0;
      for (const [dc, dr, cost] of DIRS) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const ni = nr * cols + nc;
        if (!open[ni] || done[ni]) continue;
        if (dc && dr && (!open[r * cols + nc] || !open[nr * cols + c])) continue;
        const ng = g[cur] + cost;
        if (ng < g[ni]) {
          g[ni] = ng;
          from[ni] = cur;
          push(ng + h(ni), ni);
        }
      }
    }
    if (start !== goal && from[goal] === -1) return null;
    const cells = [];
    for (let i = goal; i !== -1 && i !== start; i = from[i]) cells.push(i);
    return cells.reverse().map((i) => ({ x: ((i % cols) + 0.5) * cell, y: (((i / cols) | 0) + 0.5) * cell }));
  }

  /** Các điểm dừng từ (ax, ay) tới (bx, by), đi vòng chỗ bị chặn; điểm cuối luôn là đích. */
  function route(ax, ay, bx, by) {
    const goal = snap(bx, by);
    const start = snap(ax, ay);
    const lead = start.x !== ax || start.y !== ay ? [start] : [];
    if (clear(start.x, start.y, goal.x, goal.y)) return [...lead, goal];
    const cells = astar(cellOf(start.x, start.y), cellOf(goal.x, goal.y));
    if (!cells) return [...lead, goal];
    const pts = [...cells.slice(0, -1), goal];
    const out = [...lead];
    let from = start;
    for (let k = 0; k < pts.length;) {
      let far = k;
      for (let j = pts.length - 1; j > k; j--) {
        if (clear(from.x, from.y, pts[j].x, pts[j].y)) {
          far = j;
          break;
        }
      }
      out.push(pts[far]);
      from = pts[far];
      k = far + 1;
    }
    return out;
  }

  return {
    box,
    snap,
    route,
    isOpen,
    /** Khung chữ nhật máy chủ dùng (world từ pg:state). */
    setLogical(w) {
      if (w && Number.isFinite(w.minX) && w.maxX > w.minX && w.maxY > w.minY) logical = { minX: w.minX, maxX: w.maxX, minY: w.minY, maxY: w.maxY };
    },
    toDisplay(x, y) {
      const L = logical;
      return snap(
        box.x0 + ((x - L.minX) / (L.maxX - L.minX)) * (box.x1 - box.x0),
        box.y0 + ((y - L.minY) / (L.maxY - L.minY)) * (box.y1 - box.y0),
      );
    },
    toLogical(x, y) {
      const L = logical;
      return {
        x: Math.round(clamp(L.minX + ((x - box.x0) / (box.x1 - box.x0)) * (L.maxX - L.minX), L.minX, L.maxX)),
        y: Math.round(clamp(L.minY + ((y - box.y0) / (box.y1 - box.y0)) * (L.maxY - L.minY), L.minY, L.maxY)),
      };
    },
  };
}

/** Bản đồ đi lại của cảnh cũ: đúng khung chữ nhật máy chủ, không vật cản. */
export function rectNav(world) {
  const nav = createNav({
    width: world.width,
    height: world.height,
    walk: [[world.minX, world.minY], [world.maxX, world.minY], [world.maxX, world.maxY], [world.minX, world.maxY]],
  });
  nav.setLogical(world);
  return nav;
}

// ---------------------------------------------------------------- cảnh

function tintedCopy(img, color) {
  const [c, g] = makeCanvas(img.width, img.height);
  g.drawImage(img, 0, 0);
  if (!color) return c;
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(img, 0, 0);
  return c;
}

function shadowImage(rx, ry) {
  const [c, g] = makeCanvas(rx * 2 + 1, ry * 2 + 1);
  g.fillStyle = SHADOW;
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + 0.5)) ** 2)));
    g.fillRect(rx - half, y + ry, half * 2, 1);
  }
  return c.toDataURL();
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)');
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

/**
 * Gắn cảnh 16-bit vào `world` (phần tử thế giới của park.js, đơn vị thế giới = data.px điểm ảnh gốc).
 * Trả về { nav, update(bodies), destroy() }: `update` làm mờ đồ vật che thân bé đứng sau nó, và cho biết bé nào
 * cần nâng lên trên một đồ vật chỉ che bảng tên (thân không bị che) để tên luôn đọc được.
 */
export function mountPark16(world, art) {
  const { data, ground, atlas } = art;
  const K = data.px;
  const [W, H] = data.size;
  const [AW, AH] = data.atlasSize;
  const frames = data.frames;
  const made = [];
  const add = (el) => {
    world.append(el);
    made.push(el);
    return el;
  };

  // nền: đất + bóng đổ của đồ vật, phủ màu theo giờ
  const [bg, g] = makeCanvas(W, H);
  bg.className = 'px-layer pk-ground';
  bg.style.width = `${W * K}px`;
  bg.style.height = `${H * K}px`;
  world.prepend(bg);
  made.push(bg);

  function sprite(cls) {
    const el = document.createElement('div');
    el.className = `pk-sprite ${cls}`;
    el.style.backgroundSize = `${AW * K}px ${AH * K}px`;
    el.setAttribute('aria-hidden', 'true');
    return el;
  }
  /** Đặt khung `name` sao cho điểm neo (chân) rơi đúng (x, y) điểm ảnh gốc. */
  function show(el, name, x, y, flip = false) {
    const f = frames[name];
    if (!f) return;
    const ax = flip ? f.w - f.ax : f.ax;
    el.style.width = `${f.w * K}px`;
    el.style.height = `${f.h * K}px`;
    el.style.backgroundPosition = `${-f.x * K}px ${-f.y * K}px`;
    el.style.left = `${Math.round(x - ax) * K}px`;
    el.style.top = `${Math.round(y - f.ay) * K}px`;
    el.classList.toggle('flip', flip);
  }

  // đồ vật đứng: xếp theo chân như các bé (z-index = y theo đơn vị thế giới)
  const anims = [];
  const occluders = [];
  for (const o of data.objects) {
    const anim = o.a ? data.anims[o.a] : null;
    const name = anim ? anim.frames[0] : o.f;
    const f = frames[name];
    if (!f) continue;
    const el = add(sprite('pk-obj'));
    show(el, name, o.x, o.y);
    el.style.zIndex = String(Math.round(o.y * K));
    if (anim) anims.push({ el, anim, o, shown: 0 });
    // Vùng che: khung ảnh bỏ bớt góc trong suốt (12% mỗi bên, 10% phía trên).
    if (o.occ) {
      occluders.push({
        el, faded: false,
        x0: (o.x - f.ax + f.w * 0.12) * K, x1: (o.x - f.ax + f.w * 0.88) * K, y0: (o.y - f.ay + f.h * 0.1) * K, y1: o.y * K,
      });
    }
  }

  // khách dạo: đi tới đi lui theo lối, nghỉ ở hai đầu
  const npcs = data.npcs.map((n) => {
    const pts = n.route;
    const segs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    const len = segs.reduce((a, b) => a + b, 0);
    const shadow = add(document.createElement('div'));
    shadow.className = 'pk-shadow';
    shadow.style.width = `${15 * K}px`;
    shadow.style.height = `${5 * K}px`;
    shadow.style.backgroundImage = `url(${shadowImage(7, 2)})`;
    return { ...n, segs, len, s: len * (n.start ?? 0), dir: 1, wait: rand(0, 2), el: add(sprite('pk-npc')), shadow, key: '' };
  });
  function npcAt(n) {
    let s = n.s;
    for (let i = 0; i < n.segs.length; i++) {
      if (s <= n.segs[i] || i === n.segs.length - 1) {
        const t = n.segs[i] ? Math.min(1, s / n.segs[i]) : 0;
        const [x0, y0] = n.route[i];
        const [x1, y1] = n.route[i + 1];
        return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, dx: (x1 - x0) * n.dir };
      }
      s -= n.segs[i];
    }
    return { x: n.route[0][0], y: n.route[0][1], dx: 0 };
  }
  function drawNpc(n, t, walking) {
    const p = npcAt(n);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const west = p.dx < 0;
    let name = n.idle;
    let flip = false;
    if (walking) {
      const strip = west && n.walkW ? n.walkW : n.walkE;
      name = strip[Math.floor(t * n.fps) % strip.length];
      flip = west && !n.walkW;
    }
    const key = `${name}|${x}|${y}|${flip}`;
    if (key === n.key) return;
    n.key = key;
    show(n.el, name, x, y, flip);
    n.el.style.zIndex = String(y * K);
    n.shadow.style.left = `${(x - 7 + 1) * K}px`;
    n.shadow.style.top = `${(y - 3) * K}px`;
  }

  // ánh nước trên ao: chớp một vòng ở một chỗ, nghỉ, rồi sang chỗ khác
  const sparks = data.fx.filter((fx) => fx.kind !== 'flutter').flatMap((fx) => Array.from({ length: fx.count }, () => ({
    fx, el: add(sprite('pk-fx')), start: 0, until: 0, frame: -1,
  })));
  // bướm lượn quanh luống hoa (ban ngày)
  const flies = data.fx.filter((fx) => fx.kind === 'flutter').flatMap((fx, j) => Array.from({ length: fx.count }, (_, i) => {
    const [cx, cy] = fx.spots[(i + j) % fx.spots.length];
    return { fx, cx, cy, phase: rand(0, 6), el: add(sprite('pk-fly')) };
  }));
  function placeSpark(sp, now) {
    const [x, y] = sp.fx.spots[Math.floor(Math.random() * sp.fx.spots.length)];
    sp.x = x;
    sp.y = y;
    sp.start = now + rand(sp.fx.gap[0], sp.fx.gap[1]);
    sp.until = sp.start + sp.fx.frames.length * sp.fx.ms;
    sp.frame = -1;
    sp.el.hidden = true;
  }

  // đèn đêm
  for (const [x, y] of data.lights) {
    const el = add(document.createElement('div'));
    el.className = 'pk-glow';
    el.style.left = `${x * K}px`;
    el.style.top = `${y * K}px`;
  }

  // ---- giờ trong ngày: nền và atlas phủ màu như cảnh cũ; các bé đã có bộ lọc riêng trong CSS
  let time = null;
  function paint() {
    time = timeOfDay();
    world.dataset.time = time;
    const tint = TINTS[time];
    g.clearRect(0, 0, W, H);
    g.drawImage(ground, 0, 0);
    g.fillStyle = SHADOW;
    for (const o of data.objects) {
      if (!o.sh) continue;
      const [rx, ry] = o.sh;
      for (let y = -ry; y <= ry; y++) {
        const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + 0.5)) ** 2)));
        g.fillRect(o.x + 2 - half, o.y - 2 + y, half * 2, 1);
      }
    }
    if (tint) {
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = tint;
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    }
    const url = tint ? tintedCopy(atlas, tint).toDataURL() : atlas.src;
    world.style.setProperty('--pk-atlas', `url("${url}")`);
  }

  // ---- vòng lặp chuyển động: dừng khi tab ẩn, khi cảnh ra khỏi màn hình và khi người chơi giảm chuyển động
  let raf = 0;
  let last = 0;
  let onScreen = true;
  const motion = reducedMotion();

  /** Khung tĩnh khi không chạy: đài phun nước khung đầu, khách đứng yên, ao không lấp lánh. */
  function still() {
    for (const a of anims) {
      a.shown = 0;
      show(a.el, a.anim.frames[0], a.o.x, a.o.y);
    }
    for (const n of npcs) drawNpc(n, 0, false);
    for (const sp of sparks) sp.el.hidden = true;
    for (const b of flies) b.el.hidden = true;
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (now - last < 33) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    for (const a of anims) {
      const n = a.anim.frames.length;
      const k = Math.floor(t * a.anim.fps);
      const cycle = a.anim.mode === 'pingpong' && n > 2 ? 2 * n - 2 : n;
      const i = k % cycle;
      const idx = i < n ? i : cycle - i;
      if (idx !== a.shown) {
        a.shown = idx;
        const f = frames[a.anim.frames[idx]];
        a.el.style.backgroundPosition = `${-f.x * K}px ${-f.y * K}px`;
      }
    }
    for (const n of npcs) {
      if (n.wait > 0) {
        n.wait -= dt;
        drawNpc(n, t, false);
        continue;
      }
      n.s += n.dir * n.speed * dt;
      if (n.s >= n.len || n.s <= 0) {
        n.s = clamp(n.s, 0, n.len);
        n.dir = -n.dir;
        n.wait = rand(n.pause[0], n.pause[1]);
      }
      drawNpc(n, t, n.wait <= 0);
    }
    for (const sp of sparks) {
      if (now >= sp.until) placeSpark(sp, now);
      if (now < sp.start) continue;
      const i = Math.min(sp.fx.frames.length - 1, Math.floor((now - sp.start) / sp.fx.ms));
      if (i !== sp.frame) {
        sp.frame = i;
        sp.el.hidden = false;
        show(sp.el, sp.fx.frames[i], sp.x, sp.y);
      }
    }
    for (const b of flies) {
      const x = b.cx + 18 * Math.sin(t * 0.55 + b.phase) + 5 * Math.sin(t * 1.7 + b.phase * 2);
      const y = b.cy - 16 + 7 * Math.sin(t * 0.8 + b.phase) - 3 * Math.abs(Math.sin(t * 2.4 + b.phase));
      b.el.hidden = false;
      show(b.el, b.fx.frames[Math.floor(now / b.fx.ms) % b.fx.frames.length], x, y);
    }
  }

  function sync() {
    const run = onScreen && !document.hidden && !motion.matches;
    if (run && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (!run) still();
  }

  paint();
  for (const sp of sparks) placeSpark(sp, performance.now());
  still();
  const io = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    sync();
  });
  io.observe(world.parentElement ?? world);
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  const clock = setInterval(() => timeOfDay() !== time && paint(), 60_000);
  sync();

  const nav = createNav({
    width: W * K,
    height: Math.min(H * K, world.offsetHeight || H * K),
    walk: data.nav.walk.map(([x, y]) => [x * K, y * K]),
    rect: data.nav.rect ? data.nav.rect.map((v) => v * K) : null,
    blocked: data.nav.blocked.map((b) => (Array.isArray(b[0]) ? b.map(([x, y]) => [x * K, y * K]) : b.map((v) => v * K))),
    inset: TAG_ROOM,
  });

  return {
    nav,
    /** `bodies`: [{ x, y, h }] theo đơn vị thế giới (chân và chiều cao các bé). */
    update(bodies) {
      const lifts = bodies.map(() => 0);
      for (const o of occluders) {
        let hide = false;
        bodies.forEach((b, i) => {
          if (b.y >= o.y1) return; // bé đứng trước đồ vật
          const body = b.x + 24 > o.x0 && b.x - 24 < o.x1 && b.y > o.y0 && b.y - b.h < o.y1;
          const tag = b.x + 60 > o.x0 && b.x - 60 < o.x1 && b.y + 50 > o.y0 && b.y + 4 < o.y1;
          if (body) hide = true;
          else if (tag) lifts[i] = Math.max(lifts[i], o.y1 + 1);
        });
        if (hide !== o.faded) {
          o.faded = hide;
          o.el.classList.toggle('pk-fade', hide);
        }
      }
      return lifts;
    },
    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', sync);
      clearInterval(clock);
      for (const el of made) el.remove();
      world.style.removeProperty('--pk-atlas');
    },
  };
}
