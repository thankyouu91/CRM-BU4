"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, Flag } from "lucide-react";
import { ProjectStatusBadge } from "@/components/ui/badge";
import { cn, clampProgress } from "@/lib/utils";
import { calendarDate, calendarToday, type CalendarPeriod, type CalendarView, type ProjectTiming, type timelineSpan } from "@/lib/project-calendar";
import type { ProjectListItemData } from "./types";

export interface CalendarProject {
  project: ProjectListItemData;
  timing: ProjectTiming;
  span: NonNullable<ReturnType<typeof timelineSpan>>;
}

export function projectDateLabel(project: ProjectListItemData) {
  if (project.startDate && project.dueDate) return `${calendarDate(project.startDate)} → ${calendarDate(project.dueDate)}`;
  if (project.startDate) return `Từ ${calendarDate(project.startDate)} · Chưa có hạn kết thúc`;
  if (project.dueDate) return `Hạn ${calendarDate(project.dueDate)} · Chưa có ngày bắt đầu`;
  return "Chưa có ngày bắt đầu và kết thúc";
}

function Progress({ value }: { value: number }) {
  const progress = clampProgress(value);
  return <div className="w-16 shrink-0 text-right">
    <span className="text-xs font-semibold tabular-nums">{progress}%</span>
    <div className="mt-1.5 h-1 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
  </div>;
}

export function ActivityTimeline({ entries, period, view, now }: {
  entries: CalendarProject[]; period: CalendarPeriod; view: CalendarView; now: string;
}) {
  const today = calendarToday(now, period);
  const grid = period.columns.map((column) => `${column.width}fr`).join(" ");
  return <>
    {/* A compact agenda keeps project names readable on small screens. */}
    <div className="divide-y md:hidden" aria-label={`Lịch dự án ${period.label}`}>
      {entries.map(({ project: p }) => <Link key={p.id} href={`/projects/${p.id}`} className="flex gap-3 px-4 py-4 hover:bg-muted/40">
        <span className="mt-1 w-1 shrink-0 self-stretch rounded-full" style={{ background: p.color }} />
        <div className="min-w-0 flex-1"><ProjectStatusBadge status={p.status} /><h3 className="mt-1.5 text-sm font-semibold">{p.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{projectDateLabel(p)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{p.owner.name} · {p.doneTasks}/{p.totalTasks} công việc</p>
        </div><Progress value={p.progress} />
      </Link>)}
    </div>

    <div className="scrollbar-thin hidden overflow-x-auto md:block" role="region" aria-label={`Lịch dự án ${period.label}, cuộn ngang để xem toàn bộ`} tabIndex={0}>
      <div className={cn("relative", view === "month" ? "min-w-[1160px]" : "min-w-[960px]")}>
        <div className="grid grid-cols-[320px_minmax(0,1fr)_88px] border-b bg-muted/35">
          <div className="sticky left-0 z-20 flex items-center border-r bg-card px-5 text-xs font-medium text-muted-foreground">Dự án / Người phụ trách</div>
          <div className="relative grid h-16" style={{ gridTemplateColumns: grid }}>
            {period.columns.map((column) => <div key={column.key} className={cn("flex flex-col items-center justify-center border-r text-xs", column.weekend && "bg-muted/70 text-muted-foreground")}>
              <span className="font-semibold tabular-nums">{column.label}</span>
              {view === "month" && <span className="mt-1 text-[9px] text-muted-foreground">{column.detail}</span>}
            </div>)}
            {today !== null && <span className="absolute bottom-0 z-10 h-1 w-3 -translate-x-1/2 rounded-t bg-primary" style={{ left: `${today}%` }} />}
          </div>
          <div className="flex items-center justify-center text-[11px] text-muted-foreground">Tiến độ</div>
        </div>

        <div className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[320px] right-[88px]">
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: grid }}>
              {period.columns.map((column) => <div key={column.key} className={cn("border-r border-border/60", column.weekend && "bg-muted/40")} />)}
            </div>
            {today !== null && <div className="absolute inset-y-0 z-10 border-l border-primary/45" style={{ left: `${today}%` }} />}
          </div>
        {entries.map(({ project: p, timing, span }) => <div key={p.id} className="group relative grid grid-cols-[320px_minmax(0,1fr)_88px] border-b last:border-b-0 hover:bg-muted/25">
          <Link href={`/projects/${p.id}`} title={p.name} className="sticky left-0 z-20 flex min-h-[82px] items-start gap-3 border-r bg-card px-5 py-4 group-hover:bg-muted">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />
            <div className="min-w-0"><h3 className="truncate text-sm font-semibold group-hover:text-primary">{p.name}</h3>
              <div className="mt-1.5 flex items-center gap-2"><ProjectStatusBadge status={p.status} /><span className="truncate text-[11px] text-muted-foreground">{p.owner.name}</span></div>
            </div>
          </Link>
          <div className="relative min-h-[82px]">
            {timing.kind === "deadline" ? <Link href={`/projects/${p.id}`} aria-label={`${p.name}: ${projectDateLabel(p)}`} title={`${p.name}\n${projectDateLabel(p)}`}
              className="absolute top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border bg-card shadow-sm hover:ring-2 hover:ring-primary/30"
              style={{ left: `clamp(18px, ${span.left + span.width / 2}%, calc(100% - 18px))`, color: p.color }}><Flag className="h-4 w-4" /></Link>
              : <Link href={`/projects/${p.id}`} aria-label={`${p.name}: ${projectDateLabel(p)}, tiến độ ${p.progress}%`}
                title={`${p.name}\n${projectDateLabel(p)}\n${p.doneTasks}/${p.totalTasks} công việc hoàn thành`}
                className={cn("absolute top-1/2 z-10 h-9 -translate-y-1/2 overflow-hidden rounded-md border bg-card hover:ring-2 hover:ring-primary/30", timing.kind === "open" && "border-dashed", span.continuesBefore && "rounded-l-none", span.continuesAfter && "rounded-r-none")}
                style={{ left: `${span.left}%`, width: `${span.width}%`, borderColor: p.color }}>
                <span aria-hidden className="absolute inset-0 opacity-[0.12]" style={{ background: p.color }} />
                <span aria-hidden className="absolute inset-y-0 left-0 opacity-[0.15]" style={{ background: p.color, width: `${clampProgress(p.progress)}%` }} />
                <span className="relative flex h-full items-center justify-between gap-2 px-2 text-[11px] font-medium">
                  <span className="truncate">{span.width > 16 ? p.name : ""}</span>
                  {span.width > 25 && <span className="shrink-0 text-muted-foreground">{timing.kind === "open" ? "Chưa có hạn →" : `${p.doneTasks}/${p.totalTasks} việc`}</span>}
                </span>
              </Link>}
          </div>
          <div className="flex items-center justify-center px-3"><Progress value={p.progress} /></div>
        </div>)}
        </div>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t bg-muted/20 px-5 py-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-2"><span className="h-3 w-px bg-primary" /> Hôm nay</span>
      <span className="flex items-center gap-2"><Flag className="h-3 w-3" /> Chỉ có hạn kết thúc</span>
      <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-sm border border-dashed border-muted-foreground" /> Chưa có hạn kết thúc</span>
      <span className="ml-auto hidden md:inline">Nhấn vào dự án để mở chi tiết</span>
    </div>
  </>;
}

export function UnscheduledProjects({ projects }: { projects: ProjectListItemData[] }) {
  if (!projects.length) return null;
  return <details open className="group rounded-xl border bg-card">
    <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold">
      <CalendarDays className="h-4 w-4 text-muted-foreground" />Chưa xếp lịch
      <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{projects.length}</span>
      <span className="ml-auto text-xs font-normal text-muted-foreground">Bổ sung ngày trong chi tiết dự án</span>
    </summary>
    <div className="divide-y border-t">
      {projects.map((p) => <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: p.color }} />
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{p.owner.name}</p></div>
        <span className="hidden sm:inline"><ProjectStatusBadge status={p.status} /></span>
        <Progress value={p.progress} /><ArrowUpRight className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>)}
    </div>
  </details>;
}
