// API của các hệ thống kinh tế: việc làm, mini-game, Sàn, ngân hàng, ví, tin tức, cài đặt.
import { Router } from './router.js';
import { bankView, closeDeposit, moveSavings, openDeposit } from './bank.js';
import * as store from './db.js';
import { settings } from './settings.js';
import { GameError } from './game.js';
import { auth, intField, reply } from './http.js';
import { claimShift, jobsView, startShift } from './jobs.js';
import { cancelOrder, marketView, placeOrder, priceHistory, upgradeWarehouse } from './market.js';
import { finishGame, gamesView, startGame } from './minigames.js';
import { track } from './quests.js';
import { ledgerPage, walletView } from './wallet.js';

export const economyApi = Router();
economyApi.use(auth);

/** Cấp (của bé cao cấp nhất) cần để mở từng khu. */
export const UNLOCKS = {
  market: 2, school: 1, garden: 2, bank: 3, townhall: 3, guild: 3, kitchen: 3, business: 4, bazaar: 4, factory: 6, contracts: 6, advanced: 8,
};

export function requireLevel(userId, level, place) {
  const best = Math.max(0, ...store.listPets(userId).map((p) => p.level));
  if (best < level) throw new GameError(`${place} mở khi có một bé đạt cấp ${level}.`);
}

// ---- Việc làm ----

economyApi.get('/jobs', (req, res) => res.json(jobsView(req.user.id)));

economyApi.post('/jobs/start', (req, res) => {
  const result = startShift(req.user.id, {
    petId: intField(req.body?.petId, 'Thú cưng'),
    career: String(req.body?.career ?? ''),
    hours: intField(req.body?.hours, 'Số giờ'),
    businessId: req.body?.businessId ? intField(req.body.businessId, 'Quầy') : null,
    factoryId: req.body?.factoryId ? intField(req.body.factoryId, 'Xưởng') : null,
  });
  reply(res, req.user.id, result);
});

economyApi.post('/jobs/:id/claim', (req, res) => {
  reply(res, req.user.id, claimShift(req.user.id, intField(req.params.id, 'Ca làm')));
});

// ---- Mini-game ----

economyApi.get('/games', (req, res) => res.json(gamesView(req.user.id)));

economyApi.post('/games/:game/start', (req, res) => {
  const session = startGame(req.user.id, req.params.game);
  res.json({ session, ...gamesView(req.user.id) });
});

economyApi.post('/games/finish', (req, res) => {
  const result = finishGame(req.user.id, req.body?.sessionId, req.body?.result);
  reply(res, req.user.id, result);
});

// ---- Sàn Nguyên Liệu ----

economyApi.get('/market', (req, res) => res.json(marketView(req.user.id)));

economyApi.get('/market/:commodity/history', (req, res) => {
  res.json(priceHistory(req.params.commodity, req.query.range === 'week' ? 'week' : 'day'));
});

economyApi.post('/market/order', (req, res) => {
  requireLevel(req.user.id, UNLOCKS.market, 'Sàn Nguyên Liệu');
  const type = req.body?.type === 'limit' ? 'limit' : 'market';
  const result = placeOrder(req.user.id, {
    commodity: String(req.body?.commodity ?? ''),
    side: String(req.body?.side ?? ''),
    qty: Number(req.body?.qty),
    type,
    limit: type === 'limit' ? Number(req.body?.limit) : undefined,
  });
  track(req.user.id, 'trade');
  reply(res, req.user.id, result);
});

economyApi.post('/market/orders/:id/cancel', (req, res) => {
  reply(res, req.user.id, cancelOrder(req.user.id, intField(req.params.id, 'Lệnh')));
});

economyApi.post('/market/warehouse', (req, res) => reply(res, req.user.id, upgradeWarehouse(req.user.id)));

// ---- Ngân hàng ----

economyApi.get('/bank', (req, res) => res.json(bankView(req.user.id)));

economyApi.post('/bank/savings', (req, res) => {
  requireLevel(req.user.id, UNLOCKS.bank, 'Ngân hàng');
  const amount = intField(req.body?.amount, 'Số tiền');
  const action = String(req.body?.action ?? '');
  const result = moveSavings(req.user.id, action, amount);
  if (action === 'deposit') track(req.user.id, 'save');
  reply(res, req.user.id, result);
});

economyApi.post('/bank/deposits', (req, res) => {
  requireLevel(req.user.id, UNLOCKS.bank, 'Ngân hàng');
  const result = openDeposit(req.user.id, intField(req.body?.amount, 'Số tiền'), intField(req.body?.term, 'Kỳ hạn'));
  track(req.user.id, 'save');
  reply(res, req.user.id, result);
});

economyApi.post('/bank/deposits/:id/close', (req, res) => {
  reply(res, req.user.id, closeDeposit(req.user.id, intField(req.params.id, 'Khoản gửi')));
});

// ---- Ví ----

economyApi.get('/wallet', (req, res) => {
  const days = req.query.days === '30' ? 30 : 7;
  res.json(walletView(req.user.id, days));
});

economyApi.get('/wallet/ledger', (req, res) => {
  const before = req.query.before ? Number(req.query.before) : null;
  res.json(ledgerPage(req.user.id, { kind: req.query.kind || null, before }));
});

// ---- Tin tức ----

const newsQuery = store.db.prepare('SELECT * FROM news WHERE created_at >= ? AND starts_at <= ? ORDER BY starts_at DESC LIMIT 40');

economyApi.get('/news', (_req, res) => {
  const now = Date.now();
  res.json(newsQuery.all(now - 3 * 86_400_000, now).map((n) => ({
    id: n.id, commodity: n.commodity, headline: n.headline, up: n.effect > 0, at: n.starts_at,
  })));
});

// ---- Cài đặt ----

economyApi.post('/settings', (req, res) => {
  const wantAdvanced = Boolean(req.body?.advancedFinance);
  if (wantAdvanced) {
    if (!settings.advancedFinance) throw new GameError('Máy chủ này đã tắt chế độ Tài chính nâng cao.');
    requireLevel(req.user.id, UNLOCKS.advanced, 'Tài chính nâng cao');
  }
  store.setAdvanced(req.user.id, wantAdvanced);
  reply(res, req.user.id, {
    message: wantAdvanced ? 'Đã bật Tài chính nâng cao. Các công cụ mới sẽ mở dần theo bản cập nhật.' : 'Đã tắt Tài chính nâng cao.',
  });
});
