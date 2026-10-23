"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { api, ApiError, useApi } from "@/lib/client";
import { WEEKDAY_SHORT, weekdayOf, type HolidayInput } from "@/lib/attendance";

/** The company's public holidays of a year: not working days, "L" on the timesheet. */
export function HolidaysModal({ year, onClose, onChanged }: { year: number; onClose: () => void; onChanged: () => void }) {
  const list = useApi<{ year: number; holidays: HolidayInput[] }>(`/api/attendance/holidays?year=${year}`);
  const [day, setDay] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const change = async (run: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await run();
      toast.success(done);
      void list.reload();
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  };
  const add = () =>
    change(async () => {
      await api("/api/attendance/holidays", { method: "POST", body: { day, name } });
      setDay("");
      setName("");
    }, "Đã thêm ngày nghỉ lễ");

  return (
    <Modal open onClose={onClose} title={`Ngày nghỉ lễ ${year}`} description="Không tính là ngày làm việc; ghi L trên bảng công và tính vào công hưởng lương.">
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-end">
          <Field label="Ngày">
            <DateInput value={day} onChange={setDay} min={`${year}-01-01`} max={`${year}-12-31`} aria-label="Ngày nghỉ lễ" />
          </Field>
          <Field label="Tên">
            <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="VD: Quốc khánh, Tết Nguyên đán" />
          </Field>
          <Button onClick={add} disabled={busy || !day || name.trim().length < 2}>
            Thêm
          </Button>
        </div>
        {list.data?.holidays.length ? (
          <ul className="divide-y rounded-xl border">
            {list.data.holidays.map((h) => (
              <li key={h.day} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-24 tabular-nums">
                  {h.day.slice(8)}/{h.day.slice(5, 7)} · {WEEKDAY_SHORT[weekdayOf(h.day)]}
                </span>
                <span className="flex-1">{h.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Xoá ${h.name}`}
                  disabled={busy}
                  onClick={() => change(() => api(`/api/attendance/holidays?day=${h.day}`, { method: "DELETE" }), "Đã xoá ngày nghỉ lễ")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{list.data ? "Chưa có ngày nghỉ lễ nào trong năm." : "Đang tải…"}</p>
        )}
      </div>
    </Modal>
  );
}
