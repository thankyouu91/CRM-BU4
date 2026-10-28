"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, MessageSquareText } from "lucide-react";
import { PageHeader, Segmented } from "@/components/ui/misc";
import { Select } from "@/components/ui/input";
import { AttendanceCalendar, AttendanceLegend, KIND_TONE } from "@/components/attendance/attendance-calendar";
import { MarkModal } from "@/components/attendance/mark-modal";
import { LeaveBalanceCard } from "@/components/attendance/leave-balance-card";
import { TeamSheet } from "@/components/attendance/team-sheet";
import { useApi } from "@/lib/client";
import { formatDays, LEAVE_KINDS, LEAVE_KIND_KEYS, monthDays, monthLabel, SESSION_LABEL, shiftMonth, WEEKDAY_SHORT, weekdayOf, WORK_SCHEDULE_TEXT, type Session, type SessionCell } from "@/lib/attendance";
import type { AttendanceView as View } from "@/lib/attendance-queries";
import { cn } from "@/lib/utils";

type Tab = "calendar" | "team";

export function AttendanceView({ initial, initialTab }: { initial: View; initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [month, setMonth] = useState(initial.attendance.month);
  const [personId, setPersonId] = useState(initial.person.id);
  const { data, setData, loading, reload } = useApi<View>(`/api/attendance?user=${personId}&month=${month}`, { initial });
  const view = data && data.person.id === personId && data.attendance.month === month ? data : null;
  const shown = view ?? data ?? initial;
  const [picked, setPicked] = useState<{ day: string; session: Session } | null>(null);

  // The address bar follows the month, the person and the tab (shareable, survives reload).
  useEffect(() => {
    const sp = new URLSearchParams({ month });
    if (personId !== initial.people[0]?.id) sp.set("user", personId);
    if (tab === "team") sp.set("tab", "team");
    window.history.replaceState(null, "", `?${sp.toString()}`);
  }, [month, personId, tab, initial.people]);

  const isSelf = shown.person.id === initial.people[0]?.id;
  const { correct, requestFrom } = shown.rights;
  // Managers act on any session; people ask for leave on their own empty sessions only.
  const canPick = (day: string, cell: SessionCell) => correct || (requestFrom !== null && day >= requestFrom && cell.state !== "marked");
  const current = month === shown.today.slice(0, 7);
  const t = shown.attendance.totals;
  const teamTab = initial.people.length > 1 || initial.rights.canEditHolidays;
  const pickedCell = picked && shown.attendance.days.find((d) => d.day === picked.day)?.sessions.find((s) => s.session === picked.session);

  const summary = [
    { label: "Công chuẩn", value: t.standard, strong: false },
    { label: current ? "Đi làm (đến hôm nay)" : "Đi làm", value: t.worked, strong: false },
    ...LEAVE_KIND_KEYS.map((k) => ({ label: LEAVE_KINDS[k].label, value: t.leave[k], strong: false, kind: k })),
    { label: "Nghỉ lễ", value: t.holidays, strong: false },
    { label: "Công hưởng lương", value: t.paid, strong: true },
  ];

  return (
    <div>
      <PageHeader title="Chấm công" description={`${WORK_SCHEDULE_TEXT}. Mặc định đi làm đủ buổi; bấm vào buổi bận để xin nghỉ và ghi lý do. Buổi đã ghi chỉ quản lý sửa được.`} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {teamTab && (
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "calendar", label: "Lịch chấm công" },
              { value: "team", label: "Bảng công tháng" },
            ]}
          />
        )}
        <div className="flex items-center gap-1 rounded-md border bg-card p-0.5">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Tháng trước" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[112px] text-center text-sm font-semibold" aria-live="polite">
            {monthLabel(month)}
          </span>
          <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Tháng sau" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {!current && (
          <button type="button" onClick={() => setMonth(shown.today.slice(0, 7))} className="rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
            Tháng này
          </button>
        )}
        {tab === "calendar" && initial.people.length > 1 && (
          <Select value={personId} onChange={(e) => setPersonId(e.target.value)} className="ml-auto h-9 w-auto max-w-[260px]" aria-label="Nhân sự">
            {initial.people.map((p, i) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {i === 0 ? " (bạn)" : p.jobTitle ? ` · ${p.jobTitle}` : ""}
              </option>
            ))}
          </Select>
        )}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Đang tải" />}
      </div>

      {tab === "team" ? (
        <TeamSheet
          month={month}
          canEditHolidays={initial.rights.canEditHolidays}
          onOpen={(id) => {
            setPersonId(id);
            setTab("calendar");
          }}
        />
      ) : (
        <div className={cn("grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]", !view && "opacity-70 transition-opacity")}>
          <section className="min-w-0 rounded-2xl border bg-card p-3 sm:p-4" aria-label={`Lịch chấm công ${shown.person.name}`}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">{isSelf ? "Lịch của bạn" : shown.person.name}</h2>
              {shown.person.managerName && <span className="text-xs text-muted-foreground">· Quản lý trực tiếp: {shown.person.managerName}</span>}
              {!correct && requestFrom !== null && month < requestFrom.slice(0, 7) && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Tháng đã qua: chỉ quản lý ghi được</span>
              )}
              {!correct && requestFrom === null && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Chỉ xem</span>}
            </div>
            <AttendanceCalendar days={shown.attendance.days} today={shown.today} canPick={canPick} onPick={(day, session) => setPicked({ day, session })} />
            <div className="mt-3">
              <AttendanceLegend />
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border bg-card p-4" aria-labelledby="month-summary">
              <h2 id="month-summary" className="mb-3 text-sm font-semibold">
                Tổng công {monthLabel(month).toLowerCase()}
              </h2>
              <dl className="space-y-1.5 text-sm">
                {summary.map((r) => (
                  <div key={r.label} className={cn("flex items-center justify-between gap-2", r.strong && "border-t pt-1.5")}>
                    <dt className={cn("flex items-center gap-1.5", r.strong ? "font-semibold" : "text-muted-foreground")}>
                      {"kind" in r && r.kind && <span className={cn("h-2.5 w-2.5 rounded-sm ring-1 ring-inset", KIND_TONE[r.kind])} aria-hidden />}
                      {r.label}
                    </dt>
                    <dd className={cn("tabular-nums", r.strong ? "font-semibold" : r.value === 0 ? "text-muted-foreground/50" : "font-medium")}>{formatDays(r.value)}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <LeaveBalanceCard
              personId={shown.person.id}
              personName={shown.person.name}
              balance={shown.balance}
              month={month}
              canEdit={shown.rights.canEditBalance}
              onSaved={() => void reload()}
            />

            <section className="rounded-2xl border bg-card p-4" aria-labelledby="month-notes">
              <h2 id="month-notes" className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <MessageSquareText className="h-4 w-4 text-muted-foreground" aria-hidden /> Nghỉ & công tác trong tháng
              </h2>
              {shown.notes.length ? (
                <ul className="space-y-2 text-sm">
                  {shown.notes.map((n) => (
                    <li key={`${n.day}-${n.session}`} className="flex gap-2">
                      <span className={cn("mt-0.5 h-fit w-8 shrink-0 rounded px-1 text-center text-xs font-semibold ring-1 ring-inset", KIND_TONE[n.kind])}>{LEAVE_KINDS[n.kind].code}</span>
                      <span className="min-w-0">
                        <span className="block text-xs text-muted-foreground">
                          {WEEKDAY_SHORT[weekdayOf(n.day)]} {n.day.slice(8)}/{n.day.slice(5, 7)} · {SESSION_LABEL[n.session]}
                        </span>
                        <span className="block break-words">{n.note || LEAVE_KINDS[n.kind].label}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Không có buổi nghỉ nào: đi làm đủ.</p>
              )}
            </section>
          </aside>
        </div>
      )}

      {picked && pickedCell && (
        <MarkModal
          personId={shown.person.id}
          personName={shown.person.name}
          isSelf={isSelf}
          correct={correct}
          managerName={shown.person.managerName}
          day={picked.day}
          session={picked.session}
          cell={pickedCell}
          taken={shown.attendance.days.find((d) => d.day === picked.day)?.sessions.filter((s) => s.state === "marked").map((s) => s.session) ?? []}
          maxDay={monthDays(shiftMonth(month, 1)).at(-1)}
          onClose={() => setPicked(null)}
          onSaved={(next) => (next ? setData(next) : void reload())}
        />
      )}
    </div>
  );
}
