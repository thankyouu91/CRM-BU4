"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { CountTabs, ExpandableList, VISIBLE_ROWS, headerLinkClass } from "./expandable-list";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { PROJECT_STATUS } from "@/lib/constants";
import { SCHEDULE_STATUS, type ScheduleStatus } from "@/lib/schedule";
import { PROJECT_TABS, firstTab, groupProjects, needsAttention, type ProjectTab } from "@/lib/project-groups";
import type { Summary } from "@/lib/stats";

const SLIPPING = new Set(["AT_RISK", "BEHIND", "OVERDUE"]);

export { VISIBLE_ROWS };

type Project = Summary["projects"][number];

function Row({ p }: { p: Project }) {
  const schedule = SCHEDULE_STATUS[p.schedule.status as ScheduleStatus];
  // Behind schedule: the schedule's colour; on schedule but with overdue tasks: the "behind" orange.
  const barColor = !needsAttention(p) ? undefined : SLIPPING.has(p.schedule.status) ? schedule?.color : SCHEDULE_STATUS.BEHIND.color;
  const quiet = p.status === "PLANNING" || p.status === "ON_HOLD";
  return (
    <Link
        href={`/projects/${p.id}`}
        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:grid-cols-[minmax(0,1fr)_7rem_2.75rem]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="truncate text-sm font-medium group-hover:text-primary">{p.name}</span>
          {quiet && <span className="shrink-0 text-xs text-muted-foreground">{PROJECT_STATUS[p.status as keyof typeof PROJECT_STATUS]?.label}</span>}
          {p.overdueTasks > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-danger/10 px-1.5 py-0.5 text-xs font-semibold text-danger" title={`${p.overdueTasks} công việc quá hạn`}>
              <TriangleAlert className="h-3 w-3" aria-hidden />
              {p.overdueTasks}
              <span className="sr-only"> công việc quá hạn</span>
            </span>
          )}
        </span>
        {p.totalTasks === 0 ? (
          // No tasks yet: a 0% bar would read as "behind".
          <span className="col-span-2 text-xs text-muted-foreground sm:col-span-2 sm:text-right">Chưa có công việc</span>
        ) : (
          <>
            <span className="text-right text-sm font-semibold tabular-nums sm:order-last">{p.progress}%</span>
            <span className="col-span-2 sm:col-span-1" title={`${p.doneTasks}/${p.totalTasks} công việc hoàn thành${schedule ? ` · ${schedule.label}` : ""}`}>
              <ProgressBar value={p.progress} height={6} color={barColor} />
            </span>
          </>
        )}
    </Link>
  );
}

/**
 * Dashboard card: the projects grouped into tabs (in progress, needing attention,
 * completed, all) with one line each, the first VISIBLE_ROWS shown and the rest
 * behind "Xem thêm" in a scrolling list, so the card never runs down the page.
 */
export function ProjectProgressCard({ projects }: { projects: Project[] }) {
  const groups = useMemo(() => groupProjects(projects), [projects]);
  const [tab, setTab] = useState<ProjectTab>(() => firstTab(groups));
  const rows = groups[tab];
  const avg = rows.length ? Math.round(rows.reduce((a, p) => a + p.progress, 0) / rows.length) : 0;

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Tiến độ dự án"
        description={rows.length ? `${rows.length} dự án · trung bình ${avg}% hoàn thành` : "Tỷ lệ hoàn thành hiện tại của từng dự án"}
        action={
          <Link href="/projects" className={headerLinkClass}>
            Xem tất cả
          </Link>
        }
      />
      <CountTabs
        label="Lọc dự án"
        className="mx-5 mt-4"
        value={tab}
        onChange={(k) => setTab(k)}
        tabs={PROJECT_TABS.map((t) => ({ key: t.key, label: t.label, count: groups[t.key].length, alert: t.key === "attention" }))}
      />
      <CardBody className="flex-1 pt-3">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {projects.length === 0 ? "Chưa có dự án nào." : tab === "attention" ? "Không có dự án nào trễ hay có việc quá hạn." : "Không có dự án nào trong mục này."}
          </p>
        ) : (
          <ExpandableList key={tab} role="tabpanel" items={rows} getKey={(p) => p.id} render={(p) => <Row p={p} />} unit="dự án" />
        )}
      </CardBody>
    </Card>
  );
}
