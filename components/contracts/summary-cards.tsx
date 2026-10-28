import { formatVnd, type ContractTotals } from "@/lib/finance";
import { cn } from "@/lib/utils";

/** The four summary blocks of the original contracts sheet. */
export function SummaryCards({ t }: { t: ContractTotals }) {
  const cards: { label: string; value: string; sub: string; ink?: string }[] = [
    {
      label: "Tổng giá trị hợp đồng",
      value: formatVnd(t.value),
      sub: `Tổng số: ${t.count} hợp đồng`,
    },
    {
      label: "Tổng chi phí thực hiện",
      value: formatVnd(t.totalCost),
      sub: `Tỷ lệ CP: ${t.costRatio}%, đào tạo ${formatVnd(t.trainingCost, false)}, khảo thí ${formatVnd(t.examCost, false)}${t.otherCost ? `, khác ${formatVnd(t.otherCost, false)}` : ""}`,
    },
    {
      label: "Lợi nhuận gộp dự kiến",
      value: formatVnd(t.profit),
      sub: `Tỷ suất LN TB: ${t.margin}%${t.estimated ? `, ${t.estimated} HĐ ước tính` : ""}`,
      ink: t.profit < 0 ? "text-danger" : undefined,
    },
    {
      label: "Số dư còn phải thu",
      value: formatVnd(t.receivable),
      sub: `Đã thu: ${formatVnd(t.collected)}`,
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border bg-card px-4 py-3.5">
          <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
          <p className={cn("mt-2 text-2xl font-semibold leading-none tabular-nums tracking-tight", c.ink)}>{c.value}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
