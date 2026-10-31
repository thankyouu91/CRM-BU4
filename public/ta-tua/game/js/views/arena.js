// Đấu trường gia tộc (#arena): đội hình 15 người chiến lực cao nhất, thách đấu giành lô đất hoặc ghế ngành chiến lược,
// chọn giờ đấu, lịch đấu toàn thị trấn, lịch sử và xem lại trận (bé vẽ bằng bộ khung, có thanh máu).
// Luật ở shared/arena.js, server ở petdex/server/arena.js.
import { api } from '../api.js';
import { hasDirections } from '../petmotion.js';
import { createPetFigure } from '../sprite.js';
import { esc, fmt, viewHead } from '../ui.js';
import { RARITY_NAMES } from '../shared/arena.js';

const STATUS = {
  proposed: { label: 'Chờ chọn giờ', cls: 'wait' },
  scheduled: { label: 'Đã chốt giờ', cls: 'set' },
  done: { label: 'Đã đấu', cls: 'done' },
  forfeit: { label: 'Bỏ trận', cls: 'done' },
  cancelled: { label: 'Đã hủy', cls: 'off' },
};
const VN = { timeZone: 'Asia/Ho_Chi_Minh' };
const when = (ts) => new Date(ts).toLocaleString('vi-VN', { ...VN, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const dayLabel = (day) => new Date(`${day}T12:00:00+07:00`).toLocaleDateString('vi-VN', { ...VN, weekday: 'short', day: '2-digit', month: '2-digit' });

export function renderArena(root, ctx) {
  root.innerHTML = `<div class="arena-page">
    ${viewHead('⚔️ Đấu trường gia tộc', 'Thách đấu giành lô đất hoặc ghế ngành chiến lược của gia tộc khác. Đến giờ, 15 thành viên chiến lực cao nhất mỗi bên tự đánh theo lượt; xem lại trận ở đây.')}
    <div class="arena-body"><div class="empty muted">Đang tải…</div></div></div>`;
  const body = root.querySelector('.arena-body');
  const { species } = ctx.catalog;
  const speciesOf = (id) => species.find((s) => s.id === id) ?? species[0];
  let figures = [];
  let timer = null;
  let data = null;

  const cleanup = () => {
    clearInterval(timer);
    timer = null;
    for (const f of figures) f.destroy();
    figures = [];
  };

  const load = () => api('/arena').then((d) => {
    data = d;
    draw();
  }).catch(ctx.fail);

  function draw() {
    cleanup();
    const c = data.clan;
    const r = data.rules;
    const manage = c && (c.role === 'leader' || c.role === 'elder');
    const active = c?.wars.find((w) => w.status === 'proposed' || w.status === 'scheduled');
    body.innerHTML = `
      <section class="card arena-rules">
        <p class="muted small">Bên thách đấu đề xuất 1–${r.maxSlots} khung ${r.hours.map((h) => `${h}h`).join(' hoặc ')} (giờ Việt Nam) trong ${r.maxDaysAhead} ngày tới; bên bị thách chọn một khung trong ${r.confirmHours} giờ, không thì bị xử thua và nộp ${Math.round(r.forfeitPenalty * 100)}% quỹ.
          Bên thua trận mất lô/ghế và ${Math.round(r.penalty * 100)}% tài sản gia tộc (quỹ cộng tiền gửi kỳ hạn; quỹ thiếu thì rút tiền gửi, mất lãi), một nửa cho bên thắng, một nửa vào ngân sách thị trấn. Bên nào không có ai ra sân thì tính như bỏ trận. Sau trận, trang phục đang đeo trên các bé ra sân của hai bên hỏng hẳn (sửa ở Lò rèn); bé ở nhà không sao. Mục tiêu đổi chủ trước giờ đấu thì trận bị hủy.
          Chiến lực = (100 + 20 × cấp bé) × độ hiếm × (1 + 5% mỗi điểm trang phục còn dùng được: Lam 1, Lục 2, Vàng 3, Đỏ 4).</p>
      </section>
      ${c ? rosterBox(c, r) : '<section class="card"><p class="muted">Vào một gia tộc để thách đấu và ra sân.</p></section>'}
      ${c && manage && !active ? challengeBox(c, data.days, r) : ''}
      ${c ? myWarsBox(c, manage) : ''}
      ${listBox('📅 Lịch đấu toàn thị trấn', data.upcoming, 'Chưa có trận nào đang chờ.')}
      ${listBox('🏆 Lịch sử', data.history, 'Chưa có trận nào.', true)}
      <section class="card arena-replay" hidden></section>`;
  }

  function rosterBox(c, r) {
    return `
      <section class="card">
        <div class="row-between"><h3>${esc(c.emblem)} ${esc(c.name)}: đội hình</h3><span class="muted small">quỹ ${fmt(c.treasury)} 🪙</span></div>
        <ol class="arena-roster">${c.roster.map((m, i) => `
          <li class="${i < r.teamSize && m.pet ? 'in' : 'out'}">
            <b>${esc(m.name)}</b>
            <span class="muted small">${m.pet ? `${esc(m.pet.name)} · cấp ${m.pet.level} · ${RARITY_NAMES[m.pet.rarity] ?? ''}${m.pet.gear ? ` · ${m.pet.gear} món` : ''}` : 'chưa có bé'}</span>
            <span class="power">⚔️ ${fmt(m.power)}</span>
          </li>`).join('')}</ol>
        <p class="muted small">${r.teamSize} người đầu danh sách ra sân (tính lại đúng giờ đấu).</p>
      </section>`;
  }

  function challengeBox(c, days, r) {
    const byClan = new Map();
    for (const t of c.targets) {
      const list = byClan.get(t.clanId) ?? { name: t.clan, items: [] };
      list.items.push(t);
      byClan.set(t.clanId, list);
    }
    const dayOpts = (blank) => `${blank ? '<option value="">(không)</option>' : ''}${days.map((d) => `<option value="${d}">${dayLabel(d)}</option>`).join('')}`;
    const hourOpts = r.hours.map((h) => `<option value="${h}">${h}:00</option>`).join('');
    return `
      <section class="card">
        <h3>🎯 Thách đấu</h3>
        ${c.targets.length ? `<form class="arena-form" data-form="challenge">
          <label>Mục tiêu <select name="target" required>${[...byClan.values()].map((g) => `
            <optgroup label="${esc(g.name)}">${g.items.map((t) => `<option value="${t.clanId}|${t.kind}|${esc(t.ref)}">${t.kind === 'seat' ? '🏛️' : '🗺️'} ${esc(t.name)}${t.industry ? ` (${esc(t.industry)})` : ''}</option>`).join('')}</optgroup>`).join('')}
          </select></label>
          <label>Khung 1 <span class="row"><select name="day1" required>${dayOpts(false)}</select><select name="hour1">${hourOpts}</select></span></label>
          <label>Khung 2 <span class="row"><select name="day2">${dayOpts(true)}</select><select name="hour2">${hourOpts}</select></span></label>
          <button class="btn primary">⚔️ Gửi lời thách đấu</button>
        </form>` : '<p class="muted">Chưa có gia tộc nào khác giữ lô đất hay ghế chiến lược.</p>'}
      </section>`;
  }

  const warLine = (w, extra = '') => `
    <li class="arena-war">
      <span class="vs"><b>${esc(w.challenger.emblem)} ${esc(w.challenger.name)}</b> ⚔️ <b>${esc(w.defender.emblem)} ${esc(w.defender.name)}</b></span>
      <span class="muted small">${esc(w.target.name)} · ${w.scheduledAt ? when(w.scheduledAt) : `chờ chọn giờ tới ${when(w.deadline)}`}</span>
      <span class="tag ${STATUS[w.status].cls}">${STATUS[w.status].label}${w.winnerId ? ` · thắng: ${esc(w.winnerId === w.challenger.id ? w.challenger.name : w.defender.name)}` : ''}${w.penalty ? ` · phạt ${fmt(w.penalty)} 🪙` : ''}</span>
      ${extra}
    </li>`;

  function myWarsBox(c, manage) {
    if (!c.wars.length) return '';
    return `
      <section class="card">
        <h3>🛡️ Trận của gia tộc</h3>
        <ul class="arena-list">${c.wars.map((w) => {
          let extra = '';
          if (w.status === 'proposed' && manage && w.defender.id === c.id) {
            extra = `<span class="row">${w.slots.filter((s) => s > Date.now()).map((s) => `<button class="btn small primary" data-confirm="${w.id}" data-at="${s}">Chọn ${when(s)}</button>`).join('')}</span>`;
          } else if (w.status === 'proposed' && manage && w.challenger.id === c.id) {
            extra = `<button class="btn small" data-withdraw="${w.id}">Rút lời thách</button>`;
          } else if (w.status === 'done') {
            extra = `<button class="btn small mint" data-replay="${w.id}">▶ Xem lại</button>`;
          }
          return warLine(w, extra);
        }).join('')}</ul>
      </section>`;
  }

  function listBox(title, list, empty, replay = false) {
    return `
      <section class="card">
        <h3>${title}</h3>
        ${list.length ? `<ul class="arena-list">${list.map((w) => warLine(w, replay && w.status === 'done' ? `<button class="btn small mint" data-replay="${w.id}">▶ Xem lại</button>` : '')).join('')}</ul>` : `<p class="muted">${empty}</p>`}
      </section>`;
  }

  // ---------------------------------------------------------------- xem lại trận

  async function replay(id) {
    const box = body.querySelector('.arena-replay');
    let w;
    try {
      w = await api(`/arena/${id}`);
    } catch (err) {
      return ctx.fail(err);
    }
    cleanup();
    box.hidden = false;
    const side = (team, s) => `
      <div class="arena-side side-${s}">
        <h4>${esc(s === 0 ? w.challenger.emblem : w.defender.emblem)} ${esc(s === 0 ? w.challenger.name : w.defender.name)}</h4>
        <div class="arena-fighters">${team.map((m, i) => `
          <div class="fighter" data-f="${s}-${i}">
            <div class="fig"></div>
            <div class="hp"><i style="width:100%"></i></div>
            <small>${esc(m.pet?.name ?? m.name)} <span class="muted">⚔️${fmt(m.power)}</span></small>
          </div>`).join('') || '<p class="muted small">Không ai ra sân.</p>'}</div>
      </div>`;
    box.innerHTML = `
      <div class="row-between"><h3>▶ ${esc(w.challenger.name)} ⚔️ ${esc(w.defender.name)} · ${esc(w.target.name)}</h3>
        <span class="row"><button class="btn small" data-play>⏸ Dừng</button><button class="btn small" data-skip>⏭ Kết quả</button></span></div>
      <p class="muted small" data-round>Lượt 0/${w.rounds.length}</p>
      <div class="arena-stage">${side(w.teams[0], 0)}${side(w.teams[1], 1)}</div>
      <p class="arena-result" data-result hidden></p>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    w.teams.forEach((team, s) => team.forEach((m, i) => {
      const slot = box.querySelector(`[data-f="${s}-${i}"] .fig`);
      if (!slot || !m.pet) return;
      const f = createPetFigure(speciesOf(m.pet.species), 0.34, m.pet.wear, { stage: m.pet.stage, ageScale: m.pet.scale ?? 1, level: m.pet.level, px: 'arena' });
      // Hai bên nhìn nhau. Sheet có dáng đứng nghiêng (idleE / idleW) thì quay thật, đồ đeo không bị ngược; sheet cũ lật ảnh.
      if (hasDirections(f.sprite.sheet, 'idle')) f.setDirection(s === 1 ? 'W' : 'E');
      else if (s === 1) f.el.classList.add('flip');
      slot.append(f.el);
      figures.push(f);
    }));
    const maxHp = w.maxHp;
    const hp = maxHp.map((t) => t.slice());
    const setHp = (s, i) => {
      const el = box.querySelector(`[data-f="${s}-${i}"]`);
      if (!el) return;
      el.querySelector('.hp i').style.width = `${Math.max(0, (hp[s][i] / maxHp[s][i]) * 100)}%`;
      el.classList.toggle('down', hp[s][i] <= 0);
    };
    let r = 0;
    const finish = () => {
      clearInterval(timer);
      timer = null;
      const res = box.querySelector('[data-result]');
      res.hidden = false;
      const winner = w.winnerId === w.challenger.id ? w.challenger.name : w.defender.name;
      res.innerHTML = `🏆 <b>${esc(winner)}</b> thắng${w.penalty ? ` · bên thua nộp ${fmt(w.penalty)} 🪙` : ''}${w.transfer?.moved ? ` · giành ${esc(w.target.name)}` : ''}${w.broken ? ` · ${fmt(w.broken)} món trang phục hỏng` : ''}.`;
      box.querySelector('[data-play]').disabled = true;
    };
    const step = () => {
      if (r >= w.rounds.length) return finish();
      for (const [s, , j, , , left] of w.rounds[r]) {
        hp[1 - s][j] = left;
        setHp(1 - s, j);
        box.querySelector(`[data-f="${1 - s}-${j}"]`)?.classList.add('hit');
      }
      r += 1;
      box.querySelector('[data-round]').textContent = `Lượt ${r}/${w.rounds.length}`;
      setTimeout(() => box.querySelectorAll('.fighter.hit').forEach((el) => el.classList.remove('hit')), 300);
    };
    const play = () => {
      clearInterval(timer);
      timer = setInterval(step, 700);
    };
    box.querySelector('[data-play]').addEventListener('click', (e) => {
      if (timer) {
        clearInterval(timer);
        timer = null;
        e.target.textContent = '▶ Phát';
      } else {
        play();
        e.target.textContent = '⏸ Dừng';
      }
    });
    box.querySelector('[data-skip]').addEventListener('click', () => {
      while (r < w.rounds.length) step();
      w.hp.forEach((t, s) => t.forEach((v, i) => {
        hp[s][i] = v;
        setHp(s, i);
      }));
      finish();
    });
    if (!w.rounds.length) finish();
    else play();
  }

  body.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.confirm) {
      if (!confirm(`Chốt giờ đấu ${when(Number(t.dataset.at))}? Cả thị trấn sẽ được thông báo.`)) return;
      ctx.act(`/arena/${t.dataset.confirm}/confirm`, { at: Number(t.dataset.at) });
    } else if (t.dataset.withdraw) {
      ctx.act(`/arena/${t.dataset.withdraw}/withdraw`, {});
    } else if (t.dataset.replay) {
      replay(Number(t.dataset.replay));
    }
  });

  body.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const [defenderId, kind, ref] = String(fd.target).split('|');
    const slots = [{ day: fd.day1, hour: Number(fd.hour1) }];
    if (fd.day2) slots.push({ day: fd.day2, hour: Number(fd.hour2) });
    if (!confirm('Gửi lời thách đấu? Thua trận thì gia tộc nộp 30% tài sản (quỹ + tiền gửi), và trang phục đang đeo trên các bé ra sân sẽ hỏng.')) return;
    ctx.act('/arena/challenge', { defenderId: Number(defenderId), kind, ref, slots });
  });

  load();
  return cleanup;
}
