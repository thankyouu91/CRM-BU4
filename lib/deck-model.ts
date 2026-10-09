// A presentation as plain data. Rendered by components/deck (screen + PDF) and
// lib/export/pptx.ts (native PowerPoint), so every output shows the same content.

import { buildInsights, type Insight } from "./insights";
import { PROJECT_STATUS } from "./constants";
import { daysLeftLabel, SCHEDULE_STATUS, type Workload } from "./schedule";
import type { ContractTotals } from "./finance";
import type { Summary, SummaryPerson } from "./stats";

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
      rows: { name: string; color: string; status: string; progress: number; done: number; total: number; overdue: number }[];
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

/** Build the standard report deck from a period summary. Empty sections are skipped. */
export function buildReportDeck(s: Summary, meta: DeckMeta): Deck {
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

  if (s.projects.length) {
    slides.push({
      kind: "projects",
      kicker: "Dự án",
      title: "Tiến độ hoàn thành từng dự án",
      rows: s.projects.slice(0, 8).map((p) => ({
        name: p.name,
        color: p.color,
        status: PROJECT_STATUS[p.status as keyof typeof PROJECT_STATUS]?.label ?? p.status,
        progress: p.progress,
        done: p.doneTasks,
        total: p.totalTasks,
        overdue: p.overdueTasks,
      })),
    });
  }

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
