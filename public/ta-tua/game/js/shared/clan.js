// Luật Gia tộc và Sở Nhà Đất dùng chung cho máy chủ và trình duyệt: ngành nghề, địa hình, khí hậu,
// 200 lô đất (sinh cố định theo hạt giống), 200 mẫu lắp ghép công trình và cách vẽ chúng bằng SVG.
// Máy chủ dùng để kiểm tra và tính tiền; trình duyệt dùng để vẽ bản đồ, xem trước và lắp ghép.

// ---------------------------------------------------------------- ngành nghề

/**
 * Mỗi ngành ứng với một mảng đang có trong game. `comp`: tiền bồi thường thị trường khi gia tộc
 * thâu tóm ngành này lần đầu. `zones`/`climates`: lô đất hợp hay không hợp (cộng vào sản lượng).
 * `commodities`: hàng trên Sàn chịu tác động khi ngành này gặp cú sốc vĩ mô.
 */
export const INDUSTRIES = {
  tea: {
    name: 'Trà (lá trà, trà khô)', icon: '🍃', comp: 30_000, commodities: ['tea_leaf', 'dried_tea'],
    zones: { hill: 0.22, forest: 0.1, river: 0.05, plain: 0, coast: -0.12, sea: -0.6, urban: -0.3 },
    climates: { rainy: 0.12, temperate: 0.05, sunny: -0.06, windy: -0.05 },
  },
  dairy: {
    name: 'Bò sữa & sữa đặc', icon: '🥛', comp: 40_000, commodities: ['milk', 'condensed'],
    zones: { plain: 0.18, river: 0.08, hill: 0.05, forest: -0.05, coast: -0.08, sea: -0.6, urban: -0.25 },
    climates: { temperate: 0.08, sunny: 0, rainy: -0.04, windy: -0.03 },
  },
  sugar: {
    name: 'Mía đường', icon: '🎋', comp: 20_000, commodities: ['cane', 'sugar'],
    zones: { plain: 0.15, river: 0.1, coast: 0.02, hill: -0.1, forest: -0.15, sea: -0.6, urban: -0.3 },
    climates: { sunny: 0.15, temperate: 0.03, rainy: -0.08, windy: -0.02 },
  },
  pearl: {
    name: 'Sắn & trân châu', icon: '⚫', comp: 20_000, commodities: ['cassava', 'pearl'],
    zones: { plain: 0.12, hill: 0.08, river: 0.05, forest: 0.02, coast: -0.05, sea: -0.6, urban: -0.3 },
    climates: { sunny: 0.06, temperate: 0.04, rainy: 0, windy: -0.03 },
  },
  fruit: {
    name: 'Dâu tây & trái cây', icon: '🍓', comp: 35_000, commodities: ['strawberry'],
    zones: { hill: 0.18, plain: 0.05, forest: 0.04, river: 0.03, coast: -0.1, sea: -0.6, urban: -0.3 },
    climates: { temperate: 0.12, sunny: 0.02, rainy: -0.08, windy: -0.08 },
  },
  fishery: {
    name: 'Thủy hải sản', icon: '🐟', comp: 50_000, commodities: ['fish'],
    zones: { sea: 0.35, coast: 0.22, river: 0.12, plain: -0.25, hill: -0.45, forest: -0.4, urban: -0.3 },
    climates: { sunny: 0.05, temperate: 0.02, rainy: 0, windy: -0.05 },
  },
  beverage: {
    name: 'Chuỗi trà sữa', icon: '🧋', comp: 45_000, commodities: ['pearl', 'milk'],
    zones: { urban: 0.3, coast: 0.1, river: 0.08, sea: 0.05, plain: -0.05, hill: -0.15, forest: -0.2 },
    climates: { sunny: 0.08, temperate: 0.06, rainy: -0.06, windy: -0.04 },
  },
  food: {
    name: 'Ẩm thực & nhà hàng', icon: '🍲', comp: 35_000, commodities: ['fish', 'strawberry'],
    zones: { urban: 0.25, coast: 0.12, river: 0.1, sea: 0.05, plain: -0.05, hill: -0.12, forest: -0.15 },
    climates: { temperate: 0.05, sunny: 0.04, rainy: -0.03, windy: -0.03 },
  },
  logistics: {
    name: 'Giao vận & bốc xếp', icon: '📦', comp: 25_000, commodities: [],
    zones: { river: 0.18, coast: 0.15, urban: 0.12, plain: 0.08, sea: -0.1, hill: -0.2, forest: -0.25 },
    climates: { temperate: 0.04, sunny: 0.02, rainy: -0.08, windy: -0.06 },
  },
  education: {
    name: 'Giáo dục & gia sư', icon: '📚', comp: 25_000, commodities: [],
    zones: { urban: 0.2, plain: 0.06, river: 0.05, hill: 0.02, forest: 0, coast: 0, sea: -0.2 },
    climates: { temperate: 0.08, rainy: 0.02, sunny: -0.02, windy: -0.03 },
  },
  entertainment: {
    name: 'Giải trí & ca nhạc', icon: '🎤', comp: 30_000, commodities: [],
    zones: { urban: 0.22, coast: 0.18, sea: 0.15, river: 0.06, forest: 0.02, plain: -0.04, hill: -0.06 },
    climates: { sunny: 0.1, temperate: 0.04, rainy: -0.1, windy: -0.04 },
  },
};
export const INDUSTRY_ORDER = Object.keys(INDUSTRIES);

// ---------------------------------------------------------------- địa hình & khí hậu

/** Bảng màu bản đồ đất (phong cách bản đồ thành phố phẳng); chú thích và bảng quản trị dùng chung. */
export const MAP_PALETTE = {
  ground: '#e8e8e8', street: '#ffffff', arterial: '#f2b255', arterialEdge: '#ffffff', building: '#bdbdbd',
  park: '#8cc63f', field: '#cfe8b0', fieldHatch: '#9fd36a', river: '#8ecbef', riverEdge: '#c9e7f8', sea: '#8ecbef',
  wave: '#c9e7f8', mountain: '#9c8b6e', mountainLow: '#7a9a5a', contour: '#c8bca4', peak: '#f4f1ea', forest: '#5f9e4a',
  tree: '#477f37', sand: '#f1e3b6', urban: '#dedede',
};

export const ZONES = {
  urban: { name: 'Trung tâm', icon: '🏙️', color: MAP_PALETTE.urban, desc: 'Đông người qua lại, hợp buôn bán và dịch vụ.' },
  river: { name: 'Ven sông', icon: '🏞️', color: MAP_PALETTE.river, desc: 'Đất phù sa, giao thông đường thủy thuận tiện.' },
  coast: { name: 'Ven biển', icon: '🏖️', color: MAP_PALETTE.sand, desc: 'Gió biển, cảng cá, khách du lịch.' },
  sea: { name: 'Trên biển', icon: '🌊', color: '#6fb6e3', desc: 'Nhà nổi giữa biển: hải sản dồi dào nhưng sợ bão.' },
  hill: { name: 'Đồi núi', icon: '⛰️', color: MAP_PALETTE.mountain, desc: 'Mát, nhiều sương, hợp chè và dâu; đường đi quanh co.' },
  forest: { name: 'Rừng', icon: '🌲', color: MAP_PALETTE.forest, desc: 'Ẩm, xa phố, chi phí vận chuyển cao.' },
  plain: { name: 'Đồng bằng', icon: '🌾', color: MAP_PALETTE.field, desc: 'Bằng phẳng, ruộng đồng, hợp chăn nuôi và cây công nghiệp.' },
};
export const CLIMATES = {
  sunny: { name: 'Nhiều nắng', icon: '☀️' },
  rainy: { name: 'Mưa ẩm', icon: '🌧️' },
  temperate: { name: 'Ôn hòa', icon: '⛅' },
  windy: { name: 'Lộng gió', icon: '🌬️' },
};

/** Hệ số môi trường của một lô với một ngành: 1 + độ hợp địa hình + độ hợp khí hậu (không dưới 0,2). */
export function envFactor(industry, zone, climate) {
  const ind = INDUSTRIES[industry];
  if (!ind) return 1;
  return Math.max(0.2, 1 + (ind.zones[zone] ?? 0) + (ind.climates[climate] ?? 0));
}

// ---------------------------------------------------------------- 200 lô đất

export const LAND = { cols: 20, rows: 10, count: 200, minPrice: 100_000, maxPrice: 2_000_000, maxGrowth: 0.18, maxProd: 0.18 };
const ROW_LETTERS = 'ABCDEFGHIJ';

/** PRNG có hạt giống (mulberry32): bản đồ giống hệt nhau ở mọi máy. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (v, step) => Math.round(v / step) * step;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Hàng có sông chảy qua ở cột c (sông uốn từ tây sang rồi đổ ra biển). */
export const riverRow = (c) => 4 + Math.round(1.6 * Math.sin(c / 3.2));

function zoneAt(c, r, wobble) {
  const seaScore = (c - 9) * 0.45 + (r - 5);
  if (seaScore > 4.6 + wobble * 0.8) return 'sea';
  if (Math.hypot(c - 9.5, (r - 4.5) * 1.4) < 2.7) return 'urban';
  if (c <= 13 && r === riverRow(c)) return 'river';
  if ((6 - c) * 0.6 + (3 - r) * 0.9 > 0.7 + wobble) return 'hill';
  if (c >= 14 && r <= 3 - Math.round(wobble)) return 'forest';
  return 'plain';
}

/** Sinh 200 lô: vị trí, địa hình, khí hậu, giá gốc, % tăng giá mỗi tháng, % tốc độ sản xuất. */
export function generatePlots(seed = 20261030) {
  const rand = seeded(seed);
  const { cols, rows } = LAND;
  const wobble = Array.from({ length: cols * rows }, () => rand() - 0.5);
  const zones = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) zones.push(zoneAt(c, r, wobble[r * cols + c]));
  // Lô đất liền sát biển thành "Ven biển".
  const at = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows ? null : zones[r * cols + c]);
  const plots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let zone = zones[r * cols + c];
      if (zone !== 'sea' && zone !== 'urban' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => at(c + dc, r + dr) === 'sea')) zone = 'coast';
      const flip = rand();
      let climate = {
        sea: r >= 8 ? 'windy' : 'sunny', coast: 'sunny', hill: r === 0 ? 'windy' : 'rainy', forest: 'rainy',
        river: 'rainy', urban: 'temperate', plain: r >= 5 ? 'sunny' : 'temperate',
      }[zone];
      if (flip < 0.15) climate = ['sunny', 'rainy', 'temperate', 'windy'][Math.floor(rand() * 4)];
      const base = { urban: 0.82, coast: 0.62, river: 0.52, sea: 0.5, hill: 0.34, plain: 0.28, forest: 0.24 }[zone];
      const near = 0.22 * Math.max(0, 1 - Math.hypot(c - 9.5, r - 4.5) / 10);
      const d = clamp01(base + near + (rand() - 0.5) * 0.12);
      const price = round(LAND.minPrice + (LAND.maxPrice - LAND.minPrice) * d ** 1.6, 1000);
      const growth = Math.min(LAND.maxGrowth, round(0.02 + 0.16 * d, 0.001));
      const prod = Math.min(LAND.maxProd, Math.max(0, round(0.02 + 0.14 * d + (rand() - 0.5) * 0.04, 0.001)));
      plots.push({
        id: r * cols + c + 1,
        code: `${ROW_LETTERS[r]}${String(c + 1).padStart(2, '0')}`,
        col: c, row: r, zone, climate, desirability: Math.round(d * 1000) / 1000,
        basePrice: Math.min(LAND.maxPrice, Math.max(LAND.minPrice, price)), growth, prod,
      });
    }
  }
  return plots;
}

export const PLOTS = generatePlots();

// ---------------------------------------------------------------- cấp gia tộc

/** XP cần để lên từng cấp (cấp 1 → 10). */
export const CLAN_LEVELS = [0, 2_000, 6_000, 15_000, 35_000, 70_000, 130_000, 230_000, 400_000, 700_000];
export const clanLevelOf = (xp) => CLAN_LEVELS.findLastIndex((need) => xp >= need) + 1;
export const clanPerks = (level) => ({
  maxMembers: 8 + 4 * level,
  maxPlots: 1 + 2 * level,
  /** Số ngành được thâu tóm tối đa theo cấp (trần cứng là 3). */
  maxIndustries: level >= 5 ? 3 : level >= 3 ? 2 : 1,
  prodBonus: 0.02 * (level - 1),
});
export const CLAN_EMBLEMS = ['🏯', '🐉', '🦅', '🐯', '🌸', '⚓', '🔱', '🏮', '🌾', '💎', '🦚', '🐋'];

// ---------------------------------------------------------------- 200 mẫu lắp ghép

export const DESIGN = { cols: 24, rows: 20, maxPieces: 20, cell: 10, minPieces: 3 };
export const PALETTE = ['#e85d5d', '#f29c4b', '#f2cf4b', '#8cc56b', '#4bb3a1', '#4b8ff2', '#7a6cf2', '#c46cf2', '#f27ab8', '#8b5e3c', '#c9a27a', '#f5efe0', '#9aa3ad', '#4a4e57', '#2b2d33', '#ffffff'];
const HEX = /^#[0-9a-f]{6}$/i;

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
const GLASS = '#a9dcf2';
const INK = '#3a3a48';

const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`;
const poly = (pts, fill) => `<polygon points="${pts}" fill="${fill}"/>`;
const circle = (cx, cy, r, fill) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
const line = (x1, y1, x2, y2, stroke, w = 1) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}"/>`;
const OUT = ' stroke="#00000033" stroke-width="1"';

/**
 * 20 họ mẫu × 10 biến thể = 200 mẫu. Mỗi họ có danh sách kích thước [rộng, cao] (đơn vị ô) cho 10 biến thể
 * và một hàm vẽ (W, H là kích thước tính bằng đơn vị SVG, c là màu chính, v là số biến thể).
 */
const FAMILIES = [
  {
    key: 'base', name: 'Móng nền', icon: '🧱',
    sizes: [[4, 1], [6, 1], [8, 1], [10, 1], [12, 1], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2]],
    draw: (W, H, c, v) => {
      let s = rect(0, 0, W, H, shade(c, -0.15), OUT);
      if (v >= 5) for (let x = 0; x < W; x += 20) s += rect(x + 1, 2, 18, H / 2 - 3, shade(c, 0.1)) + rect(x + 11, H / 2 + 1, 18, H / 2 - 3, shade(c, 0.05));
      else s += rect(0, 0, W, 3, shade(c, 0.2));
      return s;
    },
  },
  {
    key: 'wall_brick', name: 'Tường gạch', icon: '🧱',
    sizes: [[2, 2], [3, 3], [4, 3], [4, 4], [5, 4], [6, 4], [6, 5], [8, 4], [8, 6], [3, 6]],
    draw: (W, H, c, v) => {
      let s = rect(0, 0, W, H, c, OUT);
      const rowH = v % 2 ? 5 : 6;
      for (let y = rowH, i = 0; y < H; y += rowH, i++) {
        s += line(0, y, W, y, shade(c, -0.25));
        for (let x = (i % 2) * 6; x < W; x += 12) s += line(x, y - rowH, x, y, shade(c, -0.25));
      }
      return s;
    },
  },
  {
    key: 'wall_glass', name: 'Tường kính', icon: '🪟',
    sizes: [[2, 2], [3, 3], [4, 3], [4, 4], [5, 4], [6, 4], [6, 5], [8, 4], [8, 6], [3, 6]],
    draw: (W, H, c, v) => {
      let s = rect(0, 0, W, H, shade(c, -0.3), OUT) + rect(2, 2, W - 4, H - 4, GLASS);
      const step = v % 3 === 0 ? 10 : v % 3 === 1 ? 15 : 20;
      for (let x = step; x < W - 2; x += step) s += line(x, 2, x, H - 2, shade(c, -0.3), 2);
      for (let y = 10; y < H - 2; y += 10) s += line(2, y, W - 2, y, shade(c, -0.3), 1);
      s += poly(`4,${H - 4} ${Math.min(W - 4, 14)},4 ${Math.min(W - 4, 20)},4 10,${H - 4}`, '#ffffff55');
      return s;
    },
  },
  {
    key: 'window_sq', name: 'Cửa sổ vuông', icon: '🔲',
    sizes: [[1, 1], [2, 2], [2, 1], [1, 2], [3, 2], [2, 3], [3, 3], [2, 2], [3, 2], [4, 3]],
    draw: (W, H, c, v) => {
      let s = rect(0, 0, W, H, c, OUT) + rect(2, 2, W - 4, H - 4, GLASS);
      if (v % 2) s += line(W / 2, 2, W / 2, H - 2, c, 2) + line(2, H / 2, W - 2, H / 2, c, 2);
      if (v >= 7) s += rect(-1, H - 3, W + 2, 3, shade(c, -0.3));
      return s;
    },
  },
  {
    key: 'window_arch', name: 'Cửa sổ vòm', icon: '🪟',
    sizes: [[1, 2], [2, 2], [2, 3], [3, 3], [1, 3], [2, 4], [3, 4], [4, 4], [4, 5], [2, 2]],
    draw: (W, H, c, v) => {
      const r = W / 2;
      let s = `<path d="M0 ${H} V${r} A${r} ${r} 0 0 1 ${W} ${r} V${H} Z" fill="${c}"${OUT}/>`;
      const ir = r - 2;
      s += `<path d="M2 ${H - 2} V${r} A${ir} ${ir} 0 0 1 ${W - 2} ${r} V${H - 2} Z" fill="${GLASS}"/>`;
      if (v % 2) s += line(W / 2, 2, W / 2, H - 2, c, 1.5);
      if (v >= 5) s += line(2, r + 2, W - 2, r + 2, c, 1.5);
      return s;
    },
  },
  {
    key: 'door', name: 'Cửa ra vào', icon: '🚪',
    sizes: [[1, 2], [2, 2], [2, 3], [3, 3], [2, 2], [3, 2], [4, 3], [2, 4], [3, 4], [4, 4]],
    draw: (W, H, c, v) => {
      let s = rect(0, 0, W, H, shade(c, -0.25), OUT) + rect(2, 2, W - 4, H - 2, c);
      if (v === 5 || v === 6) for (let y = 6; y < H; y += 4) s += line(2, y, W - 2, y, shade(c, -0.3));
      else if (v === 4 || v >= 8) s += line(W / 2, 2, W / 2, H, shade(c, -0.3), 1.5) + circle(W / 2 - 3, H / 2, 1.2, '#f2cf4b') + circle(W / 2 + 3, H / 2, 1.2, '#f2cf4b');
      else s += circle(W - 5, H / 2 + 2, 1.5, '#f2cf4b');
      if (v % 3 === 2) s += rect(4, 4, W - 8, Math.min(8, H / 3), GLASS);
      return s;
    },
  },
  {
    key: 'roof_gable', name: 'Mái dốc', icon: '🔺',
    sizes: [[4, 2], [5, 2], [6, 3], [7, 3], [8, 4], [9, 4], [10, 5], [12, 5], [6, 5], [8, 6]],
    draw: (W, H, c, v) => {
      let s = poly(`0,${H} ${W / 2},0 ${W},${H}`, c);
      for (let y = 6; y < H; y += 6) {
        const half = (W / 2) * (y / H);
        s += line(W / 2 - half, y, W / 2 + half, y, shade(c, -0.25));
      }
      s += rect(0, H - 2, W, 2, shade(c, -0.35));
      if (v % 2) s += circle(W / 2, H * 0.55, Math.min(4, H / 5), GLASS);
      return s;
    },
  },
  {
    key: 'roof_flat', name: 'Mái bằng & sân thượng', icon: '▬',
    sizes: [[4, 1], [6, 1], [8, 1], [10, 1], [12, 1], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2]],
    draw: (W, H, c, v) => {
      let s = rect(0, H - 6, W, 6, c, OUT) + rect(0, H - 6, W, 2, shade(c, 0.25));
      if (v >= 5) {
        s += line(0, 2, W, 2, shade(c, -0.3), 1.5);
        for (let x = 2; x < W; x += 6) s += line(x, 2, x, H - 6, shade(c, -0.3));
      }
      return s;
    },
  },
  {
    key: 'dome', name: 'Mái vòm', icon: '🕌',
    sizes: [[2, 1], [3, 2], [4, 2], [5, 3], [6, 3], [7, 4], [8, 4], [3, 3], [4, 4], [6, 5]],
    draw: (W, H, c, v) => {
      if (v >= 7) {
        // mái củ hành
        return `<path d="M0 ${H} C0 ${H * 0.5} ${W / 2} ${H * 0.45} ${W / 2} 0 C${W / 2} ${H * 0.45} ${W} ${H * 0.5} ${W} ${H} Z" fill="${c}"${OUT}/>`
          + rect(0, H - 2, W, 2, shade(c, -0.3)) + circle(W / 2, 1.5, 1.5, '#f2cf4b');
      }
      return `<path d="M0 ${H} A${W / 2} ${H} 0 0 1 ${W} ${H} Z" fill="${c}"${OUT}/>`
        + `<path d="M${W * 0.2} ${H} A${W * 0.3} ${H * 0.8} 0 0 1 ${W * 0.5} ${H * 0.2}" fill="none" stroke="${shade(c, 0.35)}" stroke-width="1.5"/>`
        + rect(0, H - 2, W, 2, shade(c, -0.3));
    },
  },
  {
    key: 'tower', name: 'Tháp', icon: '🗼',
    sizes: [[2, 6], [2, 8], [3, 6], [3, 8], [3, 10], [4, 8], [4, 10], [2, 10], [3, 12], [4, 12]],
    draw: (W, H, c, v) => {
      let s = rect(0, 8, W, H - 8, c, OUT) + poly(`0,8 ${W / 2},0 ${W},8`, shade(c, -0.3));
      for (let y = 14; y < H - 6; y += 12) s += rect(W / 2 - 3, y, 6, 7, GLASS);
      if (v % 2) for (let y = 12; y < H; y += 12) s += rect(0, y, W, 1.5, shade(c, -0.25));
      return s;
    },
  },
  {
    key: 'chimney', name: 'Ống khói', icon: '🏭',
    sizes: [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [2, 5], [1, 5], [2, 6], [3, 6], [3, 8]],
    draw: (W, H, c, v) => {
      let s = rect(1, 3, W - 2, H - 3, c, OUT) + rect(0, 3, W, 3, shade(c, -0.3));
      for (let y = 10; y < H; y += 8) s += rect(1, y, W - 2, 2, shade(c, 0.25));
      if (v % 2) s += circle(W / 2, 1.5, 1.8, '#d9d9e0aa');
      return s;
    },
  },
  {
    key: 'balcony', name: 'Ban công', icon: '🌉',
    sizes: [[2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2]],
    draw: (W, H, c, v) => {
      let s = rect(0, H - 3, W, 3, shade(c, -0.25), OUT) + line(0, 1, W, 1, c, 2);
      for (let x = 1; x < W; x += v % 2 ? 3 : 5) s += line(x, 1, x, H - 3, c, 1.2);
      if (v >= 5) s += circle(4, H - 6, 2.5, '#8cc56b');
      return s;
    },
  },
  {
    key: 'column', name: 'Cột', icon: '🏛️',
    sizes: [[1, 3], [1, 4], [1, 5], [1, 6], [2, 4], [2, 6], [1, 8], [2, 8], [2, 10], [3, 10]],
    draw: (W, H, c, v) => {
      let s = rect(1, 3, W - 2, H - 6, c, OUT) + rect(0, 0, W, 3, shade(c, -0.2)) + rect(0, H - 3, W, 3, shade(c, -0.2));
      if (v % 2) for (let x = 3; x < W - 2; x += 3) s += line(x, 4, x, H - 4, shade(c, -0.2));
      return s;
    },
  },
  {
    key: 'sign', name: 'Biển hiệu', icon: '🪧',
    sizes: [[3, 1], [4, 1], [5, 1], [6, 1], [8, 1], [3, 2], [4, 2], [5, 2], [6, 2], [8, 2]],
    draw: (W, H, c, v) => {
      let s = rect(0, 0, W, H, c, ` rx="2"${OUT}`) + rect(2, 2, W - 4, H - 4, shade(c, 0.35), ' rx="1"');
      const n = Math.max(2, Math.floor(W / 8));
      for (let i = 0; i < n; i++) s += rect(5 + i * ((W - 10) / n), H / 2 - 1.5, (W - 10) / n - 2, 3, shade(c, -0.35));
      if (v >= 5) s += circle(4, 4, 1.5, '#f2cf4b') + circle(W - 4, 4, 1.5, '#f2cf4b');
      return s;
    },
  },
  {
    key: 'awning', name: 'Mái hiên sọc', icon: '⛱️',
    sizes: [[2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [8, 1], [3, 2], [4, 2], [6, 2], [8, 2]],
    draw: (W, H, c, v) => {
      let s = poly(`0,${H - 3} 2,0 ${W - 2},0 ${W},${H - 3}`, c);
      const stripe = v % 2 ? 4 : 6;
      for (let x = 2, i = 0; x < W - 2; x += stripe, i++) if (i % 2) s += rect(x, 0, stripe, H - 3, '#ffffff');
      for (let x = 0; x < W; x += 5) s += circle(x + 2.5, H - 3, 2.5, i2(c, x));
      return s;
    },
  },
  {
    key: 'tree', name: 'Cây xanh', icon: '🌳',
    sizes: [[1, 2], [2, 2], [2, 3], [3, 3], [3, 4], [2, 4], [3, 5], [4, 5], [4, 6], [5, 7]],
    draw: (W, H, c, v) => {
      const trunk = rect(W / 2 - 1.5, H * 0.6, 3, H * 0.4, '#8b5e3c');
      if (v % 3 === 1) return trunk + poly(`${W / 2},0 ${W},${H * 0.7} 0,${H * 0.7}`, c) + poly(`${W / 2},${H * 0.2} ${W * 0.9},${H * 0.55} ${W * 0.1},${H * 0.55}`, shade(c, 0.2));
      if (v % 3 === 2) return trunk + circle(W / 2, H * 0.35, Math.min(W, H) * 0.32, c) + circle(W * 0.3, H * 0.45, Math.min(W, H) * 0.22, shade(c, -0.15)) + circle(W * 0.7, H * 0.45, Math.min(W, H) * 0.22, shade(c, 0.15));
      return trunk + `<ellipse cx="${W / 2}" cy="${H * 0.38}" rx="${W / 2}" ry="${H * 0.38}" fill="${c}"/>` + circle(W * 0.38, H * 0.3, Math.min(W, H) * 0.12, shade(c, 0.3));
    },
  },
  {
    key: 'lamp', name: 'Đèn', icon: '🏮',
    sizes: [[1, 2], [1, 3], [1, 4], [2, 2], [2, 3], [2, 4], [1, 5], [2, 5], [3, 3], [3, 4]],
    draw: (W, H, c, v) => {
      if (v >= 8 || v === 3) {
        // đèn lồng
        return line(W / 2, 0, W / 2, 3, INK) + `<ellipse cx="${W / 2}" cy="${H / 2}" rx="${W / 2 - 0.5}" ry="${H / 2 - 3}" fill="${c}"${OUT}/>`
          + rect(W / 2 - W / 4, 3, W / 2, 2, '#f2cf4b') + rect(W / 2 - W / 4, H - 5, W / 2, 2, '#f2cf4b');
      }
      return rect(W / 2 - 1, 6, 2, H - 6, INK) + rect(W / 2 - 4, H - 2, 8, 2, INK) + poly(`${W / 2 - 4},6 ${W / 2 + 4},6 ${W / 2 + 2},0 ${W / 2 - 2},0`, c) + circle(W / 2, 5, 2, '#fff3b0');
    },
  },
  {
    key: 'silo', name: 'Bồn chứa & silo', icon: '🛢️',
    sizes: [[2, 3], [2, 4], [3, 4], [3, 5], [4, 5], [4, 6], [2, 6], [3, 7], [5, 6], [6, 6]],
    draw: (W, H, c, v) => {
      let s = rect(0, W / 2, W, H - W / 2, c, OUT) + `<path d="M0 ${W / 2} A${W / 2} ${W / 2} 0 0 1 ${W} ${W / 2} Z" fill="${shade(c, -0.2)}"/>`;
      for (let y = W / 2 + 6; y < H; y += 7) s += line(0, y, W, y, shade(c, -0.25));
      if (v % 2) s += line(W - 3, W / 2, W - 3, H, INK) + line(W - 1, W / 2, W - 1, H, INK);
      return s;
    },
  },
  {
    key: 'mast', name: 'Cột cờ & ăng-ten', icon: '🚩',
    sizes: [[1, 3], [1, 4], [2, 3], [2, 4], [2, 5], [3, 4], [3, 5], [1, 6], [3, 6], [4, 6]],
    draw: (W, H, c, v) => {
      if (v % 3 === 1) {
        // ăng-ten
        let s = line(W / 2, 2, W / 2, H, INK, 1.5);
        for (let y = 4; y < H * 0.6; y += 4) s += line(W / 2 - W * 0.4 * (1 - y / H), y, W / 2 + W * 0.4 * (1 - y / H), y, INK);
        return s + circle(W / 2, 2, 2, c);
      }
      if (v % 3 === 2) {
        // cối xay gió
        const cx = W / 2;
        const cy = H * 0.3;
        return rect(cx - 1, cy, 2, H - cy, INK) + [0, 90, 180, 270].map((a) => `<rect x="${cx - 1.2}" y="${cy - W * 0.45}" width="2.4" height="${W * 0.45}" fill="${c}" transform="rotate(${a + 20} ${cx} ${cy})"/>`).join('') + circle(cx, cy, 1.5, INK);
      }
      return line(1.5, 0, 1.5, H, INK, 1.5) + poly(`2,1 ${W},${H * 0.15} 2,${H * 0.3}`, c);
    },
  },
  {
    key: 'ornament', name: 'Trang trí', icon: '⭐',
    sizes: [[1, 1], [2, 2], [3, 3], [1, 1], [2, 2], [3, 3], [2, 2], [3, 3], [2, 2], [4, 4]],
    draw: (W, H, c, v) => {
      const cx = W / 2;
      const cy = H / 2;
      const r = Math.min(W, H) / 2 - 0.5;
      switch (v % 5) {
        case 0: { // ngôi sao
          const pts = Array.from({ length: 10 }, (_, i) => {
            const a = (Math.PI / 5) * i - Math.PI / 2;
            const rr = i % 2 ? r * 0.45 : r;
            return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
          }).join(' ');
          return poly(pts, c);
        }
        case 1: // trái tim
          return `<path d="M${cx} ${H - 1} C${-r * 0.2} ${cy} ${cx - r * 0.2} ${-r * 0.3} ${cx} ${cy * 0.6} C${cx + r * 0.2} ${-r * 0.3} ${W + r * 0.2} ${cy} ${cx} ${H - 1} Z" fill="${c}"/>`;
        case 2: // đồng hồ
          return circle(cx, cy, r, '#ffffff') + `<circle cx="${cx}" cy="${cy}" r="${r - 0.5}" fill="none" stroke="${c}" stroke-width="${Math.max(1, r / 4)}"/>` + line(cx, cy, cx, cy - r * 0.6, INK, 1) + line(cx, cy, cx + r * 0.45, cy, INK, 1);
        case 3: // kim cương
          return poly(`${cx},0 ${W},${cy * 0.7} ${cx},${H} 0,${cy * 0.7}`, c) + poly(`${cx},0 ${W},${cy * 0.7} 0,${cy * 0.7}`, shade(c, 0.3));
        default: // huy hiệu tròn
          return circle(cx, cy, r, c) + circle(cx, cy, r * 0.6, shade(c, 0.35)) + circle(cx, cy, r * 0.25, shade(c, -0.3));
      }
    },
  },
];

function i2(c, x) {
  return Math.floor(x / 5) % 2 ? '#ffffff' : c;
}

const VARIANT_NAMES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** 200 mẫu: { id, family, name, icon, w, h, cost }. id dạng 'tower-3'. */
export const PIECES = FAMILIES.flatMap((f) => f.sizes.map(([w, h], v) => ({
  id: `${f.key}-${v + 1}`, family: f.key, familyName: f.name, name: `${f.name} ${VARIANT_NAMES[v]}`, icon: f.icon, w, h, v,
  cost: round(150 + 40 * w * h, 10),
})));
export const PIECE_FAMILIES = FAMILIES.map(({ key, name, icon }) => ({ key, name, icon }));
const BY_ID = new Map(PIECES.map((p) => [p.id, p]));
const FAMILY_BY_KEY = new Map(FAMILIES.map((f) => [f.key, f]));
export const pieceById = (id) => BY_ID.get(id) ?? null;

/** Phần SVG của một mảnh (gốc tọa độ ở góc trên trái của mảnh). */
export function pieceSvg(pieceOrId, color) {
  const piece = typeof pieceOrId === 'string' ? pieceById(pieceOrId) : pieceOrId;
  if (!piece) return '';
  const fill = HEX.test(color ?? '') ? color : PALETTE[0];
  return FAMILY_BY_KEY.get(piece.family).draw(piece.w * DESIGN.cell, piece.h * DESIGN.cell, fill, piece.v);
}

/** Cả công trình thành SVG hoàn chỉnh (dùng cho bản đồ, thẻ lô đất và trình lắp ghép). */
export function designSvg(design, { width = null, background = null } = {}) {
  const W = DESIGN.cols * DESIGN.cell;
  const H = DESIGN.rows * DESIGN.cell;
  const parts = (design ?? []).map((p) => {
    const piece = pieceById(p.piece);
    if (!piece) return '';
    const x = p.x * DESIGN.cell;
    const y = p.y * DESIGN.cell;
    const flip = p.flip ? ` transform="translate(${x + piece.w * DESIGN.cell} ${y}) scale(-1 1)"` : ` transform="translate(${x} ${y})"`;
    return `<g${flip}>${pieceSvg(piece, p.color)}</g>`;
  }).join('');
  const size = width ? ` width="${width}" height="${(width * H) / W}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"${size}>${background ? rect(0, 0, W, H, background) : ''}${parts}</svg>`;
}

/**
 * Kiểm tra và làm sạch một thiết kế: tối đa 20 mảnh, mảnh có thật, nằm trong khung 24×20 ô, màu dạng #rrggbb.
 * Ném Error (thông báo tiếng Việt) nếu sai; trả về thiết kế đã chuẩn hóa.
 */
export function cleanDesign(input) {
  if (!Array.isArray(input)) throw new Error('Thiết kế không hợp lệ.');
  if (input.length > DESIGN.maxPieces) throw new Error(`Mỗi công trình ghép tối đa ${DESIGN.maxPieces} mảnh.`);
  return input.map((raw, i) => {
    const piece = pieceById(String(raw?.piece ?? ''));
    if (!piece) throw new Error(`Mảnh thứ ${i + 1} không có trong bộ mẫu.`);
    const x = Number(raw.x);
    const y = Number(raw.y);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + piece.w > DESIGN.cols || y + piece.h > DESIGN.rows) {
      throw new Error(`${piece.name} nằm ngoài khung lắp ghép.`);
    }
    const color = String(raw.color ?? '').toLowerCase();
    if (!HEX.test(color)) throw new Error(`Màu của ${piece.name} không hợp lệ.`);
    return { piece: piece.id, x, y, color, flip: Boolean(raw.flip) };
  });
}

/** Tổng giá các mảnh của một thiết kế. */
export const designCost = (design) => design.reduce((sum, p) => sum + (pieceById(p.piece)?.cost ?? 0), 0);

/** Công trình hoàn chỉnh (đủ để vận hành) khi có ít nhất 3 mảnh, trong đó có móng nền. */
export const designComplete = (design) => design.length >= DESIGN.minPieces && design.some((p) => pieceById(p.piece)?.family === 'base');

/** Thưởng sản lượng của công trình: +0,5% mỗi mảnh, tối đa +10%. */
export const designBonus = (design) => (designComplete(design) ? Math.min(0.1, 0.005 * design.length) : 0);

// ---------------------------------------------------------------- vĩ mô

export const PHASES = {
  recovery: { name: 'Phục hồi', icon: '🌱', factor: 1, land: 0.002, traffic: 0 },
  boom: { name: 'Tăng trưởng nóng', icon: '🚀', factor: 1.12, land: 0.008, traffic: 0.1 },
  peak: { name: 'Đỉnh chu kỳ', icon: '⛰️', factor: 1.05, land: 0.003, traffic: 0.05 },
  recession: { name: 'Suy thoái', icon: '🌧️', factor: 0.85, land: -0.008, traffic: -0.1 },
};
/** Xác suất chuyển pha mỗi ngày. */
export const PHASE_NEXT = {
  recovery: { boom: 0.12 },
  boom: { peak: 0.1 },
  peak: { recession: 0.14, boom: 0.04 },
  recession: { recovery: 0.12 },
};

/**
 * Thời tiết theo ngày: nhân sản lượng theo địa hình/khí hậu và đẩy giá một số hàng trên Sàn
 * (`news`: { mã hàng: % giá }).
 */
export const WEATHER = {
  calm: { name: 'Trời yên biển lặng', icon: '🌤️', zones: {}, climates: {}, news: {}, weight: 5 },
  perfect: { name: 'Thời tiết thuận lợi', icon: '🌈', zones: { plain: 0.08, hill: 0.08, river: 0.08, coast: 0.05 }, climates: {}, news: { tea_leaf: -0.06, strawberry: -0.06 }, weight: 1.2 },
  heatwave: { name: 'Nắng nóng kéo dài', icon: '🔥', zones: { plain: -0.06 }, climates: { sunny: -0.15, rainy: 0.05 }, news: { cane: 0.1, milk: 0.08 }, weight: 1 },
  monsoon: { name: 'Mưa lớn nhiều ngày', icon: '🌧️', zones: { sea: -0.15, coast: -0.08 }, climates: { rainy: -0.12, sunny: 0.04 }, news: { tea_leaf: 0.1, strawberry: 0.12 }, weight: 1 },
  storm: { name: 'Bão biển', icon: '🌀', zones: { sea: -0.4, coast: -0.2, river: -0.08 }, climates: { windy: -0.1 }, news: { fish: 0.2 }, weight: 0.6 },
  cold: { name: 'Rét đậm', icon: '🥶', zones: { hill: -0.15, forest: -0.08 }, climates: { windy: -0.06 }, news: { strawberry: 0.1, tea_leaf: 0.06 }, weight: 0.7 },
};

/** Hệ số thời tiết cho một lô. */
export function weatherFactor(weather, zone, climate) {
  const w = WEATHER[weather] ?? WEATHER.calm;
  return Math.max(0.3, 1 + (w.zones[zone] ?? 0) + (w.climates[climate] ?? 0));
}

/** Hệ số cạnh tranh: mỗi gia tộc khác cùng ngành làm sản lượng giảm. */
export const competitionFactor = (clansInIndustry) => 1 / (1 + 0.15 * Math.max(0, clansInIndustry - 1));

/** Hệ số khan hiếm quỹ đất: bán càng nhiều thì giá lô còn lại càng tăng mạnh (k = 2: hết đất thì gấp 3). */
export const scarcityFactor = (soldRatio, k = 2) => 1 + k * Math.max(0, Math.min(1, soldRatio)) ** 2.5;
