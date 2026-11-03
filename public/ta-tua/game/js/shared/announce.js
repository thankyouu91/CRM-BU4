// Định dạng nội dung thông báo của ban quản lý. Dùng chung cho game (Báo Trân Châu, cửa sổ bật lên)
// và bảng quản lý (xem trước), nên không đụng tới trình duyệt.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Chữ đậm **…** trong một dòng đã escape. */
const inline = (text) => esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

/**
 * Nội dung thông báo (chữ thường) thành HTML an toàn: mọi chữ đều được escape trước, chỉ nhận
 * "## tiêu đề", dòng "- gạch đầu dòng", bảng "| a | b |" (bỏ dòng |---|), **chữ đậm**, dòng "---" để ngăn mục,
 * còn lại mỗi đoạn cách nhau một dòng trống.
 */
export function renderAnnouncement(body) {
  const out = [];
  let list = null;
  let table = null;
  let para = [];
  const flush = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
    if (list) out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`);
    list = null;
    if (table) {
      const [head, ...rows] = table;
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`
        + `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    }
    table = null;
  };
  for (const raw of String(body ?? '').split('\n')) {
    const line = raw.trim();
    if (/^\|.*\|$/.test(line)) {
      if (/^\|[\s:|-]+\|$/.test(line)) continue;
      if (!table) flush();
      table = table ?? [];
      table.push(line.slice(1, -1).split('|').map((c) => c.trim()));
    } else if (/^[-*] /.test(line)) {
      if (!list) flush();
      list = list ?? [];
      list.push(line.slice(2));
    } else if (/^#{1,3} /.test(line)) {
      flush();
      out.push(`<h4>${inline(line.replace(/^#+ /, ''))}</h4>`);
    } else if (/^-{3,}$/.test(line)) {
      flush();
      out.push('<hr>');
    } else if (!line) {
      flush();
    } else {
      if (list || table) flush();
      para.push(line);
    }
  }
  flush();
  return out.join('');
}
