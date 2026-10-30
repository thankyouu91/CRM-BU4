// Chuỗi sản xuất của gia tộc: hàng hóa (khoáng sản, lâm sản, nông sản, điện, hàng công nghiệp), mỏ và tài nguyên
// trên từng lô đất (sinh cố định theo địa hình), các ngành mới (khai thác, nông nghiệp, năng lượng, công nghiệp
// nhẹ, công nghiệp nặng) và công thức của chúng. Dùng chung cho máy chủ (quyết toán) và trình duyệt (hiển thị).
// File này không import clan.js; clan.js gộp các ngành ở đây vào INDUSTRIES.

/** Hàng hóa: giá gốc (xu/đơn vị) và nhóm. Giá thật = giá gốc × cầu của ngành làm ra nó (vĩ mô). */
export const GOODS = {
  // khoáng sản
  iron_ore: { name: 'Quặng sắt', icon: '🪨', group: 'mineral', base: 40 },
  coal: { name: 'Than đá', icon: '⚫', group: 'mineral', base: 30 },
  copper: { name: 'Đồng', icon: '🟠', group: 'mineral', base: 60 },
  bauxite: { name: 'Bô-xít', icon: '🟤', group: 'mineral', base: 45 },
  tin: { name: 'Thiếc', icon: '🔩', group: 'mineral', base: 70 },
  silicon: { name: 'Cát silic', icon: '⬜', group: 'mineral', base: 50 },
  salt: { name: 'Muối', icon: '🧂', group: 'mineral', base: 15 },
  silver: { name: 'Bạc', icon: '🥈', group: 'mineral', base: 200 },
  gold: { name: 'Vàng', icon: '🥇', group: 'mineral', base: 400 },
  titanium: { name: 'Titan', icon: '🔷', group: 'mineral', base: 250 },
  rare_earth: { name: 'Đất hiếm', icon: '✴️', group: 'mineral', base: 300 },
  uranium: { name: 'Urani', icon: '☢️', group: 'mineral', base: 500 },
  diamond: { name: 'Kim cương', icon: '💎', group: 'mineral', base: 900 },
  crude_oil: { name: 'Dầu thô', icon: '🛢️', group: 'mineral', base: 80 },
  gas: { name: 'Khí đốt', icon: '💨', group: 'mineral', base: 60 },
  // lâm sản & nông sản
  timber: { name: 'Gỗ', icon: '🪵', group: 'forest', base: 35 },
  rubber: { name: 'Cao su', icon: '🌳', group: 'forest', base: 55 },
  wheat: { name: 'Lúa mì', icon: '🌾', group: 'farm', base: 20 },
  rice: { name: 'Lúa gạo', icon: '🍚', group: 'farm', base: 22 },
  maize: { name: 'Ngô', icon: '🌽', group: 'farm', base: 18 },
  cotton: { name: 'Bông', icon: '☁️', group: 'farm', base: 30 },
  beans: { name: 'Đậu', icon: '🫘', group: 'farm', base: 20 },
  potatoes: { name: 'Khoai tây', icon: '🥔', group: 'farm', base: 15 },
  beef: { name: 'Thịt bò', icon: '🥩', group: 'farm', base: 90 },
  chicken: { name: 'Gà', icon: '🍗', group: 'farm', base: 45 },
  // năng lượng
  power: { name: 'Điện', icon: '⚡', group: 'energy', base: 25 },
  // công nghiệp
  steel: { name: 'Thép', icon: '🔗', group: 'heavy', base: 230 },
  aluminium: { name: 'Nhôm', icon: '🥫', group: 'heavy', base: 230 },
  fuel: { name: 'Xăng dầu', icon: '⛽', group: 'heavy', base: 220 },
  chemicals: { name: 'Hóa chất', icon: '🧪', group: 'heavy', base: 160 },
  chips: { name: 'Vi mạch', icon: '💾', group: 'heavy', base: 750 },
  machinery: { name: 'Máy móc', icon: '⚙️', group: 'heavy', base: 1000 },
  autos: { name: 'Ô tô', icon: '🚗', group: 'heavy', base: 2100 },
  trains: { name: 'Tàu hỏa', icon: '🚆', group: 'heavy', base: 2200 },
  ships: { name: 'Tàu thủy', icon: '🚢', group: 'heavy', base: 2600 },
  aircraft: { name: 'Máy bay', icon: '✈️', group: 'heavy', base: 4000 },
  computers: { name: 'Máy tính', icon: '💻', group: 'light', base: 2300 },
  medicine: { name: 'Thuốc', icon: '💊', group: 'light', base: 450 },
  clothing: { name: 'Quần áo', icon: '👕', group: 'light', base: 160 },
  furniture: { name: 'Nội thất', icon: '🪑', group: 'light', base: 160 },
  processed_food: { name: 'Thực phẩm chế biến', icon: '🥫', group: 'light', base: 120 },
};
export const GOOD_ORDER = Object.keys(GOODS);

export const SECTORS = {
  service: { name: 'Dịch vụ & tiêu dùng', icon: '🏪' },
  raw: { name: 'Khai thác & nông nghiệp', icon: '⛏️' },
  energy: { name: 'Năng lượng', icon: '⚡' },
  light: { name: 'Công nghiệp nhẹ', icon: '🧵' },
  heavy: { name: 'Công nghiệp nặng', icon: '🏭' },
  strategic: { name: 'Hạ tầng chiến lược & nhà nước', icon: '🏛️' },
};

// Bảng hợp đất dùng chung cho các ngành mới (cộng vào hệ số môi trường như các ngành cũ).
const OPEN_LAND = { plain: 0.1, river: 0.08, coast: 0.05, urban: -0.05, hill: -0.1, forest: -0.15, sea: -0.6 };
const FACTORY_LAND = { urban: 0.12, river: 0.1, coast: 0.08, plain: 0.05, hill: -0.1, forest: -0.15, sea: -0.5 };
const MILD = { temperate: 0.04, sunny: 0, rainy: -0.02, windy: -0.02 };

/**
 * Ngành mới. `extracts`: nhóm tài nguyên khai thác từ mỏ trên lô. `recipe`: { in: {hàng: số}, out: {hàng: số} } mỗi mẻ,
 * `batches`: số mẻ tối đa mỗi đêm của một lô (trước các hệ số). `plants`: ngành điện chọn loại nhà máy cho từng lô.
 */
export const PRODUCTION_INDUSTRIES = {
  mining: {
    name: 'Khai khoáng', icon: '⛏️', sector: 'raw', comp: 30_000, extracts: 'mineral', commodities: [],
    zones: { hill: 0.25, coast: 0, forest: -0.05, plain: -0.05, river: -0.05, urban: -0.4, sea: -0.2 }, climates: MILD,
  },
  oil_gas: {
    name: 'Dầu khí', icon: '🛢️', sector: 'raw', comp: 45_000, extracts: 'oilgas', commodities: [],
    zones: { sea: 0.2, coast: 0.1, plain: 0, river: -0.05, hill: -0.1, forest: -0.1, urban: -0.4 }, climates: { windy: -0.05, sunny: 0, rainy: -0.03, temperate: 0.02 },
  },
  forestry: {
    name: 'Lâm nghiệp', icon: '🪓', sector: 'raw', comp: 20_000, extracts: 'forest', commodities: [],
    zones: { forest: 0.25, hill: 0.05, river: 0, plain: -0.1, coast: -0.15, urban: -0.5, sea: -0.6 }, climates: { rainy: 0.1, temperate: 0.04, sunny: -0.04, windy: -0.04 },
  },
  agriculture: {
    name: 'Nông nghiệp', icon: '🚜', sector: 'raw', comp: 20_000, extracts: 'crop', commodities: [],
    zones: OPEN_LAND, climates: { temperate: 0.08, sunny: 0.06, rainy: 0.02, windy: -0.06 },
  },
  livestock: {
    name: 'Chăn nuôi', icon: '🐄', sector: 'raw', comp: 25_000, extracts: 'livestock', commodities: [],
    zones: { plain: 0.15, hill: 0.05, river: 0.05, forest: -0.05, coast: -0.05, urban: -0.4, sea: -0.6 }, climates: MILD,
  },
  power: {
    name: 'Năng lượng', icon: '⚡', sector: 'energy', comp: 30_000, commodities: [],
    zones: { river: 0.05, plain: 0.05, coast: 0.05, hill: 0.05, forest: -0.05, urban: -0.05, sea: 0 }, climates: { sunny: 0, windy: 0, rainy: 0, temperate: 0 },
    plants: {
      coal: { name: 'Nhiệt điện than', icon: '🏭', in: { coal: 1 }, out: { power: 4 } },
      gas: { name: 'Nhiệt điện khí', icon: '🔥', in: { gas: 1 }, out: { power: 4 } },
      hydro: { name: 'Thủy điện', icon: '💧', in: {}, out: { power: 5 }, zones: ['river'] },
      solar: { name: 'Điện mặt trời', icon: '☀️', in: {}, out: { power: 4 }, climates: ['sunny'] },
      wind: { name: 'Điện gió', icon: '🌬️', in: {}, out: { power: 4 }, climates: ['windy'] },
      nuclear: { name: 'Điện hạt nhân', icon: '☢️', in: { uranium: 1 }, out: { power: 20 } },
    },
    batches: 6,
  },
  food_processing: {
    name: 'Chế biến thực phẩm', icon: '🥫', sector: 'light', comp: 30_000, commodities: [], zones: FACTORY_LAND, climates: MILD,
    recipe: { in: { wheat: 1, beef: 1, power: 1 }, out: { processed_food: 2 } }, batches: 6,
  },
  textiles: {
    name: 'Dệt may', icon: '👕', sector: 'light', comp: 35_000, commodities: [], zones: FACTORY_LAND, climates: MILD,
    recipe: { in: { cotton: 3, power: 1 }, out: { clothing: 1 } }, batches: 6,
  },
  furniture: {
    name: 'Đồ gỗ nội thất', icon: '🪑', sector: 'light', comp: 35_000, commodities: [], zones: FACTORY_LAND, climates: MILD,
    recipe: { in: { timber: 3, power: 1 }, out: { furniture: 1 } }, batches: 6,
  },
  pharma: {
    name: 'Dược phẩm', icon: '💊', sector: 'light', comp: 45_000, commodities: [], zones: FACTORY_LAND, climates: MILD,
    recipe: { in: { chemicals: 2, beans: 1, power: 1 }, out: { medicine: 1 } }, batches: 4,
  },
  electronics: {
    name: 'Điện tử, máy tính', icon: '💻', sector: 'light', comp: 50_000, commodities: [], zones: FACTORY_LAND, climates: MILD,
    recipe: { in: { chips: 2, aluminium: 1, power: 1 }, out: { computers: 1 } }, batches: 3,
  },
  steel: {
    name: 'Luyện thép', icon: '🔗', sector: 'heavy', comp: 40_000, commodities: [], zones: FACTORY_LAND, climates: MILD,
    recipe: { in: { iron_ore: 2, coal: 1, power: 2 }, out: { steel: 1 } }, batches: 5,
  },
  aluminium: {
    name: 'Luyện nhôm', icon: '🥫', sector: 'heavy', comp: 40_000, commodities: [], zones: FACTORY_LAND, climates: MILD,
    recipe: { in: { bauxite: 2, power: 3 }, out: { aluminium: 1 } }, batches: 5,
  },
  refinery: {
    name: 'Lọc dầu', icon: '⛽', sector: 'heavy', comp: 45_000, commodities: [], zones: { ...FACTORY_LAND, coast: 0.15, sea: 0 }, climates: MILD,
    recipe: { in: { crude_oil: 2, power: 1 }, out: { fuel: 1 } }, batches: 5,
  },
  chemicals: {
    name: 'Hóa chất', icon: '🧪', sector: 'heavy', comp: 40_000, commodities: [], zones: FACTORY_LAND, climates: MILD,
    recipe: { in: { gas: 1, salt: 2, power: 1 }, out: { chemicals: 1 } }, batches: 5,
  },
  semiconductors: {
    name: 'Vi mạch', icon: '💾', sector: 'heavy', comp: 50_000, commodities: [], zones: FACTORY_LAND, climates: MILD,
    recipe: { in: { silicon: 2, rare_earth: 1, copper: 1, power: 2 }, out: { chips: 1 } }, batches: 3,
  },
  machinery: {
    name: 'Cơ khí, máy móc', icon: '⚙️', sector: 'heavy', comp: 45_000, commodities: [], zones: FACTORY_LAND, climates: MILD,
    recipe: { in: { steel: 3, copper: 1, power: 2 }, out: { machinery: 1 } }, batches: 3,
  },
  autos: {
    name: 'Ô tô', icon: '🚗', sector: 'heavy', comp: 50_000, commodities: [], zones: FACTORY_LAND, climates: MILD,
    recipe: { in: { steel: 2, rubber: 2, machinery: 1, power: 2 }, out: { autos: 1 } }, batches: 2,
  },
  trains: {
    name: 'Tàu hỏa', icon: '🚆', sector: 'heavy', comp: 50_000, commodities: [], zones: FACTORY_LAND, climates: MILD,
    recipe: { in: { steel: 4, machinery: 1, power: 2 }, out: { trains: 1 } }, batches: 2,
  },
  shipbuilding: {
    name: 'Đóng tàu', icon: '🚢', sector: 'heavy', comp: 50_000, commodities: [], zones: { coast: 0.25, sea: 0.1, river: 0.05, urban: -0.1, plain: -0.3, hill: -0.5, forest: -0.5 }, climates: MILD,
    recipe: { in: { steel: 5, timber: 2, machinery: 1, power: 2 }, out: { ships: 1 } }, batches: 2,
  },
  aerospace: {
    name: 'Hàng không', icon: '✈️', sector: 'heavy', comp: 50_000, commodities: [], zones: FACTORY_LAND, climates: { sunny: 0.05, temperate: 0.05, rainy: -0.05, windy: -0.08 },
    recipe: { in: { aluminium: 4, titanium: 2, chips: 1, fuel: 1, power: 3 }, out: { aircraft: 1 } }, batches: 1,
  },
};

/** Ngành nào làm ra hàng nào (để lấy cầu vĩ mô làm giá). Hàng thô theo ngành khai thác. */
export const GOOD_INDUSTRY = (() => {
  const map = {};
  for (const [id, ind] of Object.entries(PRODUCTION_INDUSTRIES)) for (const g of Object.keys(ind.recipe?.out ?? {})) map[g] = id;
  map.power = 'power';
  for (const [g, def] of Object.entries(GOODS)) {
    if (map[g]) continue;
    if (g === 'crude_oil' || g === 'gas') map[g] = 'oil_gas';
    else if (def.group === 'mineral') map[g] = 'mining';
    else if (def.group === 'forest') map[g] = 'forestry';
    else if (g === 'beef' || g === 'chicken') map[g] = 'livestock';
    else map[g] = 'agriculture';
  }
  return map;
})();

/** Thứ tự chạy trong đêm: khai thác, điện, rồi nhà máy từ thượng nguồn tới hạ nguồn. */
export const RUN_ORDER = [
  'mining', 'oil_gas', 'forestry', 'agriculture', 'livestock', 'power',
  'steel', 'aluminium', 'refinery', 'chemicals', 'semiconductors', 'food_processing', 'textiles', 'furniture',
  'machinery', 'pharma', 'electronics', 'autos', 'trains', 'shipbuilding', 'aerospace',
];

// ---------------------------------------------------------------- mỏ và tài nguyên trên từng lô

const MINERALS = [
  ['iron_ore', 6, [6, 10]], ['coal', 6, [6, 10]], ['copper', 4, [4, 7]], ['bauxite', 4, [5, 8]], ['tin', 3, [3, 6]],
  ['silver', 2, [2, 4]], ['gold', 1.5, [1, 3]], ['titanium', 1.5, [2, 3]], ['rare_earth', 1.2, [1, 3]], ['uranium', 0.6, [1, 2]], ['diamond', 0.4, [1, 1]],
];

function hash(n) {
  let a = (n * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(list, rand) {
  let r = rand() * list.reduce((s, [, w]) => s + w, 0);
  for (const item of list) {
    r -= item[1];
    if (r <= 0) return item;
  }
  return list[0];
}

const range = ([lo, hi], rand) => lo + Math.floor(rand() * (hi - lo + 1));

/**
 * Tài nguyên của một lô: { hàng: số đơn vị mỗi đêm } theo địa hình và khí hậu, cố định theo mã lô.
 * Lô trung tâm không có mỏ nhưng nhà máy ở đó chạy nhanh hơn.
 */
export function depositsOf(plot) {
  const rand = hash(plot.id * 97 + 13);
  const out = {};
  const add = (good, qty) => {
    out[good] = (out[good] ?? 0) + qty;
  };
  switch (plot.zone) {
    case 'hill': {
      const first = pickWeighted(MINERALS, rand);
      add(first[0], range(first[2], rand));
      if (rand() < 0.6) {
        const second = pickWeighted(MINERALS.filter((m) => m[0] !== first[0]), rand);
        add(second[0], range(second[2], rand));
      }
      add('timber', 2);
      break;
    }
    case 'forest':
      add('timber', range([7, 11], rand));
      if (rand() < 0.5) add('rubber', range([3, 6], rand));
      if (rand() < 0.2) add('coal', range([3, 5], rand));
      break;
    case 'plain': {
      const crop = plot.climate === 'sunny' ? ['cotton', 'maize'] : plot.climate === 'rainy' ? ['beans', 'potatoes'] : ['wheat', 'beans'];
      add(crop[0], range([8, 12], rand));
      add(crop[1], range([5, 8], rand));
      add(rand() < 0.5 ? 'beef' : 'chicken', range([2, 4], rand));
      if (rand() < 0.15) add('gas', range([3, 5], rand));
      break;
    }
    case 'river':
      add('rice', range([9, 13], rand));
      add('beans', range([3, 5], rand));
      if (rand() < 0.3) add('chicken', range([2, 4], rand));
      break;
    case 'coast':
      add('salt', range([6, 10], rand));
      add('silicon', range([4, 7], rand));
      if (rand() < 0.35) add('crude_oil', range([3, 6], rand));
      break;
    case 'sea':
      add(rand() < 0.55 ? 'crude_oil' : 'gas', range([5, 9], rand));
      add('salt', range([3, 6], rand));
      break;
    default:
  }
  return out;
}

/** Nhóm tài nguyên mà mỗi ngành khai thác được lấy từ mỏ của lô. */
export function extractable(industry, deposits) {
  const kind = PRODUCTION_INDUSTRIES[industry]?.extracts;
  if (!kind) return {};
  const pick = Object.entries(deposits).filter(([g]) => {
    const group = GOODS[g].group;
    if (kind === 'mineral') return group === 'mineral' && g !== 'crude_oil' && g !== 'gas';
    if (kind === 'oilgas') return g === 'crude_oil' || g === 'gas';
    if (kind === 'forest') return group === 'forest';
    if (kind === 'livestock') return g === 'beef' || g === 'chicken';
    return group === 'farm' && g !== 'beef' && g !== 'chicken';
  });
  return Object.fromEntries(pick);
}

/** Loại nhà máy điện dựng được trên một lô (thủy điện cần sông, mặt trời cần nắng, gió cần gió). */
export function plantsFor(plot) {
  return Object.entries(PRODUCTION_INDUSTRIES.power.plants)
    .filter(([, p]) => (!p.zones || p.zones.includes(plot.zone)) && (!p.climates || p.climates.includes(plot.climate)))
    .map(([id]) => id);
}

/** Công thức một mẻ của lô: ngành nhà máy dùng recipe; ngành điện theo loại nhà máy đã chọn. */
export function recipeOf(industry, variant) {
  const ind = PRODUCTION_INDUSTRIES[industry];
  if (!ind) return null;
  if (industry === 'power') {
    const plant = ind.plants[variant];
    return plant ? { in: plant.in, out: plant.out } : null;
  }
  return ind.recipe ?? null;
}

export const MARKET_RULES = {
  /** Giá NPC thu mua = giá gốc × cầu × hệ số này; nhập khẩu từ NPC = giá gốc × cầu × importMarkup. */
  npcBuy: 0.85,
  importMarkup: 1.3,
  /** Giá đăng bán trên sàn chung trong khoảng [50%, 200%] giá tham chiếu. */
  band: [0.5, 2],
  fee: 0.02,
  /** Sức chứa kho mỗi gia tộc (đơn vị) theo cấp: base + perLevel × cấp. */
  warehouseBase: 2_000,
  warehousePerLevel: 500,
  maxListings: 10,
  listingDays: 3,
};

// ---------------------------------------------------------------- hạ tầng chiến lược & ngành nhà nước

/**
 * Ngành chiến lược không làm ra hàng: gia tộc nắm ngành xây hạ tầng (cấp 1–4) tạo buff +10–40% cho TOÀN server.
 * Ai hưởng buff thì trả phí hạ tầng = 20% phần tăng thêm cho gia tộc chủ; hết tiền trả phí thì không được buff.
 * Mỗi gia tộc nắm tối đa 1 ngành chiến lược; mỗi ngành có số gia tộc chủ tối đa `maxClans`.
 *   irrigation  Trị thủy: sản lượng trồng trọt, chăn nuôi, lâm nghiệp của gia tộc và vụ thu hoạch vườn của người chơi.
 *   wind_farm   Năng lượng gió: số mẻ nhà máy, xu gia tộc thu từ bán hàng, thu nhập mua bán cá nhân (Sàn, Chợ Phiên).
 *               Thành viên gia tộc chủ được thêm +10%; pet huyền thoại đứng máy thêm 10–30% theo hành.
 *   state_bank  Ngân hàng nhà nước: lãi tiết kiệm và lãi kỳ hạn của người chơi.
 *   tax_office  Thuế vụ: được xem hồ sơ khai thiếu của gia tộc khác và đi truy thu, hưởng hoa hồng 10–40%.
 */
const NOWHERE_SEA = { sea: -0.5 };
export const STRATEGIC_INDUSTRIES = {
  irrigation: {
    name: 'Trị thủy', icon: '🌊', sector: 'strategic', comp: 50_000, maxClans: 3, commodities: [],
    zones: { river: 0.15, plain: 0.05, hill: 0.05, forest: 0, coast: 0, urban: -0.2, ...NOWHERE_SEA }, climates: MILD,
    places: ['river', 'plain', 'hill'], effect: 'Sản lượng trồng trọt, chăn nuôi, lâm nghiệp và thu hoạch vườn',
  },
  wind_farm: {
    name: 'Năng lượng gió', icon: '🌬️', sector: 'strategic', comp: 50_000, maxClans: 3, commodities: [],
    zones: { coast: 0.15, sea: 0.1, hill: 0.05, plain: 0, river: 0, forest: -0.1, urban: -0.2 }, climates: { windy: 0.15, sunny: 0, temperate: 0, rainy: -0.05 },
    places: ['coast', 'sea', 'hill', 'plain'], climatesOk: ['windy'], effect: 'Số mẻ nhà máy, xu từ bán hàng và thu nhập mua bán cá nhân',
  },
  state_bank: {
    name: 'Ngân hàng nhà nước', icon: '🏦', sector: 'strategic', comp: 50_000, maxClans: 1, commodities: [],
    zones: { urban: 0.2, river: 0, plain: -0.1, coast: 0, hill: -0.3, forest: -0.3, sea: -0.5 }, climates: MILD,
    places: ['urban'], effect: 'Lãi tiết kiệm và lãi gửi kỳ hạn của người chơi',
  },
  tax_office: {
    name: 'Thuế vụ', icon: '🧾', sector: 'strategic', comp: 50_000, maxClans: 1, commodities: [],
    zones: { urban: 0.2, river: 0, plain: -0.1, coast: 0, hill: -0.3, forest: -0.3, sea: -0.5 }, climates: MILD,
    places: ['urban'], effect: 'Truy thu thuế các gia tộc khai thiếu, hưởng hoa hồng',
  },
};

export const STRATEGIC_RULES = {
  /** Cấp hạ tầng: buff (hoặc hoa hồng truy thu) và chi phí nâng lên cấp đó. */
  levels: [{ buff: 0.1, cost: 0 }, { buff: 0.2, cost: 150_000 }, { buff: 0.3, cost: 400_000 }, { buff: 0.4, cost: 900_000 }],
  /** Phí hạ tầng: phần trăm của phần tăng thêm nhờ buff. */
  fee: 0.2,
  /** Trần khi nhiều gia tộc cùng nắm một ngành (xem combinedBuff). */
  softCap: 0.6,
  /** Thành viên gia tộc chủ Năng lượng gió được thêm. */
  ownerMemberBonus: 0.1,
  /** Pet huyền thoại đứng máy ở trang trại gió: thêm theo hành của pet. */
  operatorBonus: { kim: 0.3, hoa: 0.25, moc: 0.2, thuy: 0.15, tho: 0.1 },
  /** Tiền phạt khi Thuế vụ truy thu (cộng vào phần thuế trốn). */
  collectPenalty: 0.5,
};

/** Lô nào dựng được hạ tầng của ngành chiến lược này. */
export function strategicPlaceOk(industry, plot) {
  const def = STRATEGIC_INDUSTRIES[industry];
  if (!def) return false;
  return def.places.includes(plot.zone) || (def.climatesOk ?? []).includes(plot.climate);
}

/** Gộp buff của nhiều gia tộc chủ: lấy mức cao nhất, cộng 25% phần của các gia tộc còn lại, trần `softCap`. */
export function combinedBuff(buffs, cap = STRATEGIC_RULES.softCap) {
  if (!buffs.length) return 0;
  const top = Math.max(...buffs);
  const rest = buffs.reduce((s, b) => s + b, 0) - top;
  return Math.min(cap, top + 0.25 * rest);
}

// ---------------------------------------------------------------- vòng đời vật phẩm thiết yếu (đồ ăn)

/**
 * Chỉ số tự chủ thực phẩm D (0–90%): phần nhu cầu đồ ăn do người chơi cung cấp qua chuỗi Chế biến thực phẩm.
 * Siêu thị mua "Thực phẩm chế biến" của gia tộc mỗi đêm (1 đơn vị = 5 "Suất ăn gia tộc") rồi bán lại cho người chơi.
 * Đồ ăn NPC vẫn bán nhưng: mỗi người mỗi ngày chỉ được mua phần (1 − D) nhu cầu (NPC luôn giữ tối thiểu 10%),
 * XP của đồ NPC giảm theo giai đoạn, giá tăng nhẹ khi D cao. Tài khoản mới 7 ngày đầu được miễn mọi giới hạn.
 */
export const ESSENTIALS = {
  mealsPerUnit: 5,
  /** Phần nhu cầu NPC luôn giữ (chủ game chốt 10%). */
  npcFloor: 0.1,
  /** D thay đổi tối đa mỗi ngày, để không sốc giá. */
  maxDailyShift: 0.1,
  mealsPerPetDay: 3,
  /** Mỗi gia tộc bán cho Siêu thị tối đa 40% lượng thu mua của một đêm (chống độc quyền). */
  perClanShare: 0.4,
  /** Siêu thị trả bằng giá tham chiếu (cao hơn NPC thu mua 85%). */
  buyPrice: 1,
  /** Giá bán lẻ suất ăn = giá tham chiếu một đơn vị / 5 × hệ số này. */
  mealMarkup: 1.15,
  newbieDays: 7,
  stages: [
    { key: 'pioneer', name: 'Khai hoang', icon: '🌱', from: 0 },
    { key: 'growing', name: 'Phát triển', icon: '🏗️', from: 0.2 },
    { key: 'self', name: 'Tự chủ', icon: '🏆', from: 0.8 },
  ],
  /** Giá đồ ăn NPC tăng tới +30% khi D đi từ 20% lên 80%. */
  npcPriceUp: 0.3,
};

export const essentialStage = (d) => ESSENTIALS.stages.findLast((s) => d >= s.from);

/** Hệ số XP của đồ ăn NPC theo D: khai hoang 50%, phát triển giảm dần về 25%, tự chủ 10%. */
export function npcXpFactor(d) {
  if (d < 0.2) return 0.5;
  if (d < 0.8) return 0.5 - ((d - 0.2) / 0.6) * 0.25;
  return 0.1;
}
export const npcPriceFactor = (d) => 1 + ESSENTIALS.npcPriceUp * Math.min(1, Math.max(0, (d - 0.2) / 0.6));
