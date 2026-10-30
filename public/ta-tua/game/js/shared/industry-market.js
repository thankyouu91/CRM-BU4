// Tác động của các ngành gia tộc thâu tóm lên Sàn Nguyên Liệu. Dùng chung cho máy chủ (tính giá) và trình duyệt (giải thích).
//
// Mỗi ngành có thể:
// - `supply`: làm ra hàng → cung tăng → giá trung bình của hàng đó giảm;
// - `demand`: tiêu thụ hàng → cầu tăng → giá trung bình tăng;
// - `cost`: hạ chi phí chế biến (điện, nhiên liệu) → giá hàng chế biến giảm;
// - `stabilize`: giao vận, thông tin, máy móc → biến động giá của mọi hàng (hoặc hàng được nêu) dịu đi.
// Độ mạnh của một ngành = số gia tộc đang nắm và số lô đất đang chạy của ngành đó (tối đa 1).
// Ngành chưa ai nắm thì độ mạnh 0: hàng của nó chạy theo thị trường bình thường.

const RAW = ['tea_leaf', 'milk', 'cassava', 'cane', 'strawberry', 'fish', 'pork', 'mango'];
const PROCESSED = ['dried_tea', 'pearl', 'sugar', 'condensed'];

export const INDUSTRY_MARKET = {
  // ---- khối dịch vụ & tiêu dùng ----
  tea: { supply: ['tea_leaf', 'dried_tea'] },
  dairy: { supply: ['milk', 'condensed'] },
  sugar: { supply: ['cane', 'sugar'] },
  pearl: { supply: ['cassava', 'pearl'] },
  fruit: { supply: ['strawberry', 'mango'] },
  fishery: { supply: ['fish'] },
  beverage: { demand: ['pearl', 'milk', 'tea_leaf', 'sugar'] },
  food: { demand: ['fish', 'pork', 'strawberry', 'mango'] },
  logistics: { stabilize: [...RAW, ...PROCESSED] },
  education: { stabilize: [...RAW, ...PROCESSED], weight: 0.5 },
  entertainment: { demand: ['strawberry', 'mango', 'pearl'], weight: 0.6 },
  // ---- khối sản xuất (đã gộp các ngành na ná nhau) ----
  mining: { demand: ['pork', 'fish', 'cassava'], cost: PROCESSED, weight: 0.4 }, // thợ mỏ ăn nhiều; khí đốt hạ chi phí chế biến
  forestry: { demand: ['pork', 'cassava'], weight: 0.3 },
  agriculture: { supply: ['cane', 'cassava', 'tea_leaf', 'mango', 'milk', 'pork'] },
  power: { cost: PROCESSED },
  consumer_goods: { demand: ['cane', 'cassava', 'milk', 'tea_leaf'], supply: PROCESSED, weight: 0.8 },
  pharma: { demand: ['strawberry', 'tea_leaf'], weight: 0.4 },
  electronics: { demand: ['milk', 'pearl', 'sugar'], weight: 0.3 },
  metallurgy: { demand: ['pork', 'fish', 'cassava'], weight: 0.3 },
  petrochem: { cost: PROCESSED, supply: ['tea_leaf', 'cane', 'cassava', 'strawberry'], weight: 0.6 }, // nhiên liệu và phân bón
  machinery: { supply: ['cane', 'cassava', 'tea_leaf'], weight: 0.4, stabilize: RAW },
  vehicles: { stabilize: [...RAW, ...PROCESSED], supply: ['fish'], weight: 0.5 }, // đội xe chở hàng, tàu đánh cá
  // ---- ngành chiến lược ----
  irrigation: { supply: ['tea_leaf', 'cane', 'cassava', 'strawberry', 'mango'], weight: 0.5, stabilize: ['tea_leaf', 'cane', 'cassava', 'strawberry', 'mango'] },
  wind_farm: { cost: PROCESSED, weight: 0.6 },
  state_bank: { stabilize: [...RAW, ...PROCESSED], weight: 0.4 },
  tax_office: {}, // thu thuế, không đụng tới hàng trên Sàn
};

/** Mức tác động tối đa khi một ngành chạy hết công suất (độ mạnh 1, trọng số 1). */
export const IMPACT = {
  supply: 0.15, // cung tăng: giá trung bình −15%
  demand: 0.12, // cầu tăng: +12%
  cost: 0.1, // chi phí chế biến giảm: −10%
  stabilize: 0.3, // biến động −30%
  perClan: 0.15, // mỗi gia tộc nắm ngành góp 0,15 độ mạnh
  perPlot: 1 / 8, // mỗi lô đất đang chạy góp 1/8
  meanRange: [0.7, 1.35],
  minVol: 0.5,
};

/** Độ mạnh 0–1 của một ngành từ số gia tộc đang nắm và số lô đất đang chạy. */
export const industryStrength = ({ clans = 0, plots = 0 } = {}) => Math.min(1, clans * IMPACT.perClan + plots * IMPACT.perPlot);

/**
 * Hệ số cho từng mặt hàng từ tình hình các ngành `presence` ({ ngành: { clans, plots } }):
 * { [hàng]: { mean, vol, sources: [{ industry, kind, strength, effect }] } }. Hàng không bị ngành nào chạm thì không có trong kết quả.
 */
export function industryInfluence(presence) {
  const out = {};
  const touch = (id) => (out[id] ??= { mean: 1, vol: 1, sources: [] });
  for (const [industry, rule] of Object.entries(INDUSTRY_MARKET)) {
    const strength = industryStrength(presence?.[industry]);
    if (strength <= 0) continue;
    const w = strength * (rule.weight ?? 1);
    const apply = (list, kind, field, delta) => {
      for (const id of list ?? []) {
        const c = touch(id);
        c[field] *= 1 + delta;
        c.sources.push({ industry, kind, strength: Math.round(strength * 100) / 100, effect: Math.round(delta * 1000) / 1000 });
      }
    };
    apply(rule.supply, 'supply', 'mean', -IMPACT.supply * w);
    apply(rule.demand, 'demand', 'mean', IMPACT.demand * w);
    apply(rule.cost, 'cost', 'mean', -IMPACT.cost * w);
    apply(rule.stabilize, 'stabilize', 'vol', -IMPACT.stabilize * w);
  }
  for (const c of Object.values(out)) {
    c.mean = Math.min(IMPACT.meanRange[1], Math.max(IMPACT.meanRange[0], c.mean));
    c.vol = Math.max(IMPACT.minVol, c.vol);
  }
  return out;
}

/** Một dòng mô tả tác động của ngành lên Sàn, ví dụ "Cung tăng: Lá trà tươi, Trà khô". */
export function industryMarketText(industry, names = {}) {
  const rule = INDUSTRY_MARKET[industry];
  if (!rule) return '';
  const list = (ids) => ids.map((id) => names[id] ?? id).join(', ');
  const parts = [];
  if (rule.supply) parts.push(`cung tăng → giá giảm: ${list(rule.supply)}`);
  if (rule.demand) parts.push(`cầu tăng → giá lên: ${list(rule.demand)}`);
  if (rule.cost) parts.push(`chi phí chế biến giảm: ${list(rule.cost)}`);
  if (rule.stabilize) parts.push(rule.stabilize.length >= RAW.length + PROCESSED.length ? 'giá cả Sàn bớt biến động' : `bớt biến động: ${list(rule.stabilize)}`);
  return parts.join(' · ');
}
