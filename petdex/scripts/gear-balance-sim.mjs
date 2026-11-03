// Mô phỏng cộng dồn trang phục khi đeo 3–5 món (số liệu trong docs/pet-town-gear-balance.md).
// Chạy: node petdex/scripts/gear-balance-sim.mjs
const G = await import(new URL('../../public/ta-tua/game/js/shared/gear.js', import.meta.url));
const cfg = G.normalizeGearConfig(G.DEFAULT_GEAR_CONFIG);
let seed = 12345; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const N = 20000;
const pct = (arr, p) => { const s = [...arr].sort((a,b)=>a-b); return s[Math.floor(p*(s.length-1))]; };
function scenario(name, pieces, gen) {
  const res = { income: [], stats: [], trade: [], luck: [], raw: [] };
  for (let i = 0; i < N; i++) {
    const list = Array.from({ length: pieces }, () => gen().affixes);
    const raw = Object.fromEntries(G.AFFIX_ORDER.map(a => [a, list.reduce((s, x) => s + (x[a] ?? 0), 0)]));
    const b = G.sumBonus(list);
    for (const a of G.AFFIX_ORDER) res[a].push(b[a]);
    res.raw.push(Math.max(...Object.values(raw)));
  }
  const row = G.AFFIX_ORDER.map(a => `${a}: tb ${(res[a].reduce((s,v)=>s+v,0)/N).toFixed(1)} p90 ${pct(res[a],0.9)} max ${Math.max(...res[a])}`).join(' | ');
  console.log(`${name.padEnd(28)} ${row}`);
}
const shop = () => G.rollShopGear(cfg, rand);
const drop = () => G.rollGear(cfg, rand);
const tier = (t) => () => G.rollGear(cfg, rand, { tier: t });
// "chọn lọc": người chơi giữ món tốt nhất cho thu nhập trong k lần quay
const best = (k, g) => () => { let b = null; for (let i=0;i<k;i++){ const x=g(); if(!b || (x.affixes.income??0) > (b.affixes.income??0)) b=x;} return b; };
for (const p of [3,4,5]) {
  console.log(`--- ${p} món ---`);
  scenario('Siêu thị (lam/lục)', p, shop);
  scenario('Rớt mini-game', p, drop);
  scenario('Toàn Vàng', p, tier('gold'));
  scenario('Toàn Đỏ', p, tier('red'));
  scenario('Đỏ chọn lọc (best/5)', p, best(5, tier('red')));
}
// luck feedback
for (const luck of [0, 25, 50, 100]) {
  let c = {blue:0,green:0,gold:0,red:0}; for (let i=0;i<100000;i++) c[G.rollTier(cfg.odds, rand, luck)]++;
  console.log('luck', luck, Object.entries(c).map(([k,v])=>`${k} ${(v/1000).toFixed(1)}%`).join(' '));
}
