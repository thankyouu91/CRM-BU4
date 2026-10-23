// Who may change whose timesheet. Pure, so the API, the page and the tests share it.
//
//  - See: everyone signed in sees everyone's timesheet.
//  - Ask for leave: yourself, on sessions nothing is recorded for yet, from the first day
//    of the current month on. Once recorded, only a manager changes or clears it.
//  - Correct (record, change, clear any day): your direct manager, and whoever manages
//    your account (USER_MANAGE over lower levels, administrators).
//  - Change the annual leave numbers: the people whose accounts you manage (HR).
//  - Holidays: account managers (USER_MANAGE) and administrators.

import { canManageUser, hasPermission, type Actor } from "./permissions";
import { ownEditFrom } from "./attendance";

export type Viewer = Actor;

export interface Person {
  id: string;
  role: string;
  managerId?: string | null;
}

export const isDirectManager = (viewer: { id: string }, person: Person) => !!person.managerId && person.managerId === viewer.id;

/** Record, change or clear any day: account managers and direct managers. */
export function canCorrectAttendance(viewer: Viewer, person: Person): boolean {
  // canManageUser covers administrators (themselves included) and never a non-admin's own account.
  return canManageUser(viewer, person) || isDirectManager(viewer, person);
}

/** Record new leave on one's own empty sessions of `day` (not change what is there). */
export function canRequestLeave(viewer: Viewer, person: Person, day: string, today: string): boolean {
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
