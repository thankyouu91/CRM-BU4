// API giai đoạn 2: chăm sóc và phòng khám, trường học, vườn, bếp, khu công nghiệp, hợp đồng, Chợ Phiên, tín dụng.
import { Router } from './router.js';
import { buyListing, bazaarView, cancelListing, listForSale } from './bazaar.js';
import { cancelAuction, listAuction, placeBid } from './auction.js';
import { attendClass, bath, clinicView, schoolView, setInsurance, visitClinic } from './care.js';
import { acceptContract, breakContract, contractsView, declineContract, propose } from './contracts.js';
import { borrow, creditView, repay } from './credit.js';
import * as store from './db.js';
import {
  buildFactory, cancelToll, closeFactory, factoryView, orderToll, setFactoryAuto, setFactoryJobs, setToll, upgradeFactory,
} from './factory.js';
import {
  catchPests, cook, eatDish, expandGarden, gardenView, harvest, kitchenView, plant, sellDishToNpc, water,
} from './farm.js';
import { settings } from './settings.js';
import { GameError } from './game.js';
import { auth, intField, reply } from './http.js';
import { UNLOCKS, requireLevel } from './routes-economy.js';

export const productionApi = Router();
productionApi.use(auth);

const uid = (req) => req.user.id;
const str = (v) => String(v ?? '');
const petOf = (req) => intField(req.body?.petId ?? req.query.petId, 'Thú cưng');

// ---- Chăm sóc & phòng khám ----

productionApi.post('/pets/:id/bath', (req, res) => reply(res, uid(req), bath(uid(req), intField(req.params.id, 'Thú cưng'))));

productionApi.get('/clinic', (req, res) => res.json(clinicView(uid(req))));
productionApi.post('/clinic/visit', (req, res) => reply(res, uid(req), visitClinic(uid(req), petOf(req))));
productionApi.post('/clinic/insurance', (req, res) => {
  reply(res, uid(req), setInsurance(uid(req), req.body?.plan ? str(req.body.plan) : null));
});

// ---- Trường học ----

productionApi.get('/school', (req, res) => {
  const petId = req.query.petId ? petOf(req) : store.getUser(uid(req)).active_pet_id;
  if (!petId) throw new GameError('Bạn chưa có bé nào.');
  res.json(schoolView(uid(req), petId));
});
productionApi.post('/school/class', (req, res) => {
  requireLevel(uid(req), UNLOCKS.school, 'Trường học');
  reply(res, uid(req), attendClass(uid(req), petOf(req), str(req.body?.skill)));
});

// ---- Vườn ----

const plotOf = (req) => intField(req.body?.plot, 'Ô đất', { min: 0, max: 99 });

productionApi.get('/garden', (req, res) => {
  const owner = req.query.owner ? intField(req.query.owner, 'Người chơi') : uid(req);
  res.json(gardenView(uid(req), owner));
});
productionApi.post('/garden/plant', (req, res) => {
  requireLevel(uid(req), UNLOCKS.garden, 'Vườn');
  reply(res, uid(req), plant(uid(req), plotOf(req), str(req.body?.crop)));
});
productionApi.post('/garden/water', (req, res) => {
  reply(res, uid(req), water(uid(req), intField(req.body?.owner, 'Người chơi'), plotOf(req)));
});
productionApi.post('/garden/pests', (req, res) => reply(res, uid(req), catchPests(uid(req), plotOf(req))));
productionApi.post('/garden/harvest', (req, res) => reply(res, uid(req), harvest(uid(req), plotOf(req))));
productionApi.post('/garden/expand', (req, res) => reply(res, uid(req), expandGarden(uid(req))));

// ---- Bếp ----

productionApi.get('/kitchen', (req, res) => res.json(kitchenView(uid(req))));
productionApi.post('/kitchen/cook', (req, res) => {
  requireLevel(uid(req), UNLOCKS.kitchen, 'Bếp');
  const inputs = req.body?.inputs && typeof req.body.inputs === 'object'
    ? Object.fromEntries(Object.entries(req.body.inputs).map(([k, v]) => [str(k), Number(v)]))
    : null;
  reply(res, uid(req), cook(uid(req), { recipe: req.body?.recipe ? str(req.body.recipe) : null, inputs }));
});
productionApi.post('/kitchen/dishes/:id/eat', (req, res) => {
  reply(res, uid(req), eatDish(uid(req), intField(req.params.id, 'Món'), petOf(req)));
});
productionApi.post('/kitchen/dishes/:id/sell', (req, res) => {
  reply(res, uid(req), sellDishToNpc(uid(req), intField(req.params.id, 'Món')));
});

// ---- Khu công nghiệp ----

const factoryOf = (req) => intField(req.params.id, 'Xưởng');

productionApi.get('/factory', (req, res) => res.json(factoryView(uid(req))));
productionApi.post('/factory/build', (req, res) => {
  requireLevel(uid(req), UNLOCKS.factory, 'Khu công nghiệp');
  reply(res, uid(req), buildFactory(uid(req), str(req.body?.kind)));
});
productionApi.post('/factory/:id/upgrade', (req, res) => reply(res, uid(req), upgradeFactory(uid(req), factoryOf(req))));
productionApi.post('/factory/:id/toll', (req, res) => {
  reply(res, uid(req), setToll(uid(req), factoryOf(req), { fee: Number(req.body?.fee), open: Boolean(req.body?.open) }));
});
productionApi.post('/factory/:id/jobs', (req, res) => {
  reply(res, uid(req), setFactoryJobs(uid(req), factoryOf(req), {
    wage: Number(req.body?.wage), slots: Number(req.body?.slots), open: Boolean(req.body?.open),
  }));
});
productionApi.post('/factory/:id/auto', (req, res) => reply(res, uid(req), setFactoryAuto(uid(req), factoryOf(req), Boolean(req.body?.on))));
productionApi.post('/factory/:id/close', (req, res) => reply(res, uid(req), closeFactory(uid(req), factoryOf(req))));
productionApi.post('/factory/:id/order', (req, res) => {
  requireLevel(uid(req), UNLOCKS.market, 'Gia công');
  reply(res, uid(req), orderToll(uid(req), factoryOf(req), intField(req.body?.batches, 'Số mẻ', { max: 100 })));
});
productionApi.post('/factory/orders/:id/cancel', (req, res) => {
  reply(res, uid(req), cancelToll(uid(req), intField(req.params.id, 'Đơn gia công')));
});

// ---- Hợp đồng cung ứng ----

const contractOf = (req) => intField(req.params.id, 'Hợp đồng');

productionApi.get('/contracts', (req, res) => res.json(contractsView(uid(req))));
productionApi.post('/contracts', (req, res) => {
  requireLevel(uid(req), UNLOCKS.contracts, 'Hợp đồng cung ứng');
  reply(res, uid(req), propose(uid(req), {
    counterpart: str(req.body?.counterpart),
    role: str(req.body?.role),
    commodity: str(req.body?.commodity),
    lots: Number(req.body?.lots),
    price: Number(req.body?.price),
    days: Number(req.body?.days),
  }));
});
productionApi.post('/contracts/:id/accept', (req, res) => {
  requireLevel(uid(req), UNLOCKS.contracts, 'Hợp đồng cung ứng');
  reply(res, uid(req), acceptContract(uid(req), contractOf(req)));
});
productionApi.post('/contracts/:id/decline', (req, res) => reply(res, uid(req), declineContract(uid(req), contractOf(req))));
productionApi.post('/contracts/:id/break', (req, res) => reply(res, uid(req), breakContract(uid(req), contractOf(req))));

// ---- Chợ Phiên ----

productionApi.get('/bazaar', (req, res) => res.json(bazaarView(uid(req))));
productionApi.post('/bazaar/list', (req, res) => {
  requireLevel(uid(req), UNLOCKS.bazaar, 'Chợ Phiên');
  reply(res, uid(req), listForSale(uid(req), { kind: str(req.body?.kind), ref: str(req.body?.ref), price: Number(req.body?.price) }));
});
productionApi.post('/bazaar/:id/buy', (req, res) => {
  requireLevel(uid(req), UNLOCKS.bazaar, 'Chợ Phiên');
  reply(res, uid(req), buyListing(uid(req), intField(req.params.id, 'Tin đăng')));
});
productionApi.post('/bazaar/:id/cancel', (req, res) => reply(res, uid(req), cancelListing(uid(req), intField(req.params.id, 'Tin đăng'))));

// Đấu giá trang phục
productionApi.post('/bazaar/auctions', (req, res) => {
  requireLevel(uid(req), UNLOCKS.bazaar, 'Chợ Phiên');
  reply(res, uid(req), listAuction(uid(req), { gearId: intField(req.body?.gearId, 'Trang phục'), startPrice: Number(req.body?.startPrice), hours: Number(req.body?.hours) }));
});
productionApi.post('/bazaar/auctions/:id/bid', (req, res) => {
  requireLevel(uid(req), UNLOCKS.bazaar, 'Chợ Phiên');
  reply(res, uid(req), placeBid(uid(req), intField(req.params.id, 'Phiên đấu giá'), Number(req.body?.amount)));
});
productionApi.post('/bazaar/auctions/:id/cancel', (req, res) => reply(res, uid(req), cancelAuction(uid(req), intField(req.params.id, 'Phiên đấu giá'))));

// ---- Tín dụng & vay ----

productionApi.get('/credit', (req, res) => res.json(creditView(uid(req))));
productionApi.post('/credit/borrow', (req, res) => {
  if (!settings.advancedFinance) throw new GameError('Máy chủ này đã tắt chế độ Tài chính nâng cao.');
  reply(res, uid(req), borrow(uid(req), intField(req.body?.amount, 'Số tiền'), intField(req.body?.term, 'Kỳ hạn')));
});
productionApi.post('/credit/loans/:id/repay', (req, res) => {
  reply(res, uid(req), repay(uid(req), intField(req.params.id, 'Khoản vay'), intField(req.body?.amount, 'Số tiền')));
});
