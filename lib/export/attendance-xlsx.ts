// Monthly timesheet (bảng chấm công) as .xlsx: one row per person, one column per day
// with the company's symbols and colours (blank = đi làm, X nghỉ cả ngày, - nghỉ nửa
// ngày, blue = có phép, red = không phép, #/? đi trễ, KH, KK, ONL, CT, C, DL, L lễ),
// ngày công, ngày cơm and the other month totals, and
// the annual leave balance, and the "Ghi chú" list of symbols underneath; a second
// sheet lists every marked session with its note.
// Loaded on demand in the browser.

import { dayCode, dayKind, isLate, LEAVE_KINDS, LEAVE_KIND_KEYS, SESSION_LABEL, WEEKDAY_SHORT, WORK_SCHEDULE_TEXT, weekdayOf } from "@/lib/attendance";
import type { LeaveKind } from "@/lib/attendance";
import type { TeamAttendance } from "@/lib/attendance-queries";
import { ROLE_LABELS } from "@/lib/constants";

type Cell = Record<string, unknown> | null;
const FONT = "Arial";
const base = { fontFamily: FONT, fontSize: 10 };
const border = { borderColor: "#cbd5e1", borderStyle: "thin" as const };
const NAVY = "#1e3a8a";
// Saturday and Sunday columns, the name header: as on the company timesheet.
const WEEKEND = "#F8CBAD";
const NAME_HEAD = "#FFD966";
const HOLIDAY = "#fde68a";
// The fills of the company timesheet (TNS chấm công).
const KIND_FILL: Partial<Record<LeaveKind, string>> = {
  ANNUAL: "#00B0F0", UNPAID: "#FF0000", SICK: "#00B0F0", PERSONAL: "#FF0000",
  LATE_OK: "#FFFF00", LATE: "#FFCCCC", INVENTORY: "#CFE2F3", ONLINE: "#FF00FF", BUSINESS: "#B6D7A8", TRIP: "#C5E0B3",
};
/** Nửa ngày phép ("-") is orange; nửa ngày không phép stays red. */
const HALF_PAID = "#FFC000";
const fillOf = (k: LeaveKind, code: string) => (k === "ANNUAL" && code.startsWith("-") ? HALF_PAID : KIND_FILL[k]);
/** The "Ghi chú" list: every symbol with its colour, half days after their whole day. */
const NOTES: { code: string; label: string; fill?: string }[] = [
  { code: "", label: "Để trống: đi làm" },
  ...LEAVE_KIND_KEYS.flatMap((k) => {
    const d = LEAVE_KINDS[k];
    const rows: { code: string; label: string; fill?: string }[] = [{ code: d.code, label: d.label, fill: KIND_FILL[k] }];
    if ("half" in d) rows.push({ code: d.half, label: `${d.label} 1/2 ngày`, fill: fillOf(k, d.half) });
    return rows;
  }),
  { code: "L", label: "Nghỉ lễ", fill: HOLIDAY },
  { code: "-/CT", label: "Sáng / chiều khác nhau" },
];
const text = (v: string | null | undefined, extra: Record<string, unknown> = {}): Cell => ({ ...base, ...border, value: v ?? "", ...extra });
const num = (n: number, extra: Record<string, unknown> = {}): Cell => ({ ...base, ...border, value: n, type: Number, format: Number.isInteger(n) ? "0" : "0.0", align: "center", ...extra });
const headCell = (value: string, extra: Record<string, unknown> = {}): Cell => ({
  ...base, ...border, value, fontWeight: "bold", textColor: NAVY, backgroundColor: "#f1f5f9", align: "center", alignVertical: "center", wrap: true, ...extra,
});
const blank = (n: number): Cell[] => Array.from({ length: n }, () => null);
const dayText = (day: string) => `${day.slice(8)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

const totalsOf = (kinds: LeaveKind[]) => [
  { label: "Ngày công", width: 8 },
  { label: "Ngày cơm", width: 8 },
  { label: "Công chuẩn", width: 8 },
  ...kinds.map((k) => ({ label: `${LEAVE_KINDS[k].short} (${LEAVE_KINDS[k].code})${isLate(k) ? " · lần" : ""}`, width: 9 })),
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
  const kinds = LEAVE_KIND_KEYS.filter((k) => team.people.some((p) => p.attendance.totals.leave[k]));
  const TOTALS = totalsOf(kinds);
  const fixed = 3;
  const cols = fixed + days.length + TOTALS.length;
  const shade = (day: string) => (holidayOf.has(day) ? HOLIDAY : weekdayOf(day) >= 6 ? WEEKEND : undefined);

  const sheet: Cell[][] = [
    [{ ...base, value: `BẢNG CHẤM CÔNG ${team.label.toUpperCase()}`, fontWeight: "bold", fontSize: 14, textColor: NAVY, columnSpan: cols, height: 28 }, ...blank(cols - 1)],
    [{ ...base, value: `${WORK_SCHEDULE_TEXT}. Ngày công, ngày cơm tính đến hôm nay với tháng hiện tại.`, textColor: "#475569", columnSpan: cols }, ...blank(cols - 1)],
    [
      headCell("STT", { rowSpan: 2, backgroundColor: NAME_HEAD }),
      headCell("Họ và tên", { rowSpan: 2, backgroundColor: NAME_HEAD }),
      headCell("Chức danh", { rowSpan: 2, backgroundColor: NAME_HEAD }),
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
      ...p.attendance.days.map((d) => {
        const code = dayCode(d);
        const kind = dayKind(d);
        const fill = (kind && fillOf(kind, code)) || shade(d.day);
        return text(code, { align: "center", ...(fill ? { backgroundColor: fill } : {}) });
      }),
      num(t.worked, { fontWeight: "bold" }),
      num(t.meals, { fontWeight: "bold" }),
      num(t.standard),
      ...kinds.map((k) => num(t.leave[k])),
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
  // Ghi chú: the label across name and title, the symbol in its colour under the first day.
  sheet.push([], [null, { ...base, value: "Ghi chú:", fontWeight: "bold" }]);
  for (const n of NOTES) {
    sheet.push([null, { ...base, value: `_ ${n.label}`, columnSpan: 2 }, null, text(n.code, { align: "center", ...(n.fill ? { backgroundColor: n.fill } : {}) })]);
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
        stickyRowsCount: 4,
        stickyColumnsCount: 2,
      },
      { data: details as never, sheet: "Chi tiết nghỉ", columns: [6, 24, 12, 6, 8, 30, 8, 50].map((width) => ({ width })), stickyRowsCount: 1 },
    ],
  ).toFile(filename);
}
