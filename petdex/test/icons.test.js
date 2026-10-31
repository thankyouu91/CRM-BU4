// Thư viện icon (public/ta-tua/game/js/icons): mọi emoji game dùng, ở trình duyệt lẫn chữ server gửi về,
// phải có icon pixel của mình, để không máy nào hiện ô vuông trống. Thêm emoji mới mà chưa vẽ icon thì test này đỏ.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { GRID, ICONS, iconSvg, layout, normEmoji } from '../../public/ta-tua/game/js/icons/index.js';

const GAME = new URL('../../public/ta-tua/game/', import.meta.url).pathname;
const SERVER = new URL('../server/', import.meta.url).pathname;
const ROOT = new URL('../../', import.meta.url).pathname;
const EMOJI = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}\uFE0F?|[\u{1F3FB}-\u{1F3FF}])*|[\u{1F1E6}-\u{1F1FF}]{2}/gu;

function files(dir, exts) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'icons' ? [] : files(path, exts);
    return exts.some((x) => e.name.endsWith(x)) ? [path] : [];
  });
}

test('mọi emoji trong game đều có icon', () => {
  const missing = new Map();
  for (const file of [...files(GAME, ['.js', '.html', '.css']), ...files(SERVER, ['.js'])]) {
    for (const e of readFileSync(file, 'utf8').match(EMOJI) ?? []) {
      const key = normEmoji(e);
      if (!ICONS.has(key) && !missing.has(key)) missing.set(key, file.slice(ROOT.length));
    }
  }
  assert.deepEqual([...missing].map(([e, f]) => `${e} (${f})`), []);
});

test('icon vẽ đúng quy cách: lưới tối đa 14×14, màu đều có trong bảng màu, id không trùng', () => {
  const ids = new Map();
  const problems = [];
  for (const [emoji, icon] of ICONS) {
    const where = `${emoji} ${icon.id}`;
    if (!/^[a-z0-9-]+$/.test(icon.id)) problems.push(`${where}: id chỉ gồm a-z, 0-9, -`);
    if (ids.has(icon.id)) problems.push(`${where}: trùng id với ${ids.get(icon.id)}`);
    ids.set(icon.id, emoji);
    if (!icon.name?.trim()) problems.push(`${where}: thiếu tên tiếng Việt`);
    const max = GRID - (icon.outline ? 2 : 0);
    if (icon.rows.length > max || icon.rows.some((r) => r.length > max)) problems.push(`${where}: lưới vượt ${max}×${max}`);
    if (new Set(icon.rows.map((r) => r.length)).size > 1) problems.push(`${where}: các hàng không cùng độ dài`);
    for (const ch of new Set(icon.rows.join(''))) {
      if (ch !== '.' && !icon.palette[ch]) problems.push(`${where}: ký tự "${ch}" không có trong bảng màu`);
    }
    for (const [ch, color] of Object.entries(icon.palette)) {
      if (!/^#[0-9a-f]{6}$/i.test(color)) problems.push(`${where}: màu ${ch}=${color} phải là #rrggbb`);
    }
    if (layout(icon).join('').replace(/[.#]/g, '').length < 12) problems.push(`${where}: hình quá ít ô màu`);
    assert.match(iconSvg(emoji), /^<svg [^>]+>(<path fill="#[0-9a-f]{6}" d="[^"]+"\/>)+<\/svg>$/i);
  }
  assert.deepEqual(problems, []);
});
