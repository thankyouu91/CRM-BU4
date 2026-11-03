// Khu vui chơi: chọn mini-game, chơi trong lớp phủ, gửi kết quả cho server rồi hiện phần thưởng.
import { api } from '../api.js';
import { esc, fmt, fmtLots, viewHead } from '../ui.js';
import { TIERS } from '../shared/gear.js';

export function renderGames(root, ctx) {
  root.innerHTML = `${viewHead('🎮 Khu vui chơi & Hồ câu', 'Mỗi ván tốn 5 năng lượng của bé chính. Xu và nguyên liệu nhận được có giới hạn mỗi ngày.')}
    <div class="games-view"><div class="empty muted">Đang tải…</div></div>`;
  const view = root.querySelector('.games-view');
  const { games, gameCaps, skills, commodities } = ctx.catalog;
  let overlay = null;
  let cleanupGame = null;

  function draw(status) {
    const { used } = status;
    const pet = ctx.activePet();
    const meter = (label, value, max) => `
      <div class="meter"><div class="meter-head"><span>${label}</span><span>${value}/${max}</span></div>
        <div class="bar xp"><i style="width:${Math.min(100, (value / max) * 100)}%"></i></div></div>`;
    view.innerHTML = `
      <section class="card caps">
        <h3>🎁 Phần thưởng hôm nay</h3>
        <div class="caps-grid">
          ${meter('🪙 Xu', used.coins, gameCaps.coins)}
          ${meter(`${commodities.fish.icon} Cá (phần)`, used.fish, gameCaps.portions.fish)}
          ${meter(`${commodities.pearl.icon} Trân châu (phần)`, used.pearl, gameCaps.portions.pearl)}
        </div>
        <p class="muted small">${pet ? `${esc(pet.name)} còn ⚡ ${pet.energy} năng lượng.` : 'Nhận nuôi một bé để chơi.'} Đã chơi ${used.plays} ván hôm nay.</p>
      </section>
      <div class="game-grid">
        ${Object.entries(games).map(([id, g]) => `
          <article class="card game-card game-${id}">
            <div class="game-art">${g.icon}</div>
            <h3>${g.name}</h3>
            <p class="muted">${g.desc}</p>
            <p class="small">⏱ ${g.duration} giây · ⚡ ${g.energy} năng lượng</p>
            <button class="btn primary" data-play="${id}" ${!pet || pet.energy < g.energy ? 'disabled' : ''}>Chơi</button>
          </article>`).join('')}
      </div>`;
  }

  function closeOverlay() {
    cleanupGame?.();
    cleanupGame = null;
    overlay?.remove();
    overlay = null;
    ctx.refresh();
  }

  function showResult(game, r) {
    const parts = [];
    if (r.coins) parts.push(`<li>🪙 <b>+${fmt(r.coins)}</b> xu${r.rawCoins > r.coins ? ' <small class="muted">(chạm giới hạn ngày)</small>' : ''}</li>`);
    if (r.portions?.fish) parts.push(`<li>${commodities.fish.icon} <b>+${fmtLots(r.portions.fish)} lô</b> cá tươi vào kho</li>`);
    if (r.portions?.pearl) parts.push(`<li>${commodities.pearl.icon} <b>+${fmtLots(r.portions.pearl)} lô</b> trân châu vào kho</li>`);
    if (r.skill?.gain) parts.push(`<li>${skills[r.skill.id].icon} ${skills[r.skill.id].name} <b>+${r.skill.gain}</b></li>`);
    parts.push('<li>⭐ <b>+3 XP</b></li>');
    const m = r.drops?.material;
    if (m?.qty) parts.push(`<li>${m.icon} Rớt vật liệu: <b>+${fmtLots(m.qty)} lô</b> ${esc(m.name)} vào kho</li>`);
    else if (m) parts.push(`<li class="muted">${m.icon} Rớt ${esc(m.name)} nhưng kho đã đầy</li>`);
    const g = r.drops?.gear;
    if (g) {
      parts.push(`<li>🎀 Rớt trang phục: <b>${esc(g.name)}</b> <span class="tier-chip tier-${g.tier}">${TIERS[g.tier]?.name ?? g.tier}</span>
        <small class="gear-lines-inline">${(g.lines ?? []).map(esc).join(' · ')}</small></li>`);
    }
    overlay.querySelector('.mg-host').innerHTML = `
      <div class="mg-result">
        <div class="mg-score">${r.score}</div>
        <p class="muted">điểm</p>
        <ul>${parts.join('')}</ul>
        ${r.capped ? '<p class="muted small">Một phần thưởng đã chạm giới hạn hôm nay. Mai chơi tiếp nhé!</p>' : ''}
        <div class="row">
          <button class="btn primary" data-again="${game}">Chơi lại</button>
          <button class="btn" data-close-game>Xong</button>
        </div>
      </div>`;
  }

  async function play(game) {
    let session;
    try {
      ({ session } = await api(`/games/${game}/start`, {}));
    } catch (err) {
      return ctx.fail(err);
    }
    ctx.refreshMe();
    overlay?.remove();
    overlay = document.createElement('div');
    overlay.className = 'mg-overlay';
    overlay.innerHTML = `
      <div class="mg-frame card">
        <header class="row-between"><h3>${games[game].icon} ${games[game].name}</h3>
          <button class="close" data-close-game aria-label="Đóng">✕</button></header>
        <div class="mg-host"></div>
      </div>`;
    document.body.append(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target.closest('[data-close-game]')) closeOverlay();
      const again = e.target.closest('[data-again]');
      if (again) {
        cleanupGame?.();
        cleanupGame = null;
        play(again.dataset.again);
      }
    });
    const stage = overlay.querySelector('.mg-host');
    const mod = await import(new URL(`../games/${game}.js`, import.meta.url).href);
    let finished = false;
    cleanupGame = mod.mount(stage, {
      seed: session.seed,
      duration: session.duration,
      onFinish: async (result) => {
        if (finished) return;
        finished = true;
        try {
          const res = await api('/games/finish', { sessionId: session.id, result });
          if (!overlay) return;
          cleanupGame?.();
          cleanupGame = null;
          ctx.applyResult(res);
          showResult(game, res.result);
        } catch (err) {
          ctx.fail(err);
          closeOverlay();
        }
      },
    });
  }

  view.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-play]');
    if (btn && !btn.disabled) play(btn.dataset.play);
  });

  api('/games').then((s) => view.isConnected && draw(s)).catch(ctx.fail);
  return () => {
    cleanupGame?.();
    overlay?.remove();
  };
}
