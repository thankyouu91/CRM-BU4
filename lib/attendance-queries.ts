// Chấm công: reading and writing timesheets with the rights of lib/attendance-access.ts.

import { prisma } from "./prisma";
import { audit } from "./audit";
import { notify } from "./notifications";
import { StatusError } from "./errors";
import { zonedDay } from "./work-report";
import type { CurrentUser } from "./session";
import {
  annualLeaveUsed,
  buildAttendanceMonth,
  LEAVE_KINDS,
  leaveBalance,
  markableReason,
  monthDays,
  monthLabel,
  ownEditFrom,
  scheduledSessions,
  SESSION_LABEL,
  type AttendanceMonth,
  type HolidayInput,
  type LeaveBalanceView,
  type LeaveKind,
  type Session,
} from "./attendance";
import { canCorrectAttendance, canEditAttendanceDay, canEditHolidays, canEditLeaveBalance, canSeeAttendance } from "./attendance-access";

const personSelect = { id: true, name: true, role: true, jobTitle: true, avatarColor: true, managerId: true, active: true, manager: { select: { name: true } } } as const;

export interface AttendancePerson {
  id: string;
  name: string;
  role: string;
  jobTitle: string | null;
  avatarColor: string;
  managerName: string | null;
}

export interface AttendanceNote {
  day: string;
  session: Session;
  kind: LeaveKind;
  note: string | null;
}

export interface PersonAttendance {
  person: AttendancePerson;
  attendance: AttendanceMonth;
  balance: LeaveBalanceView;
  /** Marked sessions of the month, for the notes list and the Excel sheet. */
  notes: AttendanceNote[];
}

export interface AttendanceView extends PersonAttendance {
  today: string;
  holidays: HolidayInput[];
  rights: {
    /** Earliest day the viewer may change ("" = any day; null = none). */
    editFrom: string | null;
    canEditBalance: boolean;
    canEditHolidays: boolean;
  };
  /** People the viewer may open (themselves first). */
  people: AttendancePerson[];
}

type PersonRow = { id: string; name: string; role: string; jobTitle: string | null; avatarColor: string; managerId: string | null; active: boolean; manager: { name: string } | null };

const toPerson = (u: PersonRow): AttendancePerson => ({ id: u.id, name: u.name, role: u.role, jobTitle: u.jobTitle, avatarColor: u.avatarColor, managerName: u.manager?.name ?? null });

const monthEnd = (month: string) => monthDays(month).at(-1)!;

const holidaysIn = (from: string, to: string) => prisma.holiday.findMany({ where: { day: { gte: from, lte: to } }, orderBy: { day: "asc" }, select: { day: true, name: true } });

/** Everyone the viewer may see, themselves first, then by name. */
async function visiblePeople(viewer: CurrentUser): Promise<PersonRow[]> {
  const users = await prisma.user.findMany({ where: { active: true }, select: personSelect });
  return users
    .filter((u) => u.id === viewer.id || canSeeAttendance(viewer, u))
    .sort((a, b) => (a.id === viewer.id ? -1 : b.id === viewer.id ? 1 : a.name.localeCompare(b.name, "vi")));
}

function assemble(person: PersonRow, month: string, today: string, yearMarks: AttendanceNote[], yearHolidays: HolidayInput[], balanceRow: { entitlement: number; carriedOver: number; note: string | null } | null): PersonAttendance {
  const monthMarks = yearMarks.filter((m) => m.day.startsWith(month));
  const holidays = yearHolidays.filter((h) => h.day.startsWith(month));
  const attendance = buildAttendanceMonth({ month, marks: monthMarks, holidays, today });
  const used = annualLeaveUsed(yearMarks, yearHolidays, monthEnd(month));
  return {
    person: toPerson(person),
    attendance,
    balance: leaveBalance(Number(month.slice(0, 4)), balanceRow, used),
    notes: monthMarks.filter((m) => !holidays.some((h) => h.day === m.day) && (scheduledSessions(m.day) as string[]).includes(m.session)),
  };
}

const marksOf = async (userIds: string[], month: string) => {
  const rows = await prisma.attendanceMark.findMany({
    where: { userId: { in: userIds }, day: { gte: `${month.slice(0, 4)}-01-01`, lte: monthEnd(month) } },
    orderBy: [{ day: "asc" }, { session: "asc" }],
    select: { userId: true, day: true, session: true, kind: true, note: true },
  });
  const byUser = new Map<string, AttendanceNote[]>();
  for (const r of rows) {
    if (!(r.kind in LEAVE_KINDS)) continue;
    byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), { day: r.day, session: r.session as Session, kind: r.kind as LeaveKind, note: r.note }]);
  }
  return byUser;
};

/** One person's month with what the viewer may do; null when unknown, "forbidden" when not theirs to see. */
export async function attendanceView(viewer: CurrentUser, personId: string, month: string, now = new Date()): Promise<AttendanceView | "forbidden" | null> {
  const [person, people] = await Promise.all([prisma.user.findUnique({ where: { id: personId }, select: personSelect }), visiblePeople(viewer)]);
  if (!person) return null;
  if (person.id !== viewer.id && !canSeeAttendance(viewer, person)) return "forbidden";
  const today = zonedDay(now);
  const year = Number(month.slice(0, 4));
  const [marks, yearHolidays, balanceRow] = await Promise.all([
    marksOf([person.id], month),
    holidaysIn(`${year}-01-01`, `${year}-12-31`),
    prisma.leaveBalance.findUnique({ where: { userId_year: { userId: person.id, year } }, select: { entitlement: true, carriedOver: true, note: true } }),
  ]);
  const view = assemble(person, month, today, marks.get(person.id) ?? [], yearHolidays, balanceRow);
  const editFrom = canCorrectAttendance(viewer, person) ? "" : person.id === viewer.id ? ownEditFrom(today) : null;
  return {
    ...view,
    today,
    holidays: yearHolidays.filter((h) => h.day.startsWith(month)),
    rights: { editFrom, canEditBalance: canEditLeaveBalance(viewer, person), canEditHolidays: canEditHolidays(viewer) },
    people: people.map(toPerson),
  };
}

export interface TeamAttendance {
  month: string;
  label: string;
  today: string;
  holidays: HolidayInput[];
  people: PersonAttendance[];
}

/** The month of everyone the viewer may see (the timesheet and its Excel file). */
export async function teamAttendance(viewer: CurrentUser, month: string, now = new Date()): Promise<TeamAttendance> {
  const today = zonedDay(now);
  const year = Number(month.slice(0, 4));
  const people = await visiblePeople(viewer);
  const ids = people.map((p) => p.id);
  const [marks, yearHolidays, balances] = await Promise.all([
    marksOf(ids, month),
    holidaysIn(`${year}-01-01`, `${year}-12-31`),
    prisma.leaveBalance.findMany({ where: { userId: { in: ids }, year }, select: { userId: true, entitlement: true, carriedOver: true, note: true } }),
  ]);
  const balanceOf = new Map(balances.map((b) => [b.userId, b]));
  return {
    month,
    label: monthLabel(month),
    today,
    holidays: yearHolidays.filter((h) => h.day.startsWith(month)),
    people: people.map((p) => assemble(p, month, today, marks.get(p.id) ?? [], yearHolidays, balanceOf.get(p.id) ?? null)),
  };
}

const refuse = (message: string, status: 400 | 403 | 404 = 400) => new StatusError(message, status);

const dayText = (day: string) => `${day.slice(8)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

/** The sessions a request covers: chosen sessions of one day, or every working session of a range. */
export function slotsOf(input: { from: string; to?: string | null; sessions?: Session[] | null }): { day: string; session: Session }[] {
  if (input.to && input.to > input.from) {
    const out: { day: string; session: Session }[] = [];
    for (let d = new Date(`${input.from}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
      const day = d.toISOString().slice(0, 10);
      if (day > input.to) break;
      for (const session of scheduledSessions(day)) out.push({ day, session });
    }
    return out;
  }
  // A day with no working session still yields one, so the caller can say why (Sunday…).
  const sessions = input.sessions?.length ? input.sessions : scheduledSessions(input.from).length ? scheduledSessions(input.from) : (["AM"] as Session[]);
  return sessions.map((session) => ({ day: input.from, session }));
}

/**
 * Mark sessions (kind) or put them back to worked (kind null). For a range, Sundays,
 * Saturday afternoons and holidays are skipped. Tells the direct manager when people
 * mark their own leave.
 */
export async function setAttendance(
  viewer: CurrentUser,
  input: { userId: string; from: string; to?: string | null; sessions?: Session[] | null; kind: LeaveKind | null; note?: string | null },
  now = new Date(),
): Promise<{ changed: number }> {
  const person = await prisma.user.findUnique({ where: { id: input.userId }, select: personSelect });
  if (!person || !person.active) throw refuse("Không tìm thấy nhân sự", 404);
  if (person.id !== viewer.id && !canSeeAttendance(viewer, person)) throw refuse("Không tìm thấy nhân sự", 404);
  const today = zonedDay(now);
  const to = input.to && input.to > input.from ? input.to : null;
  const holidays = await holidaysIn(input.from, to ?? input.from);
  let slots = slotsOf({ ...input, to });
  if (to) slots = slots.filter((s) => !holidays.some((h) => h.day === s.day));
  if (!slots.length) throw refuse("Khoảng ngày này không có buổi làm việc nào");
  for (const s of slots) {
    const reason = markableReason(s.day, s.session, holidays);
    if (reason) throw refuse(reason);
    if (!canEditAttendanceDay(viewer, person, s.day, today)) {
      throw refuse(person.id === viewer.id ? "Tháng đã qua chỉ quản lý mới sửa được" : "Bạn không có quyền sửa chấm công của người này", 403);
    }
  }
  const note = input.note?.trim() || null;
  await prisma.$transaction(
    slots.map((s) =>
      input.kind
        ? prisma.attendanceMark.upsert({
            where: { userId_day_session: { userId: person.id, day: s.day, session: s.session } },
            create: { userId: person.id, day: s.day, session: s.session, kind: input.kind, note, createdById: viewer.id },
            update: { kind: input.kind, note, createdById: viewer.id },
          })
        : prisma.attendanceMark.deleteMany({ where: { userId: person.id, day: s.day, session: s.session } }),
    ),
  );

  const first = slots[0];
  const last = slots.at(-1)!;
  const when =
    first.day === last.day
      ? `${slots.length === 2 ? "cả ngày" : SESSION_LABEL[first.session].toLowerCase()} ${dayText(first.day)}`
      : `${dayText(first.day)} – ${dayText(last.day)} (${slots.length / 2} ngày công)`;
  const what = input.kind ? LEAVE_KINDS[input.kind].label.toLowerCase() : "đi làm bình thường";
  const whose = person.id === viewer.id ? "" : ` cho ${person.name}`;
  await audit(
    { id: viewer.id, name: viewer.name },
    {
      action: "attendance.mark",
      entityType: "user",
      entityId: person.id,
      summary: `Ghi ${what} ${when}${whose}`,
      details: { from: first.day, to: last.day, sessions: slots.length, kind: input.kind, note },
    },
  );
  if (input.kind && !LEAVE_KINDS[input.kind].worked && person.id === viewer.id && person.managerId) {
    await notify(viewer, [
      {
        userId: person.managerId,
        type: "attendance.leave",
        title: `${person.name} xin ${LEAVE_KINDS[input.kind].label.toLowerCase()} ${when}`,
        body: note,
        link: `/attendance?user=${person.id}&month=${first.day.slice(0, 7)}`,
      },
    ]);
  }
  return { changed: slots.length };
}

export async function setLeaveBalance(viewer: CurrentUser, input: { userId: string; year: number; entitlement: number; carriedOver: number; note?: string | null }): Promise<void> {
  const person = await prisma.user.findUnique({ where: { id: input.userId }, select: personSelect });
  if (!person) throw refuse("Không tìm thấy nhân sự", 404);
  if (!canEditLeaveBalance(viewer, person)) throw refuse("Chỉ người quản lý tài khoản này mới sửa được số phép năm", 403);
  const before = await prisma.leaveBalance.findUnique({ where: { userId_year: { userId: person.id, year: input.year } } });
  const note = input.note?.trim() || null;
  await prisma.leaveBalance.upsert({
    where: { userId_year: { userId: person.id, year: input.year } },
    create: { userId: person.id, year: input.year, entitlement: input.entitlement, carriedOver: input.carriedOver, note, updatedById: viewer.id },
    update: { entitlement: input.entitlement, carriedOver: input.carriedOver, note, updatedById: viewer.id },
  });
  const was = before ? `${before.entitlement} + ${before.carriedOver}` : "mặc định";
  await audit(
    { id: viewer.id, name: viewer.name },
    {
      action: "leave_balance.update",
      entityType: "user",
      entityId: person.id,
      summary: `Sửa phép năm ${input.year} của ${person.name}: được hưởng ${input.entitlement}, tồn năm trước ${input.carriedOver} (trước: ${was})`,
      details: { year: input.year, entitlement: input.entitlement, carriedOver: input.carriedOver, before: before ? { entitlement: before.entitlement, carriedOver: before.carriedOver } : null, note },
    },
  );
}

export async function addHoliday(viewer: CurrentUser, input: { day: string; name: string }): Promise<void> {
  if (!canEditHolidays(viewer)) throw refuse("Chỉ người quản lý nhân sự mới sửa được ngày lễ", 403);
  const name = input.name.trim();
  await prisma.holiday.upsert({ where: { day: input.day }, create: { day: input.day, name }, update: { name } });
  await audit({ id: viewer.id, name: viewer.name }, { action: "holiday.create", entityType: "holiday", entityId: input.day, summary: `Thêm ngày nghỉ lễ ${dayText(input.day)}: ${name}` });
}

export async function removeHoliday(viewer: CurrentUser, day: string): Promise<boolean> {
  if (!canEditHolidays(viewer)) throw refuse("Chỉ người quản lý nhân sự mới sửa được ngày lễ", 403);
  const row = await prisma.holiday.findUnique({ where: { day } });
  if (!row) return false;
  await prisma.holiday.delete({ where: { day } });
  await audit({ id: viewer.id, name: viewer.name }, { action: "holiday.delete", entityType: "holiday", entityId: day, summary: `Xoá ngày nghỉ lễ ${dayText(day)}: ${row.name}` });
  return true;
}
