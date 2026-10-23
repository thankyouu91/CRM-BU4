// Monthly timesheet (bảng chấm công) as .xlsx: one row per person, one column per day
// with the usual symbols (X đi làm, P phép năm, Ô ốm, R việc riêng, KL không lương,
// CT công tác, L lễ; "X/P" when morning and afternoon differ), the month totals and
// the annual leave balance; a second sheet lists every marked session with its note.
// Loaded on demand in the browser.

import { dayCode, LEAVE_KINDS, LEAVE_KIND_KEYS, SESSION_LABEL, WEEKDAY_SHORT, WORK_SCHEDULE_TEXT, weekdayOf } from "@/lib/attendance";
import type { TeamAttendance } from "@/lib/attendance-queries";
import { ROLE_LABELS } from "@/lib/constants";

type Cell = Record<string, unknown> | null;
const FONT = "Arial";
const base = { fontFamily: FONT, fontSize: 10 };
const border = { borderColor: "#cbd5e1", borderStyle: "thin" as const };
const NAVY = "#1e3a8a";
const OFF = "#e2e8f0";
const HOLIDAY = "#fde68a";
const text = (v: string | null | undefined, extra: Record<string, unknown> = {}): Cell => ({ ...base, ...border, value: v ?? "", ...extra });
const num = (n: number, extra: Record<string, unknown> = {}): Cell => ({ ...base, ...border, value: n, type: Number, format: Number.isInteger(n) ? "0" : "0.0", align: "center", ...extra });
const headCell = (value: string, extra: Record<string, unknown> = {}): Cell => ({
  ...base, ...border, value, fontWeight: "bold", textColor: NAVY, backgroundColor: "#f1f5f9", align: "center", alignVertical: "center", wrap: true, ...extra,
});
const blank = (n: number): Cell[] => Array.from({ length: n }, () => null);
const dayText = (day: string) => `${day.slice(8)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

const TOTALS = [
  { label: "Công chuẩn", width: 8 },
  { label: "Đi làm (X)", width: 8 },
  ...LEAVE_KIND_KEYS.map((k) => ({ label: `${LEAVE_KINDS[k].short} (${LEAVE_KINDS[k].code})`, width: 9 })),
  { label: "Lễ (L)", width: 7 },
  { label: "Công hưởng lương", width: 10 },
  { label: "Phép năm được hưởng", width: 10 },
  { label: "Tồn năm trước", width: 9 },
  { label: "Phép đã nghỉ (từ đầu năm)", width: 11 },
  { label: "Phép còn lại", width: 9 },
];

export async function exportAttendanceXlsx(team: TeamAttendance, filename: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const days = team.people[0]?.attendance.days.map((d) => d.day) ?? [];
  const holidayOf = new Map(team.holidays.map((h) => [h.day, h.name]));
  const fixed = 3;
  const cols = fixed + days.length + TOTALS.length;
  const shade = (day: string) => (holidayOf.has(day) ? HOLIDAY : weekdayOf(day) === 7 ? OFF : undefined);

  const legend = [
    "X: đi làm",
    ...LEAVE_KIND_KEYS.map((k) => `${LEAVE_KINDS[k].code}: ${LEAVE_KINDS[k].label.toLowerCase()}`),
    "L: nghỉ lễ",
    "X/P: sáng / chiều khác nhau",
  ].join(" · ");
  const sheet: Cell[][] = [
    [{ ...base, value: `BẢNG CHẤM CÔNG ${team.label.toUpperCase()}`, fontWeight: "bold", fontSize: 14, textColor: NAVY, columnSpan: cols, height: 28 }, ...blank(cols - 1)],
    [{ ...base, value: `${WORK_SCHEDULE_TEXT}. Ngày làm việc chưa tới để trống.`, textColor: "#475569", columnSpan: cols }, ...blank(cols - 1)],
    [{ ...base, value: legend, textColor: "#475569", columnSpan: cols, wrap: true, height: 28 }, ...blank(cols - 1)],
    [
      headCell("STT", { rowSpan: 2 }),
      headCell("Họ và tên", { rowSpan: 2 }),
      headCell("Chức danh", { rowSpan: 2 }),
      ...days.map((d) => headCell(String(Number(d.slice(8))), shade(d) ? { backgroundColor: shade(d) } : {})),
      ...TOTALS.map((t) => headCell(t.label, { rowSpan: 2, height: 48 })),
    ],
    [...blank(fixed), ...days.map((d) => headCell(WEEKDAY_SHORT[weekdayOf(d)], { fontWeight: "normal", ...(shade(d) ? { backgroundColor: shade(d) } : {}) })), ...blank(TOTALS.length)],
  ];

  team.people.forEach((p, i) => {
    const t = p.attendance.totals;
    sheet.push([
      num(i + 1),
      text(p.person.name, { fontWeight: "bold" }),
      text(p.person.jobTitle ?? ROLE_LABELS[p.person.role] ?? p.person.role),
      ...p.attendance.days.map((d) => text(dayCode(d), { align: "center", ...(shade(d.day) ? { backgroundColor: shade(d.day) } : {}) })),
      num(t.standard),
      num(t.worked),
      ...LEAVE_KIND_KEYS.map((k) => num(t.leave[k])),
      num(t.holidays),
      num(t.paid, { fontWeight: "bold" }),
      num(p.balance.entitlement),
      num(p.balance.carriedOver),
      num(p.balance.used),
      num(p.balance.remaining, { fontWeight: "bold", textColor: p.balance.remaining < 0 ? "#b91c1c" : NAVY }),
    ]);
  });
  if (team.holidays.length) {
    sheet.push([], [{ ...base, value: `Ngày nghỉ lễ trong tháng: ${team.holidays.map((h) => `${dayText(h.day)} ${h.name}`).join("; ")}`, textColor: "#475569", columnSpan: cols }, ...blank(cols - 1)]);
  }

  const details: Cell[][] = [
    ["STT", "Họ và tên", "Ngày", "Thứ", "Buổi", "Loại", "Ký hiệu", "Ghi chú / lý do"].map((h) => headCell(h)),
  ];
  let n = 0;
  for (const p of team.people) {
    for (const m of p.notes) {
      details.push([
        num(++n),
        text(p.person.name),
        text(dayText(m.day), { align: "center" }),
        text(WEEKDAY_SHORT[weekdayOf(m.day)], { align: "center" }),
        text(SESSION_LABEL[m.session], { align: "center" }),
        text(LEAVE_KINDS[m.kind].label),
        text(LEAVE_KINDS[m.kind].code, { align: "center" }),
        text(m.note, { wrap: true }),
      ]);
    }
  }
  if (n === 0) details.push([{ ...base, value: "Không có buổi nghỉ hay công tác nào trong tháng.", textColor: "#64748b", columnSpan: 8 }, ...blank(7)]);

  await writeXlsxFile(
    [
      {
        data: sheet as never,
        sheet: "Bảng chấm công",
        columns: [{ width: 5 }, { width: 24 }, { width: 18 }, ...days.map(() => ({ width: 4.6 })), ...TOTALS.map((t) => ({ width: t.width }))],
        stickyRowsCount: 5,
        stickyColumnsCount: 2,
      },
      { data: details as never, sheet: "Chi tiết nghỉ", columns: [6, 24, 12, 6, 8, 30, 8, 50].map((width) => ({ width })), stickyRowsCount: 1 },
    ],
  ).toFile(filename);
}
