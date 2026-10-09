"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  FileSpreadsheet,
  GitBranch,
  ListChecks,
  Loader2,
  MessageSquareWarning,
  Plus,
  Printer,
  Save,
  Send,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { RoleBadge, ScheduleBadge, TaskStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { PlanBar, ProgressBar } from "@/components/ui/progress";
import { KpiTile } from "@/components/kpi";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { PlanItemModal } from "./plan-item-modal";
import type { PeriodRef } from "./period-nav";
import { api, ApiError, useApi } from "@/lib/client";
import { TASK_STATUS } from "@/lib/constants";
import { daysLeftLabel } from "@/lib/schedule";
import { cn, timeAgo } from "@/lib/utils";
import {
  groupByProject,
  notesOf,
  periodQuery,
  rowItem,
  sectionTitles,
  taskStateLabel,
  type WorkEntry,
  type WorkNotes,
  type WorkProject,
  type WorkReportData,
  type WorkReportRecord,
  type WorkRow,
  type WorkTask,
  zonedText,
} from "@/lib/work-report";

type SaveState = "saved" | "dirty" | "saving" | "error";

/**
 * One person's weekly / monthly report: loads it for `period`, and for the author
 * keeps the notes saved (debounced auto-save) and sends it. Used by "Công việc của
 * tôi" (author) and the boss's member page (read-only + "Đã xem").
 */
export function WorkReportScreen({
  userId,
  period,
  initial,
  toolbar,
}: {
  /** Whose report; omitted = mine. */
  userId?: string;
  period: PeriodRef;
  initial?: WorkReportData;
  /** Period navigation etc., shown above the report and hidden when printing. */
  toolbar?: React.ReactNode;
}) {
  const url = `/api/work-reports?${periodQuery(period)}${userId ? `&userId=${userId}` : ""}`;
  const { data, error, loading, reload, setData } = useApi<WorkReportData>(url, { initial });
  // While another period loads, the previous one may still be in `data`.
  const ready = !!data && data.period.type === period.type && data.period.key === period.key && (!userId || data.author.id === userId);

  return (
    <div>
      {toolbar && <div className="mb-5 print:hidden">{toolbar}</div>}
      {error && !ready ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card py-16 text-center">
          <TriangleAlert className="h-8 w-8 text-danger" />
          <p className="text-sm">{error}</p>
        </div>
      ) : !ready ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className={cn("transition-opacity", loading && "opacity-70")}>
          <ReportBody key={`${data.author.id}:${data.period.type}:${data.period.key}`} data={data} reload={reload} setData={setData} />
        </div>
      )}
    </div>
  );
}

/** The author's notes, saved 1.2 s after typing stops, on demand, and when leaving the report. */
function useNotesDraft(data: WorkReportData, onSaved: (r: WorkReportRecord) => void) {
  const [notes, setNotes] = useState<WorkNotes>(() => notesOf(data.report?.notes));
  const [state, setState] = useState<SaveState>("saved");
  const latest = useRef(notes);
  const pending = useRef<WorkNotes | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saved = useRef(onSaved);
  saved.current = onSaved;
  const { type, key } = data.period;
  const body = useCallback((n: WorkNotes) => ({ period: type.toLowerCase(), key, ...n }), [type, key]);

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    if (inflight.current) await inflight.current;
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setState("saving");
    const run = api<{ report: WorkReportRecord }>("/api/work-reports", { method: "PUT", body: body(next) })
      .then((res) => {
        saved.current(res.report);
        setState(pending.current ? "dirty" : "saved");
      })
      .catch((e) => {
        pending.current ??= next;
        setState("error");
        toast.error(e instanceof ApiError ? e.message : "Không lưu được ghi chú");
      });
    inflight.current = run;
    await run;
    inflight.current = null;
  }, [body]);

  const change = (field: keyof WorkNotes, value: string) => {
    const next = { ...latest.current, [field]: value };
    latest.current = next;
    pending.current = next;
    setNotes(next);
    setState("dirty");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 1200);
  };

  /** For sending: no save of its own is left pending. */
  const take = async () => {
    clearTimeout(timer.current);
    if (inflight.current) await inflight.current;
    pending.current = null;
    setState("saved");
    return latest.current;
  };

  // Leaving the report (another period, the other tab, another page) saves what is pending.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pending.current) void api("/api/work-reports", { method: "PUT", body: body(pending.current), keepalive: true }).catch(() => {});
    },
    [body],
  );
  useEffect(() => {
    if (state === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  return { notes, state, change, save, take };
}

function ReportBody({
  data,
  reload,
  setData,
}: {
  data: WorkReportData;
  reload: () => Promise<void>;
  setData: (next: WorkReportData | null | ((prev: WorkReportData | null) => WorkReportData | null)) => void;
}) {
  const titles = sectionTitles(data.period.type);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [sending, setSending] = useState(false);
  const draft = useNotesDraft(data, (report) => setData((d) => (d ? { ...d, report } : d)));
  const notes = data.canEdit ? draft.notes : notesOf(data.report?.notes);
  const openable = useMemo(() => new Set(data.openable), [data.openable]);
  const current = data.sections.current;
  const currentIds = useMemo(() => new Set(current.filter((r) => r.live && r.live.status !== "DONE").map((r) => r.id)), [current]);
  const future = new Date(data.period.start).getTime() > Date.now();
  const submitted = data.report?.status === "SUBMITTED";

  const send = async () => {
    setSending(true);
    try {
      const n = await draft.take();
      const view = await api<WorkReportData>("/api/work-reports/submit", {
        method: "POST",
        body: { period: data.period.type.toLowerCase(), key: data.period.key, ...n },
      });
      setData(view);
      toast.success(submitted ? "Đã gửi lại báo cáo, cấp trên thấy bản mới nhất" : "Đã gửi báo cáo cho cấp trên");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không gửi được báo cáo");
    } finally {
      setSending(false);
    }
  };

  const exportExcel = async () => {
    try {
      const [{ exportWorkReportXlsx }, { fileSlug }] = await Promise.all([import("@/lib/export/work-report-xlsx"), import("@/lib/export/save")]);
      await exportWorkReportXlsx(data, notes, `bao-cao-${fileSlug(data.author.name)}-${data.period.key.toLowerCase()}.xlsx`);
    } catch (e) {
      console.error(e);
      toast.error("Không xuất được file Excel");
    }
  };

  const noteField = (field: keyof WorkNotes, label: string, placeholder: string) => (
    <NoteField label={label} value={notes[field]} editable={data.canEdit} placeholder={placeholder} onChange={(v) => draft.change(field, v)} />
  );

  return (
    <div className="space-y-5 print:space-y-4 print:px-px">
      <HeaderCard data={data} saveState={draft.state} onSave={draft.save} onSend={send} sending={sending} future={future} onExport={exportExcel} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 print:grid-cols-4 print:gap-2">
        <KpiTile
          label={titles.last}
          value={data.totals.lastDone}
          icon={CheckCircle2}
          sub={`${data.totals.entries} báo cáo tiến độ · ${data.totals.hours} giờ`}
          className="print:p-3 print:shadow-none"
        />
        <KpiTile
          label="Đang làm"
          value={data.totals.currentOpen}
          icon={Clock}
          tone={data.totals.overdue ? "critical" : "default"}
          sub={data.totals.overdue ? `${data.totals.overdue} việc quá hạn` : "Không có việc trễ"}
          className="print:p-3 print:shadow-none"
        />
        <KpiTile label={`Hoàn thành ${titles.unit} này`} value={data.totals.currentDone} icon={ListChecks} className="print:p-3 print:shadow-none" />
        <KpiTile label={`Kế hoạch ${titles.unit} tới`} value={data.totals.next} icon={CalendarClock} className="print:p-3 print:shadow-none" />
      </div>

      <Section n={1} title={titles.last} period={data.prev.label} count={data.sections.last.tasks.length} unit="việc hoàn thành">
        <TaskGroups
          rows={data.sections.last.tasks}
          authorId={data.author.id}
          openable={openable}
          onOpen={setOpenTask}
          empty={`Không có công việc hoàn thành trong ${data.prev.short.toLowerCase()}.`}
        />
        <Entries rows={data.sections.last.entries} openable={openable} onOpen={setOpenTask} />
        {noteField("doneNote", "Kết quả nổi bật / ghi chú", "Kết quả đạt được, số liệu, việc đã bàn giao…")}
      </Section>

      <Section n={2} title={titles.current} period={data.period.label} count={data.sections.current.length} unit="việc">
        <TaskGroups
          rows={data.sections.current}
          authorId={data.author.id}
          openable={openable}
          onOpen={setOpenTask}
          empty={`Không có công việc đang làm hay đến hạn trong ${data.period.short.toLowerCase()}.`}
        />
        {noteField("doingNote", "Ghi chú", "Đang tập trung vào việc gì, tiến triển ra sao…")}
      </Section>

      <Section
        n={3}
        title={titles.next}
        period={data.next.label}
        count={data.sections.next.length}
        unit="việc"
        action={
          data.canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="print:hidden"
              onClick={() => setPlanning(true)}
              disabled={!data.planProjects.length}
              title={data.planProjects.length ? undefined : "Bạn chưa tham gia dự án nào để thêm việc"}
            >
              <Plus className="h-3.5 w-3.5" /> Thêm việc vào kế hoạch
            </Button>
          )
        }
      >
        <TaskGroups
          rows={data.sections.next}
          authorId={data.author.id}
          openable={openable}
          onOpen={setOpenTask}
          continuing={currentIds}
          continuingLabel={`Đang làm từ ${titles.unit} này`}
          empty={`Chưa có công việc nào bắt đầu hay đến hạn trong ${data.next.short.toLowerCase()}.`}
        />
        {noteField("planNote", "Kế hoạch", "Mục tiêu, việc dự kiến làm, mốc cần đạt…")}
      </Section>

      <Section n={4} title="Dự án của tôi" period="Dự án làm chủ hoặc quản lý" count={data.projects.length} unit="dự án">
        <Projects rows={data.projects} openable={openable} />
      </Section>

      <Section n={5} title="Khó khăn / đề xuất">
        {noteField("issues", "Khó khăn, vướng mắc và đề xuất cần cấp trên hỗ trợ", "VD: chờ phê duyệt ngân sách, cần thêm nhân sự…")}
      </Section>

      {submitted && data.canReview && <ReviewCard data={data} onReviewed={(report) => setData((d) => (d ? { ...d, report } : d))} />}

      <p className="hidden text-[10px] text-slate-500 print:block" suppressHydrationWarning>
        In lúc {zonedText(new Date(), "datetime")} từ WorkHub · danh sách công việc là số liệu tại thời điểm in
        {data.snapshotAt ? `, so với lúc gửi ${zonedText(data.snapshotAt, "datetime")}` : ""}.
      </p>

      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} onChanged={() => void reload()} />
      {data.canEdit && (
        <PlanItemModal
          open={planning}
          onClose={() => setPlanning(false)}
          projects={data.planProjects}
          period={data.next}
          assigneeId={data.author.id}
          onCreated={() => void reload()}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Header, status, actions
// ----------------------------------------------------------------------------

function StatusPill({ data }: { data: WorkReportData }) {
  const r = data.report;
  if (!r) {
    return <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{data.canEdit ? "Chưa gửi" : "Chưa có báo cáo"}</span>;
  }
  if (r.status === "DRAFT") {
    return <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-500/15 dark:text-slate-300">Nháp · chưa gửi</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
      <Send className="h-3 w-3" /> Đã gửi {zonedText(r.submittedAt, "datetime")}
    </span>
  );
}

function saveLabel(state: SaveState, report: WorkReportRecord | null) {
  if (state === "saving") return "Đang lưu…";
  if (state === "dirty") return "Có thay đổi chưa lưu";
  if (state === "error") return "Chưa lưu được, thử lại";
  return report ? `Đã lưu ${timeAgo(report.updatedAt)}` : "Ghi chú được tự động lưu";
}

function HeaderCard({
  data,
  saveState,
  onSave,
  onSend,
  sending,
  future,
  onExport,
}: {
  data: WorkReportData;
  saveState: SaveState;
  onSave: () => Promise<void>;
  onSend: () => Promise<void>;
  sending: boolean;
  future: boolean;
  onExport: () => Promise<void>;
}) {
  const r = data.report;
  const kind = data.period.type === "WEEK" ? "tuần" : "tháng";
  const [exporting, setExporting] = useState(false);
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card print:rounded-none print:border-0 print:border-b print:p-0 print:pb-3 print:shadow-none">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={data.author.name} color={data.author.avatarColor} size="md" className="print:hidden" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Báo cáo công việc {kind}</p>
            <h2 className="mt-0.5 text-lg font-bold leading-snug sm:text-xl">{data.period.label}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-medium">{data.author.name}</span>
              {data.author.jobTitle && <span className="text-muted-foreground">· {data.author.jobTitle}</span>}
              <RoleBadge role={data.author.role} />
              <StatusPill data={data} />
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end print:hidden">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              loading={exporting}
              onClick={async () => {
                setExporting(true);
                await onExport();
                setExporting(false);
              }}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Xuất Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> In / Lưu PDF
            </Button>
            {data.canEdit && (
              <>
                <Button variant="outline" size="sm" onClick={() => void onSave()} disabled={saveState === "saved" || saveState === "saving"}>
                  <Save className="h-3.5 w-3.5" /> Lưu nháp
                </Button>
                <Button
                  size="sm"
                  onClick={() => void onSend()}
                  loading={sending}
                  disabled={future}
                  title={future ? "Chưa đến kỳ này, chỉ có thể lưu nháp kế hoạch" : undefined}
                >
                  <Send className="h-3.5 w-3.5" /> {r?.status === "SUBMITTED" ? "Gửi lại" : "Gửi báo cáo"}
                </Button>
              </>
            )}
          </div>
          {data.canEdit && (
            <p className={cn("text-xs", saveState === "error" ? "text-danger" : "text-muted-foreground")}>{saveLabel(saveState, r)}</p>
          )}
        </div>
      </div>

      {r?.status === "SUBMITTED" && (
        <div className="mt-4 flex flex-col gap-2 border-t pt-4 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
          <p className="text-muted-foreground">
            Danh sách công việc bên dưới là <b className="text-foreground">số liệu hiện tại</b>; dòng nào thay đổi so với lúc gửi ghi rõ{" "}
            <span className="whitespace-nowrap">“lúc báo cáo → hiện tại”</span>.
          </p>
          {r.editedSinceSubmit && (
            <p className="flex items-center gap-1.5 text-warning">
              <TriangleAlert className="h-4 w-4" /> Ghi chú đã sửa sau khi gửi{data.canEdit ? " — bấm Gửi lại để cập nhật bản gửi" : ""}
            </p>
          )}
          {r.reviewedAt ? (
            <p className="flex items-center gap-1.5 text-success">
              <CheckCircle2 className="h-4 w-4" /> {r.reviewedBy?.name ?? "Cấp trên"} đã xem {timeAgo(r.reviewedAt)}
              {r.reviewStale && <span className="text-muted-foreground">(trước lần gửi lại)</span>}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-warning">
              <Eye className="h-4 w-4" /> Chờ cấp trên xem
            </p>
          )}
        </div>
      )}
      {r?.reviewNote && (
        <p className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-sm">
          <span className="font-medium text-success">Nhận xét của {r.reviewedBy?.name ?? "cấp trên"}:</span> “{r.reviewNote}”
        </p>
      )}
    </section>
  );
}

function ReviewCard({ data, onReviewed }: { data: WorkReportData; onReviewed: (r: WorkReportRecord) => void }) {
  const r = data.report!;
  const [note, setNote] = useState(r.reviewNote ?? "");
  const [busy, setBusy] = useState(false);
  const review = async () => {
    setBusy(true);
    try {
      const res = await api<{ report: WorkReportRecord }>(`/api/work-reports/${r.id}/review`, { method: "POST", body: { reviewNote: note || null } });
      onReviewed(res.report);
      toast.success("Đã đánh dấu đã xem báo cáo");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thể cập nhật");
    } finally {
      setBusy(false);
    }
  };
  const fresh = r.reviewedAt && !r.reviewStale;
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card print:hidden">
      <h3 className="text-[15px] font-semibold">Cấp trên xem xét</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {fresh ? "Bạn đã xem báo cáo này; có thể cập nhật nhận xét." : `Đánh dấu đã xem để ${data.author.name} biết báo cáo đã được đọc.`}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nhận xét, chỉ đạo cho người báo cáo (tuỳ chọn)…" className="h-10" />
        <Button onClick={review} loading={busy}>
          <Eye className="h-4 w-4" /> {fresh ? "Cập nhật nhận xét" : "Đã xem"}
        </Button>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Sections
// ----------------------------------------------------------------------------

function Section({
  n,
  title,
  period,
  count,
  unit,
  action,
  children,
}: {
  n: number;
  title: string;
  period?: string;
  count?: number;
  unit?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-card print:break-inside-auto print:rounded-lg print:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5 print:break-after-avoid">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold">
            {n}. {title}
          </h3>
          {(period || count !== undefined) && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {period}
              {count !== undefined && ` · ${count} ${unit}`}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function NoteField({
  label,
  value,
  editable,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | null;
  editable: boolean;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const text = value ?? "";
  return (
    <div className="border-t bg-muted/20 px-5 py-4 print:break-inside-avoid print:bg-transparent">
      <p className="mb-1.5 text-xs font-medium text-foreground/80">{label}</p>
      {editable ? (
        <>
          <Textarea
            value={text}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={Math.min(12, Math.max(3, text.split("\n").length + 1))}
            className="min-h-0 bg-card print:hidden"
          />
          <p className="hidden whitespace-pre-wrap text-sm print:block">{text || "—"}</p>
        </>
      ) : (
        <p className="whitespace-pre-wrap text-sm">{text || <span className="text-muted-foreground">Chưa ghi.</span>}</p>
      )}
    </div>
  );
}

function TaskGroups({
  rows,
  authorId,
  openable,
  onOpen,
  empty,
  continuing,
  continuingLabel,
}: {
  rows: WorkRow<WorkTask>[];
  authorId: string;
  openable: Set<string>;
  onOpen: (id: string) => void;
  empty: string;
  continuing?: Set<string>;
  continuingLabel?: string;
}) {
  if (!rows.length) return <p className="px-5 py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div>
      {groupByProject(rows).map((g) => (
        <div key={g.project.id} className="border-b last:border-b-0">
          <p className="flex items-center gap-2 bg-muted/40 px-5 py-1.5 text-xs font-semibold text-muted-foreground print:break-after-avoid">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: g.project.color }} />
            <span className="truncate">{g.project.name}</span>
            <span className="font-normal">· {g.rows.length}</span>
          </p>
          <ul className="divide-y">
            {g.rows.map((row) => (
              <TaskLine
                key={row.id}
                row={row}
                authorId={authorId}
                canOpen={openable.has(row.id)}
                onOpen={onOpen}
                continuing={!!continuing?.has(row.id) && continuingLabel ? continuingLabel : null}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TaskLine({
  row,
  authorId,
  canOpen,
  onOpen,
  continuing,
}: {
  row: WorkRow<WorkTask>;
  authorId: string;
  canOpen: boolean;
  onOpen: (id: string) => void;
  continuing: string | null;
}) {
  const t = rowItem(row);
  const content = (
    <>
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: statusColor(t.status) }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", row.state === "gone" && "text-muted-foreground line-through", canOpen && "group-hover:text-primary")}>
          {t.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
          {t.parentTitle && (
            <span className="inline-flex items-center gap-1">
              <GitBranch className="h-3 w-3" /> {t.parentTitle}
            </span>
          )}
          {t.assignee?.id !== authorId && <span>{t.assignee ? `Giao cho ${t.assignee.name}` : "Chưa giao người phụ trách"}</span>}
          {t.startDate && <span>Bắt đầu {zonedText(t.startDate, "short")}</span>}
          {t.dueDate && (
            <span className={cn(t.overdue && "font-semibold text-danger")}>
              Hạn {zonedText(t.dueDate)}
              {t.overdue && " · quá hạn"}
            </span>
          )}
          {t.completedAt && <span>Xong {zonedText(t.completedAt, "short")}</span>}
          {continuing && <span className="text-primary">{continuing}</span>}
        </p>
        <ChangeNote row={row} />
      </div>
      <div className="hidden w-28 shrink-0 pt-0.5 sm:block print:block">
        <ProgressBar value={t.progress} height={6} showLabel />
      </div>
      <TaskStatusBadge status={t.status} className="mt-0.5 shrink-0" />
    </>
  );
  return (
    <li className="print:break-inside-avoid">
      {canOpen ? (
        <button onClick={() => onOpen(row.id)} className="group flex w-full items-start gap-3 px-5 py-2.5 text-left hover:bg-muted/40">
          {content}
        </button>
      ) : (
        <div className="flex items-start gap-3 px-5 py-2.5">{content}</div>
      )}
    </li>
  );
}

const statusColor = (s: string) => TASK_STATUS[s as keyof typeof TASK_STATUS]?.color ?? TASK_STATUS.TODO.color;

/** "Lúc báo cáo … → hiện tại …" for lines that changed since the report was sent. */
function ChangeNote({ row }: { row: WorkRow<WorkTask> }) {
  if (row.state === "added") {
    return <p className="mt-1 text-xs font-medium text-primary">Mới, sau lần gửi báo cáo</p>;
  }
  if (!row.reported || row.state === "same" || row.state === "live") return null;
  const was = row.reported;
  const now = row.live;
  const dueMoved = now && was.dueDate !== now.dueDate;
  return (
    <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 print:bg-transparent print:px-0">
      Lúc báo cáo: <b>{taskStateLabel(was)}</b>
      {dueMoved && was.dueDate && ` · hạn ${zonedText(was.dueDate, "short")}`}
      {now ? (
        <>
          {" "}
          → hiện tại: <b>{taskStateLabel(now)}</b>
          {dueMoved && ` · hạn ${now.dueDate ? zonedText(now.dueDate, "short") : "không có"}`}
          {row.state === "left" && " (không còn thuộc mục này)"}
        </>
      ) : (
        <> · công việc đã bị xoá</>
      )}
    </p>
  );
}

function Entries({ rows, openable, onOpen }: { rows: WorkRow<WorkEntry>[]; openable: Set<string>; onOpen: (id: string) => void }) {
  if (!rows.length) return null;
  const hours = Math.round(rows.reduce((a, r) => a + rowItem(r).hoursSpent, 0) * 10) / 10;
  return (
    <div className="border-t">
      <p className="flex items-center gap-1.5 px-5 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <MessageSquareWarning className="h-3.5 w-3.5" /> Báo cáo tiến độ đã gửi · {rows.length} báo cáo · {hours} giờ
      </p>
      {groupByProject(rows).map((g) => (
        <div key={g.project.id} className="px-5 py-2">
          <p className="flex items-center gap-2 text-xs font-semibold print:break-after-avoid">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: g.project.color }} />
            {g.project.name}
          </p>
          <ul className="mt-1.5 space-y-2 border-l pl-4">
            {g.rows.map((row) => {
              const e = rowItem(row);
              const canOpen = row.live !== null && openable.has(e.task.id);
              return (
                <li key={row.id} className="text-sm print:break-inside-avoid">
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">{zonedText(e.createdAt, "datetime")}</span>
                    {canOpen ? (
                      <button onClick={() => onOpen(e.task.id)} className="font-medium text-foreground hover:text-primary">
                        {e.task.title}
                      </button>
                    ) : (
                      <span className="font-medium text-foreground">{e.task.title}</span>
                    )}
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">{e.progress}%</span>
                    {e.hoursSpent > 0 && <span>{e.hoursSpent} giờ</span>}
                    {row.state === "gone" && <span className="text-danger">công việc đã bị xoá</span>}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap">{e.content}</p>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Projects({ rows, openable }: { rows: WorkRow<WorkProject>[]; openable: Set<string> }) {
  if (!rows.length) {
    return <p className="px-5 py-6 text-center text-sm text-muted-foreground">Không làm chủ hay quản lý dự án nào đang chạy.</p>;
  }
  return (
    <ul className="divide-y">
      {rows.map((row) => {
        const p = rowItem(row);
        const was = row.state === "changed" || row.state === "gone" ? row.reported : null;
        const name = (
          <span className="flex min-w-0 items-center gap-2 font-medium">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="truncate">{p.name}</span>
          </span>
        );
        return (
          <li key={row.id} className="grid gap-2 px-5 py-3 text-sm sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-4 print:break-inside-avoid">
            <div className="min-w-0">
              {openable.has(p.id) && row.live ? (
                <Link href={`/projects/${p.id}`} className="hover:text-primary">
                  {name}
                </Link>
              ) : (
                name
              )}
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                <span>{p.role === "OWNER" ? "Chủ dự án" : "Quản lý dự án"}</span>
                <span>
                  {p.doneTasks}/{p.totalTasks} việc xong
                </span>
                {p.overdueTasks > 0 && <span className="font-semibold text-danger">{p.overdueTasks} quá hạn</span>}
                {p.dueDate && (
                  <span>
                    Hạn {zonedText(p.dueDate)}
                    {p.scheduleStatus !== "DONE" && ` · ${daysLeftLabel(p.daysLeft)}`}
                  </span>
                )}
              </p>
              {was && (
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                  Lúc báo cáo: <b>{was.progress}%</b>
                  {row.live ? (
                    <>
                      {" "}
                      → hiện tại: <b>{row.live.progress}%</b>
                    </>
                  ) : (
                    " · không còn trong danh sách"
                  )}
                </p>
              )}
            </div>
            <PlanBar actual={p.progress} planned={p.planned} showLabel />
            <ScheduleBadge status={p.scheduleStatus} />
          </li>
        );
      })}
    </ul>
  );
}
