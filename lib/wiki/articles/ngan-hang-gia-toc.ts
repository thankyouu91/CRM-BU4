import type { WikiArticle } from "../types";
import { UNLOCKS } from "../rules";
import { BANK } from "@/petdex/server/rules/bank.js";
import { CBANK, balanceSheet, failurePayout, maxDepositRate, simpleInterest } from "@/public/ta-tua/game/js/shared/clan-bank.js";
import { FINANCE_TAX, financeTax } from "@/public/ta-tua/game/js/shared/clan-bonds.js";

// Ngân hàng gia tộc: tiền gửi của người chơi ở ngân hàng do gia tộc nắm Ngân hàng nhà nước điều hành
// (petdex/server/clan-bank.js). Mọi con số đọc thẳng từ public/ta-tua/game/js/shared/clan-bank.js;
// tests/petfarm-wiki-sync-clan-bank.test.ts chạy code của game và báo khi một con số lệch.

const xu = (n: number) => `${n.toLocaleString("vi-VN")} xu`;
const pct = (x: number) => `${String(+(x * 100).toFixed(3)).replace(".", ",")}%`;
const terms = CBANK.terms.join(", ");
const rep = CBANK.reputation;

// Ví dụ: lãi suất cơ bản ban đầu, ngân hàng trả mức trần cho kỳ 14 ngày.
const base = BANK.defaultRate;
const cap = maxDepositRate(base);
const EX = { amount: 10_000, term: 14 };
const exNpc = Math.floor(EX.amount * (base + (BANK.termPremium as Record<number, number>)[EX.term]) * EX.term);
const exClan = simpleInterest(EX.amount, cap, EX.term);

// Ví dụ bảng cân đối: vốn chủ 100.000, nhận 400.000 tiền gửi, cho vay 380.000.
const sheet = balanceSheet({ cash: 120_000, loans: 380_000, deposits: 400_000 });
// Ví dụ đổ vỡ: hai người gửi 30.000 và 10.000, ngân hàng còn 8.000 tiền mặt, quỹ bảo hiểm có 100.000.
const fail = failurePayout([30_000, 10_000], 8_000, 100_000);

export const article: WikiArticle = {
  slug: "ngan-hang-gia-toc",
  title: "Ngân hàng gia tộc",
  category: "kinh-te",
  emoji: "🏯",
  summary: `Gia tộc nắm Ngân hàng nhà nước mở ngân hàng riêng, nhận tiền gửi ${terms} ngày với lãi tối đa ${CBANK.maxRateMultiple} lần lãi tiết kiệm NPC. Lãi cao hơn đi kèm rủi ro: ngân hàng thiếu tiền mặt thì phải xếp hàng rút, đổ vỡ thì bảo hiểm chỉ bù một phần.`,
  keywords: ["ngân hàng gia tộc", "tiền gửi", "gửi kỳ hạn", "lãi suất", "bảo hiểm tiền gửi", "rút tiền", "xếp hàng", "đổ vỡ", "uy tín", "thanh khoản", "vốn chủ", "state_bank", "ngân hàng nhà nước"],
  related: ["vay-the-chap", "ngan-hang", "gia-toc", "so-cong-thuong"],
  sections: [
    {
      id: "day-la-gi",
      title: "Đây là gì",
      blocks: [
        { p: `Ngoài [Ngân hàng Trân Châu](ngan-hang) của NPC, gia tộc đang nắm ngành chiến lược **🏦 Ngân hàng nhà nước** được mở một ngân hàng của riêng mình. Ngân hàng này nhận tiền gửi kỳ hạn của mọi người chơi và đem tiền đó [cho các gia tộc khác vay thế chấp](vay-the-chap).` },
        { p: `Tiền gửi nằm ở **tài khoản vốn riêng của ngân hàng**, tách khỏi quỹ gia tộc. Tộc trưởng tự đặt lãi; gửi ở đâu là do người gửi chọn. Mở ở màn **🏦 Ngân hàng → 🏯 Ngân hàng gia tộc** từ **cấp ${UNLOCKS.bank}**.` },
      ],
    },
    {
      id: "chuc-nang",
      title: "Chức năng",
      blocks: [
        { table: { head: ["Việc", "Ai làm", "Con số"], rows: [
          ["Mở ngân hàng", "Tộc trưởng gia tộc nắm Ngân hàng nhà nước", `Chuyển vốn chủ tối thiểu ${xu(CBANK.minCapital)} từ quỹ gia tộc`],
          ["Đặt lãi tiền gửi", "Tộc trưởng", `Mỗi kỳ hạn ${terms} ngày một mức, từ 0 tới ${CBANK.maxRateMultiple} × lãi suất cơ bản mỗi ngày`],
          ["Góp vốn / rút vốn", "Tộc trưởng", `Rút vốn phải giữ tiền mặt ≥ ${pct(CBANK.liquidityFloor)} tiền gửi, tiền gửi ≤ ${CBANK.leverage} × vốn chủ, và không ai đang xếp hàng`],
          ["Gửi tiền", "Mọi người chơi", `Mỗi khoản ≥ ${xu(CBANK.minDeposit)}; một người tối đa ${xu(CBANK.maxPerDepositor)} ở một ngân hàng. Lãi chốt lúc gửi`],
          ["Rút đủ hạn", "Người gửi", "Gốc + lãi đơn cả kỳ; nửa đêm ngày đáo hạn hệ thống tự trả"],
          ["Rút trước hạn", "Người gửi", "Chỉ nhận gốc, mất toàn bộ lãi"],
        ] } },
        { p: `**Lãi** = số tiền × lãi/ngày × số ngày, trả một lần khi đáo hạn. Ví dụ lúc lãi suất cơ bản là ${pct(base)}/ngày: gửi ${xu(EX.amount)} kỳ ${EX.term} ngày ở NPC được ${xu(exNpc)} lãi; ở ngân hàng gia tộc trả mức trần ${pct(cap)}/ngày được ${xu(exClan)}, trừ ${pct(FINANCE_TAX.rate)} thuế lợi nhuận tài chính còn ${xu(exClan - financeTax(exClan))} (lãi tiết kiệm NPC không chịu thuế này).` },
        { p: `**Phí bảo hiểm:** mỗi khoản gửi mới, ngân hàng (không phải người gửi) nộp **${pct(CBANK.insurancePremium)}** số tiền vào **quỹ bảo hiểm tiền gửi** chung. Phí giải ngân khoản vay (${pct(CBANK.loan.fee)}) cũng vào quỹ này.` },
        { p: `**Bảng cân đối:** vốn chủ = tiền mặt + nợ cho vay còn phải thu − tiền gửi. Ví dụ tiền mặt ${xu(sheet.cash)}, cho vay ${xu(sheet.loans)}, tiền gửi ${xu(sheet.deposits)}: vốn chủ ${xu(sheet.equity)}, tiền mặt tối thiểu ${xu(sheet.floor)}, nhận tiền gửi tới ${xu(sheet.depositCap)}.` },
        { table: { head: ["Uy tín (0–100)", "Thay đổi"], rows: [
          ["Lúc mở", `${rep.start} (mở lại sau khi đổ vỡ: ${rep.start / 2})`],
          ["Có lệnh rút phải xếp hàng", `−${rep.runDrop}, tối đa một lần mỗi ngày, kèm tin trên báo`],
          ["Đêm không còn ai xếp hàng", `+${rep.dailyRecover}`],
          [`Dưới ${CBANK.minReputation}`, "Không nhận tiền gửi mới"],
        ] } },
        { p: `**Xếp hàng rút:** khi tiền mặt không đủ trả, lệnh rút (kể cả khoản tự đáo hạn lúc nửa đêm) vào hàng chờ, trả theo thứ tự trước sau ngay khi ngân hàng có tiền (thu nợ, góp vốn). Trong lúc còn người xếp hàng, ngân hàng không nhận tiền gửi mới, không cho vay, không rút vốn.` },
        { p: `**Đổ vỡ:** còn lệnh rút xếp hàng quá **${CBANK.failNights} đêm**, hoặc gia tộc chủ giải tán. Tiền mặt còn lại chia cho mọi người gửi theo tỉ lệ gốc, rồi quỹ bảo hiểm bù tới **${pct(CBANK.insuranceCover)}** phần gốc còn thiếu (trong phạm vi quỹ đang có). Ví dụ hai người gửi ${xu(30_000)} và ${xu(10_000)}, ngân hàng còn ${xu(8_000)}: nhận từ tiền mặt ${xu(fail.paid[0])} và ${xu(fail.paid[1])}, bảo hiểm bù thêm ${xu(fail.insured[0])} và ${xu(fail.insured[1])}. Tiền lãi không được bù.` },
        { p: "**Mất Ngân hàng nhà nước** (bị thâu tóm qua [Đấu trường](dau-truong)): ngân hàng không nhận tiền gửi, không cho vay mới, nhưng vẫn trả các khoản cũ và thu nợ cũ." },
        { p: "**Phong tỏa khẩn cấp:** quản trị viên có thể tạm dừng một hoặc mọi ngân hàng gia tộc; khi đó không gửi, rút, vay được và khoản đáo hạn chờ tới khi gỡ phong tỏa (vẫn thu nợ)." },
      ],
    },
    {
      id: "rui-ro",
      title: "Rủi ro",
      blocks: [
        { list: [
          "**Người gửi:** ngân hàng cho vay càng nhiều thì tiền mặt càng mỏng. Nhiều người rút cùng lúc có thể phải xếp hàng; đổ vỡ thì mất lãi và có thể mất một phần gốc.",
          `**Quỹ bảo hiểm có hạn:** nó chỉ lớn bằng số phí đã thu. Nhiều ngân hàng đổ vỡ cùng lúc thì mỗi người được bù ít hơn ${pct(CBANK.insuranceCover)}.`,
          "**Ngân hàng:** lãi trả cho người gửi lấy từ vốn của ngân hàng. Trả lãi cao mà không cho vay sinh lời được thì vốn chủ mòn dần; khoản vay vỡ nợ mà lô bán rẻ cũng vậy.",
          "**Tin đồn:** mỗi lần có người phải xếp hàng là một tin trên báo và một lần mất uy tín, nên một đợt rút nhỏ có thể kéo theo đợt rút lớn hơn.",
        ] },
      ],
    },
    {
      id: "meo",
      title: "Mẹo",
      blocks: [
        { list: [
          "Lãi cao nhất chưa chắc là nơi gửi tốt nhất: hãy nhìn cả uy tín và phần trăm tiền mặt trên tiền gửi.",
          "Kỳ hạn ngắn trả lãi thấp hơn nhưng để tiền ở ngân hàng ít đêm hơn.",
          "Nếu bạn điều hành ngân hàng, thử nghĩ xem khoản tiền gửi nào sẽ đáo hạn trước khi khoản vay của bạn kịp thu về.",
        ] },
      ],
    },
  ],
};
