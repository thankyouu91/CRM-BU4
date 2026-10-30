// Sổ cái: nơi duy nhất được phép làm thay đổi xu. Mỗi dòng ghi số dư sau giao dịch để đối soát.
import { db } from './db.js';
import { GameError } from './game.js';

/** Nhóm: income/expense được tính vào báo cáo thu chi; transfer chỉ là chuyển giữa các túi của cùng người chơi. */
export const KINDS = {
  opening: { group: 'transfer', label: 'Số dư ban đầu' },
  daily: { group: 'income', label: 'Quà ngày' },
  play: { group: 'income', label: 'Chơi với bé' },
  level: { group: 'income', label: 'Thưởng lên cấp' },
  cuddle: { group: 'income', label: 'Bạn bè công viên' },
  salary: { group: 'income', label: 'Lương' },
  minigame: { group: 'income', label: 'Mini-game' },
  market_sell: { group: 'income', label: 'Bán trên Sàn' },
  gear_trade: { group: 'income', label: 'Thưởng giao dịch (trang phục)' },
  gift_code: { group: 'income', label: 'Mã quà' },
  interest: { group: 'income', label: 'Lãi ngân hàng' },
  shop: { group: 'expense', label: 'Siêu thị' },
  adopt: { group: 'expense', label: 'Nhận nuôi' },
  market_buy: { group: 'expense', label: 'Mua trên Sàn' },
  fee: { group: 'expense', label: 'Phí giao dịch' },
  warehouse: { group: 'expense', label: 'Nâng cấp kho' },
  savings_in: { group: 'transfer', label: 'Gửi tiết kiệm' },
  savings_out: { group: 'transfer', label: 'Rút tiết kiệm' },
  deposit_open: { group: 'transfer', label: 'Gửi kỳ hạn' },
  deposit_close: { group: 'transfer', label: 'Tất toán kỳ hạn' },
  escrow_lock: { group: 'transfer', label: 'Ký quỹ lệnh' },
  escrow_release: { group: 'transfer', label: 'Hoàn ký quỹ' },
  business_income: { group: 'income', label: 'Doanh thu quầy' },
  license: { group: 'expense', label: 'Giấy phép quầy' },
  rent: { group: 'expense', label: 'Thuê mặt bằng' },
  wage: { group: 'expense', label: 'Trả lương nhân viên' },
  biz_upgrade: { group: 'expense', label: 'Nâng cấp quầy' },
  marketing: { group: 'expense', label: 'Quảng cáo' },
  tax: { group: 'expense', label: 'Thuế' },
  stipend: { group: 'income', label: 'Trợ cấp tân thủ' },
  quest: { group: 'income', label: 'Nhiệm vụ' },
  guild_create: { group: 'expense', label: 'Lập Hội' },
  guild_donation: { group: 'expense', label: 'Góp quỹ Hội' },
  guild_reward: { group: 'income', label: 'Thưởng dự án Hội' },
  town_spend: { group: 'transfer', label: 'Chi ngân sách' },
  guild_upgrade: { group: 'transfer', label: 'Chi quỹ Hội' },
  clinic: { group: 'expense', label: 'Phòng khám' },
  insurance: { group: 'expense', label: 'Bảo hiểm' },
  school: { group: 'expense', label: 'Học phí' },
  seeds: { group: 'expense', label: 'Hạt giống' },
  garden_expand: { group: 'expense', label: 'Mở rộng vườn' },
  garden_help: { group: 'income', label: 'Tưới vườn giúp bạn' },
  kitchen_sale: { group: 'income', label: 'Bán món ăn' },
  factory_build: { group: 'expense', label: 'Xây xưởng' },
  factory_upgrade: { group: 'expense', label: 'Nâng cấp xưởng' },
  toll_fee: { group: 'expense', label: 'Phí gia công' },
  toll_income: { group: 'income', label: 'Thu phí gia công' },
  contract_buy: { group: 'expense', label: 'Mua theo hợp đồng' },
  contract_sell: { group: 'income', label: 'Bán theo hợp đồng' },
  contract_penalty: { group: 'expense', label: 'Bồi thường hợp đồng' },
  contract_comp: { group: 'income', label: 'Nhận bồi thường' },
  bazaar_buy: { group: 'expense', label: 'Mua ở Chợ Phiên' },
  bazaar_sale: { group: 'income', label: 'Bán ở Chợ Phiên' },
  loan_in: { group: 'transfer', label: 'Giải ngân khoản vay' },
  loan_repay: { group: 'transfer', label: 'Trả gốc vay' },
  loan_interest: { group: 'expense', label: 'Lãi vay' },
  loan_fee: { group: 'expense', label: 'Phí vay' },
  town_seed: { group: 'transfer', label: 'Quỹ khởi tạo' },
  slot_reopen: { group: 'expense', label: 'Mở lại ô tưởng niệm' },
  admin: { group: 'transfer', label: 'Quản trị viên điều chỉnh' },
  clan_create: { group: 'expense', label: 'Lập gia tộc' },
  clan_donation: { group: 'expense', label: 'Góp quỹ gia tộc' },
  clan_dividend: { group: 'income', label: 'Cổ tức gia tộc' },
  // Các dòng dưới chỉ ghi trên tài khoản quỹ gia tộc (clan:<id>) và ngân sách thị trấn.
  clan_comp: { group: 'transfer', label: 'Bồi thường thị trường (thâu tóm ngành)' },
  clan_land: { group: 'transfer', label: 'Mua bán đất' },
  clan_build: { group: 'transfer', label: 'Xây công trình' },
  clan_revenue: { group: 'transfer', label: 'Doanh thu gia tộc' },
  clan_upkeep: { group: 'transfer', label: 'Phí duy trì gia tộc' },
  corp_tax: { group: 'transfer', label: 'Thuế doanh nghiệp' },
  corp_tax_refund: { group: 'transfer', label: 'Hoàn thuế doanh nghiệp' },
  corp_tax_collect: { group: 'transfer', label: 'Sở thuế truy thu' },
  goods_trade: { group: 'transfer', label: 'Mua bán hàng công nghiệp' },
  infra_bonus: { group: 'income', label: 'Buff hạ tầng chiến lược' },
  infra_fee: { group: 'expense', label: 'Phí hạ tầng' },
  tax_commission: { group: 'transfer', label: 'Hoa hồng truy thu thuế' },
  goods_import: { group: 'transfer', label: 'Nhập khẩu nguyên liệu' },
};

/** Thu thuế: một nửa vào ngân sách thị trấn, một nửa bị hủy (cùng tỉ lệ như phí). */
export function chargeTax(userId, amount, memo, now = Date.now()) {
  if (amount <= 0) return;
  post({ userId, delta: -amount, kind: 'tax', memo, now });
  const toTreasury = Math.floor(amount / 2);
  if (toTreasury > 0) post({ account: 'treasury', delta: toTreasury, kind: 'tax', memo, now });
}

export const treasuryBalance = () => q.account.get('treasury')?.balance ?? 0;

const q = {
  addWallet: db.prepare('UPDATE users SET coins = coins + ? WHERE id = ? AND coins + ? >= 0'),
  wallet: db.prepare('SELECT coins FROM users WHERE id = ?'),
  ensureBank: db.prepare('INSERT OR IGNORE INTO bank_accounts (user_id, savings, accrued, updated_at) VALUES (?, 0, 0, ?)'),
  addSavings: db.prepare('UPDATE bank_accounts SET savings = savings + ? WHERE user_id = ? AND savings + ? >= 0'),
  savings: db.prepare('SELECT savings FROM bank_accounts WHERE user_id = ?'),
  addAccount: db.prepare(`
    INSERT INTO accounts (id, balance) VALUES (?, ?)
    ON CONFLICT (id) DO UPDATE SET balance = balance + excluded.balance`),
  account: db.prepare('SELECT balance FROM accounts WHERE id = ?'),
  insert: db.prepare(`
    INSERT INTO ledger (user_id, account, delta, balance_after, kind, memo, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`),
};

/**
 * Ghi một biến động xu. `account` là 'wallet' (mặc định) hoặc 'savings' của `userId`,
 * hoặc một tài khoản chung như 'treasury' (khi đó userId = null).
 * Ném GameError nếu số dư sẽ âm. Gọi bên trong transaction của nơi dùng.
 */
export function post({ userId = null, account = 'wallet', delta, kind, memo = null, now = Date.now() }) {
  if (!Number.isInteger(delta)) throw new Error(`Số xu phải là số nguyên: ${delta}`);
  if (!KINDS[kind]) throw new Error(`Loại giao dịch lạ: ${kind}`);
  if (delta === 0) return null;
  let balance;
  if (account === 'wallet') {
    if (q.addWallet.run(delta, userId, delta).changes === 0) throw new GameError('Không đủ xu.');
    balance = q.wallet.get(userId).coins;
  } else if (account === 'savings') {
    q.ensureBank.run(userId, now);
    if (q.addSavings.run(delta, userId, delta).changes === 0) throw new GameError('Tài khoản tiết kiệm không đủ tiền.');
    balance = q.savings.get(userId).savings;
  } else {
    q.addAccount.run(account, delta);
    balance = q.account.get(account).balance;
  }
  q.insert.run(userId, account, delta, balance, kind, memo, now);
  return balance;
}

/** Thu phí: người chơi trả đủ, một nửa vào ngân sách thị trấn, nửa còn lại bị hủy khỏi nền kinh tế. */
export function chargeFee(userId, amount, memo, now = Date.now()) {
  if (amount <= 0) return;
  post({ userId, delta: -amount, kind: 'fee', memo, now });
  const toTreasury = Math.floor(amount / 2);
  if (toTreasury > 0) post({ account: 'treasury', delta: toTreasury, kind: 'fee', memo, now });
}
