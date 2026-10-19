import { TriangleAlert } from "lucide-react";
import { outsideWindows, type DateWindow } from "@/lib/date-window";

/** A warning under a task's dates when they leave its project's or category's (never blocks saving). */
export function DateWindowNotice({ start, due, windows }: { start: string | null | undefined; due: string | null | undefined; windows: DateWindow[] }) {
  const lines = outsideWindows(start, due, windows);
  if (!lines.length) return null;
  return (
    <div role="status" className="flex gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <div>
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
        <p className="mt-0.5 opacity-80">Vẫn lưu được; hãy kiểm tra lại ngày hoặc thời hạn của {windows.length > 1 ? "dự án / hạng mục" : windows[0].kind}.</p>
      </div>
    </div>
  );
}
