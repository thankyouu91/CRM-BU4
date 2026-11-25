// Daily checklist cá nhân (trang Tổng quan). Only its owner reads or changes it. A day shows
// what was open that day (unfinished items carry on to the next days) and what was ticked on it.

import { prisma } from "./prisma";
import { StatusError } from "./errors";
import { zonedDay } from "./work-report";
import { CHECKLIST_TEXT_MAX } from "./constants";

export { CHECKLIST_TEXT_MAX };
/** Open items per person: a list this long is no longer a checklist. */
export const CHECKLIST_OPEN_MAX = 100;

export interface ChecklistItemView {
  id: string;
  text: string;
  /** Day it was written; earlier than `day` means it carried over. */
  createdDay: string;
  doneDay: string | null;
}

export interface ChecklistDay {
  day: string;
  today: string;
  items: ChecklistItemView[];
}

const select = { id: true, text: true, createdDay: true, doneDay: true } as const;

/** The checklist as it stood on `day` (default today): open then, or ticked that day. */
export async function checklistOf(userId: string, day?: string | null, now = new Date()): Promise<ChecklistDay> {
  const today = zonedDay(now);
  const d = day && day <= today ? day : today;
  const items = await prisma.checklistItem.findMany({
    where: { userId, createdDay: { lte: d }, OR: [{ doneDay: null }, { doneDay: { gte: d } }] },
    orderBy: [{ createdDay: "asc" }, { createdAt: "asc" }],
    select,
  });
  // Ticked after that day: it was still open on it.
  return { day: d, today, items: items.map((i) => (i.doneDay && i.doneDay > d ? { ...i, doneDay: null } : i)) };
}

export async function addChecklistItem(userId: string, text: string, now = new Date()): Promise<ChecklistItemView> {
  const clean = text.trim().slice(0, CHECKLIST_TEXT_MAX);
  if (!clean) throw new StatusError("Nhập nội dung việc cần làm", 400);
  if ((await prisma.checklistItem.count({ where: { userId, doneDay: null } })) >= CHECKLIST_OPEN_MAX) {
    throw new StatusError(`Checklist đã có ${CHECKLIST_OPEN_MAX} việc chưa xong: hãy tích hoặc xoá bớt`, 400);
  }
  return prisma.checklistItem.create({ data: { userId, text: clean, createdDay: zonedDay(now) }, select });
}

/** Tick, untick or reword one's own item; someone else's is "not found". */
export async function updateChecklistItem(userId: string, id: string, patch: { done?: boolean; text?: string }, now = new Date()): Promise<ChecklistItemView> {
  const item = await prisma.checklistItem.findFirst({ where: { id, userId }, select: { id: true } });
  if (!item) throw new StatusError("Không tìm thấy việc này", 404);
  const text = patch.text?.trim().slice(0, CHECKLIST_TEXT_MAX);
  if (patch.text !== undefined && !text) throw new StatusError("Nội dung không được trống", 400);
  return prisma.checklistItem.update({
    where: { id },
    data: { ...(text ? { text } : {}), ...(patch.done === undefined ? {} : { doneDay: patch.done ? zonedDay(now) : null }) },
    select,
  });
}

export async function deleteChecklistItem(userId: string, id: string): Promise<void> {
  const { count } = await prisma.checklistItem.deleteMany({ where: { id, userId } });
  if (!count) throw new StatusError("Không tìm thấy việc này", 404);
}
