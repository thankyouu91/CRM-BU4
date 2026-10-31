// Atlas icon đồ 16-bit (public/ta-tua/game/assets/items, dựng bằng scripts/art/build-items.py): mỗi khung phải là một id
// có thật trong catalog (đồ Siêu thị, món Bếp, nông sản Sàn, hàng công nghiệp gia tộc), nằm gọn trong trang atlas,
// khớp với tệp WebP thật và có mục nguồn gốc trong docs/art/asset-manifest.json. Đội vẽ đặt sai tên tệp thì test này đỏ.
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ITEM_ATLAS } from '../../public/ta-tua/game/js/itematlas.js';
import { ITEMS } from '../server/game.js';
import { COMMODITIES } from '../server/rules/market.js';
import { DISHES } from '../server/rules/production.js';
import { GOODS } from '../../public/ta-tua/game/js/shared/industry.js';

const ASSETS = new URL('../../public/ta-tua/game/assets/items/', import.meta.url);
const MAX_FILE = 200 * 1024;
const { size, pages, frames } = ITEM_ATLAS;

/** Rộng, cao của ảnh WebP lossless (khối VP8L) hoặc mở rộng (VP8X), đọc thẳng từ đầu tệp. */
function webpSize(buf) {
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8L') {
    assert.equal(buf[20], 0x2f, 'chữ ký VP8L');
    const bits = buf.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
  }
  if (chunk === 'VP8X') return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
  throw new Error(`atlas phải là WebP lossless, gặp khối ${chunk}`);
}

const fileOf = (url) => new URL(new URL(url).pathname.split('/').pop(), ASSETS);

test('item atlas: mọi khung là id có thật trong catalog', () => {
  const known = new Set([...Object.keys(ITEMS), ...Object.keys(DISHES), ...Object.keys(COMMODITIES), ...Object.keys(GOODS)]);
  const unknown = Object.keys(frames).filter((id) => !known.has(id));
  assert.deepEqual(unknown, [], 'tên tệp icon phải đúng id catalog');
  assert.ok(Object.keys(frames).length >= 43);
});

test('item atlas: mọi khung nằm gọn trong trang, không chồng nhau, trang khớp tệp WebP thật', () => {
  assert.equal(size, 32);
  assert.ok(pages.length >= 1);
  pages.forEach((page, i) => {
    const file = fileOf(page.url);
    const buf = readFileSync(file);
    assert.deepEqual(webpSize(buf), [page.w, page.h], `trang ${i}: cỡ trong itematlas.js khác tệp ${file.pathname}`);
    assert.ok(statSync(file).size <= MAX_FILE, `trang ${i} vượt 200 KB`);
  });
  const seen = new Map();
  const problems = [];
  for (const [id, [p, x, y]] of Object.entries(frames)) {
    const page = pages[p];
    if (!page) {
      problems.push(`${id}: trang ${p} không có`);
      continue;
    }
    if (![p, x, y].every(Number.isInteger) || x < 0 || y < 0 || x + size > page.w || y + size > page.h) {
      problems.push(`${id}: [${p}, ${x}, ${y}] ra ngoài trang ${page.w}x${page.h}`);
    }
    for (const [other, [q, ox, oy]] of seen) {
      if (q === p && Math.abs(ox - x) < size && Math.abs(oy - y) < size) problems.push(`${id} chồng lên ${other}`);
    }
    seen.set(id, [p, x, y]);
  }
  assert.deepEqual(problems, []);
});

test('item atlas: items.json và manifest nguồn gốc khớp với bảng khung', () => {
  const doc = JSON.parse(readFileSync(new URL('items.json', ASSETS), 'utf8'));
  assert.deepEqual(Object.keys(doc.frames), Object.keys(frames));
  for (const [id, f] of Object.entries(frames)) assert.deepEqual(doc.frames[id].slice(0, 3), f, id);
  assert.deepEqual(doc.pages.map((p) => [p.w, p.h]), pages.map((p) => [p.w, p.h]));

  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../../docs/art/asset-manifest.json', import.meta.url)), 'utf8'));
  const mine = manifest.assets.filter((a) => a.area === 'items');
  const byFrame = new Map(mine.map((a) => [a.path.split('#')[1], a]));
  assert.deepEqual([...byFrame.keys()].sort(), Object.keys(frames).sort(), 'mỗi khung đúng một mục area "items"');
  for (const a of mine) {
    const id = a.path.split('#')[1];
    assert.ok(a.id === `item-${id}` || a.id === `good-${id}`, `${a.id}: id phải là item-<id> hoặc good-<id>`);
    assert.equal(a.status, 'approved', a.id);
    assert.match(a.provenance?.license ?? '', /PixelLab ToS §1\.3, §3\.3/, `${a.id}: thiếu dòng giấy phép`);
  }
});
