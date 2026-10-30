// API Gia tộc, Sở Nhà Đất (bản đồ 200 lô, xem trước, mua bán, lắp ghép công trình) và bản tin vĩ mô.
import { Router } from './router.js';
import {
  buyPlot, choosePlant, clanConfig, collectAsTaxOffice, taxOfficeCases, clanView, createClan, donateClan, enterIndustry, joinClan, kickMember, landView, leaveClan, payDividend,
  plotPreview, saveDesign, sellPlot, setDeclareRatio, setMemberRole, setPlotIndustry,
} from './clans.js';
import { dayKey } from './clock.js';
import { auth, intField, reply } from './http.js';
import { macroHistory, macroToday } from './macro.js';
import { assignOperator, removeOperator, strategicView, upgradeInfra } from './strategic.js';
import { buyListing, cancelListing, importGoods, industryView, listGoods, sellToNpc, setKeep, setShopAsk } from './industry.js';
import { UNLOCKS, requireLevel } from './routes-economy.js';
import { arenaView, challenge, confirmSlot, warReplay, withdraw } from './arena.js';
import {
  bidSeizedPlot, borrowFromBank, clanBankView, depositAtBank, keepSeizedPlot, moveBankCapital, openBank, repayBankLoan, setBankTerms, withdrawFromBank,
} from './clan-bank.js';
import {
  appointLeader, buyShares, clanTradeShares, mergeControlled, payShareDividend, repayMargin, sellShares, sharesView, startIpo, subscribeIpo,
} from './clan-shares.js';
import { castBallot, openClanDeposit, resolveVotes, startDepose, withdrawClanDeposit } from './clan-gov.js';

export const clanApi = Router();
clanApi.use('/clans', auth);
clanApi.use('/land', auth);
clanApi.use('/macro', auth);
clanApi.use('/industry', auth);
clanApi.use('/arena', auth);
clanApi.use('/clan-bank', auth);
clanApi.use('/shares', auth);

const uid = (req) => req.user.id;
const unlock = (req, what) => requireLevel(uid(req), clanConfig().unlockLevel, what);

// ---- Đấu trường gia tộc ----
clanApi.get('/arena', (req, res) => res.json(arenaView(uid(req))));
clanApi.get('/arena/:id', (req, res) => res.json(warReplay(intField(req.params.id, 'Trận'))));
clanApi.post('/arena/challenge', (req, res) => reply(res, uid(req), challenge(uid(req), {
  defenderId: intField(req.body?.defenderId, 'Gia tộc'), kind: String(req.body?.kind ?? ''), ref: String(req.body?.ref ?? ''), slots: req.body?.slots,
})));
clanApi.post('/arena/:id/confirm', (req, res) => reply(res, uid(req), confirmSlot(uid(req), intField(req.params.id, 'Trận'), Number(req.body?.at))));
clanApi.post('/arena/:id/withdraw', (req, res) => reply(res, uid(req), withdraw(uid(req), intField(req.params.id, 'Trận'))));

// ---- Ngân hàng gia tộc: tiền gửi của người chơi, cho vay thế chấp lô đất, đấu giá lô siết nợ ----
clanApi.get('/clan-bank', (req, res) => res.json(clanBankView(uid(req))));
clanApi.post('/clan-bank/open', (req, res) => reply(res, uid(req), openBank(uid(req), intField(req.body?.capital, 'Vốn'))));
clanApi.post('/clan-bank/terms', (req, res) => reply(res, uid(req), setBankTerms(uid(req), {
  rates: req.body?.rates && typeof req.body.rates === 'object' ? req.body.rates : {},
  loanRate: req.body?.loanRate, lendingOpen: req.body?.lendingOpen,
})));
clanApi.post('/clan-bank/capital', (req, res) => reply(res, uid(req), moveBankCapital(uid(req), String(req.body?.action ?? ''), intField(req.body?.amount, 'Số tiền'))));
clanApi.post('/clan-bank/deposits/:id/withdraw', (req, res) => reply(res, uid(req), withdrawFromBank(uid(req), intField(req.params.id, 'Khoản gửi'))));
clanApi.post('/clan-bank/loans/:id/repay', (req, res) => reply(res, uid(req), repayBankLoan(
  uid(req), intField(req.params.id, 'Khoản vay'), req.body?.amount == null ? null : intField(req.body.amount, 'Số tiền'),
)));
clanApi.post('/clan-bank/auctions/:id/bid', (req, res) => reply(res, uid(req), bidSeizedPlot(uid(req), intField(req.params.id, 'Phiên'), intField(req.body?.amount, 'Giá'))));
clanApi.post('/clan-bank/auctions/:id/keep', (req, res) => reply(res, uid(req), keepSeizedPlot(uid(req), intField(req.params.id, 'Phiên'))));
clanApi.post('/clan-bank/:bankId/deposit', (req, res) => {
  requireLevel(uid(req), UNLOCKS.bank, 'Gửi ngân hàng gia tộc');
  reply(res, uid(req), depositAtBank(uid(req), intField(req.params.bankId, 'Ngân hàng'), intField(req.body?.amount, 'Số tiền'), Number(req.body?.term)));
});
clanApi.post('/clan-bank/:bankId/borrow', (req, res) => reply(res, uid(req), borrowFromBank(uid(req), {
  bankId: intField(req.params.bankId, 'Ngân hàng'), plotId: intField(req.body?.plotId, 'Lô đất'), amount: intField(req.body?.amount, 'Số tiền'), term: Number(req.body?.term),
})));

// ---- Cổ phần gia tộc: IPO, mua bán theo quỹ khớp lệnh, ký quỹ, cổ tức, quyền kiểm soát ----
clanApi.get('/shares', (req, res) => res.json(sharesView(uid(req))));
clanApi.post('/shares/ipo', (req, res) => reply(res, uid(req), startIpo(uid(req), { shares: intField(req.body?.shares, 'Số cổ phần'), price: intField(req.body?.price, 'Giá') })));
clanApi.post('/shares/dividend', (req, res) => reply(res, uid(req), payShareDividend(uid(req), intField(req.body?.amount, 'Số tiền'))));
clanApi.post('/shares/margin/:id/repay', (req, res) => reply(res, uid(req), repayMargin(uid(req), intField(req.params.id, 'Khoản vay'))));
clanApi.post('/shares/:clanId/subscribe', (req, res) => {
  requireLevel(uid(req), UNLOCKS.bank, 'Mua cổ phiếu');
  reply(res, uid(req), subscribeIpo(uid(req), intField(req.params.clanId, 'Gia tộc'), intField(req.body?.qty, 'Số cổ phần')));
});
clanApi.post('/shares/:clanId/buy', (req, res) => {
  requireLevel(uid(req), UNLOCKS.bank, 'Mua cổ phiếu');
  reply(res, uid(req), buyShares(uid(req), intField(req.params.clanId, 'Gia tộc'), intField(req.body?.qty, 'Số cổ phần'), { margin: Boolean(req.body?.margin) }));
});
clanApi.post('/shares/:clanId/sell', (req, res) => reply(res, uid(req), sellShares(uid(req), intField(req.params.clanId, 'Gia tộc'), intField(req.body?.qty, 'Số cổ phần'))));
clanApi.post('/shares/:clanId/clan-trade', (req, res) => reply(res, uid(req), clanTradeShares(
  uid(req), intField(req.params.clanId, 'Gia tộc'), String(req.body?.side ?? ''), intField(req.body?.qty, 'Số cổ phần'), { asBank: Boolean(req.body?.asBank) },
)));
clanApi.post('/shares/:clanId/appoint', (req, res) => reply(res, uid(req), appointLeader(uid(req), intField(req.params.clanId, 'Gia tộc'), intField(req.body?.userId, 'Người được bổ nhiệm'))));
clanApi.post('/shares/:clanId/merge', (req, res) => reply(res, uid(req), mergeControlled(uid(req), intField(req.params.clanId, 'Gia tộc'))));

clanApi.get('/clans', (req, res) => {
  resolveVotes(); // phiếu hết giờ thì khép trước khi xem
  res.json(clanView(uid(req)));
});
// ---- Bỏ phiếu phế truất, tiền gửi kỳ hạn của quỹ ----
clanApi.post('/clans/depose', (req, res) => reply(res, uid(req), startDepose(uid(req), intField(req.body?.candidateId, 'Người được đề cử'))));
clanApi.post('/clans/votes/:id', (req, res) => reply(res, uid(req), castBallot(uid(req), intField(req.params.id, 'Phiếu'), Boolean(req.body?.yes))));
clanApi.post('/clans/deposits', (req, res) => reply(res, uid(req), openClanDeposit(uid(req), intField(req.body?.amount, 'Số tiền', { min: 1 }), Number(req.body?.term))));
clanApi.post('/clans/deposits/:id/withdraw', (req, res) => reply(res, uid(req), withdrawClanDeposit(uid(req), intField(req.params.id, 'Khoản gửi'))));
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

clanApi.post('/land/:id/plant', (req, res) => reply(res, uid(req), choosePlant(uid(req), intField(req.params.id, 'Lô đất'), String(req.body?.plant ?? ''))));

// ---- Kho, sàn công nghiệp, nhập khẩu ----

clanApi.get('/industry', (req, res) => res.json(industryView(uid(req), macroToday())));
clanApi.post('/industry/shop-ask', (req, res) => reply(res, uid(req), setShopAsk(uid(req), { cat: String(req.body?.cat ?? ''), qty: req.body?.qty, pct: req.body?.pct })));
clanApi.post('/industry/keep', (req, res) => reply(res, uid(req), setKeep(uid(req), String(req.body?.good ?? ''), Boolean(req.body?.keep))));
clanApi.post('/industry/list', (req, res) => reply(res, uid(req), listGoods(uid(req), { good: String(req.body?.good ?? ''), qty: req.body?.qty, price: req.body?.price }, macroToday())));
clanApi.post('/industry/listings/:id/cancel', (req, res) => reply(res, uid(req), cancelListing(uid(req), intField(req.params.id, 'Tin'))));
clanApi.post('/industry/listings/:id/buy', (req, res) => reply(res, uid(req), buyListing(uid(req), intField(req.params.id, 'Tin'), req.body?.qty)));
clanApi.post('/industry/import', (req, res) => reply(res, uid(req), importGoods(uid(req), String(req.body?.good ?? ''), req.body?.qty, macroToday())));
clanApi.post('/industry/sell', (req, res) => reply(res, uid(req), sellToNpc(uid(req), String(req.body?.good ?? ''), req.body?.qty, macroToday())));

// ---- Hạ tầng chiến lược & ngành nhà nước ----

clanApi.get('/clans/strategic', (req, res) => res.json({ ...strategicView(uid(req)), taxOffice: taxOfficeCases(uid(req)) }));
clanApi.post('/clans/strategic/upgrade', (req, res) => reply(res, uid(req), upgradeInfra(uid(req))));
clanApi.post('/clans/strategic/operator', (req, res) => reply(res, uid(req), assignOperator(uid(req), intField(req.body?.plotId, 'Lô đất'), intField(req.body?.petId, 'Bé'))));
clanApi.post('/clans/strategic/operator/remove', (req, res) => reply(res, uid(req), removeOperator(uid(req), intField(req.body?.plotId, 'Lô đất'))));
clanApi.post('/clans/tax-office/:id/collect', (req, res) => reply(res, uid(req), collectAsTaxOffice(uid(req), intField(req.params.id, 'Hồ sơ'))));
