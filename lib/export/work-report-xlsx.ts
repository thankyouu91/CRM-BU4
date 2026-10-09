// Weekly / monthly work reports as .xlsx: one person's report laid out like the
// screen (sections, notes, projects), and the boss overview of a whole team
// (summary, task details, progress reports). Loaded on demand in the browser.

import { ROLE_LABELS } from "@/lib/constants";
import { SCHEDULE_STATUS, type ScheduleStatus } from "@/lib/schedule";
import {
  groupByProject,
  rowItem,
  sectionTitles,
  statusLabel,
  taskStateLabel,
  type TeamWorkReports,
  type WorkNotes,
  type WorkReportData,
  type WorkReportRecord,
  type WorkRow,
  type WorkTask,
  zonedText,
} from "@/lib/work-report";

type Cell = Record<string, unknown> | null;
const FONT = "Arial";
const base = { fontFamily: FONT, fontSize: 10 };
const border = { borderColor: "#cbd5e1", borderStyle: "thin" as const };
const NAVY = "#1e3a8a";
const blank = (n: number): Cell[] => Array.from({ length: n }, () => null);
const widths = (...w: number[]) => w.map((width) => ({ width }));
const text = (v: string | null | undefined, extra: Record<string, unknown> = {}): Cell => ({ ...base, ...border, value: v ?? "", ...extra });
const pct = (n: number, extra: Record<string, unknown> = {}): Cell => ({
  ...base,
  ...border,
  value: n / 100,
  type: Number,
  format: "0%",
  align: "right",
  ...extra,
});
const num = (n: number, extra: Record<string, unknown> = {}): Cell => ({ ...base, ...border, value: n, type: Number, align: "right", ...extra });
const span = (value: string, cols: number, extra: Record<string, unknown> = {}): Cell[] => [
  { ...base, value, columnSpan: cols, wrap: true, ...extra },
  ...blank(cols - 1),
];
const head = (labels: string[], color = NAVY): Cell[] =>
  labels.map((value) => ({
    ...base,
    ...border,
    value,
    fontWeight: "bold",
    textColor: color,
    backgroundColor: "#f1f5f9",
    align: "center",
    wrap: true,
  }));

function stateText(status: WorkReportRecord["status"] | "NONE", r: WorkReportRecord | null) {
  if (!r || status === "NONE") return "Chưa có báo cáo";
  if (r.status === "DRAFT") return "Nháp (chưa gửi)";
  return `Đã gửi ${zonedText(r.submittedAt, "datetime")}${r.editedSinceSubmit ? " · đã sửa ghi chú sau khi gửi" : ""}`;
}

function reviewText(r: WorkReportRecord | null) {
  if (!r?.reviewedAt) return r?.status === "SUBMITTED" ? "Chưa xem" : "";
  const stale = r.reviewStale ? " (trước lần gửi lại)" : "";
  const note = r.reviewNote ? ` — “${r.reviewNote}”` : "";
  return `${r.reviewedBy?.name ?? "Cấp trên"} · ${zonedText(r.reviewedAt, "datetime")}${stale}${note}`;
}

/** What the line said when the report was sent (empty for drafts). */
function reportedText(row: WorkRow<WorkTask>) {
  switch (row.state) {
    case "same":
      return "Không đổi";
    case "changed":
      return taskStateLabel(row.reported!);
    case "added":
      return "Mới sau khi gửi";
    case "left":
      return `${taskStateLabel(row.reported!)} (đã chuyển mục)`;
    case "gone":
      return `${taskStateLabel(row.reported!)} (đã xoá)`;
    default:
      return "";
  }
}

function taskNote(t: WorkTask, authorId: string, continuing: boolean, unit: string) {
  const parts: string[] = [];
  if (t.overdue) parts.push("Quá hạn");
  if (t.assignee?.id !== authorId) parts.push(t.assignee ? `Giao cho ${t.assignee.name}` : "Chưa giao");
  if (t.parentTitle) parts.push(`Thuộc: ${t.parentTitle}`);
  if (t.completedAt) parts.push(`Xong ${zonedText(t.completedAt)}`);
  if (continuing) parts.push(`Đang làm từ ${unit} này`);
  return parts.join(" · ");
}

// ----------------------------------------------------------------------------
// One report
// ----------------------------------------------------------------------------

const COLS = 8;
const TASK_HEAD = ["STT", "Dự án", "Công việc", "Trạng thái", "Tiến độ", "Hạn chót", "Lúc báo cáo", "Ghi chú"];
const WIDTHS = [6, 28, 46, 14, 10, 13, 24, 34];

function taskRows(rows: WorkRow<WorkTask>[], authorId: string, unit: string, continuing?: Set<string>): Cell[][] {
  if (!rows.length) {
    const none = { ...base, ...border, value: "Không có công việc", fontStyle: "italic", textColor: "#64748b", columnSpan: COLS - 1 };
    return [[text("", { align: "center" }), none, ...blank(COLS - 2)]];
  }
  let i = 0;
  return groupByProject(rows).flatMap((g) =>
    g.rows.map((row) => {
      const t = rowItem(row);
      i += 1;
      return [
        text(String(i), { align: "center" }),
        text(g.project.name, { wrap: true }),
        text(t.title, { wrap: true, ...(row.state === "gone" ? { textColor: "#94a3b8" } : {}) }),
        text(statusLabel(t.status), { align: "center" }),
        pct(t.progress),
        text(t.dueDate ? zonedText(t.dueDate) : "", { align: "center", ...(t.overdue ? { textColor: "#dc2626", fontWeight: "bold" } : {}) }),
        text(reportedText(row), { wrap: true, ...(row.state === "changed" || row.state === "left" ? { textColor: "#b45309" } : {}) }),
        text(taskNote(t, authorId, !!continuing?.has(row.id), unit), { wrap: true }),
      ];
    }),
  );
}

function sectionTitle(value: string, color: string): Cell[] {
  return span(value, COLS, { fontWeight: "bold", fontSize: 11, textColor: "#ffffff", backgroundColor: color, height: 20, alignVertical: "center" });
}

function noteRow(label: string, value: string | null): Cell[] {
  return [
    { ...base, ...border, value: label, fontWeight: "bold", backgroundColor: "#f8fafc", columnSpan: 2, wrap: true, alignVertical: "top" },
    null,
    { ...base, ...border, value: value || "—", columnSpan: COLS - 2, wrap: true, alignVertical: "top" },
    ...blank(COLS - 3),
  ];
}

export async function exportWorkReportXlsx(data: WorkReportData, notes: WorkNotes, filename: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const titles = sectionTitles(data.period.type);
  const r = data.report;
  const currentOpen = new Set(data.sections.current.filter((x) => x.live && x.live.status !== "DONE").map((x) => x.id));
  const info = (label: string, value: string, label2: string, value2: string): Cell[] => [
    { ...base, value: label, fontWeight: "bold", textColor: "#475569", columnSpan: 2 },
    null,
    { ...base, value, columnSpan: 2, wrap: true },
    null,
    { ...base, value: label2, fontWeight: "bold", textColor: "#475569", columnSpan: 2 },
    null,
    { ...base, value: value2, columnSpan: 2, wrap: true },
    null,
  ];

  const entries = data.sections.last.entries;
  const entryRows: Cell[][] = entries.length
    ? [
        span(`Báo cáo tiến độ đã gửi (${entries.length} báo cáo · ${data.totals.hours} giờ)`, COLS, {
          fontWeight: "bold",
          textColor: NAVY,
        }),
        head(["STT", "Dự án", "Công việc", "Ngày", "Tiến độ", "Giờ làm", "Nội dung", ""]),
        ...groupByProject(entries).flatMap((g, gi, all) =>
          g.rows.map((row, ri) => {
            const e = rowItem(row);
            const n = all.slice(0, gi).reduce((a, x) => a + x.rows.length, 0) + ri + 1;
            return [
              text(String(n), { align: "center" }),
              text(g.project.name, { wrap: true }),
              text(e.task.title, { wrap: true }),
              text(zonedText(e.createdAt, "datetime"), { align: "center" }),
              pct(e.progress),
              num(e.hoursSpent, { format: "0.0" }),
              { ...base, ...border, value: e.content, wrap: true, columnSpan: 2 },
              null,
            ];
          }),
        ),
      ]
    : [];

  const projectRows: Cell[][] = data.projects.length
    ? [
        head(["STT", "Dự án", "Vai trò", "Đánh giá tiến độ", "Tiến độ", "Hạn", "Kế hoạch đến nay", "Công việc"]),
        ...data.projects.map((row, i) => {
          const p = rowItem(row);
          const was = row.state === "changed" && row.reported ? ` (lúc báo cáo ${row.reported.progress}%)` : "";
          return [
            text(String(i + 1), { align: "center" }),
            text(p.name, { wrap: true }),
            text(p.role === "OWNER" ? "Chủ dự án" : "Quản lý dự án", { align: "center" }),
            text(SCHEDULE_STATUS[p.scheduleStatus as ScheduleStatus]?.label ?? p.scheduleStatus, { align: "center" }),
            pct(p.progress),
            text(p.dueDate ? zonedText(p.dueDate) : "", { align: "center" }),
            text(p.planned === null ? "—" : `${p.planned}%`, { align: "center" }),
            text(`${p.doneTasks}/${p.totalTasks} xong${p.overdueTasks ? ` · ${p.overdueTasks} quá hạn` : ""}${was}`, { wrap: true }),
          ];
        }),
      ]
    : [span("Không làm chủ hay quản lý dự án nào đang chạy.", COLS, { fontStyle: "italic", textColor: "#64748b" })];

  const sheet: Cell[][] = [
    span(`BÁO CÁO CÔNG VIỆC ${data.period.label.toUpperCase()}`, COLS, {
      fontSize: 14,
      fontWeight: "bold",
      textColor: "#ffffff",
      backgroundColor: NAVY,
      align: "center",
      alignVertical: "center",
      height: 30,
    }),
    blank(COLS),
    info(
      "Người báo cáo",
      [data.author.name, data.author.jobTitle].filter(Boolean).join(" · "),
      "Trạng thái",
      stateText(r?.status ?? "NONE", r),
    ),
    info("Cấp bậc", ROLE_LABELS[data.author.role] ?? data.author.role, "Cấp trên đã xem", reviewText(r) || "—"),
    blank(COLS),
    sectionTitle(`1. ${titles.last.toUpperCase()} · ${data.prev.label}`, "#047857"),
    head(TASK_HEAD),
    ...taskRows(data.sections.last.tasks, data.author.id, titles.unit),
    ...entryRows,
    noteRow("Kết quả nổi bật / ghi chú", notes.doneNote),
    blank(COLS),
    sectionTitle(`2. ${titles.current.toUpperCase()} · ${data.period.label}`, "#2563eb"),
    head(TASK_HEAD),
    ...taskRows(data.sections.current, data.author.id, titles.unit),
    noteRow("Ghi chú", notes.doingNote),
    blank(COLS),
    sectionTitle(`3. ${titles.next.toUpperCase()} · ${data.next.label}`, "#6d28d9"),
    head(TASK_HEAD),
    ...taskRows(data.sections.next, data.author.id, titles.unit, currentOpen),
    noteRow("Kế hoạch", notes.planNote),
    blank(COLS),
    sectionTitle("4. DỰ ÁN CỦA TÔI", "#c2410c"),
    ...projectRows,
    blank(COLS),
    sectionTitle("5. KHÓ KHĂN / ĐỀ XUẤT", "#b91c1c"),
    span(notes.issues || "—", COLS, { ...border, alignVertical: "top", height: 40 }),
    blank(COLS),
    span(
      `Xuất lúc ${zonedText(new Date(), "datetime")}. Trạng thái và tiến độ công việc là số liệu tại thời điểm xuất${
        data.snapshotAt ? `; cột “Lúc báo cáo” là số liệu khi gửi (${zonedText(data.snapshotAt, "datetime")})` : ""
      }.`,
      COLS,
      { fontStyle: "italic", textColor: "#64748b" },
    ),
  ];

  await writeXlsxFile(sheet as never, {
    sheet: data.period.short,
    columns: widths(...WIDTHS),
  }).toFile(filename);
}

// ----------------------------------------------------------------------------
// Boss overview: every visible member's report on one period
// ----------------------------------------------------------------------------

export async function exportTeamWorkReportsXlsx(team: TeamWorkReports, filename: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const titles = sectionTitles(team.period.type);

  const summaryHead = [
    "STT",
    "Nhân sự",
    "Chức danh",
    "Cấp bậc",
    "Trạng thái",
    "Cấp trên đã xem",
    `${titles.last}: việc xong`,
    "Báo cáo tiến độ",
    "Giờ làm",
    "Đang làm",
    "Quá hạn",
    `Hoàn thành ${titles.unit} này`,
    `Kế hoạch ${titles.unit} tới`,
    "Kết quả nổi bật",
    "Ghi chú kỳ này",
    "Kế hoạch",
    "Khó khăn / đề xuất",
  ];
  const summaryRows: Cell[][] = team.members.map((m, i) => {
    const t = m.totals;
    const n = m.report?.notes;
    const state = m.state === "SUBMITTED" ? "#047857" : m.state === "DRAFT" ? "#475569" : "#b91c1c";
    return [
      text(String(i + 1), { align: "center" }),
      text(m.author.name, { fontWeight: "bold" }),
      text(m.author.jobTitle),
      text(ROLE_LABELS[m.author.role] ?? m.author.role, { align: "center" }),
      text(stateText(m.state, m.report), { textColor: state, wrap: true }),
      text(reviewText(m.report), { wrap: true }),
      num(t.lastDone),
      num(t.entries),
      num(t.hours, { format: "0.0" }),
      num(t.currentOpen),
      num(t.overdue, t.overdue ? { textColor: "#dc2626", fontWeight: "bold" } : {}),
      num(t.currentDone),
      num(t.next),
      text(n?.doneNote, { wrap: true }),
      text(n?.doingNote, { wrap: true }),
      text(n?.planNote, { wrap: true }),
      text(n?.issues, { wrap: true }),
    ];
  });
  const sent = team.members.filter((m) => m.state === "SUBMITTED").length;
  const summary: Cell[][] = [
    span(`TỔNG HỢP BÁO CÁO CÔNG VIỆC ${team.period.label.toUpperCase()}`, summaryHead.length, {
      fontSize: 14,
      fontWeight: "bold",
      textColor: "#ffffff",
      backgroundColor: NAVY,
      align: "center",
      height: 30,
    }),
    span(
      `Đã gửi ${sent}/${team.members.length} · xuất lúc ${zonedText(new Date(), "datetime")} · số liệu tại thời điểm xuất`,
      summaryHead.length,
      { fontStyle: "italic", textColor: "#475569" },
    ),
    head(summaryHead),
    ...summaryRows,
  ];

  const detail: Cell[][] = [
    head(["STT", "Nhân sự", "Mục", "Dự án", "Công việc", "Trạng thái", "Tiến độ", "Hạn chót", "Lúc báo cáo", "Ghi chú"]),
  ];
  const entries: Cell[][] = [head(["STT", "Nhân sự", "Dự án", "Công việc", "Ngày", "Tiến độ", "Giờ làm", "Nội dung"])];
  for (const m of team.members) {
    const v = m.view;
    if (!v) continue;
    const currentOpen = new Set(v.sections.current.filter((x) => x.live && x.live.status !== "DONE").map((x) => x.id));
    const parts: [string, WorkRow<WorkTask>[], Set<string> | undefined][] = [
      [titles.last, v.sections.last.tasks, undefined],
      [titles.current, v.sections.current, undefined],
      [titles.next, v.sections.next, currentOpen],
    ];
    for (const [label, rows, continuing] of parts) {
      for (const g of groupByProject(rows)) {
        for (const row of g.rows) {
          const t = rowItem(row);
          detail.push([
            text(String(detail.length), { align: "center" }),
            text(m.author.name),
            text(label),
            text(g.project.name, { wrap: true }),
            text(t.title, { wrap: true }),
            text(statusLabel(t.status), { align: "center" }),
            pct(t.progress),
            text(t.dueDate ? zonedText(t.dueDate) : "", { align: "center", ...(t.overdue ? { textColor: "#dc2626", fontWeight: "bold" } : {}) }),
            text(reportedText(row), { wrap: true }),
            text(taskNote(t, m.author.id, !!continuing?.has(row.id), titles.unit), { wrap: true }),
          ]);
        }
      }
    }
    for (const row of v.sections.last.entries) {
      const e = rowItem(row);
      entries.push([
        text(String(entries.length), { align: "center" }),
        text(m.author.name),
        text(e.project.name, { wrap: true }),
        text(e.task.title, { wrap: true }),
        text(zonedText(e.createdAt, "datetime"), { align: "center" }),
        pct(e.progress),
        num(e.hoursSpent, { format: "0.0" }),
        text(e.content, { wrap: true }),
      ]);
    }
  }

  await writeXlsxFile(
    [
      {
        data: summary as never,
        sheet: "Tổng hợp",
        columns: widths(6, 24, 22, 14, 26, 30, 12, 12, 9, 10, 10, 12, 12, 36, 36, 36, 36),
        stickyRowsCount: 3,
      },
      { data: detail as never, sheet: "Chi tiết công việc", columns: widths(6, 22, 20, 26, 44, 14, 10, 13, 24, 34), stickyRowsCount: 1 },
      { data: entries as never, sheet: "Báo cáo tiến độ", columns: widths(6, 22, 26, 40, 17, 10, 9, 60), stickyRowsCount: 1 },
    ],
  ).toFile(filename);
}
