import Link from "next/link";
import { cn } from "@/lib/utils";

export function ReportModeNav({ analytics = false, projectId = "" }: { analytics?: boolean; projectId?: string }) {
  const project = projectId ? `&projectId=${encodeURIComponent(projectId)}` : "";
  return <nav aria-label="Loại báo cáo" className="mb-6 flex flex-wrap gap-1 border-b">
    {[
      { label: "Báo cáo công việc phòng", href: `/reports?view=department${project}`, selected: !analytics },
      { label: "Thống kê & trình chiếu", href: `/reports?view=analytics${project}`, selected: analytics },
    ].map(item => <Link key={item.href} href={item.href} aria-current={item.selected ? "page" : undefined}
      className={cn("border-b-2 px-4 py-3 text-sm font-medium", item.selected ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
      {item.label}
    </Link>)}
  </nav>;
}
