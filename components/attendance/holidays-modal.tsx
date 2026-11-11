"use client";

import { useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
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
  const addStatutory = async () => {
    setBusy(true);
    try {
      const r = await api<{ added: number }>("/api/attendance/holidays", { method: "POST", body: { statutoryYear: year } });
      toast.success(r.added ? `Đã thêm ${r.added} ngày nghỉ lễ, Tết năm ${year}` : `Các ngày lễ, Tết năm ${year} đã có đủ`);
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
        <div className="rounded-xl border bg-muted/40 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto font-medium">Ngày lễ, Tết theo Bộ luật Lao động</p>
            <Button size="sm" variant="outline" onClick={addStatutory} disabled={busy}>
              <Sparkles className="h-4 w-4" /> Thêm ngày lễ, Tết {year}
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Tết Dương lịch, 5 ngày Tết Nguyên đán (cuối năm Âm lịch đến mùng 4), Giỗ Tổ Hùng Vương, 30/4, 1/5, Quốc khánh 2/9 và một ngày liền kề, cộng ngày nghỉ bù khi lễ trùng Chủ nhật. Ngày đã nhập được giữ nguyên.
            Chính phủ công bố lịch nghỉ Tết và 2/9 cụ thể mỗi năm: đối chiếu thông báo, xoá hoặc thêm ngày cho khớp.
          </p>
        </div>
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
