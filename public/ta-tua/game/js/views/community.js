// Bạn bè và Hội: kết bạn, thăm nhà, thả tim, tặng quà; lập/gia nhập Hội, góp quỹ, nâng cấp, dự án tuần.
import { api } from '../api.js';
import { createPetFigure } from '../sprite.js';
import { esc, fmt, openModal, closeModal, viewHead, ageText } from '../ui.js';

let tab = 'friends';
let emblem = null;

export function renderCommunity(root, ctx) {
  root.innerHTML = `<div class="com-page">
    ${viewHead('👥 Bạn bè & Hội', 'Kết bạn để thăm nhà, thả tim, tặng quà. Vào Hội để góp quỹ, nâng cấp và cùng làm dự án tuần.')}
    <div class="filters">
      <button class="btn small ${tab === 'friends' ? 'current' : ''}" data-tab="friends">🤝 Bạn bè</button>
      <button class="btn small ${tab === 'guild' ? 'current' : ''}" data-tab="guild">🏯 Hội</button>
    </div>
    <div class="com-view"><div class="empty muted">Đang tải…</div></div></div>`;
  const page = root.querySelector('.com-page');
  const view = page.querySelector('.com-view');
  const { species, items, commodities, guild: guildRules } = ctx.catalog;
  const figures = [];
  let friendData = null;
  let guildData = null;

  const speciesOf = (id) => species.find((s) => s.id === id) ?? species[0];
  const mountFigure = (slot, pet, base) => {
    if (!slot || !pet) return;
    const figure = createPetFigure(speciesOf(pet.species), base, pet.wear, {
      stage: pet.stage ?? pet.age?.stage, ageScale: pet.scale ?? pet.age?.scale ?? 1,
    });
    slot.append(figure.el);
    figures.push(figure);
  };
  const clearFigures = () => figures.splice(0).forEach((f) => f.destroy());

  // ---- bạn bè ----

  function drawFriends(f) {
    clearFigures();
    view.innerHTML = `
      <div class="com-grid">
        <section class="card com-box">
          <h3>➕ Kết bạn</h3>
          <form class="money-form" data-request>
            <input name="username" required minlength="3" maxlength="20" placeholder="Tên người chơi" autocomplete="off" />
            <button class="btn primary">Gửi lời mời</button>
          </form>
          ${f.incoming.length ? `<h4>Lời mời đến</h4><ul class="flow-list">${f.incoming.map((r) => `
            <li><span>${esc(r.username)}</span><span class="row"><button class="btn small mint" data-accept="${r.id}">Đồng ý</button>
              <button class="btn small" data-remove="${r.id}">Từ chối</button></span></li>`).join('')}</ul>` : ''}
          ${f.outgoing.length ? `<h4>Đang chờ đồng ý</h4><ul class="flow-list">${f.outgoing.map((r) => `
            <li><span>${esc(r.username)}</span><button class="link-btn" data-remove="${r.id}">Hủy</button></li>`).join('')}</ul>` : ''}
          <p class="muted small">Nhà bạn được ${f.myLikes.total} tim (${f.myLikes.today} hôm nay). Hôm nay còn tặng được ${f.giftsLeft} món.</p>
        </section>
        <section class="card com-box wide">
          <h3>🤝 Bạn bè (${f.friends.length})</h3>
          ${f.friends.length ? `<div class="friend-grid">${f.friends.map((fr) => `
            <article class="friend-card">
              <div class="friend-pet" data-fig="${fr.id}"></div>
              <div>
                <b>${esc(fr.username)}</b> ${fr.inPark ? '<span class="badge star">🌳 ở công viên</span>' : ''}
                <br><small class="muted">${fr.pet ? `${esc(fr.pet.name)} · Lv ${fr.pet.level} · ${fr.pet.mood.label}` : 'Chưa nuôi bé nào'}</small>
              </div>
              <div class="row">
                <button class="btn small" data-visit="${fr.id}">🏠 Thăm</button>
                <button class="btn small pink" data-like="${fr.id}" ${fr.likedToday ? 'disabled' : ''}>${fr.likedToday ? '💖 Đã thả' : '💖 Thả tim'}</button>
                <button class="btn small" data-gift="${fr.id}" ${f.giftsLeft ? '' : 'disabled'}>🎁</button>
                <button class="link-btn" data-remove="${fr.id}" title="Xóa bạn">✕</button>
              </div>
            </article>`).join('')}</div>`
            : '<p class="muted">Chưa có bạn nào. Gặp người chơi khác ở công viên rồi kết bạn nhé!</p>'}
        </section>
      </div>`;
    for (const fr of f.friends) mountFigure(view.querySelector(`[data-fig="${fr.id}"]`), fr.pet, 0.38);
  }

  async function visitFriend(id) {
    const v = await api(`/friends/${id}/visit`);
    openModal({
      title: `Nhà của ${v.username}`,
      html: `
        <p class="muted">${v.guild ? `Hội ${esc(v.guild)} · ` : ''}💖 ${v.likes} tim</p>
        <div class="visit-pets">${v.pets.map((p) => `
          <div class="visit-pet">
            <div class="friend-pet big" data-vfig="${p.id}"></div>
            <b>${esc(p.name)}${p.id === v.activePetId ? ' ⭐' : ''}</b>
            <small class="muted">Lv ${p.level} · ${ageText(p.age.days)} · ${p.mood.label}${p.busyUntil ? ' · đang đi làm' : ''}</small>
          </div>`).join('')}</div>
        <button class="btn pink" data-pick="like" ${v.likedToday ? 'disabled' : ''}>${v.likedToday ? '💖 Hôm nay đã thả tim' : '💖 Thả tim nhà này'}</button>`,
      onPick: (pick) => {
        if (pick === 'like') ctx.act(`/friends/${id}/like`);
      },
    });
    const modal = document.querySelector('.modal');
    for (const p of v.pets) mountFigure(modal.querySelector(`[data-vfig="${p.id}"]`), p, 0.6);
  }

  function giftTo(id) {
    const owned = Object.values(items).filter((i) => (i.type === 'food' || i.type === 'care') && ctx.me.inventory[i.id] > 0);
    openModal({
      title: 'Tặng quà',
      html: owned.length
        ? `<div class="pick-list">${owned.map((i) => `
            <button class="pick" data-pick="${i.id}"><b>${i.icon}</b><span>${esc(i.name)}</span><span class="badge">×${ctx.me.inventory[i.id]}</span></button>`).join('')}</div>`
        : '<div class="empty"><b>🫙</b><p>Túi chưa có đồ ăn hay đồ chăm sóc để tặng.</p></div>',
      onPick: (itemId) => ctx.act(`/friends/${id}/gift`, { itemId }),
    });
  }

  // ---- Hội ----

  function drawGuild(g) {
    clearFigures();
    if (!g.guild) {
      const canCreate = ctx.bestLevel() >= ctx.catalog.unlocks.guild;
      emblem ??= g.emblems[0];
      view.innerHTML = `
        <div class="com-grid">
          <section class="card com-box">
            <h3>🏯 Lập Hội mới</h3>
            <div class="emblems">${g.emblems.map((e) => `<button class="emblem ${e === emblem ? 'current' : ''}" data-emblem="${e}">${e}</button>`).join('')}</div>
            <form class="money-form" data-create>
              <input name="name" required minlength="3" maxlength="20" placeholder="Tên Hội" ${canCreate ? '' : 'disabled'} />
              <button class="btn primary" ${canCreate ? '' : 'disabled'}>Lập Hội · ${fmt(g.createCost)} 🪙</button>
            </form>
            ${canCreate ? '' : `<p class="locked-note">🔒 Cần một bé cấp ${ctx.catalog.unlocks.guild} để lập Hội. Gia nhập Hội có sẵn thì không cần.</p>`}
          </section>
          <section class="card com-box wide">
            <h3>🏆 Các Hội trong phố</h3>
            ${g.guilds.length ? `<ul class="guild-list">${g.guilds.map((x, i) => `
              <li><span class="rank-no">${i + 1}</span><span class="guild-emblem">${x.emblem}</span>
                <div><b>${esc(x.name)}</b><br><small class="muted">${x.members}/${x.max} thành viên · ${fmt(x.prestige)} danh vọng</small></div>
                <button class="btn small" data-join="${x.id}" ${x.members >= x.max ? 'disabled' : ''}>Gia nhập</button></li>`).join('')}</ul>`
              : '<p class="muted">Chưa có Hội nào. Hãy là người đầu tiên!</p>'}
          </section>
        </div>`;
      return;
    }
    const me = g.guild;
    const p = me.project;
    view.innerHTML = `
      <div class="com-grid">
        <section class="card com-box guild-hero">
          <span class="guild-emblem big">${me.emblem}</span>
          <div><h3>${esc(me.name)}</h3><p class="muted">Trưởng Hội: ${esc(me.leaderName)} · ${fmt(me.prestige)} danh vọng · ${me.members.length}/${guildRules.maxMembers} thành viên</p></div>
          <button class="link-btn danger" data-leave>Rời Hội</button>
        </section>
        <section class="card com-box">
          <h3>💰 Quỹ Hội</h3>
          <div class="big-number">${fmt(me.treasury)} <small>🪙</small></div>
          <form class="money-form" data-donate>
            <input name="amount" type="number" min="1" step="1" required placeholder="Số xu muốn góp" />
            <button class="btn primary">Góp quỹ</button>
          </form>
          <p class="muted small">Bạn đã góp ${fmt(me.myDonated)} 🪙. Chỉ trưởng Hội được dùng quỹ để nâng cấp.</p>
          ${Object.entries(me.upgrades).map(([k, u]) => `
            <div class="upgrade-row"><div><b>${u.name}</b> <span class="badge">cấp ${u.level}/${u.costs.length}</span><br><small class="muted">${u.desc}</small></div>
              ${u.next === null ? '<span class="badge star">Tối đa</span>'
                : `<button class="btn small" data-gupgrade="${k}" ${me.leader && me.treasury >= u.next ? '' : 'disabled'}>${fmt(u.next)} 🪙</button>`}</div>`).join('')}
        </section>
        <section class="card com-box">
          <h3>${p.icon} Dự án tuần: ${p.name}</h3>
          ${p.done ? '<p class="up"><b>✓ Đã hoàn thành tuần này!</b></p>' : '<p class="muted">Góp đủ nguyên liệu từ kho để hoàn thành.</p>'}
          ${Object.entries(p.needs).map(([c, lots]) => {
            const have = p.progress[c] ?? 0;
            return `<div class="meter"><div class="meter-head"><span>${commodities[c].icon} ${commodities[c].name}</span><span>${have.toLocaleString('vi-VN')}/${lots} lô</span></div>
              <div class="bar xp"><i style="width:${Math.min(100, (have / lots) * 100)}%"></i></div>
              ${p.done || have >= lots ? '' : `<div class="row"><button class="btn small" data-contribute="${c}:10">Góp 1 lô</button><button class="btn small" data-contribute="${c}:50">Góp 5 lô</button></div>`}</div>`;
          }).join('')}
          <p class="muted small">Xong dự án: Hội +${p.prestige} danh vọng, mỗi thành viên +${p.reward} 🪙 từ ngân sách thị trấn.</p>
        </section>
        <section class="card com-box wide">
          <h3>👥 Thành viên</h3>
          <ul class="flow-list">${me.members.map((m) => `
            <li><span>${esc(m.username)}${m.inPark ? ' <span class="badge star">🌳</span>' : ''}</span><small class="muted">góp ${fmt(m.donated)} 🪙</small></li>`).join('')}</ul>
        </section>
      </div>`;
  }

  async function load() {
    if (tab === 'friends') {
      friendData = await api('/friends');
      if (view.isConnected) drawFriends(friendData);
    } else {
      guildData = await api('/guild');
      if (view.isConnected) drawGuild(guildData);
    }
  }

  page.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;
    if (d.tab) {
      tab = d.tab;
      return ctx.refresh();
    }
    if (d.accept) return ctx.act(`/friends/${d.accept}/accept`);
    if (d.remove) return ctx.act(`/friends/${d.remove}/remove`);
    if (d.like) return ctx.act(`/friends/${d.like}/like`);
    if (d.visit) return visitFriend(d.visit).catch(ctx.fail);
    if (d.gift) return giftTo(d.gift);
    if (d.emblem) {
      emblem = d.emblem;
      return drawGuild(guildData);
    }
    if (d.join) return ctx.act(`/guild/${d.join}/join`);
    if (d.leave !== undefined && confirm('Rời Hội?')) return ctx.act('/guild/leave');
    if (d.gupgrade) return ctx.act('/guild/upgrade', { key: d.gupgrade });
    if (d.contribute) {
      const [commodity, qty] = d.contribute.split(':');
      return ctx.act('/guild/contribute', { commodity, qty: Number(qty) });
    }
  });

  page.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    if (e.target.matches('[data-request]')) ctx.act('/friends/request', { username: form.get('username') });
    else if (e.target.matches('[data-create]')) ctx.act('/guild/create', { name: form.get('name'), emblem });
    else if (e.target.matches('[data-donate]')) ctx.act('/guild/donate', { amount: Number(form.get('amount')) });
  });

  load().catch(ctx.fail);
  return () => {
    clearFigures();
    closeModal();
  };
}
