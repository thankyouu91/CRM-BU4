// API quầy trà sữa, Tòa thị chính, bạn bè, Hội và nhiệm vụ ngày.
import { Router } from './router.js';
import {
  buyDrink, buyUpgrade, businessView, closeBusiness, openBusiness, promote, setJobPost, setMenu, teaStalls,
} from './business.js';
import { GameError } from './game.js';
import { auth, intField, reply } from './http.js';
import { claimQuest, questsView } from './quests.js';
import { UNLOCKS, requireLevel } from './routes-economy.js';
import {
  acceptFriend, contribute, createGuild, donate, friendsView, giftFriend, guildView, joinGuild, leaveGuild,
  likeFriend, removeFriend, requestFriend, upgradeGuild, visit,
} from './social.js';
import { townView, vote } from './town.js';

export const communityApi = Router();
communityApi.use(auth);

const uid = (req) => req.user.id;

// ---- Quầy trà sữa ----

communityApi.get('/business', (req, res) => res.json(businessView(uid(req))));

communityApi.post('/business/open', (req, res) => {
  requireLevel(uid(req), UNLOCKS.business, 'Quầy trà sữa');
  reply(res, uid(req), openBusiness(uid(req), { name: req.body?.name, location: req.body?.location }));
});
communityApi.post('/business/menu', (req, res) => reply(res, uid(req), setMenu(uid(req), req.body?.menu)));
communityApi.post('/business/upgrade', (req, res) => reply(res, uid(req), buyUpgrade(uid(req), String(req.body?.key ?? ''))));
communityApi.post('/business/promote', (req, res) => reply(res, uid(req), promote(uid(req))));
communityApi.post('/business/jobs', (req, res) => {
  reply(res, uid(req), setJobPost(uid(req), {
    wage: Number(req.body?.wage),
    slots: Number(req.body?.slots),
    open: Boolean(req.body?.open),
  }));
});
communityApi.post('/business/close', (req, res) => reply(res, uid(req), closeBusiness(uid(req))));
// Khách ghé quầy: xem các quầy đang có bé trực và mua đồ uống cho bé (chỉ số gấp đôi trà sữa Siêu thị).
communityApi.get('/business/stalls', (req, res) => res.json(teaStalls(uid(req))));
communityApi.post('/business/:id/buy', (req, res) => {
  reply(res, uid(req), buyDrink(uid(req), intField(req.params.id, 'Quầy'), String(req.body?.recipe ?? ''), Number(req.body?.qty ?? 1)));
});

// ---- Tòa thị chính ----

communityApi.get('/town', (req, res) => res.json(townView(uid(req))));
communityApi.post('/town/vote', (req, res) => {
  requireLevel(uid(req), UNLOCKS.townhall, 'Bỏ phiếu');
  reply(res, uid(req), vote(uid(req), String(req.body?.option ?? '')));
});

// ---- Bạn bè ----

communityApi.get('/friends', (req, res) => res.json(friendsView(uid(req))));
communityApi.post('/friends/request', (req, res) => reply(res, uid(req), requestFriend(uid(req), req.body?.username)));
communityApi.post('/friends/:id/accept', (req, res) => reply(res, uid(req), acceptFriend(uid(req), intField(req.params.id, 'Người chơi'))));
communityApi.post('/friends/:id/remove', (req, res) => reply(res, uid(req), removeFriend(uid(req), intField(req.params.id, 'Người chơi'))));
communityApi.get('/friends/:id/visit', (req, res) => res.json(visit(uid(req), intField(req.params.id, 'Người chơi'))));
communityApi.post('/friends/:id/like', (req, res) => reply(res, uid(req), likeFriend(uid(req), intField(req.params.id, 'Người chơi'))));
communityApi.post('/friends/:id/gift', (req, res) => {
  reply(res, uid(req), giftFriend(uid(req), intField(req.params.id, 'Người chơi'), String(req.body?.itemId ?? '')));
});

// ---- Hội ----

communityApi.get('/guild', (req, res) => res.json(guildView(uid(req))));
communityApi.post('/guild/create', (req, res) => {
  requireLevel(uid(req), UNLOCKS.guild, 'Lập Hội');
  reply(res, uid(req), createGuild(uid(req), { name: req.body?.name, emblem: req.body?.emblem }));
});
communityApi.post('/guild/:id/join', (req, res) => reply(res, uid(req), joinGuild(uid(req), intField(req.params.id, 'Hội'))));
communityApi.post('/guild/leave', (req, res) => reply(res, uid(req), leaveGuild(uid(req))));
communityApi.post('/guild/donate', (req, res) => reply(res, uid(req), donate(uid(req), intField(req.body?.amount, 'Số tiền'))));
communityApi.post('/guild/upgrade', (req, res) => reply(res, uid(req), upgradeGuild(uid(req), String(req.body?.key ?? ''))));
communityApi.post('/guild/contribute', (req, res) => {
  const qty = intField(req.body?.qty, 'Khối lượng');
  reply(res, uid(req), contribute(uid(req), String(req.body?.commodity ?? ''), qty));
});

// ---- Nhiệm vụ ngày ----

communityApi.get('/quests', (req, res) => res.json(questsView(uid(req))));
communityApi.post('/quests/:slot/claim', (req, res) => {
  const slot = Number(req.params.slot);
  if (!Number.isInteger(slot)) throw new GameError('Nhiệm vụ không hợp lệ.');
  reply(res, uid(req), claimQuest(uid(req), slot));
});
