"use client";

import { useState } from "react";
import { Pencil, Palmtree } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client";
import { formatDays, monthLabel, MONTHLY_LEAVE, PROBATION_MONTHS, type LeaveBalanceView } from "@/lib/attendance";
import { cn } from "@/lib/utils";

const toNumber = (v: string) => Number(v.replace(",", "."));
const dayText = (day: string) => day.split("-").reverse().join("/");
const signed = (n: number) => `${n > 0 ? "+" : ""}${formatDays(n)}`;

function EditBalanceModal({ personId, personName, balance, onClose, onSaved }: { personId: string; personName: string; balance: LeaveBalanceView; onClose: () => void; onSaved: () => void }) {
  const [adjustment, setAdjustment] = useState(String(balance.yearAdjustment));
  const [note, setNote] = useState(balance.note ?? "");
  const [busy, setBusy] = useState(false);
  const a = toNumber(adjustment);
  const valid = Number.isFinite(a) && Math.abs(a) <= 60 && Number.isInteger(a * 2);
  const save = async () => {
    setBusy(true);
    try {
      await api("/api/attendance/balance", { method: "PUT", body: { userId: personId, year: balance.year, adjustment: a, note: note.trim() || null } });
      toast.success("Đã lưu điều chỉnh phép năm");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Điều chỉnh phép năm ${balance.year}`}
      description={personName}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={save} loading={busy} disabled={!valid || busy}>
            Lưu
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Cộng / trừ (ngày)" hint="Âm để trừ. Tính theo nửa ngày (VD: 3 hoặc -0,5)">
          <Input inputMode="decimal" value={adjustment} onChange={(ev) => setAdjustment(ev.target.value)} />
        </Field>
        <Field label="Ghi chú">
          <Input value={note} maxLength={300} onChange={(ev) => setNote(ev.target.value)} placeholder="VD: Phép tồn từ trước, +1 ngày thâm niên" />
        </Field>
        <p className="rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
          Mỗi tháng sau thử việc được cộng {MONTHLY_LEAVE} ngày phép, phép dư cộng dồn. Số điều chỉnh được cộng vào tháng đầu tiên của năm {balance.year} trong sổ phép.
        </p>
      </div>
    </Modal>
  );
}

/** Thử việc: when it ends, and what it means for leave. */
function ProbationNote({ officialFrom }: { officialFrom: string }) {
  const [y, m, d] = officialFrom.split("-").map(Number);
  const lastProbationDay = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  return (
    <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
      Thử việc {PROBATION_MONTHS} tháng, đến hết {dayText(lastProbationDay)}: chưa có phép năm. Từ tháng {m}/{y} mỗi tháng được cộng {MONTHLY_LEAVE} ngày. Nghỉ có phép trong thời gian thử việc là nghỉ âm của tháng đó (trừ lương).
    </p>
  );
}

/** Sổ phép of the month: what was left, what the month added and used, and what payroll deducts. */
export function LeaveBalanceCard({
  personId,
  personName,
  balance,
  month,
  canEdit,
  onSaved,
}: {
  personId: string;
  personName: string;
  balance: LeaveBalanceView;
  month: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const rows = [
    { label: "Phép đầu tháng", value: formatDays(balance.opening) },
    { label: "Cộng trong tháng", value: signed(balance.earned) },
    ...(balance.adjustment ? [{ label: "Điều chỉnh (HR)", value: signed(balance.adjustment) }] : []),
    { label: "Nghỉ phép trong tháng", value: balance.used ? `−${formatDays(balance.used)}` : "0" },
  ];
  return (
    <section className="rounded-2xl border bg-card p-4" aria-labelledby="leave-balance">
      <div className="mb-3 flex items-center gap-2">
        <Palmtree className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 id="leave-balance" className="flex-1 text-sm font-semibold">
          Phép năm · {monthLabel(month).toLowerCase()}
        </h2>
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Điều chỉnh
          </Button>
        )}
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className={cn("text-3xl font-semibold tabular-nums", balance.remaining < 0 ? "text-danger" : "text-foreground")}>{formatDays(balance.remaining)}</span>
        <span className="text-sm text-muted-foreground">ngày còn lại cuối tháng</span>
      </p>
      {balance.negative > 0 && (
        <p className="mt-2 rounded-lg bg-red-50 p-2.5 text-sm font-medium text-red-800 dark:bg-red-500/10 dark:text-red-300">
          Nghỉ âm {formatDays(balance.negative)} ngày: trừ lương tháng này. Tháng sau phép bắt đầu lại từ {MONTHLY_LEAVE} ngày.
        </p>
      )}
      <dl className="mt-3 space-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-medium tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
      {balance.officialFrom && <ProbationNote officialFrom={balance.officialFrom} />}
      {balance.note && <p className="mt-2 text-xs text-muted-foreground">Ghi chú {balance.year}: {balance.note}</p>}
      <p className="mt-2 text-xs text-muted-foreground">Mỗi tháng sau thử việc +{MONTHLY_LEAVE} ngày, phép dư cộng dồn; tháng nào âm thì trừ lương tháng đó. Tự tính từ lịch chấm công.</p>
      {editing && <EditBalanceModal personId={personId} personName={personName} balance={balance} onClose={() => setEditing(false)} onSaved={onSaved} />}
    </section>
  );
}
