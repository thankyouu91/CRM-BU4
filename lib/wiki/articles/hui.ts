import type { WikiArticle } from "../types";
import { UNLOCKS } from "../rules";
import { HUI_EXTRA } from "../rules-credit";
import { HUI, pickWinner, splitPot } from "@/petdex/server/rules/finance.js";

// Hụi bỏ thăm của người chơi và hụi lớn giữa các gia tộc (petdex/server/hui.js, rules/finance.js HUI).
// Các ví dụ chạy bằng đúng hàm chọn người hốt và chia tiền thăm của game.

const xu = (n: number) => `${n.toLocaleString("vi-VN")} xu`;
const pct = (x: number) => `${String(+(x * 100).toFixed(2)).replace(".", ",")}%`;
const signedXu = (n: number) => (n > 0 ? `+${xu(n)}` : n < 0 ? `−${xu(-n)}` : "0 xu");
const minus = (n: number) => `−${-n}`;

// ---------------------------------------------------------------- mô phỏng một dây hụi

type Plan = {
  amount: number;
  /** Theo thứ tự vào dây; người đầu là chủ hụi. */
  members: string[];
  /** Tiền thăm từng kỳ (kỳ 1 trước). */
  bids: Record<string, number>[];
  /** Ai không đóng nổi ở kỳ nào. */
  drops?: Record<string, number>;
};

function simulate(plan: Plan) {
  const people = plan.members.map((name, id) => ({ id, name, paid: 0, got: 0, won: 0, out: 0 }));
  const rounds: (string | number)[][] = [];
  for (let round = 1; round <= 20; round++) {
    const payers = [];
    for (const m of people) {
      if (m.out) continue;
      if (plan.drops?.[m.name] === round) {
        m.out = round;
        continue;
      }
      m.paid += plan.amount;
      payers.push(m);
    }
    const pot = payers.length * plan.amount;
    const eligible = payers.filter((m) => !m.won).map((m) => m.id);
    const bids = Object.entries(plan.bids[round - 1] ?? {}).map(([name, bid], at) => ({ member_id: people.find((m) => m.name === name)!.id, bid, at }));
    const pick = pickWinner(eligible, bids, round, 0);
    if (pick && pot > 0) {
      const winner = people[pick.winner];
      const others = payers.filter((m) => m !== winner);
      const split = splitPot(pot, pick.bid, others.length);
      winner.got += split.winner;
      for (const o of others) o.got += split.each;
      winner.won = round;
      rounds.push([`Kỳ ${round}`, payers.length, pot, pick.bid ? `${winner.name} (thăm ${xu(pick.bid)})` : `${winner.name} (không ai bỏ thăm)`, split.winner, split.each]);
    }
    const stillToWin = people.filter((m) => !m.out && !m.won).length;
    const active = people.filter((m) => !m.out).length;
    if (stillToWin === 0 || active < 2) break;
  }
  const totals = people.map((m) => [m.name + (m.id === 0 ? " (chủ hụi)" : ""), m.won ? `Kỳ ${m.won}` : "Không", xu(m.paid), xu(m.got), signedXu(m.got - m.paid)]);
  return { rounds, totals, people };
}

const NAMES = ["An", "Bình", "Chi", "Dũng"];
const AMOUNT = 1_000;
const BIDS: Record<string, number>[] = [{ Bình: 600, Chi: 300 }, { Chi: 300, Dũng: 100 }, { Dũng: 150 }, {}];
const fair = simulate({ amount: AMOUNT, members: NAMES, bids: BIDS });
const runaway = simulate({ amount: AMOUNT, members: NAMES, bids: [BIDS[0], { Chi: 300 }, { Dũng: 150 }, {}], drops: { Bình: 2 } });
const [an, binh] = fair.people;
const runner = runaway.people[1];
const pot4 = AMOUNT * NAMES.length;
const maxBid4 = Math.floor(pot4 * HUI.maxBidRatio);

const ROUND_HEAD = ["Kỳ", "Số người góp", "Quỹ kỳ", "Người hốt", "Người hốt nhận", "Mỗi người khác nhận"];
const TOTAL_HEAD = ["Người", "Hốt ở", "Đã góp", "Đã nhận", "Lời / lỗ"];

export const article: WikiArticle = {
  slug: "hui",
  title: "Hụi",
  category: "kinh-te",
  emoji: "🪙",
  summary: `Chơi hụi bỏ thăm với người chơi khác hoặc giữa các gia tộc: mỗi đêm mọi người góp một khoản, người bỏ thăm cao nhất hốt cả quỹ, và bỏ ngang thì mất tiền đã góp, bị trừ điểm tín dụng.`,
  keywords: ["hụi", "họ", "hụi bỏ thăm", "hốt hụi", "bỏ thăm", "tiền thăm", "chủ hụi", "dây hụi", "giật hụi", "bể hụi", "hụi lớn", "hụi gia tộc"],
  related: ["vay-ngang-hang", "tin-dung", "gia-toc", "ngan-hang", "tai-chinh"],
  sections: [
    {
      id: "la-gi",
      title: "Hụi bỏ thăm là gì",
      blocks: [
        { p: `Vào màn **🤝 Vay ngang hàng & Hụi**, tab **🔄 Hụi** (mở từ **cấp ${UNLOCKS.bank}**). Một **dây hụi** là một nhóm cùng góp tiền:` },
        { list: [
          "**Mỗi đêm là một kỳ**: lúc quyết toán nửa đêm (giờ Việt Nam), mọi thành viên góp đúng số tiền đã định vào **quỹ hụi**.",
          "Kỳ nào cũng có **một người hốt hụi** (nhận cả quỹ kỳ đó). Mỗi người chỉ hốt **một lần**.",
          "Ai muốn hốt sớm thì **bỏ thăm**: hứa trả một khoản **tiền thăm** cho những người còn lại. Thăm cao nhất thắng.",
          "Dây kết thúc (**Đã mãn hụi**) khi ai cũng đã hốt, nên dây N người chạy N kỳ, tức N đêm.",
        ] },
        { p: "Nói gọn: hốt sớm giống như **vay** của cả nhóm (trả lãi bằng tiền thăm), hốt muộn giống như **gửi tiết kiệm** (được chia tiền thăm của người khác)." },
      ],
    },
    {
      id: "lap-day",
      title: "Lập dây và vào dây",
      blocks: [
        { table: { head: ["", "Hụi người chơi", "Hụi lớn gia tộc"], rows: [
          ["Ai thao tác", "Chính bạn", "Chỉ **tộc trưởng** (tộc trưởng đã bị phế truất thì không)"],
          ["Góp bằng", "**Ví** của bạn", "**Quỹ gia tộc**"],
          ["Tiền góp mỗi kỳ", `${xu(HUI.player.minAmount)} tới ${xu(HUI.player.maxAmount)}`, `${xu(HUI.clan.minAmount)} tới ${xu(HUI.clan.maxAmount)}`],
          ["Số thành viên", `${HUI.player.minSize} tới ${HUI.player.maxSize} người`, `${HUI.clan.minSize} tới ${HUI.clan.maxSize} gia tộc`],
          ["Số dây cùng lúc", `tối đa ${HUI_EXTRA.maxGroups} dây mỗi người`, `tối đa ${HUI_EXTRA.maxGroups} dây mỗi gia tộc`],
        ] } },
        { steps: [
          "Ở **➕ Lập dây hụi**, đặt tên (3 tới 30 ký tự), số tiền góp mỗi kỳ và số thành viên, bấm **Lập dây**. Người lập là **chủ hụi** và là thành viên đầu tiên.",
          "Người khác tìm dây ở **📣 Dây đang gom người** và bấm **Vào dây hụi**.",
          "Đủ số người đã định thì dây **tự chạy**. Chủ hụi cũng có thể bấm **Cho chạy ngay** khi đã có ít nhất số tối thiểu.",
          "Dây chạy thì **kỳ 1 chốt ngay nửa đêm hôm đó**, rồi mỗi đêm một kỳ.",
        ] },
        { list: [
          "Trước khi dây chạy, thành viên bấm **Rời dây** được mà không mất gì (chưa góp kỳ nào). Chủ hụi bấm **Hủy dây** thì cả dây hủy.",
          `Dây gom người quá **${HUI.openDays} ngày** mà chưa đủ: có từ ${HUI.player.minSize} thành viên trở lên thì tự chạy (kỳ 1 chốt luôn đêm đó), ít hơn thì tự hủy, không ai mất xu nào.`,
          "Khi dây đã chạy thì **không rời được** nữa.",
          "Mở dây hụi lớn gia tộc thì cả thị trấn thấy tin trên báo.",
        ] },
      ],
    },
    {
      id: "bo-tham",
      title: "Bỏ thăm và hốt hụi",
      blocks: [
        { list: [
          `Chỉ người **chưa hốt** mới được bỏ thăm, cho kỳ sắp chốt. Tiền thăm từ 0 tới **${pct(HUI.maxBidRatio)} quỹ kỳ** (quỹ kỳ = tiền góp × số thành viên còn lại).`,
          "Bấm **Đổi thăm** để sửa trước nửa đêm; đặt về 0 là rút thăm.",
          "Nửa đêm: **thăm cao nhất hốt**. Bằng nhau thì ai bỏ thăm trước thắng.",
          "**Không ai bỏ thăm**: kỳ 1 chủ hụi hốt, các kỳ sau người vào dây sớm nhất trong số chưa hốt hốt.",
          "Người hốt nhận **quỹ kỳ trừ tiền thăm**. Tiền thăm **chia đều** cho tất cả những người cùng góp kỳ đó (kể cả người đã hốt từ trước); phần lẻ không chia hết trả lại người hốt.",
          "Đã hốt rồi thì **chỉ còn góp đều** tới hết dây, không bỏ thăm nữa.",
        ] },
        { p: `Ví dụ dây ${NAMES.length} người góp ${xu(AMOUNT)}/kỳ: quỹ kỳ ${xu(pot4)}, tiền thăm tối đa ${xu(maxBid4)}. Ai bỏ thăm ${xu(600)} mà thắng thì nhận ${xu(pot4 - 600)}, ba người kia mỗi người nhận ${xu(200)}.` },
        { tip: "Thẻ dây hụi cho biết kỳ nào chốt sau bao lâu, quỹ kỳ bao nhiêu, bạn đã góp và đã nhận bao nhiêu. Mở **Lịch sử** để xem ai hốt kỳ nào, thăm bao nhiêu." },
      ],
    },
    {
      id: "vi-du",
      title: `Ví dụ: dây ${NAMES.length} người, ${NAMES.length} kỳ`,
      blocks: [
        { p: `${NAMES.join(", ")} chơi dây góp **${xu(AMOUNT)}/kỳ**, ${NAMES[0]} là chủ hụi. Mỗi người góp đủ ${NAMES.length} kỳ, tức ${xu(AMOUNT * NAMES.length)}.` },
        { table: { head: ROUND_HEAD, rows: fair.rounds } },
        { table: { head: TOTAL_HEAD, rows: fair.totals } },
        { list: [
          `**${binh.name}** cần tiền gấp nên bỏ thăm cao để hốt kỳ 1: có ngay ${xu(Number(fair.rounds[0][4]))} từ đêm đầu, đổi lại tổng cộng lỗ ${xu(binh.paid - binh.got)}. Đó là **tiền lãi** cho việc được dùng tiền sớm.`,
          `**${an.name}** không bỏ thăm, hốt kỳ cuối, cộng thêm phần chia tiền thăm của mọi kỳ trước: lời ${xu(an.got - an.paid)}. Đó là **tiền lãi** cho việc chịu đợi.`,
          "Tổng lời lỗ của cả dây luôn bằng 0: hụi không sinh ra xu, chỉ chuyển tiền giữa người hốt sớm và người hốt muộn.",
        ] },
        { tip: "Không cần tiền gấp thì đừng bỏ thăm, cứ góp đều và hốt muộn để ăn tiền thăm. Cần vốn ngay thì so tiền thăm với lãi [vay ngân hàng](tin-dung) hay [vay ngang hàng](vay-ngang-hang) trước khi bỏ thăm." },
      ],
    },
    {
      id: "khong-dong",
      title: "Không đóng được hụi",
      blocks: [
        { p: "Tới nửa đêm mà **ví** của bạn (hụi gia tộc: **quỹ gia tộc**) không đủ tiền góp kỳ đó thì:" },
        { list: [
          "Bạn **bị loại khỏi dây**, **không được hoàn** số đã góp. Cả thị trấn thấy tin trên báo.",
          `Người chơi bị **${minus(HUI.creditPenaltyBeforeWin)} điểm tín dụng** nếu chưa hốt, **${minus(HUI.creditPenalty)} điểm** nếu đã hốt.`,
          `Người chơi bị **cấm chơi hụi ${HUI.banDays} ngày**: không lập hay vào dây mới được.`,
          "Gia tộc bị loại thì mất số đã góp; trừ điểm và cấm chơi chỉ áp dụng cho hụi người chơi.",
          "Các thành viên còn lại góp tiếp, quỹ mỗi kỳ nhỏ đi vì bớt người góp.",
        ] },
        { warn: "Tiền góp chỉ lấy từ **ví**, không lấy từ tiết kiệm. Trước nửa đêm nhớ để đủ xu trong ví cho mọi dây đang chơi, nhất là khi vừa tiêu nhiều trong ngày." },
      ],
    },
    {
      id: "giat-hui",
      title: "Cẩn thận giật hụi",
      blocks: [
        { p: `**Giật hụi** là hốt sớm rồi bỏ dây, không góp nữa. Cùng dây ở ví dụ trên, giả sử ${runner.name} hốt kỳ 1 rồi kỳ 2 không đóng:` },
        { table: { head: ROUND_HEAD, rows: runaway.rounds } },
        { table: { head: TOTAL_HEAD, rows: runaway.totals.map((r, i) => (runaway.people[i].out ? [r[0], `${r[1]}, bỏ dây kỳ ${runaway.people[i].out}`, ...r.slice(2)] : r)) } },
        { p: `${runner.name} bỏ túi ${xu(runner.got - runner.paid)} và chỉ mất ${-HUI.creditPenalty} điểm tín dụng cùng ${HUI.banDays} ngày cấm chơi hụi. Ba người còn lại **chia nhau gánh khoản đó**: game không đền bù cho ai.` },
        { warn: "Chỉ chơi hụi với người bạn tin được. Người đã hốt sớm mà ít xu là rủi ro lớn nhất cho những người hốt sau. Dây càng dài, người hốt muộn càng phải chờ lâu." },
      ],
    },
  ],
};
