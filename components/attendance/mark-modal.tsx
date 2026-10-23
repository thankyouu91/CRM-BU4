"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { api, ApiError } from "@/lib/client";
import { LEAVE_KINDS, LEAVE_KIND_KEYS, scheduledSessions, SESSION_LABEL, WEEKDAY_SHORT, weekdayOf, type LeaveKind, type Session, type SessionCell } from "@/lib/attendance";
import type { AttendanceView } from "@/lib/attendance-queries";
import { cn } from "@/lib/utils";
import { KIND_TONE } from "./attendance-calendar";

type Scope = Session | "DAY" | "RANGE";

const dayText = (day: string) => `${WEEKDAY_SHORT[weekdayOf(day)] === "CN" ? "Chủ nhật" : `Thứ ${weekdayOf(day) + 1}`}, ${day.slice(8)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

/** Mark a session (or a day, or several days) as leave or a business trip, with the reason. */
export function MarkModal({
  personId,
  personName,
  isSelf,
  day,
  session,
  cell,
  maxDay,
  onClose,
  onSaved,
}: {
  personId: string;
  personName: string;
  isSelf: boolean;
  day: string;
  session: Session;
  /** What the session holds now. */
  cell: SessionCell;
  maxDay?: string;
  onClose: () => void;
  onSaved: (view: AttendanceView | null) => void;
}) {
  const saturday = scheduledSessions(day).length === 1;
  const [scope, setScope] = useState<Scope>(session);
  const [to, setTo] = useState(day);
  const [kind, setKind] = useState<LeaveKind>(cell.kind ?? "ANNUAL");
  const [note, setNote] = useState(cell.note ?? "");
  const [busy, setBusy] = useState(false);

  const send = async (k: LeaveKind | null) => {
    setBusy(true);
    try {
      const body = {
        userId: personId,
        from: day,
        to: scope === "RANGE" ? to : null,
        sessions: scope === "AM" || scope === "PM" ? [scope] : null,
        kind: k,
        note: k ? note.trim() || null : null,
      };
      const r = await api<{ changed: number; view: AttendanceView | null }>("/api/attendance/marks", { method: "POST", body });
      toast.success(k ? `Đã ghi ${LEAVE_KINDS[k].label.toLowerCase()} (${r.changed / 2} ngày công)` : "Đã chuyển về đi làm bình thường", {
        description: k && isSelf && !LEAVE_KINDS[k].worked ? "Quản lý trực tiếp của bạn nhận được thông báo." : undefined,
      });
      onSaved(r.view);
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  };

  const scopes: { value: Scope; label: string }[] = [
    { value: "AM", label: "Buổi sáng" },
    ...(saturday ? [] : [{ value: "PM" as Scope, label: "Buổi chiều" }, { value: "DAY" as Scope, label: "Cả ngày" }]),
    { value: "RANGE", label: "Nhiều ngày" },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={isSelf ? "Ghi nghỉ / xin nghỉ" : `Chấm công · ${personName}`}
      description={`${dayText(day)} · đang là: ${cell.state === "marked" ? LEAVE_KINDS[cell.kind!].label : "đi làm"} (${SESSION_LABEL[session].toLowerCase()})`}
      footer={
        <>
          {cell.state === "marked" && (
            <Button variant="ghost" className="mr-auto" onClick={() => send(null)} disabled={busy}>
              Đi làm bình thường
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button onClick={() => send(kind)} loading={busy} disabled={busy || (scope === "RANGE" && to < day)}>
            Lưu
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Áp dụng cho">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Áp dụng cho">
            {scopes.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={scope === s.value}
                onClick={() => setScope(s.value)}
                className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium", scope === s.value ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}
              >
                {s.label}
              </button>
            ))}
          </div>
        </Field>
        {scope === "RANGE" && (
          <Field label="Đến hết ngày" hint="Mọi buổi làm việc từ ngày đã chọn tới ngày này; bỏ qua chủ nhật, chiều thứ 7 và ngày lễ.">
            <DateInput value={to} onChange={setTo} min={day} max={maxDay} aria-label="Đến hết ngày" />
          </Field>
        )}
        <Field label="Loại">
          <div className="grid gap-1.5" role="radiogroup" aria-label="Loại">
            {LEAVE_KIND_KEYS.map((k) => (
              <label key={k} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm", kind === k && "border-primary bg-primary/5")}>
                <input type="radio" name="leave-kind" className="accent-[hsl(var(--primary))]" checked={kind === k} onChange={() => setKind(k)} />
                <span className={cn("w-8 shrink-0 rounded px-1 text-center text-[11px] font-semibold ring-1 ring-inset", KIND_TONE[k])}>{LEAVE_KINDS[k].code}</span>
                <span>{LEAVE_KINDS[k].label}</span>
                {LEAVE_KINDS[k].annual && <span className="ml-auto text-[11px] text-muted-foreground">trừ phép năm</span>}
                {LEAVE_KINDS[k].worked && <span className="ml-auto text-[11px] text-muted-foreground">tính công</span>}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Ghi chú / lý do">
          <Textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="VD: Đi khám bệnh, việc gia đình, đi gặp khách hàng…" />
        </Field>
      </div>
    </Modal>
  );
}
