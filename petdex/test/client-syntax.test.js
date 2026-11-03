// Mã trình duyệt của game (public/ta-tua/game/js) không qua ESLint: một lỗi cú pháp (ví dụ lúc gộp nhánh)
// làm cả game trắng trang. Kiểm tra mọi file đều phân tích được.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = new URL('../../public/ta-tua/game/js/', import.meta.url).pathname;

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : []));
}

test('mọi file JS của game phía trình duyệt đều đúng cú pháp', () => {
  const list = files(ROOT);
  assert.ok(list.length > 20);
  const broken = [];
  for (const file of list) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (err) {
      broken.push(`${file.slice(ROOT.length)}: ${String(err.stderr).split('\n').slice(0, 4).join(' ')}`);
    }
  }
  assert.deepEqual(broken, []);
});
