// Bộ lập lịch toàn cục: nhịp giá Sàn mỗi 10 phút và quyết toán lúc nửa đêm (giờ Việt Nam).
// Lưu mốc lần chạy cuối, nên server tắt một thời gian thì bật lên vẫn chạy bù.
import { centralBankWeek, settleBankDay } from './bank.js';
import { settleBusinessDay } from './business.js';
import { expireListings } from './bazaar.js';
import { settleCareDay } from './care.js';
import { settleContractsDay } from './contracts.js';
import { settleLoansDay } from './credit.js';
import { settleFactoryDay } from './factory.js';
import { settleLifeDay } from './lifecycle.js';
import { closeWeek, settleTaxes, weekKey } from './town.js';
import { dayKey, nextDay, startOfDay, weekday } from './clock.js';
import { getMeta, setMeta } from './db.js';
import { DAY } from './game.js';
import { expireOrders, initMarket, marketTick, pruneHistory } from './market.js';
import { MARKET } from './rules/market.js';
import { snapshotNetWorth } from './wallet.js';

const MAX_CATCH_UP = 3 * DAY;

/**
 * Đóng sổ một ngày theo thứ tự cố định: quầy (bán bù + tiền thuê), xưởng (chạy bù + thuê đất), sức khỏe và bảo hiểm, vòng đời (bé hết tuổi thọ),
 * giao hàng hợp đồng, lãi ngân hàng, trả góp khoản vay, thuế thu nhập, hết hạn lệnh và tin Chợ Phiên, chụp tài sản.
 * Chủ nhật thì thêm Ngân hàng Trung ương và kết quả bỏ phiếu của Tòa thị chính.
 */
export function closeDay(day, rand = Math.random) {
  const end = startOfDay(nextDay(day));
  settleBusinessDay(day, rand);
  settleFactoryDay(day, rand);
  settleCareDay(day, end, rand);
  settleLifeDay(day);
  settleContractsDay(day);
  settleBankDay(end);
  settleLoansDay(day);
  settleTaxes(day, end);
  expireOrders(nextDay(day), end);
  expireListings(end);
  snapshotNetWorth(day, end);
  pruneHistory(end - 14 * DAY);
  if (weekday(day) === 0) {
    centralBankWeek(day, end);
    closeWeek(weekKey(day), end, rand);
  }
}

/** Chạy mọi việc đã đến hạn tính tới `now`. Trả về số nhịp giá và số ngày đã quyết toán. */
export function runDue(now = Date.now(), rand = Math.random) {
  let lastTick = Number(getMeta('market_tick') ?? 0);
  if (!lastTick) {
    // Khởi động ấm: mở Sàn từ 24 giờ trước rồi chạy bù, để người chơi đầu tiên đã thấy biểu đồ có sóng.
    lastTick = Math.floor((now - DAY) / MARKET.tickMs) * MARKET.tickMs;
    initMarket(lastTick);
    setMeta('market_tick', lastTick);
  }
  let ticks = 0;
  let t = Math.max(lastTick + MARKET.tickMs, Math.floor((now - MAX_CATCH_UP) / MARKET.tickMs) * MARKET.tickMs);
  for (; t <= now; t += MARKET.tickMs) {
    marketTick(t, rand);
    setMeta('market_tick', t);
    ticks += 1;
  }

  const today = dayKey(now);
  let settled = getMeta('settled_day');
  if (!settled) {
    settled = dayKey(now - DAY);
    setMeta('settled_day', settled);
  }
  let days = 0;
  while (nextDay(settled) < today) {
    settled = nextDay(settled);
    closeDay(settled, rand);
    setMeta('settled_day', settled);
    days += 1;
  }
  return { ticks, days };
}

export function startScheduler() {
  const run = () => {
    try {
      runDue();
    } catch (err) {
      console.error('Lỗi bộ lập lịch:', err);
    }
  };
  run();
  return setInterval(run, 30_000);
}
