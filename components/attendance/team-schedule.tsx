"use client";

import { dayCode, dayKind, LEAVE_KINDS, SESSION_LABEL, WEEKDAY_SHORT, type DayCell } from "@/lib/attendance";
import type { TeamAttendance } from "@/lib/attendance-queries";
import { cn } from "@/lib/utils";
import { HOLIDAY_TONE, KIND_TONE } from "./attendance-calendar";

/** What a day holds, in words, for the cell's tooltip and screen readers. */
function dayText(d: DayCell): string {
  const date = `${Number(d.day.slice(8))}/${Number(d.day.slice(5, 7))}`;
  if (!d.employed) return `${date}: ngoài thời gian làm việc`;
  if (d.holiday) return `${date}: nghỉ lễ ${d.holiday}`;
  const parts = d.sessions
    .filter((s) => s.state !== "off")
    .map((s) => `${SESSION_LABEL[s.session].toLowerCase()} ${s.state === "marked" ? LEAVE_KINDS[s.kind!].label.toLowerCase() + (s.note ? ` (${s.note})` : "") : s.state === "planned" ? "chưa tới" : "đi làm"}`);
  return parts.length ? `${date}: ${parts.join(", ")}` : `${date}: nghỉ`;
}

/**
 * Lịch làm việc của nhân sự: everyone's month day by day, with the timesheet's symbols and
 * colours (the web version of the Excel sheet). Choosing a name opens that person's calendar.
 */
export function TeamSchedule({ team, onOpen }: { team: TeamAttendance; onOpen: (personId: string) => void }) {
  const days = team.people[0]?.attendance.days ?? [];
  if (!days.length) return <p className="p-4 text-sm text-muted-foreground">Chưa có nhân sự nào trong tháng này.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
        <caption className="sr-only">Lịch làm việc của nhân sự {team.label}</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 border-b bg-card px-3 py-2 text-left font-medium text-muted-foreground">
              Nhân sự
            </th>
            {days.map((d) => (
              <th
                key={d.day}
                scope="col"
                className={cn(
                  "min-w-[2.1rem] border-b px-0.5 py-1 text-center font-medium tabular-nums",
                  d.weekday >= 6 ? "bg-orange-50 text-muted-foreground dark:bg-orange-500/10" : "text-muted-foreground",
                  d.day === team.today && "text-foreground",
                )}
              >
                <span className={cn("block", d.day === team.today && "mx-auto w-fit rounded bg-foreground px-1 text-background")}>{Number(d.day.slice(8))}</span>
                <span className="block font-normal">{WEEKDAY_SHORT[d.weekday]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {team.people.map((p) => (
            <tr key={p.person.id}>
              <th scope="row" className="sticky left-0 z-10 max-w-[180px] border-b bg-card px-3 py-1.5 text-left font-medium">
                <button type="button" onClick={() => onOpen(p.person.id)} className="block max-w-full truncate hover:underline" title={`Mở lịch của ${p.person.name}`}>
                  {p.person.name}
                </button>
              </th>
              {p.attendance.days.map((d) => {
                const kind = dayKind(d);
                const code = dayCode(d);
                const tone = !d.employed
                  ? "bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgb(var(--border))_4px_8px)]"
                  : d.holiday
                    ? HOLIDAY_TONE
                    : kind
                      ? KIND_TONE[kind]
                      : d.weekday >= 6
                        ? "bg-orange-50/60 dark:bg-orange-500/5"
                        : "";
                return (
                  <td key={d.day} className="border-b p-0.5" title={dayText(d)}>
                    <span className={cn("flex h-6 items-center justify-center rounded-[4px] font-semibold ring-inset", (kind || d.holiday) && "ring-1", tone)}>
                      <span aria-hidden>{code}</span>
                      <span className="sr-only">{dayText(d)}</span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
