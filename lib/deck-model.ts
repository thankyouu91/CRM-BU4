// A presentation as plain data. Rendered by components/deck (screen + PDF) and
// lib/export/pptx.ts (native PowerPoint), so every output shows the same content.

import { buildInsights, type Insight } from "./insights";
import { PROJECT_STATUS } from "./constants";
import { daysLeftLabel, SCHEDULE_STATUS, type Workload } from "./schedule";
import type { ContractTotals } from "./finance";
import type { Summary, SummaryPerson } from "./stats";
import type { DepartmentReport, DepartmentRow } from "./department-report";
import { zonedText } from "./work-report";

export interface ScheduleSlideRow {
  name: string;
  color: string;
  /** 0 = project, 1 = main category, 2 = sub-category */
  level: 0 | 1 | 2;
  progress: number;
  planned: number | null;
  achievement: number | null;
  status: string;
  statusColor: string;
  deadline: string;
  done: number;
  remaining: number;
}

export interface ProjectSlideRow {
  name: string;
  color: string;
  status: string;
  statusColor: string;
  progress: number;
  done: number;
  total: number;
  overdue: number;
}

export interface ProjectsSummary {
  total: number;
  /** Every task done (and at least one task). */
  complete: number;
  /** Projects with at least one overdue task. */
  overdue: number;
  /** Projects without any task yet. */
  empty: number;
}

export type WorkTone = "success" | "danger" | "warning" | "accent" | "muted";
export type WorkLine =
  | { kind: "project"; name: string; color: string; count: number; continued: boolean }
  | { kind: "task"; title: string; who: string; tag: string; tone: WorkTone };

/** Lines per column on a weekly slide; two columns per slide, at most WEEK_PAGES slides per week. */
export const WEEK_LINES = 11;
export const WEEK_PAGES = 3;

/** Up to this many projects share one slide (two columns); more are split over several. */
export const PROJECTS_PER_SLIDE = 14;
/** Up to this many, each project gets a full-width row. */
export const PROJECTS_LIST_MAX = 6;

/** One-line names: shortened with an ellipsis rather than clipped (PDF capture has no text-overflow). */
export const clipName = (name: string, max: number) => (name.length > max ? `${name.slice(0, max - 1).trimEnd()}…` : name);

// Running work first, finished and cancelled last, so the slide reads as "what is moving".
const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, PLANNING: 1, ON_HOLD: 2, COMPLETED: 3, CANCELLED: 4 };

/** Every project, ordered, as slides of at most PROJECTS_PER_SLIDE (pages balanced). */
export function projectSlides(projects: Summary["projects"]): Extract<SlideModel, { kind: "projects" }>[] {
  if (!projects.length) return [];
  const rows: ProjectSlideRow[] = [...projects]
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || b.progress - a.progress || a.name.localeCompare(b.name, "vi"))
    .map((p) => {
      const status = PROJECT_STATUS[p.status as keyof typeof PROJECT_STATUS];
      return { name: p.name, color: p.color, status: status?.label ?? p.status, statusColor: status?.color ?? "#64748b", progress: p.progress, done: p.doneTasks, total: p.totalTasks, overdue: p.overdueTasks };
    });
  const summary: ProjectsSummary = {
    total: rows.length,
    complete: rows.filter((r) => r.total > 0 && r.done === r.total).length,
    overdue: rows.filter((r) => r.overdue > 0).length,
    empty: rows.filter((r) => r.total === 0).length,
  };
  const pages = Math.ceil(rows.length / PROJECTS_PER_SLIDE);
  const per = Math.ceil(rows.length / pages);
  return Array.from({ length: pages }, (_, i) => ({
    kind: "projects" as const,
    kicker: "Dự án",
    title: pages > 1 ? `Tiến độ hoàn thành từng dự án (${i + 1}/${pages})` : "Tiến độ hoàn thành từng dự án",
    summary,
    rows: rows.slice(i * per, (i + 1) * per),
  }));
}

export interface DeckMeta {
  title: string;
  periodLabel: string;
  scopeLabel: string;
  preparedBy: string;
  generatedAt: string;
}

export type SlideModel =
  | { kind: "cover"; title: string; subtitle: string }
  | { kind: "kpis"; kicker: string; title: string; items: { label: string; value: string; sub?: string; tone?: "danger" | "accent" }[] }
  | {
      kind: "projects";
      kicker: string;
      title: string;
      /** Figures for all projects, repeated on each page of a long list. */
      summary: ProjectsSummary;
      rows: ProjectSlideRow[];
    }
  | { kind: "schedule"; kicker: string; title: string; rows: ScheduleSlideRow[]; workload: Workload }
  | {
      kind: "finance";
      kicker: string;
      title: string;
      scopeNote: string;
      totals: ContractTotals;
      rows: { name: string; color: string; progress: number | null; count: number; value: number; profit: number; margin: number; receivable: number }[];
    }
  | { kind: "trend"; kicker: string; title: string; data: Summary["trend"]; stats: { label: string; value: string }[] }
  | { kind: "status"; kicker: string; title: string; data: Summary["statusDistribution"] }
  | { kind: "people"; kicker: string; title: string; people: SummaryPerson[] }
  | { kind: "hours"; kicker: string; title: string; data: Summary["trend"]; stats: { label: string; value: string }[] }
  | {
      kind: "risks";
      kicker: string;
      title: string;
      overdueTotal: number;
      byProject: { name: string; color: string; overdue: number }[];
      upcoming: Summary["upcoming"];
    }
  | {
      kind: "quotes";
      kicker: string;
      title: string;
      quotes: { author: string; color: string; task: string; project: string; content: string; progress: number }[];
    }
  | {
      kind: "week";
      kicker: string;
      title: string;
      /** "Tuần 41 · 05/10 – 11/10/2026" */
      period: string;
      stats: { label: string; value: number; tone?: WorkTone }[];
      /** Two columns of lines, laid out here so the screen, PDF and PPTX match. */
      columns: WorkLine[][];
      /** Tasks left out when the week is longer than the slides allow. */
      hidden: number;
    }
  | { kind: "insights"; kicker: string; title: string; items: Insight[] }
  | { kind: "bullets"; kicker: string; title: string; bullets: string[] };

export interface Deck {
  meta: DeckMeta;
  slides: SlideModel[];
}

export function makeDeckMeta(periodLabel: string, projectName: string | null, preparedBy: string, title?: string): DeckMeta {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    title: title ?? (projectName ? `Báo cáo dự án ${projectName}` : "Báo cáo tiến độ công việc"),
    periodLabel,
    scopeLabel: projectName ?? "Toàn bộ dự án",
    preparedBy,
    generatedAt: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
  };
}

export function slideTitle(s: SlideModel, meta: DeckMeta): string {
  return s.kind === "cover" ? meta.title : s.title;
}

type Picked = { row: DepartmentRow; tag: string; tone: WorkTone };

/** Lines grouped by project (alphabetical), split into columns and slides. */
function weekPages(picked: Picked[]): { columns: WorkLine[][]; hidden: number }[] {
  const byProject = new Map<string, { name: string; color: string; items: Picked[] }>();
  for (const p of picked) {
    const pr = p.row.task.project;
    if (!byProject.has(pr.id)) byProject.set(pr.id, { name: pr.name, color: pr.color, items: [] });
    byProject.get(pr.id)!.items.push(p);
  }
  const groups = [...byProject.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const columns: WorkLine[][] = [];
  let column: WorkLine[] = [];
  const close = () => {
    if (column.length) columns.push(column);
    column = [];
  };
  for (const g of groups) {
    g.items.forEach((p, i) => {
      // A project heading never ends a column; a group carried over repeats its heading.
      if (column.length >= WEEK_LINES - (i === 0 ? 1 : 0)) close();
      if (i === 0 || column.length === 0) column.push({ kind: "project", name: clipName(g.name, 44), color: g.color, count: g.items.length, continued: i > 0 });
      const t = p.row.task;
      column.push({ kind: "task", title: clipName(t.parentTitle ? `${t.title} (${t.parentTitle})` : t.title, 40), who: clipName(t.assignee?.name ?? "Chưa giao", 18), tag: p.tag, tone: p.tone });
    });
  }
  close();
  const pages: { columns: WorkLine[][]; hidden: number }[] = [];
  for (let i = 0; i < columns.length && pages.length < WEEK_PAGES; i += 2) pages.push({ columns: columns.slice(i, i + 2), hidden: 0 });
  const shown = pages.flatMap((p) => p.columns).flat().filter((l) => l.kind === "task").length;
  if (pages.length) pages[pages.length - 1].hidden = picked.length - shown;
  return pages;
}

/**
 * The week the weekly slides describe for a report period: this week when the period
 * includes today, otherwise the period's last week (a past month shows how it ended).
 */
export function deckWeekAnchor(from: Date | string, to: Date | string, now = new Date()): Date {
  const end = new Date(to);
  return new Date(from) <= now && now <= end ? now : end;
}

/**
 * The weekly report (Báo cáo công việc phòng) as three slides: last week done, this week
 * in progress, next week planned. Same buckets as the report screen and its Excel file.
 */
export function weekSlides(r: DepartmentReport): SlideModel[] {
  const [prev, cur, next] = r.sections;
  const rows = (section: typeof prev, id: string) => section.buckets.find((b) => b.id === id)?.rows ?? [];
  const day = (iso: string | null) => (iso ? zonedText(iso, "short") : "");
  const pct = (row: DepartmentRow) => `${row.task.progress}%`;
  const sections: { kicker: string; title: string; period: string; stats: { label: string; value: number; tone?: WorkTone }[]; picked: Picked[] }[] = [
    {
      kicker: "Báo cáo tuần", title: "Tuần trước · Đã làm", period: prev.period.label,
      stats: [
        { label: "việc đã xong", value: rows(prev, "completed").length, tone: "success" },
        { label: "việc có cập nhật", value: rows(prev, "activity").length, tone: "accent" },
        { label: "đến hạn nhưng chưa xong", value: rows(prev, "outstanding").length, tone: "danger" },
      ],
      picked: [
        ...rows(prev, "completed").map((row) => ({ row, tag: `Xong ${day(row.task.completedAt)}`, tone: "success" as const })),
        ...rows(prev, "completedLater").map((row) => ({ row, tag: `Xong muộn ${day(row.task.completedAt)}`, tone: "warning" as const })),
        ...rows(prev, "activity").map((row) => ({ row, tag: `Đang làm ${pct(row)}`, tone: "accent" as const })),
        ...rows(prev, "outstanding").map((row) => ({ row, tag: `Chưa xong · hạn ${day(row.task.dueDate)}`, tone: "danger" as const })),
      ],
    },
    {
      kicker: "Báo cáo tuần", title: "Tuần này · Đang làm", period: cur.period.label,
      stats: [
        { label: "việc cần xử lý", value: r.counts.currentOpen, tone: "accent" },
        { label: "tồn từ trước", value: r.counts.carryover, tone: "danger" },
        { label: "đã xong", value: r.counts.currentDone, tone: "success" },
        { label: "bị chặn", value: r.counts.blocked, tone: "danger" },
      ],
      picked: [
        ...rows(cur, "carryover").map((row) => ({ row, tag: `Tồn · hạn ${day(row.task.dueDate)}`, tone: "danger" as const })),
        ...rows(cur, "due").map((row) => ({ row, tag: `Hạn ${day(row.task.dueDate)} · ${pct(row)}`, tone: "warning" as const })),
        ...rows(cur, "active").map((row) => ({ row, tag: row.task.status === "BLOCKED" ? "Bị chặn" : `Đang làm ${pct(row)}`, tone: row.task.status === "BLOCKED" ? ("danger" as const) : ("accent" as const) })),
        ...rows(cur, "completed").map((row) => ({ row, tag: `Xong ${day(row.task.completedAt)}`, tone: "success" as const })),
      ],
    },
    {
      kicker: "Báo cáo tuần", title: "Tuần tới · Sẽ làm", period: next.period.label,
      stats: [
        { label: "việc theo kế hoạch", value: r.counts.nextPlanned, tone: "accent" },
        { label: "đến hạn", value: rows(next, "due").length, tone: "warning" },
        { label: "bắt đầu", value: rows(next, "starting").length, tone: "accent" },
      ],
      picked: [
        ...rows(next, "due").map((row) => ({ row, tag: `Hạn ${day(row.task.dueDate)}`, tone: "warning" as const })),
        ...rows(next, "starting").map((row) => ({ row, tag: `Bắt đầu ${day(row.task.startDate)}`, tone: "accent" as const })),
        ...rows(next, "continuing").map((row) => ({ row, tag: `Tiếp tục · ${pct(row)}`, tone: "muted" as const })),
      ],
    },
  ];
  return sections.flatMap((sec) => {
    const pages = weekPages(sec.picked);
    if (!pages.length) return [{ kind: "week" as const, kicker: sec.kicker, title: sec.title, period: sec.period, stats: sec.stats, columns: [], hidden: 0 }];
    return pages.map((page, i) => ({
      kind: "week" as const,
      kicker: sec.kicker,
      title: pages.length > 1 ? `${sec.title} (${i + 1}/${pages.length})` : sec.title,
      period: sec.period,
      stats: sec.stats,
      columns: page.columns,
      hidden: page.hidden,
    }));
  });
}

/**
 * Build the standard report deck from a period summary. Empty sections are skipped.
 * With the weekly report, its three slides follow the project progress.
 */
export function buildReportDeck(s: Summary, meta: DeckMeta, week?: DepartmentReport | null): Deck {
  const k = s.kpis;
  const slides: SlideModel[] = [];

  slides.push({ kind: "cover", title: meta.title, subtitle: `${meta.scopeLabel} · ${meta.periodLabel}` });

  slides.push({
    kind: "kpis",
    kicker: "Tổng quan",
    title: "Kết quả nổi bật trong kỳ",
    items: [
      { label: "Tiến độ tổng thể", value: `${k.overallProgress}%`, sub: `${k.totalProjects} dự án`, tone: "accent" },
      { label: "Công việc trong kỳ", value: String(k.totalTasks), sub: `${k.inProgressTasks} đang thực hiện` },
      { label: "Đã hoàn thành", value: String(k.doneTasks), sub: `Tỷ lệ ${k.completionRate}%` },
      { label: "Quá hạn", value: String(k.overdueTasks), sub: k.overdueTasks ? "Cần ưu tiên xử lý" : "Không có", tone: k.overdueTasks ? "danger" : undefined },
      { label: "Báo cáo tiến độ", value: String(k.reportsCount), sub: "từ người thực hiện" },
      { label: "Giờ công", value: String(k.hoursLogged), sub: "giờ đã ghi nhận" },
    ],
  });

  // All projects, not only the first few: long lists become compact columns over several slides.
  slides.push(...projectSlides(s.projects));
  if (week) slides.push(...weekSlides(week));

  const scheduled = s.schedule.filter((r) => r.level === 0 || r.dueDate);
  if (s.workload.total > 0 || scheduled.some((r) => r.dueDate)) {
    const short = (iso: string) => {
      const d = new Date(iso);
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    };
    slides.push({
      kind: "schedule",
      kicker: "Deadline",
      title: "Tiến độ theo deadline & khối lượng công việc",
      rows: scheduled.slice(0, 7).map((r) => ({
        // Slide rows are one line; long names are shortened rather than clipped.
        name: r.name.length > 38 ? `${r.name.slice(0, 37).trimEnd()}…` : r.name,
        color: r.color,
        level: r.level,
        progress: r.progress,
        planned: r.schedule.planned,
        achievement: r.schedule.achievement,
        status: SCHEDULE_STATUS[r.schedule.status].label,
        statusColor: SCHEDULE_STATUS[r.schedule.status].color,
        deadline: !r.dueDate
          ? "Chưa đặt hạn"
          : r.schedule.status === "DONE"
            ? `Hạn ${short(r.dueDate)} · đã xong`
            : `Hạn ${short(r.dueDate)} · ${daysLeftLabel(r.schedule.daysLeft)}`,
        done: r.workload.done,
        remaining: r.workload.remaining,
      })),
      workload: s.workload,
    });
  }

  if (s.finance && s.finance.totals.count > 0) {
    const f = s.finance;
    slides.push({
      kind: "finance",
      kicker: "Tài chính",
      title: "Giá trị hợp đồng, chi phí & lợi nhuận",
      scopeNote: f.scope === "project" ? "Toàn bộ hợp đồng của dự án" : `Hợp đồng thực hiện trong ${s.period.label.toLowerCase()}`,
      totals: f.totals,
      rows: f.byProject.slice(0, 5).map((p) => ({
        name: p.name.length > 34 ? `${p.name.slice(0, 33).trimEnd()}…` : p.name,
        color: p.color,
        progress: p.progress,
        count: p.totals.count,
        value: p.totals.value,
        profit: p.totals.profit,
        margin: p.totals.margin,
        receivable: p.totals.receivable,
      })),
    });
  }

  if (s.trend.length > 1) {
    const created = s.trend.reduce((a, b) => a + b.created, 0);
    const completed = s.trend.reduce((a, b) => a + b.completed, 0);
    slides.push({
      kind: "trend",
      kicker: "Xu hướng",
      title: "Công việc tạo mới và hoàn thành",
      data: s.trend,
      stats: [
        { label: "Tạo mới", value: String(created) },
        { label: "Hoàn thành", value: String(completed) },
        { label: "Chênh lệch", value: `${completed - created >= 0 ? "+" : ""}${completed - created}` },
      ],
    });
  }

  if (k.totalTasks > 0) {
    slides.push({ kind: "status", kicker: "Trạng thái", title: "Phân bổ công việc theo trạng thái", data: s.statusDistribution });
  }

  if (s.people.length) {
    slides.push({ kind: "people", kicker: "Nhân sự", title: "Khối lượng & hiệu suất theo người phụ trách", people: s.people.slice(0, 8) });
  }

  if (k.hoursLogged > 0 && s.trend.length > 1) {
    const active = s.trend.filter((b) => b.hours > 0).length;
    slides.push({
      kind: "hours",
      kicker: "Nguồn lực",
      title: "Giờ công được ghi nhận",
      data: s.trend,
      stats: [
        { label: "Tổng giờ công", value: String(k.hoursLogged) },
        { label: "Số báo cáo", value: String(k.reportsCount) },
        { label: "TB mỗi báo cáo", value: `${k.reportsCount ? Math.round((k.hoursLogged / k.reportsCount) * 10) / 10 : 0} giờ` },
        { label: "Mốc có hoạt động", value: `${active}/${s.trend.length}` },
      ],
    });
  }

  if (k.overdueTasks > 0 || s.upcoming.length) {
    slides.push({
      kind: "risks",
      kicker: "Rủi ro",
      title: "Công việc quá hạn & hạn chót sắp tới",
      overdueTotal: k.overdueTasks,
      byProject: s.projects
        .filter((p) => p.overdueTasks > 0)
        .sort((a, b) => b.overdueTasks - a.overdueTasks)
        .map((p) => ({ name: p.name, color: p.color, overdue: p.overdueTasks })),
      upcoming: s.upcoming.slice(0, 6),
    });
  }

  if (s.recentReports.length) {
    slides.push({
      kind: "quotes",
      kicker: "Báo cáo",
      title: "Cập nhật nổi bật từ người thực hiện",
      quotes: s.recentReports.slice(0, 4).map((r) => ({
        author: r.authorName,
        color: r.authorColor,
        task: r.taskTitle,
        project: r.projectName,
        content: r.content,
        progress: r.progress,
      })),
    });
  }

  slides.push({ kind: "insights", kicker: "Kết luận", title: "Nhận định chính từ số liệu", items: buildInsights(s) });

  return { meta, slides };
}

/**
 * Parse a slide outline (e.g. Claude's "Dàn ý trình chiếu" answer pasted back in)
 * into bullet slides. Accepts "## Slide 1: Title", "Slide 1 - Title", "### Title"
 * headings followed by "-", "*", "•" or numbered bullets.
 */
export function parseOutline(text: string): { title: string; bullets: string[] }[] {
  const slides: { title: string; bullets: string[] }[] = [];
  const heading = /^\s*(?:#{1,4}\s*)?(?:\*\*)?\s*(?:slide|trang|trình chiếu)\s*\d+\s*[:.\-–—)]?\s*(.*?)(?:\*\*)?\s*$/i;
  const mdHeading = /^\s*#{1,4}\s+(.+?)\s*$/;
  const bullet = /^\s*(?:[-*•+]|\d+[.)])\s+(.+)$/;
  const clean = (t: string) => t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/[*_`]/g, "").trim();

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const h = line.match(heading) ?? line.match(mdHeading);
    if (h) {
      slides.push({ title: clean(h[1]) || `Slide ${slides.length + 1}`, bullets: [] });
      continue;
    }
    const b = line.match(bullet);
    const content = clean(b ? b[1] : line);
    if (!content) continue;
    if (!slides.length) slides.push({ title: content, bullets: [] });
    else slides[slides.length - 1].bullets.push(content);
  }
  return slides.filter((s) => s.title || s.bullets.length).map((s) => ({ ...s, bullets: s.bullets.slice(0, 8) }));
}

export function buildOutlineDeck(outline: { title: string; bullets: string[] }[], meta: DeckMeta): Deck {
  return {
    meta,
    slides: [
      { kind: "cover", title: meta.title, subtitle: `${meta.scopeLabel} · ${meta.periodLabel}` },
      ...outline.map((o, i) => ({ kind: "bullets" as const, kicker: `Phần ${i + 1}`, title: o.title, bullets: o.bullets })),
    ],
  };
}
