// Who may see and change whose timesheet. Pure, so the API, the page and the tests share it.
//
//  - See: yourself, anyone below your level (as for weekly reports), and the people you
//    are the direct manager of.
//  - Change marks: yourself from the first day of the current month on (earlier months
//    are closed to you); any day for the people whose accounts you manage and for your
//    direct reports.
//  - Change the annual leave numbers: the people whose accounts you manage (HR).
//  - Holidays: account managers (USER_MANAGE) and administrators.

import { canManageUser, canViewWorkReport, hasPermission, type Actor } from "./permissions";
import { ownEditFrom } from "./attendance";

export type Viewer = Actor;

export interface Person {
  id: string;
  role: string;
  managerId?: string | null;
}

export const isDirectManager = (viewer: { id: string }, person: Person) => !!person.managerId && person.managerId === viewer.id;

export function canSeeAttendance(viewer: Viewer, person: Person): boolean {
  return canViewWorkReport(viewer, person) || isDirectManager(viewer, person);
}

/** Correct anyone's day: account managers and direct managers. */
export function canCorrectAttendance(viewer: Viewer, person: Person): boolean {
  // canManageUser covers administrators (themselves included) and never a non-admin's own account.
  return canManageUser(viewer, person) || isDirectManager(viewer, person);
}

export function canEditAttendanceDay(viewer: Viewer, person: Person, day: string, today: string): boolean {
  if (canCorrectAttendance(viewer, person)) return true;
  return viewer.id === person.id && day >= ownEditFrom(today);
}

export function canEditLeaveBalance(viewer: Viewer, person: Person): boolean {
  return canManageUser(viewer, person);
}

export function canEditHolidays(viewer: Viewer): boolean {
  return hasPermission(viewer, "USER_MANAGE");
}

/**
 * Whether making `managerId` the direct manager of `personId` would close a loop
 * (A manages B, B manages A, …), given everyone's current manager.
 */
export function managerLoop(personId: string, managerId: string, managerOf: ReadonlyMap<string, string | null>): boolean {
  const seen = new Set<string>();
  for (let at: string | null | undefined = managerId; at; at = managerOf.get(at)) {
    if (at === personId) return true;
    if (seen.has(at)) return false; // an older loop elsewhere; not this change's
    seen.add(at);
  }
  return false;
}
