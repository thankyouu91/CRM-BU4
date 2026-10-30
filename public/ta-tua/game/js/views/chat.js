// Trò chuyện: kênh chung của cả thị trấn, kênh gia tộc và tin nhắn riêng. Hỏi tin mới vài giây một lần khi đang mở màn này.
import { api } from '../api.js';
import { ago, clock, esc, openModal, closeModal, viewHead } from '../ui.js';
import { composeMailTo } from './mail.js';

const POLL_MS = 4_000;
let tab = 'world'; // 'world' | 'clan' | 'pm'
let pmKey = null; // 'pm:<id>' đang mở

/** Mở thẳng cuộc trò chuyện riêng với người chơi `id` (từ hộp thư, bạn bè...). */
export function openPm(id) {
  tab = 'pm';
  pmKey = `pm:${id}`;
}

const time = (ts) => (Date.now() - ts < 20 * 3_600_000 ? clock(ts) : ago(ts));

export function renderChat(root, ctx) {
  const badges = ctx.me.badges ?? {};
  const dot = (n) => (n ? `<span class="chat-dot">${n > 99 ? '99+' : n}</span>` : '');
  root.innerHTML = `<div class="chat-page">
    ${viewHead('💬 Trò chuyện', 'Kênh chung cho cả thị trấn, kênh riêng của gia tộc và tin nhắn riêng. Lịch sự, không spam, không lộ mật khẩu nhé.')}
    <div class="filters">
      <button class="btn small ${tab === 'world' ? 'current' : ''}" data-tab="world">🌐 Kênh chung</button>
      <button class="btn small ${tab === 'clan' ? 'current' : ''}" data-tab="clan">🏯 Gia tộc ${dot(badges.clan)}</button>
      <button class="btn small ${tab === 'pm' ? 'current' : ''}" data-tab="pm">✉️ Tin nhắn riêng ${dot(badges.pm)}</button>
    </div>
    <div class="chat-body"><div class="empty muted">Đang tải…</div></div>
  </div>`;
  const page = root.querySelector('.chat-page');
  const body = page.querySelector('.chat-body');
  let timer = null;
  let alive = true;
  let current = null; // { key, lastId, firstId }

  const stop = () => {
    clearInterval(timer);
    timer = null;
  };

  function line(m) {
    const mine = m.userId === ctx.me.user.id;
    const who = `${m.clan ? `<span title="${esc(m.clan.name)}">${esc(m.clan.emblem)}</span> ` : ''}<b>${esc(m.name)}</b>`;
    return `<li class="chat-line ${mine ? 'mine' : ''}" data-id="${m.id}">
      <div class="chat-meta">${mine ? who : `<button class="link-btn chat-who" data-who="${m.userId}" data-name="${esc(m.name)}" data-username="${esc(m.username)}">${who}</button>`}
        <time>${time(m.at)}</time></div>
      <div class="chat-text">${m.text == null ? '<i class="muted">Tin của người bạn đã chặn</i>' : esc(m.text)}</div>
    </li>`;
  }

  function append(list, messages, { prepend = false } = {}) {
    if (!messages.length) return;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    const html = messages.map(line).join('');
    list.querySelector('.chat-empty')?.remove();
    if (prepend) {
      const h = list.scrollHeight;
      list.insertAdjacentHTML('afterbegin', html);
      list.scrollTop += list.scrollHeight - h;
    } else {
      list.insertAdjacentHTML('beforeend', html);
      if (atBottom || messages.some((m) => m.userId === ctx.me.user.id)) list.scrollTop = list.scrollHeight;
    }
  }

  /** Vẽ một kênh (chung, gia tộc hoặc một cuộc trò chuyện riêng) vào `host` và bắt đầu hỏi tin mới. */
  async function openChannel(host, key, title = '') {
    stop();
    let feed;
    try {
      feed = await api(`/chat/${encodeURIComponent(key)}`);
    } catch (err) {
      host.innerHTML = `<div class="empty muted">${esc(err.message)}</div>`;
      if (err.status === 401) ctx.fail(err);
      return;
    }
    if (!alive) return;
    current = { key, lastId: feed.messages.at(-1)?.id ?? 0, firstId: feed.messages[0]?.id ?? 0 };
    const other = feed.other;
    const head = feed.clan
      ? `<div class="chat-head">${esc(feed.clan.emblem)} <b>${esc(feed.clan.name)}</b> <small class="muted">chỉ thành viên gia tộc thấy</small></div>`
      : other
        ? `<div class="chat-head"><b>${esc(other.name)}</b> <small class="muted">@${esc(other.username)}</small>
            <span class="row">
              <button class="btn small" data-mail-to="${esc(other.username)}">📮 Gửi thư</button>
              <button class="btn small" data-${other.blocked ? 'unblock' : 'block'}="${other.id}">${other.blocked ? 'Bỏ chặn' : '🚫 Chặn'}</button>
            </span></div>`
        : title;
    const disabled = other?.blocked || other?.blocksMe;
    host.innerHTML = `${head}
      <ul class="chat-log-list">
        ${feed.more ? '<li class="chat-more"><button class="link-btn" data-older>Xem tin cũ hơn</button></li>' : ''}
        ${feed.messages.length ? '' : '<li class="chat-empty muted">Chưa có tin nào. Mở lời trước đi!</li>'}
      </ul>
      <form class="chat-send" data-send>
        <input name="text" maxlength="300" autocomplete="off" required
          placeholder="${disabled ? (other.blocked ? 'Bạn đang chặn người này' : 'Người này không nhận tin của bạn') : 'Nhập tin nhắn…'}" ${disabled ? 'disabled' : ''} />
        <button class="btn primary" ${disabled ? 'disabled' : ''}>Gửi</button>
      </form>`;
    const list = host.querySelector('.chat-log-list');
    append(list, feed.messages);
    list.scrollTop = list.scrollHeight;
    if (!disabled) host.querySelector('[data-send] input').focus({ preventScroll: true });
    timer = setInterval(() => poll(list), POLL_MS);
    if (feed.messages.length) ctx.refreshMe().catch(() => {}); // chấm đỏ của kênh vừa đọc
  }

  async function poll(list) {
    if (!current || document.visibilityState !== 'visible') return;
    const key = current.key;
    try {
      const feed = await api(`/chat/${encodeURIComponent(key)}?since=${current.lastId}`);
      if (!alive || current?.key !== key) return;
      const fresh = feed.messages.filter((m) => m.id > current.lastId && !list.querySelector(`[data-id="${m.id}"]`));
      if (fresh.length) {
        current.lastId = fresh.at(-1).id;
        append(list, fresh);
      }
    } catch (err) {
      if (err.status === 401) ctx.fail(err);
    }
  }

  async function older(list) {
    const feed = await api(`/chat/${encodeURIComponent(current.key)}?before=${current.firstId}`);
    list.querySelector('.chat-more')?.remove();
    if (feed.messages.length) {
      current.firstId = feed.messages[0].id;
      append(list, feed.messages, { prepend: true });
    }
    if (feed.messages.length >= 50) list.insertAdjacentHTML('afterbegin', '<li class="chat-more"><button class="link-btn" data-older>Xem tin cũ hơn</button></li>');
  }

  async function drawPm() {
    stop();
    const { threads, blocked } = await api('/chat/threads');
    if (!alive) return;
    body.innerHTML = `<div class="chat-pm">
      <aside class="card chat-threads">
        <form class="chat-find" data-find>
          <input name="username" required minlength="2" maxlength="20" placeholder="Tên người chơi" autocomplete="off" />
          <button class="btn small primary">Nhắn</button>
        </form>
        <ul>${threads.length ? threads.map((t) => `
          <li><button class="chat-thread ${t.key === pmKey ? 'current' : ''}" data-thread="${t.key}">
            <b>${esc(t.other.name)}</b>${t.unread ? `<span class="chat-dot">${t.unread}</span>` : ''}
            <small class="muted">${t.last ? `${t.last.mine ? 'Bạn: ' : ''}${t.last.text == null ? '…' : esc(t.last.text.slice(0, 40))} · ${time(t.last.at)}` : ''}</small>
          </button></li>`).join('') : '<li class="muted small">Chưa có cuộc trò chuyện nào. Gõ tên người chơi để bắt đầu.</li>'}</ul>
        ${blocked.length ? `<details class="chat-blocked"><summary>Đã chặn (${blocked.length})</summary><ul>${blocked.map((b) => `
          <li>${esc(b.name)} <button class="link-btn" data-unblock="${b.id}">Bỏ chặn</button></li>`).join('')}</ul></details>` : ''}
      </aside>
      <section class="card chat-room" data-room>${pmKey ? '' : '<div class="empty muted">Chọn một cuộc trò chuyện.</div>'}</section>
    </div>`;
    if (pmKey) openChannel(body.querySelector('[data-room]'), pmKey);
  }

  function draw() {
    for (const b of page.querySelectorAll('[data-tab]')) b.classList.toggle('current', b.dataset.tab === tab);
    if (tab === 'pm') return drawPm().catch(ctx.fail);
    body.innerHTML = '<section class="card chat-room" data-room></section>';
    openChannel(body.querySelector('[data-room]'), tab);
  }

  function whoMenu(btn) {
    const { who, name, username } = btn.dataset;
    openModal({
      title: name,
      html: `<p class="muted">@${esc(username)}</p>
        <div class="row">
          <button class="btn primary" data-pick="pm">✉️ Nhắn riêng</button>
          <button class="btn" data-pick="mail">📮 Gửi thư</button>
          <button class="btn" data-pick="block">🚫 Chặn</button>
        </div>`,
      onPick: async (pick) => {
        closeModal();
        if (pick === 'pm') {
          openPm(who);
          draw();
        } else if (pick === 'mail') {
          composeMailTo(username);
          ctx.go('mail');
        } else if (pick === 'block') {
          try {
            ctx.toast((await api(`/chat/block/${who}`, {})).message);
            draw();
          } catch (err) {
            ctx.fail(err);
          }
        }
      },
    });
  }

  page.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) {
      tab = t.dataset.tab;
      return draw();
    }
    const thread = e.target.closest('[data-thread]');
    if (thread) {
      pmKey = thread.dataset.thread;
      for (const b of page.querySelectorAll('[data-thread]')) b.classList.toggle('current', b === thread);
      thread.querySelector('.chat-dot')?.remove();
      return openChannel(page.querySelector('[data-room]'), pmKey);
    }
    const who = e.target.closest('[data-who]');
    if (who) return whoMenu(who);
    const mailTo = e.target.closest('[data-mail-to]');
    if (mailTo) {
      composeMailTo(mailTo.dataset.mailTo);
      return ctx.go('mail');
    }
    try {
      if (e.target.closest('[data-older]')) return await older(page.querySelector('.chat-log-list'));
      const block = e.target.closest('[data-block]');
      const unblock = e.target.closest('[data-unblock]');
      if (block || unblock) {
        const res = await api(block ? `/chat/block/${block.dataset.block}` : `/chat/unblock/${unblock.dataset.unblock}`, {});
        ctx.toast(res.message);
        draw();
      }
    } catch (err) {
      ctx.fail(err);
    }
  });

  page.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      if (form.matches('[data-send]')) {
        const input = form.elements.text;
        const text = input.value.trim();
        if (!text || !current) return;
        input.value = '';
        const { message } = await api(`/chat/${encodeURIComponent(current.key)}`, { text });
        const list = page.querySelector('.chat-log-list');
        if (message && !list.querySelector(`[data-id="${message.id}"]`)) {
          append(list, [message]);
          current.lastId = Math.max(current.lastId, message.id);
        }
      } else if (form.matches('[data-find]')) {
        const found = await api(`/chat/find?username=${encodeURIComponent(form.elements.username.value.trim())}`);
        pmKey = found.key;
        await drawPm();
      }
    } catch (err) {
      ctx.fail(err);
    }
  });

  draw();
  return () => {
    alive = false;
    stop();
  };
}
