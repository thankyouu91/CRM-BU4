// Bản đồ đất 16-bit (scripts/art/build-landmap.py -> public/ta-tua/game/assets/landmap/): tranh phải khớp PLOTS hiện tại
// (plots_hash), mỗi công trình biểu tượng nằm trên lô đúng vùng, dung lượng trong ngân sách, manifest ghi đủ nguồn gốc.
// Trình dựng Node (không có canvas) vẫn vẽ nền vector như trước.
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const { PLOTS } = await import('../../public/ta-tua/game/js/shared/clan.js');
const { MAP_H, MAP_W, landMapSvg, plotsHash } = await import('../../public/ta-tua/game/js/landmap.js');

const DIR = fileURLToPath(new URL('../../public/ta-tua/game/assets/landmap/', import.meta.url));
const data = JSON.parse(readFileSync(`${DIR}landmap.json`, 'utf8'));
const byCode = new Map(PLOTS.map((p) => [p.code, p]));

/** Cỡ ảnh WebP lossless (khối VP8L): 14 bit rộng - 1, 14 bit cao - 1. */
function webpSize(file) {
  const b = readFileSync(file);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WEBP');
  assert.equal(b.toString('ascii', 12, 16), 'VP8L', `${file}: phải là WebP lossless`);
  const bits = b.readUInt32LE(21);
  return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
}

test('bản đồ 16-bit: plots_hash khớp PLOTS, khung và cỡ tranh đúng', () => {
  assert.equal(data.plots_hash, plotsHash(), 'PLOTS đã đổi: chạy lại python3 -I scripts/art/build-landmap.py ART_ROOT');
  assert.deepEqual(data.size, [702, 332]);
  assert.equal(data.unit, 1.5);
  assert.deepEqual(data.view, [1053, MAP_H]);
  assert.ok(data.view[0] >= MAP_W);
  assert.deepEqual(webpSize(`${DIR}${data.map}`), data.size);
});

test('bản đồ 16-bit: mỗi công trình biểu tượng nằm trên lô đúng vùng của nó', () => {
  const ZONE = [
    ['townhall', 'urban'], ['waterfall', 'river'], ['windmill', 'plain'], ['lighthouse', 'coast'], ['harbour', 'coast'],
    ['pagoda', 'hill'], ['mine', 'hill'], ['sawmill', 'forest'], ['fishing-village', 'sea'],
  ];
  const names = Object.entries(data.landmarks);
  for (const [prefix] of ZONE.slice(0, 8)) assert.ok(names.some(([, n]) => n.startsWith(prefix)), `thiếu công trình ${prefix}`);
  for (const [code, name] of names) {
    const plot = byCode.get(code);
    assert.ok(plot, `${name}: không có lô ${code}`);
    const want = ZONE.find(([prefix]) => name.startsWith(prefix))?.[1];
    assert.ok(want, `${name}: công trình lạ`);
    assert.equal(plot.zone, want, `${name} ở ${code} (${plot.zone}), cần vùng ${want}`);
  }
  // concept đã duyệt: tòa thị chính E10, thác E01, mỏ D06, chùa C04
  assert.match(data.landmarks.E10, /^townhall/);
  assert.match(data.landmarks.E01, /^waterfall/);
  assert.match(data.landmarks.D06, /^mine/);
  assert.match(data.landmarks.C04, /^pagoda/);
  assert.deepEqual(data.landmark_plots, Object.keys(data.landmarks).map((c) => byCode.get(c).id).sort((a, b) => a - b));
});

test('bản đồ 16-bit: hiệu ứng nằm trong tranh và trong atlas, dung lượng trong ngân sách', () => {
  const [AW, AH] = webpSize(`${DIR}${data.atlas}`);
  const [W, H] = data.size;
  for (const f of data.ground) {
    const [x, y, w, h] = f.r;
    for (const [px, py] of [[x, y], ...(f.at ?? [])]) assert.ok(px >= 0 && py >= 0 && px + w <= W && py + h <= H, `${f.id} ra ngoài tranh`);
    assert.ok(f.ms > 0 && f.f.length >= 2, f.id);
    for (const fr of f.f) if (fr) assert.ok(fr[0] + w <= AW && fr[1] + h <= AH, `${f.id}: khung ra ngoài atlas`);
  }
  for (const c of data.clouds) assert.ok(c.a[0] + c.a[2] <= AW && c.a[1] + c.a[3] <= AH, 'mây ra ngoài atlas');
  for (const g of data.gulls.f) assert.ok(g[0] + g[2] <= AW && g[1] + g[3] <= AH, 'hải âu ra ngoài atlas');
  assert.ok(data.dark.length >= 30, 'bảng tối một bậc của palette');
  const size = (n) => statSync(`${DIR}${n}`).size;
  assert.ok(size('map.webp') <= 80 * 1024, `map.webp ${size('map.webp')} B > 80 KB`);
  assert.ok(size('fx.webp') <= 24 * 1024, `fx.webp ${size('fx.webp')} B > 24 KB`);
  assert.ok(size('map.webp') + size('fx.webp') + size('landmap.json') <= 110 * 1024, 'tổng > 110 KB');
});

test('bản đồ 16-bit: manifest có mục area "landmap" với giấy phép PixelLab', () => {
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../../docs/art/asset-manifest.json', import.meta.url)), 'utf8'));
  const mine = manifest.assets.filter((a) => a.area === 'landmap');
  const ids = mine.map((a) => a.id);
  assert.ok(ids.includes('lm-map') && ids.includes('lm-fx'));
  for (const a of mine) {
    assert.match(a.id, /^lm-/);
    assert.equal(a.provenance.license, 'PixelLab output owned by the creator, commercial use allowed (PixelLab ToS §1.3, §3.3, https://pixellab.ai/termsofservice); not to be used to train other models without written permission (§1.2, §3.3)');
    assert.equal(a.verification.approved_by, 'owner (design session, 2026-10-31)');
  }
  for (const a of manifest.assets.filter((x) => x.area !== 'landmap')) assert.ok(!a.id.startsWith('lm-'), `${a.id}: id lm-* ngoài khu landmap`);
});

test('trình dựng Node: vẫn là nền vector khung 1052, đủ 200 lô bấm được', () => {
  const svg = landMapSvg({ key: 'zone', fillFor: () => null, infos: new Map(), selected: null });
  assert.match(svg, new RegExp(`viewBox="0 0 ${MAP_W} ${MAP_H}"`));
  assert.equal(MAP_W, 1052);
  assert.equal((svg.match(/data-plot="/g) ?? []).length, 200);
  assert.ok(!svg.includes('lm16-stage') && !svg.includes('<canvas'));
});
