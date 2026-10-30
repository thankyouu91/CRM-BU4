// API Gia tộc, Sở Nhà Đất (bản đồ 200 lô, xem trước, mua bán, lắp ghép công trình) và bản tin vĩ mô.
import { Router } from './router.js';
import {
  buyPlot, clanConfig, clanView, createClan, donateClan, enterIndustry, joinClan, kickMember, landView, leaveClan, payDividend,
  plotPreview, saveDesign, sellPlot, setDeclareRatio, setMemberRole, setPlotIndustry,
} from './clans.js';
import { dayKey } from './clock.js';
import { auth, intField, reply } from './http.js';
import { macroHistory, macroToday } from './macro.js';
import { requireLevel } from './routes-economy.js';

export const clanApi = Router();
clanApi.use('/clans', auth);
clanApi.use('/land', auth);
clanApi.use('/macro', auth);

const uid = (req) => req.user.id;
const unlock = (req, what) => requireLevel(uid(req), clanConfig().unlockLevel, what);

clanApi.get('/clans', (req, res) => res.json(clanView(uid(req))));
clanApi.post('/clans/create', (req, res) => {
  unlock(req, 'Lập gia tộc');
  reply(res, uid(req), createClan(uid(req), { name: req.body?.name, emblem: req.body?.emblem, color: req.body?.color }));
});
clanApi.post('/clans/:id/join', (req, res) => {
  unlock(req, 'Gia nhập gia tộc');
  reply(res, uid(req), joinClan(uid(req), intField(req.params.id, 'Gia tộc')));
});
clanApi.post('/clans/leave', (req, res) => reply(res, uid(req), leaveClan(uid(req))));
clanApi.post('/clans/donate', (req, res) => reply(res, uid(req), donateClan(uid(req), intField(req.body?.amount, 'Số tiền', { min: 10 }))));
clanApi.post('/clans/kick', (req, res) => reply(res, uid(req), kickMember(uid(req), intField(req.body?.userId, 'Thành viên'))));
clanApi.post('/clans/role', (req, res) => reply(res, uid(req), setMemberRole(uid(req), intField(req.body?.userId, 'Thành viên'), String(req.body?.role ?? ''))));
clanApi.post('/clans/industries', (req, res) => reply(res, uid(req), enterIndustry(uid(req), String(req.body?.industry ?? ''))));
clanApi.post('/clans/declare', (req, res) => reply(res, uid(req), setDeclareRatio(uid(req), req.body?.ratio)));
clanApi.post('/clans/dividend', (req, res) => reply(res, uid(req), payDividend(uid(req), intField(req.body?.amount, 'Số tiền'))));

clanApi.get('/land', (req, res) => res.json(landView(uid(req))));
clanApi.get('/land/:id/preview', (req, res) => res.json(plotPreview(uid(req), req.params.id, String(req.query.industry ?? ''))));
clanApi.post('/land/:id/buy', (req, res) => reply(res, uid(req), buyPlot(uid(req), intField(req.params.id, 'Lô đất'))));
clanApi.post('/land/:id/sell', (req, res) => reply(res, uid(req), sellPlot(uid(req), intField(req.params.id, 'Lô đất'))));
clanApi.post('/land/:id/industry', (req, res) => reply(res, uid(req), setPlotIndustry(uid(req), intField(req.params.id, 'Lô đất'), String(req.body?.industry ?? ''))));
clanApi.post('/land/:id/design', (req, res) => reply(res, uid(req), saveDesign(uid(req), intField(req.params.id, 'Lô đất'), req.body?.design)));

clanApi.get('/macro', (_req, res) => {
  const today = macroToday();
  res.json({ today, history: macroHistory(dayKey(Date.now()), 14) });
});
