"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { PROJECT_STATUS } from "@/lib/constants";
import { SCHEDULE_STATUS, type ScheduleStatus } from "@/lib/schedule";
import { PROJECT_TABS, firstTab, groupProjects, needsAttention, type ProjectTab } from "@/lib/project-groups";
import type { Summary } from "@/lib/stats";
import { cn } from "@/lib/utils";

const SLIPPING = new Set(["AT_RISK", "BEHIND", "OVERDUE"]);

/** Rows shown before "Xem thêm": the card stays about as tall as its neighbour. */
export const VISIBLE_ROWS = 6;

type Project = Summary["projects"][number];

function Row({ p }: { p: Project }) {
  const schedule = SCHEDULE_STATUS[p.schedule.status as ScheduleStatus];
  // Behind schedule: the schedule's colour; on schedule but with overdue tasks: the "behind" orange.
  const barColor = !needsAttention(p) ? undefined : SLIPPING.has(p.schedule.status) ? schedule?.color : SCHEDULE_STATUS.BEHIND.color;
  const quiet = p.status === "PLANNING" || p.status === "ON_HOLD";
  return (
    <li>
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
    </li>
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
  const [expanded, setExpanded] = useState(false);
  const rows = groups[tab];
  const shown = expanded ? rows : rows.slice(0, VISIBLE_ROWS);
  const hidden = rows.length - shown.length;
  const avg = rows.length ? Math.round(rows.reduce((a, p) => a + p.progress, 0) / rows.length) : 0;

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Tiến độ dự án"
        description={rows.length ? `${rows.length} dự án · trung bình ${avg}% hoàn thành` : "Tỷ lệ hoàn thành hiện tại của từng dự án"}
        action={
          <Link href="/projects" className="-my-1.5 -mr-2 inline-flex min-h-8 items-center rounded-md px-2 text-xs font-medium text-primary hover:bg-primary/5 hover:underline">
            Xem tất cả
          </Link>
        }
      />
      <div role="tablist" aria-label="Lọc dự án" className="mx-5 mt-4 flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {PROJECT_TABS.map((t) => {
          const n = groups[t.key].length;
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(t.key);
                setExpanded(false);
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  t.key === "attention" && n > 0 ? "bg-danger/15 text-danger" : active ? "bg-muted" : "bg-card/60",
                )}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>
      <CardBody className="flex-1 pt-3">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {projects.length === 0 ? "Chưa có dự án nào." : tab === "attention" ? "Không có dự án nào trễ hay có việc quá hạn." : "Không có dự án nào trong mục này."}
          </p>
        ) : (
          <>
            <ul role="tabpanel" className={cn("-mx-2 divide-y divide-border/60", expanded && "max-h-[26rem] overflow-y-auto pr-1")}>
              {shown.map((p) => (
                <Row key={p.id} p={p} />
              ))}
            </ul>
            {(hidden > 0 || expanded) && rows.length > VISIBLE_ROWS && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
              >
                {expanded ? "Thu gọn" : `Xem thêm ${hidden} dự án`}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
              </button>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
