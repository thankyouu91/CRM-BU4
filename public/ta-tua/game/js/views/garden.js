// Vườn: gieo hạt trên các ô đất, bắt sâu, thu hoạch vào kho Sàn, mở thêm ô; tưới hộ vườn bạn bè.
import { api } from '../api.js';
import { closeModal, countdown, esc, fmt, fmtLots, modalOpen, openModal, viewHead } from '../ui.js';
import { sceneHdr } from '../scenes-hdr.js';
import { hasAtlasIcon, itemIcon } from '../itemart.js';

let friendId = null; // vườn bạn đang mở để tưới hộ
let lastAuto = 0; // lần tự tải lại gần nhất, tránh tải liên tục khi đồng hồ máy lệch giờ

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function renderGarden(root, ctx) {
  root.innerHTML = `<div class="garden-page">
    ${viewHead('🌱 Vườn', 'Gieo hạt, chờ cây lớn rồi thu hoạch. Nông sản vào thẳng kho ở Sàn để bán, nấu ăn hoặc đem chế biến.')}
    ${sceneHdr('garden')}
    <div class="garden-view"><div class="empty muted">Đang tải…</div></div></div>`;
  const page = root.querySelector('.garden-page');
  const view = page.querySelector('.garden-view');
  const need = ctx.catalog.unlocks.garden;
  if (ctx.bestLevel() < need) {
    view.innerHTML = `<section class="card empty"><b>🔒</b><h2>Vườn chưa mở</h2>
      <p class="muted">Có một bé đạt cấp ${need} là được nhận đất trồng trọt.</p></section>`;
    return;
  }

  const { commodities, garden: rules } = ctx.catalog;
  let mine = null; // GET /garden
  let friends = []; // GET /friends → friends
  let theirs = null; // GET /garden?owner=friendId
  let timer = 0;
  let ticks = 0;

  /** Tên nông sản cây cho ra. Dòng nào gọi hàm này cũng đã vẽ icon của chính nông sản đó (cropIcon), nên có icon
   *  16-bit thì chỉ ghi tên, không chêm emoji cũ (hình khác hẳn) vào cùng dòng. */
  const commodityLabel = (id) => {
    const c = commodities[id];
    if (!c) return esc(id);
    return hasAtlasIcon(id) ? esc(c.name) : `${esc(c.icon)} ${esc(c.name)}`;
  };

  /** Sản lượng dự kiến (phần) sau khi tính tưới hộ và sâu bệnh. */
  function expected(crop, p) {
    const mult = (p.watered ? 1 + rules.waterBonus : 1) * (p.pests ? 1 - rules.pestLoss : 1);
    const [lo, hi] = crop.yield;
    return `${Math.max(1, Math.round(lo * mult))}–${Math.max(1, Math.round(hi * mult))}`;
  }

  /** Icon 16-bit 32 điểm của nông sản mà cây cho ra (Chè ra lá trà...); chưa có hình thì emoji của cây. */
  const cropIcon = (crop) => itemIcon({ id: crop.commodity, icon: esc(crop.icon) }, 3);

  /** Cây non → cây lớn → ra quả, theo phần trăm thời gian đã qua. */
  const stageIcon = (crop, done, ready) => (ready || done >= 0.67 ? cropIcon(crop) : done >= 0.34 ? '🌿' : '🌱');

  function plotTile(p, data, own) {
    if (!p.crop) {
      return `
        <div class="garden-plot is-empty">
          <span class="garden-plot-icon">🟫</span>
          <b>Ô ${p.idx + 1}</b>
          ${own
            ? `<button class="btn small mint" data-plant="${p.idx}">🌱 Gieo hạt</button>`
            : '<small class="muted">Đang để trống</small>'}
        </div>`;
    }
    const crop = data.crops[p.crop] ?? { name: p.crop, icon: '🌱', yield: [0, 0], hours: 1 };
    const now = Date.now();
    const done = p.ready ? 1 : clamp01((now - p.plantedAt) / (p.readyAt - p.plantedAt));
    const badges = [
      p.watered ? `<span class="badge garden-badge water" title="${p.wateredBy} lượt tưới hộ">💧 Đã tưới +${Math.round(rules.waterBonus * 100)}%</span>` : '',
      p.pests ? `<span class="badge garden-badge pest">🐛 Có sâu −${Math.round(rules.pestLoss * 100)}%</span>` : '',
    ].join('');

    let actions = '';
    if (own) {
      if (p.pests) actions += `<button class="btn small pink" data-pests="${p.idx}">🐛 Bắt sâu</button>`;
      if (p.ready) actions += `<button class="btn small gold" data-harvest="${p.idx}">🧺 Thu hoạch</button>`;
    } else if (p.ready) {
      actions = '<small class="muted">Chín rồi, chờ chủ vườn thu</small>';
    } else if (!p.canWater) {
      actions = '<small class="up">💧 Bạn đã tưới ô này</small>';
    } else if (data.helpLeft > 0) {
      actions = `<button class="btn small mint" data-water="${p.idx}">💧 Tưới hộ</button>`;
    } else {
      actions = '<small class="muted">Hết lượt tưới hôm nay</small>';
    }

    return `
      <div class="garden-plot ${p.ready ? 'is-ready' : 'is-growing'} ${p.pests ? 'has-pests' : ''}"
        ${p.ready ? '' : `data-planted-at="${Number(p.plantedAt)}" data-ready-at="${Number(p.readyAt)}"`}>
        <span class="garden-plot-icon">${stageIcon(crop, done, p.ready)}</span>
        <b>${esc(crop.name)}</b>
        ${p.ready
          ? '<small class="garden-ripe">✨ Chín rồi!</small>'
          : `<div class="bar garden-bar"><i style="width:${Math.round(done * 100)}%"></i></div>
             <small class="garden-left">còn ${countdown(p.readyAt - now)}</small>`}
        ${badges ? `<div class="garden-badges">${badges}</div>` : ''}
        <small class="muted">Dự kiến ${expected(crop, p)} phần</small>
        ${actions ? `<div class="garden-plot-actions">${actions}</div>` : ''}
      </div>`;
  }

  function cropGuide() {
    return Object.values(mine.crops).map((c) => `
      <li>
        <span class="garden-guide-icon">${cropIcon(c)}</span>
        <div>
          <b>${esc(c.name)}</b>
          <small class="muted">⏱ ${c.hours} giờ · 📦 ${c.yield[0]}–${c.yield[1]} phần → ${commodityLabel(c.commodity)}</small>
        </div>
        <span class="garden-guide-price">${fmt(c.seed)} 🪙</span>
      </li>`).join('');
  }

  function friendBox() {
    const helpLeft = (theirs ?? mine).helpLeft;
    const list = friends.length
      ? `<div class="garden-friend-list">${friends.map((f) => `
          <button class="chip ${f.id === friendId ? 'current' : ''}" data-friend="${Number(f.id)}">🏡 ${esc(f.username)}</button>`).join('')}</div>`
      : `<p class="muted">Chưa có bạn bè nào. Kết bạn để ghé vườn nhau tưới cây nhé!</p>
         <div class="row"><button class="btn small" data-go="community">👥 Tìm bạn</button></div>`;

    let visit = '';
    if (friendId && !theirs) {
      visit = '<div class="garden-visit"><p class="muted">Đang mở cổng vườn…</p></div>';
    } else if (theirs) {
      const planted = theirs.plots.filter((p) => p.crop);
      const thirsty = planted.filter((p) => !p.ready && p.canWater).length;
      visit = `
        <div class="garden-visit">
          <div class="row-between">
            <b>🏡 Vườn của ${esc(theirs.owner)}</b>
            <button class="link-btn" data-close-friend>Đóng</button>
          </div>
          ${planted.length
            ? `<p class="muted small">${thirsty ? `Có ${thirsty} ô đang chờ bạn tưới.` : 'Không còn ô nào bạn tưới được lúc này.'}</p>
               <div class="garden-plots">${theirs.plots.map((p) => plotTile(p, theirs, false)).join('')}</div>`
            : `<p class="muted">${esc(theirs.owner)} chưa trồng gì, quay lại sau nhé.</p>`}
        </div>`;
    }

    return `
      <section class="card garden-box garden-friends">
        <h3>🤝 Tưới hộ bạn bè</h3>
        <p class="muted small">Mỗi ô bạn tưới được thêm ${Math.round(rules.waterBonus * 100)}% sản lượng; bạn nhận +${rules.helpReward} 🪙 và bé chính +${rules.helpXp} XP.</p>
        <div class="garden-help"><span>💧 Tưới giúp còn <b>${helpLeft}</b>/${rules.helpPerDay} lần hôm nay</span></div>
        ${list}
        ${visit}
      </section>`;
  }

  function draw() {
    const index = ctx.me.economy.priceIndex;
    const cost = mine.nextPlotCost == null ? null : Math.max(1, Math.round(mine.nextPlotCost * index));
    const ready = mine.plots.filter((p) => p.ready).length;
    const pests = mine.plots.filter((p) => p.pests).length;
    view.innerHTML = `
      <div class="garden-grid">
        <section class="card garden-box wide">
          <div class="row-between">
            <h3>🌾 Ruộng nhà mình <small class="muted">${mine.plots.length} ô</small></h3>
            <div class="garden-badges">
              ${ready ? `<span class="badge star">🧺 ${ready} ô chín</span>` : ''}
              ${pests ? `<span class="badge garden-badge pest">🐛 ${pests} ô có sâu</span>` : ''}
            </div>
          </div>
          <div class="garden-plots">
            ${mine.plots.map((p) => plotTile(p, mine, true)).join('')}
            ${cost !== null ? `
              <button class="garden-plot garden-expand" data-expand="${cost}">
                <span class="garden-plot-icon">➕</span><b>Mở thêm ô đất</b><small>${fmt(cost)} 🪙</small>
              </button>` : ''}
          </div>
          <div class="garden-note">
            <p class="small">🧺 Thu hoạch xong, nông sản vào thẳng <b>kho ở Sàn</b> (1 lô = ${ctx.catalog.market.lot} phần). Kho đầy thì phần dư bị bỏ, nhớ bán bớt hoặc nâng cấp kho.</p>
            <button class="btn small" data-go="market">📈 Xem kho ở Sàn</button>
          </div>
        </section>
        ${friendBox()}
        <section class="card garden-box">
          <h3>📖 Sổ tay nhà nông</h3>
          <ul class="garden-guide">${cropGuide()}</ul>
          <p class="muted small">Sâu có thể xuất hiện giữa vụ: bắt kịp thì không mất gì, để nguyên thì mất ${Math.round(rules.pestLoss * 100)}% sản lượng.</p>
        </section>
      </div>`;
  }

  function pickCrop(idx) {
    const coins = ctx.me.user.coins;
    openModal({
      title: `Gieo hạt ở ô ${idx + 1}`,
      html: `
        <div class="pick-list">${Object.entries(mine.crops).map(([id, c]) => {
          const poor = coins < c.seed;
          return `
            <button class="pick garden-pick" data-pick="${esc(id)}" ${poor ? 'disabled' : ''}>
              <b>${cropIcon(c)}</b>
              <span>${esc(c.name)}
                <small>${c.hours} giờ · thu ${c.yield[0]}–${c.yield[1]} phần (${fmtLots(c.yield[0])}–${fmtLots(c.yield[1])} lô)</small>
                <small>thành ${commodityLabel(c.commodity)}</small>
              </span>
              <span class="garden-guide-price">${fmt(c.seed)} 🪙${poor ? '<small>thiếu xu</small>' : ''}</span>
            </button>`;
        }).join('')}</div>
        <p class="muted small">Bạn bè tưới hộ thì vụ đó thêm ${Math.round(rules.waterBonus * 100)}% sản lượng.</p>`,
      onPick: (crop) => {
        closeModal();
        ctx.act('/garden/plant', { plot: idx, crop });
      },
    });
  }

  function openFriend(id) {
    friendId = id;
    draw();
    api(`/garden?owner=${id}`).then((g) => {
      if (!view.isConnected || friendId !== id) return;
      theirs = g;
      draw();
      view.querySelector('.garden-visit')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }).catch((err) => {
      if (friendId === id) {
        friendId = null;
        theirs = null;
      }
      if (view.isConnected) draw();
      ctx.fail(err);
    });
  }

  page.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled || !mine) return;
    const d = btn.dataset;
    if (d.plant !== undefined) pickCrop(Number(d.plant));
    else if (d.pests !== undefined) ctx.act('/garden/pests', { plot: Number(d.pests) });
    else if (d.harvest !== undefined) ctx.act('/garden/harvest', { plot: Number(d.harvest) });
    else if (d.expand !== undefined) {
      if (confirm(`Mở thêm ô đất thứ ${mine.plots.length + 1} với giá ${fmt(Number(d.expand))} xu?`)) ctx.act('/garden/expand');
    } else if (d.friend !== undefined) {
      const id = Number(d.friend);
      if (id === friendId) {
        friendId = null;
        theirs = null;
        draw();
      } else {
        theirs = null;
        openFriend(id);
      }
    } else if (d.closeFriend !== undefined) {
      friendId = null;
      theirs = null;
      draw();
    } else if (d.water !== undefined && friendId) {
      ctx.act('/garden/water', { owner: friendId, plot: Number(d.water) });
    }
  });

  async function load() {
    const [g, f] = await Promise.all([api('/garden'), api('/friends').catch(() => null)]);
    const list = f?.friends ?? [];
    if (friendId && !list.some((x) => x.id === friendId)) friendId = null;
    let t = null;
    if (friendId) {
      const id = friendId;
      t = await api(`/garden?owner=${id}`).catch((err) => {
        if (friendId === id) friendId = null;
        ctx.fail(err);
        return null;
      });
    }
    if (!view.isConnected) return;
    mine = g;
    friends = list;
    theirs = t;
    draw();
  }

  /** Mỗi giây chạy đồng hồ đếm ngược; cây chín thì tải lại; mỗi phút tải lại để thấy sâu mới và lượt tưới của bạn bè. */
  function tick() {
    if (!view.isConnected) return clearInterval(timer);
    ticks += 1;
    let due = false;
    for (const el of view.querySelectorAll('[data-ready-at]')) {
      const readyAt = Number(el.dataset.readyAt);
      const plantedAt = Number(el.dataset.plantedAt);
      const left = readyAt - Date.now();
      if (left <= 0) {
        due = true;
        continue;
      }
      const label = el.querySelector('.garden-left');
      if (label) label.textContent = `còn ${countdown(left)}`;
      const bar = el.querySelector('.garden-bar > i');
      if (bar) bar.style.width = `${Math.round(clamp01((Date.now() - plantedAt) / (readyAt - plantedAt)) * 100)}%`;
    }
    const idle = !modalOpen() && document.visibilityState === 'visible';
    if (idle && ((due && Date.now() - lastAuto > 15_000) || ticks % 60 === 0)) {
      lastAuto = Date.now();
      load().catch(() => {});
    }
  }

  load().then(() => {
    if (view.isConnected) timer = setInterval(tick, 1000);
  }).catch(ctx.fail);
  return () => clearInterval(timer);
}
