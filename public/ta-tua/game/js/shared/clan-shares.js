// Cổ phần gia tộc: luật chung cho server, giao diện và wiki (hàm thuần, không đụng cơ sở dữ liệu).
// Mỗi gia tộc có 1.000 cổ phần. Lên sàn (IPO): bán tối đa 30% cho người chơi với giá cố định trong 24 giờ, phần không ai
// mua thì ngân hàng gia tộc bảo lãnh mua lại; gia tộc góp 10% cổ phần và xu làm "quỹ khớp lệnh" để sàn chạy. Phần còn
// lại chia cho thành viên theo số đã góp quỹ. Sau đó giá chạy theo cung cầu: mua thì giá lên, bán thì giá xuống (quỹ khớp
// lệnh giữ tích số xu × cổ phần không đổi), mỗi ngày chỉ dao động trong biên ±15% so với giá đầu ngày.

export const SHARES = {
  total: 1_000,
  /** Bán ra công chúng lúc IPO: tối đa 30% số cổ phần. */
  ipoMax: 0.3,
  ipoMin: 0.05,
  /** Giá IPO trong khoảng 0,5 tới 2 lần giá trị sổ sách mỗi cổ phần (quỹ + giá trị đất) / 1.000. */
  ipoBand: [0.5, 2],
  subscribeHours: 24,
  /** Gia tộc góp 10% cổ phần cùng số xu tương ứng theo giá IPO vào quỹ khớp lệnh. */
  poolShare: 0.1,
  /** Ngân hàng gia tộc bảo lãnh: mua phần IPO không ai mua với giá 90% giá IPO; thu phí 2% số xu IPO thu được. */
  underwritePrice: 0.9,
  underwriteFee: 0.02,
  /** Phí giao dịch 1% mỗi lệnh, trả cho gia tộc nắm Ngân hàng nhà nước (môi giới). */
  fee: 0.01,
  /** Biên độ giá mỗi ngày so với giá đầu ngày. */
  band: 0.15,
  /** Một người chơi giữ tối đa 10% cổ phần của một gia tộc. */
  playerCap: 0.1,
  /** Nắm trên 25% thì lên báo công bố; trên 50% (chỉ gia tộc mới nắm được) thì nắm quyền kiểm soát. */
  disclose: 0.25,
  control: 0.5,
  /** Sở Công Thương chặn thâu tóm làm gia tộc vượt 40% số lô của một ngành. */
  antitrustShare: 0.4,
  margin: {
    /** Vay ký quỹ của ngân hàng gia tộc: tối đa 50% giá trị lệnh mua. */
    maxLtv: 0.5,
    /** Giá trị cổ phần cầm cố dưới 130% số nợ thì bị bán giải chấp. */
    maintenance: 1.3,
    /** Lãi mỗi ngày = lãi cho vay của ngân hàng. */
  },
};

export const SHARE_IPO_MAX = Math.floor(SHARES.total * SHARES.ipoMax);
export const SHARE_POOL = Math.floor(SHARES.total * SHARES.poolShare);
export const PLAYER_CAP = Math.floor(SHARES.total * SHARES.playerCap);

/** Giá hiện tại của quỹ khớp lệnh. */
export const poolPrice = (coins, shares) => (shares > 0 ? coins / shares : 0);

/** Mua `qty` cổ phần từ quỹ (tích số không đổi): số xu phải trả trước phí. Infinity nếu quỹ không đủ cổ phần. */
export function buyCost(coins, shares, qty) {
  if (qty >= shares) return Infinity;
  return Math.ceil((coins * qty) / (shares - qty));
}

/** Bán `qty` cổ phần vào quỹ: số xu nhận được trước phí. */
export const sellProceeds = (coins, shares, qty) => Math.floor((coins * qty) / (shares + qty));

/** Giá sau lệnh còn trong biên ngày không. */
export function withinBand(refPrice, nextPrice) {
  return nextPrice <= refPrice * (1 + SHARES.band) + 1e-9 && nextPrice >= refPrice * (1 - SHARES.band) - 1e-9;
}

/** Phí giao dịch của một lệnh `value` xu. */
export const tradeFee = (value) => Math.max(1, Math.ceil(value * SHARES.fee));

/** Chia phần cổ phần thành viên theo số đã góp quỹ (ai cũng ít nhất 1 khi đủ; phần lẻ cho người góp nhiều nhất). */
export function allotByDonation(members, shares) {
  const total = members.reduce((s, m) => s + Math.max(0, m.donated), 0);
  const out = members.map((m) => ({ id: m.id, qty: total ? Math.floor((shares * Math.max(0, m.donated)) / total) : Math.floor(shares / members.length) }));
  let left = shares - out.reduce((s, o) => s + o.qty, 0);
  const order = [...out].sort((a, b) => (members.find((m) => m.id === b.id)?.donated ?? 0) - (members.find((m) => m.id === a.id)?.donated ?? 0));
  for (let i = 0; left > 0; i = (i + 1) % order.length, left -= 1) order[i].qty += 1;
  return out;
}
