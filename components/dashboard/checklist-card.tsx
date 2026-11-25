"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ListTodo, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { api, ApiError, useApi } from "@/lib/client";
import { CHECKLIST_TEXT_MAX } from "@/lib/constants";
import type { ChecklistDay, ChecklistItemView } from "@/lib/checklist";
import { cn } from "@/lib/utils";

const shift = (day: string, by: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
};
const dayText = (day: string) => day.split("-").reverse().join("/");

/** Daily checklist cá nhân: one's own list for today; unfinished items carry on to the next day. */
export function ChecklistCard() {
  const [day, setDay] = useState<string | null>(null);
  const { data, setData, loading } = useApi<ChecklistDay>(`/api/checklist${day ? `?day=${day}` : ""}`);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const isToday = !!data && data.day === data.today;
  const done = data?.items.filter((i) => i.doneDay).length ?? 0;

  const put = (item: ChecklistItemView) => setData((d) => (d ? { ...d, items: d.items.map((i) => (i.id === item.id ? item : i)) } : d));

  const add = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const { item } = await api<{ item: ChecklistItemView }>("/api/checklist", { method: "POST", body: { text } });
      setData((d) => (d ? { ...d, items: [...d.items, item] } : d));
      setText("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thêm được");
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (item: ChecklistItemView) => {
    put({ ...item, doneDay: item.doneDay ? null : data!.today }); // optimistic
    try {
      put((await api<{ item: ChecklistItemView }>(`/api/checklist/${item.id}`, { method: "PATCH", body: { done: !item.doneDay } })).item);
    } catch (e) {
      put(item);
      toast.error(e instanceof ApiError ? e.message : "Không lưu được");
    }
  };
  const remove = async (item: ChecklistItemView) => {
    setData((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== item.id) } : d));
    try {
      await api(`/api/checklist/${item.id}`, { method: "DELETE" });
    } catch (e) {
      setData((d) => (d ? { ...d, items: [...d.items, item] } : d));
      toast.error(e instanceof ApiError ? e.message : "Không xoá được");
    }
  };

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <ListTodo className="h-4 w-4 text-muted-foreground" aria-hidden />
        <div className="mr-auto">
          <h2 className="text-sm font-semibold">Checklist của tôi</h2>
          <p className="text-xs text-muted-foreground">
            {data ? `${isToday ? "Hôm nay" : dayText(data.day)} · xong ${done}/${data.items.length}` : "Đang tải…"} · chỉ bạn xem được
          </p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Đang tải" />}
        <div className="flex items-center gap-0.5">
          <button type="button" aria-label="Ngày trước" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" onClick={() => data && setDay(shift(data.day, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" disabled={isToday} onClick={() => setDay(null)} className="rounded-md px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40">
            Hôm nay
          </button>
          <button type="button" aria-label="Ngày sau" disabled={isToday} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40" onClick={() => data && setDay(shift(data.day, 1))}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <ul className="max-h-80 divide-y overflow-y-auto" aria-label="Việc cần làm">
        {data?.items.map((i) => (
          <li key={i.id} className="group flex items-start gap-3 px-4 py-2">
            <input
              type="checkbox"
              checked={!!i.doneDay}
              disabled={!isToday}
              onChange={() => toggle(i)}
              aria-label={i.text}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--primary))]"
            />
            <span className={cn("min-w-0 flex-1 break-words text-sm", i.doneDay && "text-muted-foreground line-through")}>
              {i.text}
              {i.createdDay < data.day && !i.doneDay && <span className="ml-2 text-xs text-warning">từ {dayText(i.createdDay).slice(0, 5)}</span>}
            </span>
            {isToday && (
              <button type="button" onClick={() => remove(i)} aria-label={`Xoá ${i.text}`} className="rounded p-0.5 text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100 focus-visible:opacity-100">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
        {data && !data.items.length && <li className="px-4 py-6 text-center text-sm text-muted-foreground">{isToday ? "Chưa có việc nào cho hôm nay." : "Ngày này không có việc nào."}</li>}
      </ul>
      {isToday && (
        <form
          className="flex items-center gap-2 border-t px-4 py-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <input
            value={text}
            maxLength={CHECKLIST_TEXT_MAX}
            onChange={(e) => setText(e.target.value)}
            placeholder="Thêm việc cần làm hôm nay…"
            aria-label="Việc cần làm"
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <button type="submit" disabled={!text.trim() || busy} className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
            <Plus className="h-4 w-4" /> Thêm
          </button>
        </form>
      )}
    </Card>
  );
}
