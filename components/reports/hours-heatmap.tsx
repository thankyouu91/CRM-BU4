import { Avatar } from "@/components/ui/avatar";
import type { Summary } from "@/lib/stats";
import { cn } from "@/lib/utils";

const fmt = (h: number) => h.toLocaleString("vi-VN", { maximumFractionDigits: 1 });

/** Five shades of the primary colour; 0 hours stays a plain cell. */
function shade(hours: number, max: number): string {
  if (hours <= 0) return "bg-muted/60";
  const step = Math.min(4, Math.floor((hours / max) * 4.999));
  return ["bg-primary/15", "bg-primary/30", "bg-primary/50", "bg-primary/70", "bg-primary"][step];
}

/**
 * Hours each person reported, per time slot of the report (days of a month, weeks of a
 * quarter, months of a year): who is carrying the load and when, at a glance.
 */
export function HoursHeatmap({ people, trend }: { people: Summary["people"]; trend: Summary["trend"] }) {
  const rows = people.filter((p) => p.hours > 0).sort((a, b) => b.hours - a.hours);
  if (!rows.length || !trend.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Chưa có giờ công nào được báo cáo trong kỳ này.</p>;
  }
  const max = Math.max(...rows.flatMap((p) => p.hoursByBucket), 0.1);
  const many = trend.length > 16;
  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
          <thead>
            <tr>
              <th scope="col" className="sr-only">Nhân sự</th>
              {trend.map((b, i) => (
                <th key={b.label} scope="col" className="min-w-[22px] text-center text-[10px] font-medium text-muted-foreground">
                  {/* Every other label when the slots are many, so they stay readable. */}
                  <span className={cn(many && i % 2 === 1 && "invisible")}>{many ? b.label.split("/")[0] : b.label}</span>
                  <span className="sr-only">{b.label}</span>
                </th>
              ))}
              <th scope="col" className="pl-2 text-right text-xs font-medium text-muted-foreground">Tổng</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.userId}>
                <th scope="row" className="whitespace-nowrap pr-2 text-left font-normal">
                  <span className="flex items-center gap-2 text-sm">
                    <Avatar name={p.name} color={p.avatarColor} size="xs" />
                    <span className="max-w-[10rem] truncate">{p.name}</span>
                  </span>
                </th>
                {p.hoursByBucket.map((h, i) => (
                  <td
                    key={trend[i].label}
                    title={`${p.name} · ${trend[i].label}: ${fmt(h)} giờ`}
                    className={cn("h-7 rounded-[5px] p-0 transition-colors", shade(h, max))}
                  >
                    <span className="sr-only">{fmt(h)} giờ</span>
                  </td>
                ))}
                <td className="whitespace-nowrap pl-2 text-right text-sm font-semibold tabular-nums">{fmt(p.hours)}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div aria-hidden className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
        Ít
        {["bg-muted/60", "bg-primary/15", "bg-primary/30", "bg-primary/50", "bg-primary/70", "bg-primary"].map((c) => (
          <span key={c} className={cn("h-3 w-3 rounded-[3px]", c)} />
        ))}
        Nhiều · ô đậm nhất: {fmt(max)} giờ
      </div>
    </div>
  );
}
