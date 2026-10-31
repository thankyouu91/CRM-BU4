// Kinh doanh trên bản đồ đất: mỗi lô có chủ đang làm ngành gì; với lô của gia tộc mình, doanh thu ước tính và vì sao
// bằng 0 (gia tộc khác không hiện cảnh báo); màu theo ngành
// cho chế độ "Ngành đang kinh doanh"; dải "Gia tộc của tôi"; chữ chú thích khi rê chuột lên lô.
// Chỉ dùng dữ liệu sẵn có (/land và /clans), luật giống máy chủ: lô chỉ chạy khi công trình hoàn chỉnh, ngành khai
// thác cần mỏ đúng loại trên lô, ngành điện cần chọn loại nhà máy, ngành tạm đóng thì không chạy.
import { INDUSTRIES, INDUSTRY_ORDER, designComplete } from './shared/clan.js';
import { PRODUCTION_INDUSTRIES, extractable, recipeOf } from './shared/industry.js';

const KIND_NAMES = { crop: 'nông sản', livestock: 'vật nuôi', mineral: 'khoáng sản', oilgas: 'dầu khí', forest: 'gỗ rừng' };
const num = (v) => Math.round(v).toLocaleString('vi-VN');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Trạng thái kinh doanh của một lô có chủ (null nếu lô còn trống).
 * `info`: dòng của /land; `est`: { operating, estimate } của lô thuộc gia tộc mình (từ /clans), null với gia tộc khác;
 * `upkeep`: phí duy trì mỗi đêm chia đều cho mỗi lô; `closed`: các ngành đang tạm đóng.
 * state: 'idle' (chưa chọn ngành), 'zero' (sản lượng 0), 'low' (doanh thu chưa đủ phí duy trì), 'ok' (có doanh thu
 * ước tính), 'other' (lô của gia tộc khác: chỉ biết ngành, không đánh giá, không cảnh báo).
 */
export function plotBusiness(info, { est = null, upkeep = 0, closed = [] } = {}) {
  if (!info?.owner) return null;
  const ind = INDUSTRIES[info.industry];
  if (!ind) return { state: 'idle', short: 'Chưa chọn ngành', reason: info.mine ? 'Lô chưa làm ngành nào nên chưa có doanh thu.' : '' };
  if (!info.mine) return { state: 'other', short: '', reason: '' };
  const zero = (short, reason) => ({ state: 'zero', short, reason });
  if (closed.includes(info.industry)) return zero('Ngành tạm đóng', `Ngành ${ind.name} đang tạm đóng nên lô không chạy.`);
  const prod = PRODUCTION_INDUSTRIES[info.industry];
  if (prod?.extracts && !Object.keys(extractable(info.industry, info.deposits ?? {})).length) {
    const kinds = prod.extracts.map((k) => KIND_NAMES[k] ?? k).join(', ');
    return zero('Không có tài nguyên', `Lô không có mỏ ${kinds} cho ngành ${ind.name} nên sản lượng bằng 0. Nên đổi sang ngành hợp với lô.`);
  }
  if (prod?.plants && !recipeOf(info.industry, info.variant)) return zero('Chưa chọn nhà máy', 'Chưa chọn loại nhà máy điện hợp với lô nên chưa phát điện.');
  if (!designComplete(info.design ?? [])) return zero('Chưa xây xong', 'Công trình chưa hoàn chỉnh (cần móng và ít nhất 3 mảnh) nên lô chưa chạy.');
  if (ind.sector === 'strategic') return { state: 'ok', short: 'Hạ tầng', reason: 'Hạ tầng chiến lược: tạo hiệu ứng cho cả game thay vì doanh thu.' };
  if (est) {
    if (!est.operating || est.estimate <= 0) return zero('Sản lượng 0', 'Ước tính mỗi đêm lô này không làm ra gì.');
    if (est.estimate < upkeep) return { state: 'low', short: `≈ ${num(est.estimate)}/đêm`, reason: `Doanh thu ước tính ≈ ${num(est.estimate)} xu/đêm, chưa đủ phí duy trì ≈ ${num(upkeep)} xu của lô.`, estimate: est.estimate };
    return { state: 'ok', short: `≈ ${num(est.estimate)}/đêm`, reason: `Doanh thu ước tính ≈ ${num(est.estimate)} xu/đêm.`, estimate: est.estimate };
  }
  return { state: 'ok', short: 'Đang kinh doanh', reason: 'Đang kinh doanh.' };
}

/** Lô có cần cảnh báo đỏ không (sản lượng 0). */
export const needsWarning = (biz) => biz?.state === 'zero';

/**
 * Bảng màu theo ngành cho chế độ "Ngành đang kinh doanh": Okabe-Ito (an toàn với người mù màu) rồi Paul Tol, đủ
 * sáng để biểu tượng và mã lô màu mực vẫn đọc rõ. Màu gán theo thứ tự ngành đang có mặt trên bản đồ.
 */
export const BIZ_PALETTE = ['#e69f00', '#56b4e9', '#009e73', '#f0e442', '#cc79a7', '#0072b2', '#d55e00', '#bbcc33', '#99ddff', '#ffaabb', '#44bb99', '#eedd88', '#aaaa00', '#ee8866'];
export const BIZ_IDLE = '#e3d7c4';

/** Các ngành đang có lô làm, theo thứ tự ngành của game: [{ id, color, count }]. */
export function industriesInUse(plots) {
  const counts = new Map();
  for (const p of plots) if (p.owner && INDUSTRIES[p.industry]) counts.set(p.industry, (counts.get(p.industry) ?? 0) + 1);
  return INDUSTRY_ORDER.filter((id) => counts.has(id)).map((id, k) => ({ id, color: BIZ_PALETTE[k % BIZ_PALETTE.length], count: counts.get(id) }));
}

/** Chú thích chế độ "Ngành đang kinh doanh": ô màu, biểu tượng, tên ngành, số lô. */
export function bizLegend(plots) {
  const used = industriesInUse(plots);
  const idle = plots.filter((p) => p.owner && !INDUSTRIES[p.industry]).length;
  if (!used.length && !idle) return '<span>Chưa có lô nào đang kinh doanh.</span>';
  return used.map((u) => `<span><i style="background:${u.color}"></i>${INDUSTRIES[u.id].icon} ${esc(INDUSTRIES[u.id].name)} <b>${u.count}</b></span>`).join('')
    + (idle ? `<span><i style="background:${BIZ_IDLE}"></i>Chưa chọn ngành <b>${idle}</b></span>` : '')
    + '<span><i class="free"></i>Còn trống</span>';
}

/**
 * Dải "Gia tộc của tôi" phía trên bản đồ: số lô, mỗi lô một nút (bấm để chọn trên bản đồ) và đếm lô có doanh thu
 * ước tính / chưa có doanh thu. `rows`: [{ plot, info, biz }] của gia tộc mình. Điện thoại: `open` = false thì chỉ
 * hiện dòng đầu, nút "Xem các lô" mở danh sách (máy tính luôn mở).
 */
export function myClanStrip(clan, rows, selected = null, open = false) {
  if (!clan) return '';
  const earning = rows.filter((r) => r.biz?.state === 'ok').length;
  const idle = rows.length - earning;
  const total = rows.reduce((s, r) => s + (r.biz?.estimate ?? 0), 0);
  const chip = ({ plot, info, biz }) => {
    const ind = INDUSTRIES[info.industry];
    const state = biz?.state ?? 'idle';
    return `<button type="button" class="biz-chip st-${state}${selected === plot.id ? ' current' : ''}" data-pick-plot="${plot.id}" title="${esc(biz?.reason ?? '')}">
      <span class="biz-chip-icon">${ind ? ind.icon : '💤'}</span>
      <span class="biz-chip-text"><b>${plot.code}</b> ${ind ? esc(ind.name) : 'Chưa chọn ngành'}<small>${state === 'zero' ? '⚠️ ' : ''}${esc(biz?.short ?? '')}</small></span></button>`;
  };
  return `<section class="biz-strip${open ? '' : ' collapsed'}" aria-label="Gia tộc của tôi">
    <div class="biz-strip-head"><b>${esc(clan.emblem)} ${esc(clan.name)}</b>
      <span>${rows.length} lô</span>
      <span class="biz-good">✅ ${earning} lô có doanh thu ước tính${total ? ` ≈ ${num(total)}/đêm` : ''}</span>
      ${idle ? `<span class="biz-bad">⚠️ ${idle} lô chưa có doanh thu</span>` : ''}
      ${rows.length ? `<button type="button" class="biz-strip-toggle" data-strip-toggle aria-expanded="${open}" aria-controls="biz-chips">
        <span>${open ? 'Thu gọn' : 'Xem các lô'}</span><i aria-hidden="true"></i></button>` : ''}</div>
    ${rows.length ? `<div class="biz-chips" id="biz-chips">${rows.map(chip).join('')}</div>` : '<p class="muted small">Gia tộc chưa có lô nào. Chọn một lô còn trống trên bản đồ để mua.</p>'}
  </section>`;
}

/** Chữ chú thích khi rê chuột lên một lô: chủ, ngành, công trình, tình trạng (hoặc giá nếu còn trống). */
export function plotTipHtml(plot, info, biz, { zoneName = '', money = num } = {}) {
  if (!info?.owner) {
    return `<b>${plot.code}</b> · ${esc(zoneName)}<br>Còn trống${info?.price ? ` · giá ${money(info.price)}` : ''}`;
  }
  const ind = INDUSTRIES[info.industry];
  const pieces = info.design?.length ?? 0;
  const state = biz?.state ?? 'idle';
  return `<b>${plot.code}</b> · ${esc(zoneName)}<br>
    <span class="tip-owner" style="--clan:${esc(info.owner.color)}">${esc(info.owner.emblem)} ${esc(info.owner.name)}${info.mine ? ' (của bạn)' : ''}</span><br>
    ${ind ? `${ind.icon} ${esc(ind.name)}` : 'Chưa chọn ngành'}<br>
    ${pieces ? `🏗️ Công trình ${pieces} mảnh${designComplete(info.design) ? '' : ' (chưa xong)'}` : '🏗️ Chưa xây công trình'}${biz?.reason ? '<br>' : ''}
    ${biz?.reason ? `<span class="tip-state st-${state}">${esc(biz.reason)}</span>` : ''}`;
}
