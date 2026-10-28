import { formatVnd, formatVndShort, type ContractTotals } from "@/lib/finance";
import { cn } from "@/lib/utils";

export interface WaterfallStep {
  key: string;
  label: string;
  /** Signed change (the first and last bars are totals). */
  amount: number;
  /** Where the bar starts and ends, in VNĐ. */
  from: number;
  to: number;
  kind: "total" | "cost" | "result";
}

/**
 * Contract value, minus each kind of cost, down to what is left. "Lợi nhuận gộp" only
 * when that equals the profit on the cards, i.e. every contract has its costs entered;
 * otherwise the last bar is what is left after the costs entered so far.
 */
export function waterfallSteps(t: ContractTotals): { steps: WaterfallStep[]; complete: boolean } {
  const left = t.value - t.totalCost;
  const complete = t.count > 0 && t.profit === left && t.estimated === 0;
  const steps: WaterfallStep[] = [{ key: "value", label: "Giá trị HĐ", amount: t.value, from: 0, to: t.value, kind: "total" }];
  let level = t.value;
  for (const [key, label, cost] of [
    ["training", "Chi phí đào tạo", t.trainingCost],
    ["exam", "Chi phí khảo thí", t.examCost],
    ["other", "Chi phí khác", t.otherCost],
  ] as const) {
    if (!cost && key === "other") continue;
    steps.push({ key, label, amount: -cost, from: level, to: level - cost, kind: "cost" });
    level -= cost;
  }
  steps.push({ key: "left", label: complete ? "Lợi nhuận gộp" : "Còn lại sau chi phí", amount: left, from: 0, to: left, kind: "result" });
  return { steps, complete };
}

const BAR_W = 112;

// Value in ink, costs in grey; only the outcome carries a status color (profit or loss).
const BAR = {
  total: "bg-foreground/85",
  cost: "bg-muted-foreground/35",
  result: "bg-success",
  loss: "bg-danger",
};

/** Waterfall of the contracts shown: how the contract value turns into gross profit. */
export function ProfitWaterfall({ t, className }: { t: ContractTotals; className?: string }) {
  if (t.value <= 0) return null;
  const { steps, complete } = waterfallSteps(t);
  // Scale from the lowest point (a loss goes below zero) to the contract value.
  const low = Math.min(0, ...steps.map((s) => Math.min(s.from, s.to)));
  const high = Math.max(...steps.map((s) => Math.max(s.from, s.to)));
  const span = high - low || 1;
  const pct = (v: number) => ((v - low) / span) * 100;
  const zero = pct(0);

  return (
    <figure className={cn("rounded-xl border bg-card p-4 sm:p-5", className)}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">Từ giá trị hợp đồng đến lợi nhuận gộp</span>
        <span className="text-xs text-muted-foreground">
          {complete
            ? `Tỷ suất ${t.margin}% trên ${t.count} hợp đồng`
            : "Một số hợp đồng chưa nhập chi phí: cột cuối là phần còn lại sau chi phí đã nhập, chưa phải lợi nhuận gộp"}
        </span>
      </figcaption>

      <div className="relative mt-3 h-56" role="img" aria-label={steps.map((s) => `${s.label} ${formatVnd(s.amount)}`).join(", ")}>
        {/* Room above the tallest bar for its amount. */}
        {/* Bars keep a readable width (at most BAR_W) however wide the card is; connectors join their edges. */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 top-6 flex items-stretch gap-4">
          {low < 0 && <div className="absolute inset-x-0 border-t border-dashed border-muted-foreground/40" style={{ bottom: `${zero}%` }} />}
          {steps.map((s, i) => {
            const bottom = pct(Math.min(s.from, s.to));
            const height = Math.max(pct(Math.max(s.from, s.to)) - bottom, 0.8);
            const next = steps[i + 1];
            const tone = s.kind === "result" && s.amount < 0 ? BAR.loss : BAR[s.kind];
            return (
              <div key={s.key} className="relative flex-1">
                <div className={cn("absolute left-1/2 w-full -translate-x-1/2 rounded-[4px]", tone)} style={{ bottom: `${bottom}%`, height: `${height}%`, maxWidth: BAR_W }} />
                <span
                  className={cn("absolute inset-x-0 text-center text-xs font-semibold tabular-nums", s.kind === "cost" ? "text-muted-foreground" : "text-foreground")}
                  style={{ bottom: `calc(${bottom + height}% + 4px)` }}
                >
                  {s.kind === "cost" ? `−${formatVndShort(-s.amount)}` : formatVndShort(s.amount)}
                </span>
                {/* Connector to the next bar, at the level this one ends. */}
                {next && (
                  <div
                    className="absolute border-t border-dashed border-muted-foreground/50"
                    style={{ bottom: `${pct(s.to)}%`, left: `calc(50% + min(50%, ${BAR_W / 2}px))`, width: `calc(100% + 1rem - 2 * min(50%, ${BAR_W / 2}px))` }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div aria-hidden className="mt-2 flex gap-4">
        {steps.map((s) => (
          <span key={s.key} className="flex-1 text-center text-xs leading-tight text-muted-foreground">
            {s.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
