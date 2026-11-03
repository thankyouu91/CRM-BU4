// API trò chuyện (kênh chung, gia tộc, tin nhắn riêng) và hộp thư.
import {
  blockList, blockUser, chatFeed, claimMail, deleteMail, findChatUser, mailbox, playerMail, pmThreads, readAllMail, readMail,
  sendChat, unblockUser,
} from './chat.js';
import { auth, intField, reply } from './http.js';
import { Router } from './router.js';

export const chatApi = Router();
chatApi.use(auth);

const uid = (req) => req.user.id;
const num = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : 0);

chatApi.get('/chat/threads', (req, res) => res.json({ threads: pmThreads(uid(req)), blocked: blockList(uid(req)) }));
chatApi.get('/chat/find', (req, res) => res.json(findChatUser(uid(req), req.query?.username)));
chatApi.get('/chat/:key', (req, res) => res.json(chatFeed(uid(req), String(req.params.key), { since: num(req.query?.since), before: num(req.query?.before) })));
chatApi.post('/chat/:key', (req, res) => res.json(sendChat(uid(req), String(req.params.key), req.body?.text)));
chatApi.post('/chat/block/:id', (req, res) => res.json(blockUser(uid(req), intField(req.params.id, 'Người chơi'))));
chatApi.post('/chat/unblock/:id', (req, res) => res.json(unblockUser(uid(req), intField(req.params.id, 'Người chơi'))));

chatApi.get('/mail', (req, res) => res.json(mailbox(uid(req))));
chatApi.post('/mail/send', (req, res) => res.json(playerMail(uid(req), { to: req.body?.to, subject: req.body?.subject, body: req.body?.body })));
chatApi.post('/mail/read-all', (req, res) => res.json(readAllMail(uid(req))));
chatApi.post('/mail/:id/read', (req, res) => res.json(readMail(uid(req), intField(req.params.id, 'Thư'))));
chatApi.post('/mail/:id/claim', (req, res) => reply(res, uid(req), claimMail(uid(req), intField(req.params.id, 'Thư'))));
chatApi.post('/mail/:id/delete', (req, res) => res.json(deleteMail(uid(req), intField(req.params.id, 'Thư'))));
