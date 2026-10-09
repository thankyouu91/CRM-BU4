import { formatVnd, type ContractTotals } from "@/lib/finance";
import { cn } from "@/lib/utils";

/** The four summary blocks of the original contracts sheet. */
export function SummaryCards({ t }: { t: ContractTotals }) {
  const cards = [
    {
      label: "Tổng giá trị hợp đồng",
      value: formatVnd(t.value),
      sub: `Tổng số: ${t.count} hợp đồng`,
      accent: "border-t-blue-600",
      ink: "text-blue-700 dark:text-blue-300",
    },
    {
      label: "Tổng chi phí thực hiện",
      value: formatVnd(t.totalCost),
      sub: `Tỷ lệ CP: ${t.costRatio}% · đào tạo ${formatVnd(t.trainingCost, false)} · khảo thí ${formatVnd(t.examCost, false)}${t.otherCost ? ` · khác ${formatVnd(t.otherCost, false)}` : ""}`,
      accent: "border-t-orange-500",
      ink: "text-orange-700 dark:text-orange-300",
    },
    {
      label: "Lợi nhuận gộp dự kiến",
      value: formatVnd(t.profit),
      sub: `Tỷ suất LN TB: ${t.margin}%${t.estimated ? ` · ${t.estimated} HĐ ước tính` : ""}`,
      accent: "border-t-emerald-600",
      ink: t.profit < 0 ? "text-danger" : "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "Số dư còn phải thu",
      value: formatVnd(t.receivable),
      sub: `Đã thu: ${formatVnd(t.collected)}`,
      accent: "border-t-violet-600",
      ink: "text-violet-700 dark:text-violet-300",
    },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className={cn("rounded-2xl border border-t-4 bg-card p-5 shadow-card", c.accent)}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</p>
          <p className={cn("mt-2 text-2xl font-bold tabular-nums tracking-tight", c.ink)}>{c.value}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
