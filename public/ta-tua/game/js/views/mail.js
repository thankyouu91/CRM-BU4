// Hộp thư: thư của người chơi khác, thư hệ thống và thư của Ban quản lý (có thể kèm xu, nhận một lần).
import { api } from '../api.js';
import { ago, esc, fmt, viewHead } from '../ui.js';

let draftTo = ''; // người nhận điền sẵn khi mở từ màn Trò chuyện

/** Mở màn Hộp thư với ô người nhận đã điền. */
export function composeMailTo(username) {
  draftTo = String(username ?? '');
}

export function renderMail(root, ctx) {
  root.innerHTML = `<div class="mail-page">
    ${viewHead('📬 Hộp thư', 'Thư của bạn bè, thông báo và quà của Ban quản lý. Thư có quà phải bấm Nhận trước khi xoá.')}
    <div class="mail-grid">
      <section class="card mail-list"><div class="empty muted">Đang tải…</div></section>
      <section class="card mail-compose">
        <h3>📮 Viết thư</h3>
        <form data-compose>
          <input name="to" required minlength="2" maxlength="20" placeholder="Tên người nhận" autocomplete="off" value="${esc(draftTo)}" />
          <input name="subject" required maxlength="80" placeholder="Tiêu đề" autocomplete="off" />
          <textarea name="body" required maxlength="2000" rows="6" placeholder="Nội dung"></textarea>
          <button class="btn primary">Gửi thư</button>
          <p class="muted small">Mỗi 30 giây một lá, tối đa 20 lá mỗi ngày. Người chơi không gửi kèm xu qua thư được: tặng quà ở Bạn bè.</p>
        </form>
      </section>
    </div>
  </div>`;
  const page = root.querySelector('.mail-page');
  const listEl = page.querySelector('.mail-list');
  let mails = [];
  let open = null;
  let alive = true;
  if (draftTo) page.querySelector('[name="subject"]').focus({ preventScroll: true });
  draftTo = '';

  function draw() {
    const unread = mails.filter((m) => !m.read).length;
    listEl.innerHTML = `
      <div class="mail-head"><h3>Thư đến (${mails.length})</h3>
        ${unread ? '<button class="link-btn" data-read-all>Đánh dấu đã đọc hết</button>' : ''}</div>
      ${mails.length ? `<ul>${mails.map((m) => `
        <li class="mail-row ${m.read ? '' : 'unread'} ${open === m.id ? 'open' : ''}">
          <button class="mail-open" data-open="${m.id}">
            <span class="mail-from">${m.system ? '🏛️' : '✉️'} ${esc(m.from.name)}</span>
            <b class="mail-subject">${esc(m.subject)}</b>
            ${m.coins ? `<span class="badge ${m.claimed ? '' : 'star'}">🎁 ${fmt(m.coins)} 🪙${m.claimed ? ' · đã nhận' : ''}</span>` : ''}
            <small class="muted">${ago(m.at)}</small>
          </button>
          ${open === m.id ? `<div class="mail-body">
            <p>${esc(m.body).replace(/\n/g, '<br>') || '<i class="muted">(không có nội dung)</i>'}</p>
            <div class="row">
              ${m.coins && !m.claimed ? `<button class="btn gold" data-claim="${m.id}">🎁 Nhận ${fmt(m.coins)} xu</button>` : ''}
              ${m.from.id ? `<button class="btn small" data-reply="${m.id}">↩️ Trả lời</button>` : ''}
              <button class="btn small" data-delete="${m.id}" ${m.coins && !m.claimed ? 'disabled title="Nhận quà trước đã"' : ''}>🗑️ Xoá</button>
            </div>
          </div>` : ''}
        </li>`).join('')}</ul>` : '<p class="muted">Hộp thư trống.</p>'}`;
  }

  async function load() {
    const box = await api('/mail');
    if (!alive) return;
    mails = box.mails;
    draw();
  }

  page.addEventListener('click', async (e) => {
    try {
      const o = e.target.closest('[data-open]');
      if (o) {
        const id = Number(o.dataset.open);
        open = open === id ? null : id;
        const m = mails.find((x) => x.id === id);
        if (open && m && !m.read) {
          m.read = true;
          api(`/mail/${id}/read`, {}).then(() => ctx.refreshMe()).catch(() => {});
        }
        return draw();
      }
      const claim = e.target.closest('[data-claim]');
      if (claim) {
        claim.disabled = true;
        const res = await api(`/mail/${claim.dataset.claim}/claim`, {});
        ctx.applyResult(res);
        ctx.toast(res.result?.message ?? 'Đã nhận quà.');
        return load();
      }
      const del = e.target.closest('[data-delete]');
      if (del) {
        const res = await api(`/mail/${del.dataset.delete}/delete`, {});
        ctx.toast(res.message);
        open = null;
        await load();
        return ctx.refreshMe();
      }
      const reply = e.target.closest('[data-reply]');
      if (reply) {
        const m = mails.find((x) => x.id === Number(reply.dataset.reply));
        const form = page.querySelector('[data-compose]');
        form.elements.to.value = m?.from.username ?? m?.from.name ?? '';
        form.elements.subject.value = m ? `Re: ${m.subject}`.slice(0, 80) : '';
        form.elements.body.focus();
        return;
      }
      if (e.target.closest('[data-read-all]')) {
        await api('/mail/read-all', {});
        await load();
        return ctx.refreshMe();
      }
    } catch (err) {
      ctx.fail(err);
    }
  });

  page.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const res = await api('/mail/send', { to: form.elements.to.value.trim(), subject: form.elements.subject.value, body: form.elements.body.value });
      ctx.toast(res.message);
      form.reset();
    } catch (err) {
      ctx.fail(err);
    } finally {
      btn.disabled = false;
    }
  });

  load().catch(ctx.fail);
  return () => {
    alive = false;
  };
}
