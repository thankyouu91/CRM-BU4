// Conversions between <input type="date"> values (local yyyy-mm-dd) and ISO strings.

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO/Date -> local "yyyy-mm-dd" for a date input ("" when empty). */
export function toInputDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Local "yyyy-mm-dd" -> ISO, built in the browser's timezone so a due date means
 * the end of that day where the user is (start dates use the start of the day).
 */
export function fromInputDate(value: string, edge: "start" | "end" = "start"): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = edge === "end" ? new Date(y, m - 1, d, 23, 59, 59) : new Date(y, m - 1, d, 0, 0, 0);
  return date.toISOString();
}

export function isOverdue(dueDate: string | null | undefined, status: string): boolean {
  return !!dueDate && status !== "DONE" && new Date(dueDate).getTime() < Date.now();
}
