"use client";

import { MessageSquareText } from "lucide-react";
import { LEAVE_KINDS, SESSION_LABEL, WEEKDAY_SHORT, type DayCell, type LeaveKind, type Session, type SessionCell } from "@/lib/attendance";
import { cn } from "@/lib/utils";

const SKY = "bg-sky-100 text-sky-800 ring-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30";
const RED = "bg-red-100 text-red-800 ring-red-300 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30";
const PLAIN = "bg-slate-50 text-slate-700 ring-slate-300 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30";
/**
 * Colour of each kind of session, shared by the calendar, the legend and the summary;
 * the company timesheet's colours (blue = có phép, red = không phép), so X and C read right.
 */
export const KIND_TONE: Record<LeaveKind, string> = {
  ANNUAL: SKY,
  UNPAID: RED,
  LATE_OK: "bg-yellow-100 text-yellow-900 ring-yellow-300 dark:bg-yellow-500/15 dark:text-yellow-300 dark:ring-yellow-500/30",
  LATE: "bg-pink-100 text-pink-800 ring-pink-300 dark:bg-pink-500/15 dark:text-pink-300 dark:ring-pink-500/30",
  CUSTOMER: PLAIN,
  INVENTORY: "bg-blue-100 text-blue-800 ring-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30",
  ONLINE: "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-300 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:ring-fuchsia-500/30",
  BUSINESS: "bg-green-100 text-green-800 ring-green-300 dark:bg-green-500/15 dark:text-green-300 dark:ring-green-500/30",
  SICK: SKY,
  PERSONAL: RED,
  TRIP: "bg-lime-100 text-lime-800 ring-lime-300 dark:bg-lime-500/15 dark:text-lime-300 dark:ring-lime-500/30",
};
// A worked session is the normal case, so it stays neutral: only exceptions carry a colour.
const WORK_TONE = "bg-muted/70 text-foreground/70 ring-transparent";
const PLANNED_TONE = "bg-card text-muted-foreground ring-border border-dashed";
const HOLIDAY_TONE = "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/30";

function sessionText(c: SessionCell): { short: string; long: string } {
  if (c.state === "marked") return { short: LEAVE_KINDS[c.kind!].code, long: LEAVE_KINDS[c.kind!].short };
  if (c.state === "holiday") return { short: "L", long: "Nghỉ lễ" };
  return { short: "✓", long: "Đi làm" };
}

function SessionButton({ day, cell, editable, onPick }: { day: DayCell; cell: SessionCell; editable: boolean; onPick: (day: string, session: Session) => void }) {
  const t = sessionText(cell);
  const tone = cell.state === "marked" ? KIND_TONE[cell.kind!] : cell.state === "holiday" ? HOLIDAY_TONE : cell.state === "planned" ? PLANNED_TONE : WORK_TONE;
  const label = `${SESSION_LABEL[cell.session]} ${Number(day.day.slice(8))}/${Number(day.day.slice(5, 7))}: ${cell.state === "marked" ? LEAVE_KINDS[cell.kind!].label : t.long}${cell.note ? ` · ${cell.note}` : ""}`;
  const clickable = editable && cell.state !== "holiday";
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => onPick(day.day, cell.session)}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-7 w-full min-w-0 items-center gap-1 rounded-[5px] px-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
        tone,
        clickable ? "cursor-pointer hover:ring-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40" : "cursor-default",
      )}
    >
      <span className="hidden shrink-0 opacity-60 sm:inline">{cell.session === "AM" ? "S" : "C"}</span>
      <span className="sm:hidden">{t.short}</span>
      <span className="hidden truncate sm:inline">{t.long}</span>
      {cell.note && <MessageSquareText className="ml-auto hidden h-3 w-3 shrink-0 sm:block" aria-hidden />}
    </button>
  );
}

/**
 * The month, Monday first; each working day split into morning and afternoon (Saturday:
 * morning). Worked is the default; a coloured session carries a mark (leave, late, trip…).
 */
export function AttendanceCalendar({
  days,
  today,
  canPick,
  onPick,
}: {
  days: DayCell[];
  today: string;
  /** Whether the viewer may act on this session (record, or change what is there). */
  canPick: (day: string, cell: SessionCell) => boolean;
  onPick: (day: string, session: Session) => void;
}) {
  const lead = (days[0]?.weekday ?? 1) - 1;
  return (
    <div role="grid" aria-label="Lịch chấm công" className="overflow-hidden">
      <div role="row" className="grid grid-cols-7 gap-1 pb-1.5">
        {WEEKDAY_SHORT.slice(1).map((w) => (
          <div key={w} role="columnheader" className={cn("text-center text-xs font-medium text-muted-foreground", w === "CN" && "text-muted-foreground/60")}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} aria-hidden />
        ))}
        {days.map((d) => {
          const working = d.sessions.filter((s) => s.state !== "off");
          return (
            <div
              key={d.day}
              role="gridcell"
              className={cn(
                "min-w-0 rounded-md border p-1 sm:p-1.5",
                d.weekday === 7 ? "bg-muted/40" : "bg-card",
                d.day === today && "border-foreground/60",
              )}
            >
              <div className="mb-1 flex min-w-0 items-baseline gap-1">
                <span className={cn("text-xs font-semibold tabular-nums", d.day === today ? "rounded bg-foreground px-1 text-background" : d.weekday === 7 ? "text-muted-foreground" : "")}>{Number(d.day.slice(8))}</span>
                {d.holiday && <span className="hidden truncate text-xs font-medium text-orange-700 dark:text-orange-300 sm:inline" title={d.holiday}>{d.holiday}</span>}
              </div>
              {!working.length ? (
                <p className="py-2 text-center text-xs text-muted-foreground sm:py-3">Nghỉ</p>
              ) : (
                <div className="space-y-1">
                  {working.map((s) => (
                    <SessionButton key={s.session} day={d} cell={s} editable={canPick(d.day, s)} onPick={onPick} />
                  ))}
                  {working.length === 1 && <p className="flex h-7 items-center justify-center text-xs text-muted-foreground">Nghỉ chiều</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AttendanceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
      <span className={cn("rounded px-1.5 py-0.5 ring-1 ring-inset", WORK_TONE)}>✓ Đi làm</span>
      {(Object.keys(LEAVE_KINDS) as LeaveKind[]).map((k) => (
        <span key={k} className={cn("rounded px-1.5 py-0.5 ring-1 ring-inset", KIND_TONE[k])}>
          {LEAVE_KINDS[k].code} {LEAVE_KINDS[k].short}
        </span>
      ))}
      <span className={cn("rounded px-1.5 py-0.5 ring-1 ring-inset", HOLIDAY_TONE)}>L Lễ</span>
      <span className={cn("rounded border border-dashed px-1.5 py-0.5")}>Ngày chưa tới</span>
    </div>
  );
}
