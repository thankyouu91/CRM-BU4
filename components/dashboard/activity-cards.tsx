"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, FileText } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/misc";
import { PRIORITY } from "@/lib/constants";
import { zonedText } from "@/lib/work-report";
import type { Summary } from "@/lib/stats";
import { cn, timeAgo } from "@/lib/utils";
import { CountTabs, ExpandableList, headerLinkClass } from "./expandable-list";

/** Whole days until a deadline (0 = today). */
export const daysUntil = (iso: string, now = Date.now()) => Math.ceil((new Date(iso).getTime() - now) / 86_400_000);
/** Deadlines this close are flagged red and get their own tab. */
export const SOON_DAYS = 3;

type Upcoming = Summary["upcoming"][number];
type Report = Summary["recentReports"][number];

function DeadlineRow({ t }: { t: Upcoming }) {
  const d = daysUntil(t.dueDate);
  const soon = d <= SOON_DAYS;
  const priority = PRIORITY[t.priority as keyof typeof PRIORITY];
  return (
    <div className="flex items-center gap-3 px-2 py-2">
      <span
        className={cn("w-12 shrink-0 rounded-md py-1 text-center text-xs font-semibold tabular-nums", soon ? "bg-danger/10 text-danger" : "bg-muted text-foreground")}
      >
        {zonedText(t.dueDate, "short")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{t.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {t.projectName}
          {t.assigneeName && ` · ${t.assigneeName}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs">
        {priority && t.priority !== "MEDIUM" && t.priority !== "LOW" && (
          <span className="h-2 w-2 rounded-full" style={{ background: priority.color }} title={`Ưu tiên ${priority.label.toLowerCase()}`}>
            <span className="sr-only">Ưu tiên {priority.label.toLowerCase()}</span>
          </span>
        )}
        <span className={cn("w-16 text-right tabular-nums", soon ? "font-medium text-danger" : "text-muted-foreground")}>{d <= 0 ? "Hôm nay" : `Còn ${d} ngày`}</span>
      </div>
    </div>
  );
}

/** "Hạn chót sắp tới": one line per task, soonest first, the closest ones in their own tab. */
export function UpcomingCard({ upcoming }: { upcoming: Upcoming[] }) {
  const soon = upcoming.filter((t) => daysUntil(t.dueDate) <= SOON_DAYS);
  const [tab, setTab] = useState<"all" | "soon">("all");
  const rows = tab === "soon" ? soon : upcoming;
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Hạn chót sắp tới"
        description="Công việc chưa xong đến hạn trong 14 ngày"
        action={
          <Link href="/tasks" className={headerLinkClass}>
            Công việc của tôi
          </Link>
        }
      />
      {upcoming.length > 0 && (
        <CountTabs
          label="Lọc hạn chót"
          className="mx-5 mt-4"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "all", label: "14 ngày tới", count: upcoming.length },
            { key: "soon", label: `Trong ${SOON_DAYS} ngày`, count: soon.length, alert: true },
          ]}
        />
      )}
      <CardBody className="flex-1 pt-3">
        {rows.length === 0 ? (
          upcoming.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Không có hạn chót gần" className="py-8" />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Không có việc nào đến hạn trong {SOON_DAYS} ngày tới.</p>
          )
        ) : (
          <ExpandableList key={tab} role="tabpanel" items={rows} getKey={(t) => t.id} render={(t) => <DeadlineRow t={t} />} unit="công việc" />
        )}
      </CardBody>
    </Card>
  );
}

function ReportRow({ r }: { r: Report }) {
  return (
    <div className="flex items-center gap-3 px-2 py-2">
      <Avatar name={r.authorName} size="sm" color={r.authorColor} />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2 text-sm">
          <span className="truncate font-medium">{r.taskTitle}</span>
          {!r.reviewedAt && <span className="shrink-0 rounded-full bg-warning/15 px-1.5 text-xs font-medium text-warning">Chờ xem xét</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={r.content}>
          {r.authorName}
          {r.content && ` · ${r.content}`}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end text-xs">
        <span className="font-semibold tabular-nums">{r.progress}%</span>
        <span className="text-muted-foreground">
          {r.hoursSpent > 0 && `${r.hoursSpent} giờ · `}
          {timeAgo(r.createdAt)}
        </span>
      </div>
    </div>
  );
}

/** "Báo cáo tiến độ gần đây": one compact row per report, unreviewed ones in their own tab. */
export function RecentReportsCard({ reports }: { reports: Report[] }) {
  const pending = reports.filter((r) => !r.reviewedAt);
  const [tab, setTab] = useState<"all" | "pending">("all");
  const rows = tab === "pending" ? pending : reports;
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Báo cáo tiến độ gần đây"
        description="Báo cáo từ người thực hiện trong kỳ"
        action={
          <Link href="/inbox" className={headerLinkClass}>
            Hộp báo cáo
          </Link>
        }
      />
      {reports.length > 0 && (
        <CountTabs
          label="Lọc báo cáo"
          className="mx-5 mt-4"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "all", label: "Mới nhất", count: reports.length },
            { key: "pending", label: "Chờ xem xét", count: pending.length, alert: true },
          ]}
        />
      )}
      <CardBody className="flex-1 pt-3">
        {rows.length === 0 ? (
          reports.length === 0 ? (
            <EmptyState icon={FileText} title="Chưa có báo cáo trong kỳ" className="py-8" />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Mọi báo cáo đã được xem xét.</p>
          )
        ) : (
          <ExpandableList key={tab} role="tabpanel" items={rows} getKey={(r) => r.id} render={(r) => <ReportRow r={r} />} unit="báo cáo" />
        )}
      </CardBody>
    </Card>
  );
}
