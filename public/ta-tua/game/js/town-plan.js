// Bố cục "lưới khu phố" của Phố Trân Châu (town16.js): chỉ có hình học, không đụng tới DOM hay ảnh, nên
// chạy được cả trong Node (petdex/test/town-plan.test.js). Mỗi khu gồm một hay vài "lô" 3 ô nằm trên một dãy;
// dưới mỗi dãy là một con đường ngang, giữa các lô là đường dọc. Cùng 5 khu và quảng trường đài phun nước,
// ba cách xếp theo bề ngang khung: rộng (9 ô x 3 dãy), vừa (6 ô x 4 dãy), hẹp (3 ô x 9 dãy, cuộn dọc).
// Mọi số là điểm ảnh 1x của thế giới (ô lưới 16 px).

export const T = 16;

export const DISTRICTS = {
  nha: { short: 'Nhà', name: 'Nhà & Chăm sóc', icon: '🏡', tone: 'rose' },
  tai: { short: 'Tài chính', name: 'Tài chính', icon: '🏦', tone: 'gold' },
  plaza: { short: 'Quảng trường', name: 'Quảng trường', icon: '⛲', tone: 'plaza' },
  cho: { short: 'Chợ', name: 'Chợ', icon: '🛒', tone: 'tea' },
  vui: { short: 'Vui chơi', name: 'Vui chơi', icon: '🎈', tone: 'mint' },
  cn: { short: 'Xưởng', name: 'Xưởng & Gia tộc', icon: '⚒️', tone: 'clay' },
  more: { short: 'Nơi mới', name: 'Nơi mới', icon: '✨', tone: 'plaza' },
};

/**
 * Ô đặc biệt (không phải toà nhà): '#plaza' quảng trường; '#plazaL' + '#plazaR' quảng trường vắt qua
 * đường dọc giữa hai lô; '#plot' luống rau, '#stalls' sạp ô dù, '#pond' hồ nhỏ. Ba ô trang trí sau là chỗ
 * trống cho nơi mới thêm vào PLACES mà chưa có trong bảng này.
 * slot: bề ngang một ô (đơn vị ô lưới), vroad: bề ngang đường dọc, margin: lề hai bên.
 */
export const PLANS = {
  wide: {
    slot: 8, vroad: 3, margin: 2,
    rows: [
      [['nha', ['home', 'school', 'clinic']], ['tai', ['bank', 'townhall', 'news']], ['cho', ['shop', 'boba', 'bazaar']]],
      [['nha', ['kitchen', 'garden', '#plot']], ['plaza', ['#plaza', '#plaza', '#plaza']], ['cho', ['market', 'matshop', '#stalls']]],
      [['vui', ['park', 'arcade', '#pond']], ['cn', ['realestate', 'colosseum', 'arena']], ['cn', ['factory', 'jobs', 'forge']]],
    ],
  },
  mid: {
    slot: 8, vroad: 3, margin: 1,
    rows: [
      [['nha', ['home', 'school', 'clinic']], ['tai', ['bank', 'townhall', 'news']]],
      // quảng trường 2 ô vắt qua đường dọc giữa: đường dọc chạy thẳng vào đài phun nước
      [['nha', ['kitchen', 'garden', '#plazaL']], ['vui', ['#plazaR', 'park', 'arcade']]],
      [['cho', ['shop', 'boba', 'bazaar']], ['cho', ['market', 'matshop', '#stalls']]],
      [['cn', ['factory', 'jobs', 'forge']], ['cn', ['realestate', 'colosseum', 'arena']]],
    ],
  },
  narrow: {
    slot: 7, vroad: 0, margin: 0.5,
    rows: [
      [['nha', ['home', 'school', 'clinic']]],
      [['nha', ['kitchen', 'garden', '#plot']]],
      [['tai', ['bank', 'townhall', 'news']]],
      [['plaza', ['#plaza', '#plaza', '#plaza']]],
      [['cho', ['shop', 'boba', 'bazaar']]],
      [['cho', ['market', 'matshop', '#stalls']]],
      [['vui', ['park', 'arcade', '#pond']]],
      [['cn', ['factory', 'jobs', 'forge']]],
      [['cn', ['realestate', 'colosseum', 'arena']]],
    ],
  },
};

export const MODES = Object.keys(PLANS);

/** Bề ngang thế giới mặc định của từng bố cục (khung + viền 2 px mỗi bên phải chứa vừa). */
export const WORLD_W = { wide: 1312, mid: 848, narrow: 352 };
export const NARROW_MIN_W = 336;
const FRAME = 4; // viền khung 2 px x 2

/** Bố cục theo bề ngang dành cho phố (px CSS của khối phố). */
export function townMode(avail) {
  if (avail >= WORLD_W.wide + FRAME) return 'wide';
  if (avail >= WORLD_W.mid + FRAME) return 'mid';
  return 'narrow';
}

const TOPPAD = 40; // chỗ cho chip tên dãy đầu
const BAND = 7 * T + 4; // từ đỉnh dải nhà tới chân toà
const PLAZA_BAND = 78; // dãy quảng trường ở khung hẹp thấp hơn
const ROADH = 2 * T;
const GAP = 4; // khe tối thiểu giữa hai toà kề nhau
const DEFAULT_SIZE = { l: 56, r: 56 };
const SPARE = ['#plot', '#stalls', '#pond'];

/**
 * Tính bố cục. `ids`: id các nơi (theo thứ tự PLACES). `sizeOf(id)` trả về { l, r }: phần toà nhà nằm bên
 * trái / phải điểm chân (để dàn khe không chồng nhau). `width`: bề ngang muốn có (chỉ dùng cho khung hẹp).
 * Trả về { mode, W, H, rows, vroads, cells, districts }:
 *   rows[r] = { top, B (chân toà), roadTop, roadBottom }
 *   cells: { kind: 'place', id, x, y, row, district } | { kind: 'plaza'|'plot'|'stalls'|'pond'|'empty', x0, x1, cx, row, district }
 *   districts: { id, short, name, icon, tone, x, y (tâm bảng tên), center? }
 */
export function planTown(mode, ids, { sizeOf = () => DEFAULT_SIZE, width } = {}) {
  const P = PLANS[mode] ?? PLANS.wide;
  const known = new Set(ids);
  const planned = new Set(P.rows.flat().flatMap(([, list]) => list).filter((id) => !id.startsWith('#')));
  // Nơi mới chưa có trong bảng: lấp vào ô trang trí trước, hết ô thì thêm dãy "Nơi mới" ở cuối phố.
  const extra = ids.filter((id) => !planned.has(id));
  const rowsDef = P.rows.map((row) => row.map(([d, list]) => [d, list.map((id) => (SPARE.includes(id) && extra.length ? extra.shift() : id))]));
  const blocksPerRow = Math.max(...P.rows.map((r) => r.length));
  while (extra.length) {
    const row = [];
    for (let k = 0; k < blocksPerRow; k++) row.push(['more', extra.splice(0, 3).concat(['#empty', '#empty', '#empty']).slice(0, 3)]);
    rowsDef.push(row);
  }

  const slotW = P.slot * T;
  const vroadW = P.vroad * T;
  let marginX = P.margin * T;
  let W = marginX * 2 + blocksPerRow * 3 * slotW + (blocksPerRow - 1) * vroadW;
  if (mode === 'narrow' && width) {
    W = Math.max(NARROW_MIN_W, Math.min(W, Math.floor(width)));
    marginX = (W - 3 * slotW) / 2;
  }
  const narrow = mode === 'narrow';
  const rows = [];
  let y = TOPPAD;
  for (const row of rowsDef) {
    const isPlaza = row.some(([d]) => d === 'plaza');
    const B = y + (isPlaza && narrow ? PLAZA_BAND : BAND);
    const roadTop = B + 6;
    const roadBottom = roadTop + ROADH;
    rows.push({ top: y, B, roadTop, roadBottom });
    y = roadBottom + (narrow ? 14 : 22); // chip của dãy dưới chồng nhẹ lên mép đường
  }
  const H = rows[rows.length - 1].roadBottom + 6;
  const blockX = (k) => marginX + k * (3 * slotW + vroadW);
  const vroads = [];
  for (let k = 1; vroadW && k < blocksPerRow; k++) {
    const x0 = blockX(k) - vroadW;
    vroads.push({ x0, x1: x0 + vroadW, x: x0 + vroadW / 2, y0: rows[0].top + 4, y1: rows[rows.length - 1].roadBottom - 8 });
  }

  const cells = [];
  const districts = [];
  const sign = (id, x, yy, center) => {
    if (districts.some((d) => d.id === id)) return;
    districts.push({ id, ...(DISTRICTS[id] ?? DISTRICTS.more), x: Math.round(x), y: Math.round(yy), ...(center ? { center: true } : {}) });
  };
  for (const [r, row] of rowsDef.entries()) {
    const ry = rows[r];
    const signY = r === 0 ? 13 : rows[r - 1].roadTop + ROADH / 2;
    for (const [k, [district, list]] of row.entries()) {
      const bx = blockX(k);
      if (district === 'plaza') {
        cells.push({ kind: 'plaza', x0: bx, x1: bx + 3 * slotW, cx: bx + 1.5 * slotW, row: r, district });
        sign('plaza', bx + 1.5 * slotW, ry.top + 2, true);
        continue;
      }
      const lead = list.filter((id) => id === '#plazaR').length;
      sign(district, bx + 4 + slotW * lead, signY);
      const items = [];
      for (const [i, id] of list.entries()) {
        const x0 = bx + slotW * i;
        const cx = x0 + slotW / 2;
        if (id === '#plazaR') continue;
        if (id === '#plazaL') {
          const x1 = x0 + 2 * slotW + vroadW;
          cells.push({ kind: 'plaza', x0, x1, cx: (x0 + x1) / 2, row: r, district: 'plaza' });
          sign('plaza', (x0 + x1) / 2, ry.top + 2, true);
          continue;
        }
        if (id.startsWith('#')) {
          cells.push({ kind: id.slice(1), x0, x1: x0 + slotW, cx, row: r, district });
          continue;
        }
        if (!known.has(id)) {
          cells.push({ kind: 'empty', x0, x1: x0 + slotW, cx, row: r, district });
          continue;
        }
        const s = sizeOf(id) ?? DEFAULT_SIZE;
        const cell = { kind: 'place', id, x: cx, y: ry.B, row: r, district, l: s.l, r: s.r };
        items.push(cell);
        cells.push(cell);
      }
      spread(items, bx, bx + 3 * slotW);
      for (const it of items) {
        it.x = Math.round(it.x);
        delete it.l;
        delete it.r;
      }
    }
  }
  return { mode, W: Math.round(W), H, rows, vroads, cells, districts, slot: slotW, roadH: ROADH };
}

/** Đẩy các toà trong một lô ra cho khỏi chồng nhau (giữ chỗ cũ nếu đã đủ rộng), không ra ngoài lô. */
function spread(items, x0, x1) {
  const n = items.length;
  for (let i = 1; i < n; i++) {
    const a = items[i - 1];
    const b = items[i];
    b.x = Math.max(b.x, a.x + a.r + GAP + b.l);
  }
  if (n) items[n - 1].x = Math.min(items[n - 1].x, x1 - items[n - 1].r);
  for (let i = n - 2; i >= 0; i--) {
    const a = items[i];
    const b = items[i + 1];
    a.x = Math.min(a.x, b.x - b.l - GAP - a.r);
  }
  if (n && items[0].x - items[0].l < x0) {
    // lô quá chật: dàn khe đều trên cả bề ngang lô
    const total = items.reduce((s, it) => s + it.l + it.r, 0);
    const gap = (x1 - x0 - total) / (n + 1);
    let x = x0 + gap;
    for (const it of items) {
      it.x = x + it.l;
      x += it.l + it.r + gap;
    }
  }
}
