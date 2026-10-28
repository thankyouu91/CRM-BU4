"use client";

import { useState } from "react";
import { CalendarDays, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useApi } from "@/lib/client";
import { formatDays, LEAVE_KINDS, LEAVE_KIND_KEYS } from "@/lib/attendance";
import type { TeamAttendance } from "@/lib/attendance-queries";
import { cn } from "@/lib/utils";
import { HolidaysModal } from "./holidays-modal";

/**
 * The month of everyone the viewer may see: totals per person, the annual leave
 * left, and the Excel timesheet. Choosing a person opens their calendar.
 */
export function TeamSheet({ month, canEditHolidays, onOpen }: { month: string; canEditHolidays: boolean; onOpen: (personId: string) => void }) {
  const { data, loading, reload } = useApi<TeamAttendance>(`/api/attendance/team?month=${month}`);
  const team = data?.month === month ? data : null;
  const [exporting, setExporting] = useState(false);
  const [holidays, setHolidays] = useState(false);

  const exportExcel = async () => {
    if (!team) return;
    setExporting(true);
    try {
      const [{ exportAttendanceXlsx }, { fileSlug }] = await Promise.all([import("@/lib/export/attendance-xlsx"), import("@/lib/export/save")]);
      await exportAttendanceXlsx(team, `cham-cong-${fileSlug(team.label)}.xlsx`);
    } catch (e) {
      console.error(e);
      toast.error("Không xuất được file Excel");
    } finally {
      setExporting(false);
    }
  };

  const num = (n: number, strong = false) => <td className={cn("px-2 py-2.5 text-right tabular-nums", strong && "font-semibold", n === 0 && !strong && "text-muted-foreground/50")}>{formatDays(n)}</td>;

  return (
    <section className="rounded-2xl border bg-card" aria-label="Bảng công tháng">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <p className="mr-auto text-sm text-muted-foreground">
          {team ? `${team.people.length} người · ${team.label}` : "Đang tải…"}
          {loading && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
        </p>
        {canEditHolidays && (
          <Button size="sm" variant="outline" onClick={() => setHolidays(true)}>
            <CalendarDays className="h-4 w-4" /> Ngày nghỉ lễ
          </Button>
        )}
        <Button size="sm" onClick={exportExcel} disabled={!team || exporting} loading={exporting}>
          <FileSpreadsheet className="h-4 w-4" /> Xuất Excel
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Nhân sự</th>
              <th className="px-2 py-2.5 text-right font-medium">Công chuẩn</th>
              <th className="px-2 py-2.5 text-right font-medium">Đi làm</th>
              {LEAVE_KIND_KEYS.map((k) => (
                <th key={k} className="px-2 py-2.5 text-right font-medium" title={LEAVE_KINDS[k].label}>
                  {LEAVE_KINDS[k].short}
                </th>
              ))}
              <th className="px-2 py-2.5 text-right font-medium">Lễ</th>
              <th className="px-2 py-2.5 text-right font-medium">Hưởng lương</th>
              <th className="px-4 py-2.5 text-right font-medium">Phép còn lại</th>
            </tr>
          </thead>
          <tbody>
            {team?.people.map((p) => {
              const t = p.attendance.totals;
              return (
                <tr key={p.person.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <button type="button" onClick={() => onOpen(p.person.id)} className="flex items-center gap-2.5 text-left hover:underline">
                      <Avatar name={p.person.name} color={p.person.avatarColor} size="sm" />
                      <span className="min-w-0">
                        <span className="block font-medium">{p.person.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{p.person.jobTitle ?? (p.person.managerName ? `QL: ${p.person.managerName}` : "")}</span>
                      </span>
                    </button>
                  </td>
                  {num(t.standard)}
                  {num(t.worked)}
                  {LEAVE_KIND_KEYS.map((k) => (
                    <td key={k} className={cn("px-2 py-2.5 text-right tabular-nums", t.leave[k] === 0 && "text-muted-foreground/50")}>
                      {formatDays(t.leave[k])}
                    </td>
                  ))}
                  {num(t.holidays)}
                  {num(t.paid, true)}
                  <td className={cn("px-4 py-2.5 text-right font-semibold tabular-nums", p.balance.remaining < 0 ? "text-danger" : "text-primary")}>{formatDays(p.balance.remaining)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t px-4 py-2 text-xs text-muted-foreground">
        Đi làm tính đến hôm nay với tháng hiện tại. Phép còn lại = được hưởng + tồn năm trước − đã nghỉ từ đầu năm đến hết tháng. File Excel có thêm từng ngày (X, P, Ô…) và trang chi tiết lý do nghỉ.
      </p>
      {holidays && <HolidaysModal year={Number(month.slice(0, 4))} onClose={() => setHolidays(false)} onChanged={() => void reload()} />}
    </section>
  );
}
