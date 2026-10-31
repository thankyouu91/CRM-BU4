// Danh sách nguồn gốc ảnh (docs/art/asset-manifest.json) do các script scripts/art/build-*.py ghi.
// Mỗi script chỉ thay phần của mình, nên một id lặp sẽ âm thầm nhân đôi qua mỗi lần dựng lại.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../../docs/art/asset-manifest.json', import.meta.url)), 'utf8'));

test('asset manifest: mọi id là duy nhất', () => {
  const seen = new Map();
  for (const a of manifest.assets) seen.set(a.id, (seen.get(a.id) ?? 0) + 1);
  const dupes = [...seen].filter(([, n]) => n > 1).map(([id, n]) => `${id} ×${n}`);
  assert.deepEqual(dupes, []);
});

test('asset manifest: mỗi mục có id, đường dẫn và nguồn gốc', () => {
  for (const a of manifest.assets) {
    assert.ok(typeof a.id === 'string' && a.id, 'thiếu id');
    assert.ok(typeof a.path === 'string' && a.path, `${a.id}: thiếu path`);
    assert.ok(a.provenance && typeof a.provenance === 'object', `${a.id}: thiếu provenance`);
  }
});
