// Thư viện icon Pet Farm: mọi emoji trong game được vẽ lại thành icon pixel SVG của mình,
// để máy nào, trình duyệt nào cũng hiện giống nhau, không phụ thuộc phông emoji của hệ điều hành.
//
// Mỗi icon là một lưới ký tự (cùng định dạng với itemart.js): mỗi ký tự là một màu trong bảng màu,
// '.' bỏ trống, tối đa 14×14 ô; viền nâu đậm 1 ô được thêm tự động. Icon nằm giữa khung vuông 16×16.
//
// Dùng: startIcons() một lần khi trang mở. Từ đó chữ nào trong trang có emoji đã có icon thì
// emoji được thay bằng <svg class="ic">, kể cả chữ do server gửi về. Ô nhập liệu, <option>,
// thuộc tính title/placeholder giữ nguyên emoji vì trình duyệt không cho chèn hình vào đó.
import { OUTLINE } from '../pixel.js';
import SETS from './sets.js';

export const GRID = 16;
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const VS16 = /\uFE0F/g;

/** Bỏ ký tự biến thể U+FE0F để "❤️" và "❤" là một. */
export const normEmoji = (s) => s.replace(VS16, '');

/** emoji (đã chuẩn hóa) → { id, name, rows, palette, outline } */
export const ICONS = new Map();
for (const set of SETS) {
  for (const [emoji, [id, name, rows, palette, opts]] of Object.entries(set)) {
    ICONS.set(normEmoji(emoji), { id, name, rows, palette, outline: opts?.outline !== false });
  }
}

/** Lưới đã thêm viền và căn giữa khung GRID×GRID: mảng GRID chuỗi, ký tự '#' là viền. */
export function layout(icon) {
  const h = icon.rows.length;
  const w = Math.max(...icon.rows.map((r) => r.length));
  const pad = icon.outline ? 1 : 0;
  const ox = Math.floor((GRID - w) / 2);
  const oy = Math.floor((GRID - h) / 2);
  const cell = (x, y) => {
    const ch = icon.rows[y - oy]?.[x - ox];
    return ch && ch !== '.' && icon.palette[ch] ? ch : null;
  };
  const out = [];
  for (let y = 0; y < GRID; y++) {
    let line = '';
    for (let x = 0; x < GRID; x++) {
      const ch = cell(x, y);
      if (ch) line += ch;
      else if (pad && (cell(x - 1, y) || cell(x + 1, y) || cell(x, y - 1) || cell(x, y + 1))) line += '#';
      else line += '.';
    }
    out.push(line);
  }
  return out;
}

/** Nội dung SVG (các <path>, mỗi màu một path, gộp các ô liền nhau theo hàng) của một icon. */
export function iconPaths(icon) {
  const grid = layout(icon);
  const colors = { ...icon.palette, '#': OUTLINE };
  const byColor = new Map();
  grid.forEach((line, y) => {
    let x = 0;
    while (x < GRID) {
      const ch = line[x];
      if (ch === '.') {
        x++;
        continue;
      }
      let run = 1;
      while (line[x + run] === ch) run++;
      const d = byColor.get(ch) ?? [];
      d.push(`M${x} ${y}h${run}v1h-${run}z`);
      byColor.set(ch, d);
      x += run;
    }
  });
  return [...byColor].map(([ch, d]) => `<path fill="${colors[ch]}" d="${d.join('')}"/>`).join('');
}

/** SVG đứng riêng của icon (dùng cho favicon, ảnh xem trước); null nếu emoji chưa có icon. */
export function iconSvg(emoji) {
  const icon = ICONS.get(normEmoji(emoji));
  if (!icon) return null;
  return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${GRID} ${GRID}" shape-rendering="crispEdges">${iconPaths(icon)}</svg>`;
}

// ---------------------------------------------------------------- trong trang

let sprite = null;
const defined = new Set();

/** Thêm <symbol> của icon vào sprite ẩn của trang (chỉ khi lần đầu dùng). */
function ensureSymbol(icon) {
  if (defined.has(icon.id)) return;
  if (!sprite) {
    sprite = document.createElementNS(SVG_NS, 'svg');
    sprite.setAttribute('aria-hidden', 'true');
    sprite.setAttribute('focusable', 'false');
    sprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    document.body.prepend(sprite);
  }
  const symbol = document.createElementNS(SVG_NS, 'symbol');
  symbol.id = `ic-${icon.id}`;
  symbol.setAttribute('viewBox', `0 0 ${GRID} ${GRID}`);
  symbol.innerHTML = iconPaths(icon);
  sprite.append(symbol);
  defined.add(icon.id);
}

/** Phần tử <svg class="ic"> của icon. */
function iconNode(icon) {
  ensureSymbol(icon);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'ic');
  svg.setAttribute('viewBox', `0 0 ${GRID} ${GRID}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', icon.name);
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#ic-${icon.id}`);
  use.setAttributeNS(XLINK_NS, 'xlink:href', `#ic-${icon.id}`); // Safari cũ chỉ hiểu xlink:href
  svg.append(use);
  return svg;
}

/** Chuỗi HTML của icon cho code mới muốn chèn thẳng; emoji chưa có icon thì trả lại chính emoji. */
export function ic(emoji) {
  const icon = ICONS.get(normEmoji(emoji));
  if (!icon || typeof document === 'undefined') return emoji;
  ensureSymbol(icon);
  return `<svg class="ic" viewBox="0 0 ${GRID} ${GRID}" role="img" aria-label="${icon.name}"><use href="#ic-${icon.id}" xlink:href="#ic-${icon.id}"/></svg>`;
}

let pattern = null;
/** Regex bắt mọi emoji đã có icon; chuỗi dài (ZWJ) xếp trước, U+FE0F đi kèm tùy ý. */
function emojiPattern() {
  if (!pattern) {
    const alts = [...ICONS.keys()]
      .sort((a, b) => b.length - a.length)
      .map((e) => [...e].map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\uFE0F?') + '\\uFE0F?');
    pattern = new RegExp(alts.join('|'), 'gu');
  }
  pattern.lastIndex = 0;
  return pattern;
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'TITLE', 'NOSCRIPT']);
const skipped = (el) => !el || SKIP.has(el.nodeName) || el.closest?.('svg, [contenteditable], [data-no-icons]');

function iconizeText(node) {
  const text = node.nodeValue;
  const re = emojiPattern();
  if (!re.test(text)) return;
  re.lastIndex = 0;
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) frag.append(text.slice(last, m.index));
    frag.append(iconNode(ICONS.get(normEmoji(m[0]))));
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.append(text.slice(last));
  node.replaceWith(frag);
}

/** Thay emoji bằng icon trong mọi chữ dưới `root`. */
export function iconize(root) {
  if (root.nodeType === Node.TEXT_NODE) {
    if (!skipped(root.parentElement)) iconizeText(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE || skipped(root)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (skipped(n.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const texts = [];
  while (walker.nextNode()) texts.push(walker.currentNode);
  texts.forEach(iconizeText);
}

let observer = null;
/** Bật thay icon cho cả trang, kể cả nội dung vẽ sau này. Gọi nhiều lần cũng chỉ chạy một lần. */
export function startIcons(root = document.body) {
  if (observer || typeof MutationObserver === 'undefined') return;
  iconize(root);
  // Callback chạy như microtask, trước lần vẽ kế tiếp, nên không thấy emoji gốc nháy lên.
  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') iconize(r.target);
      else r.addedNodes.forEach((n) => n.isConnected && iconize(n));
    }
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true });
}

/** Biểu tượng tab trình duyệt vẽ bằng icon của mình thay cho emoji của hệ điều hành. */
export function setFavicon(emoji) {
  const svg = iconSvg(emoji);
  const link = document.querySelector('link[rel="icon"]');
  if (svg && link) link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
