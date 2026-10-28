"use client";

import { useState } from "react";
import { Pencil, Palmtree } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client";
import { formatDays, monthLabel, type LeaveBalanceView } from "@/lib/attendance";
import { cn } from "@/lib/utils";

const toNumber = (v: string) => Number(v.replace(",", "."));

function EditBalanceModal({ personId, personName, balance, onClose, onSaved }: { personId: string; personName: string; balance: LeaveBalanceView; onClose: () => void; onSaved: () => void }) {
  const [entitlement, setEntitlement] = useState(String(balance.entitlement));
  const [carriedOver, setCarriedOver] = useState(String(balance.carriedOver));
  const [note, setNote] = useState(balance.note ?? "");
  const [busy, setBusy] = useState(false);
  const e = toNumber(entitlement);
  const c = toNumber(carriedOver);
  const valid = Number.isFinite(e) && Number.isFinite(c) && e >= 0 && c >= 0;
  const save = async () => {
    setBusy(true);
    try {
      await api("/api/attendance/balance", { method: "PUT", body: { userId: personId, year: balance.year, entitlement: e, carriedOver: c, note: note.trim() || null } });
      toast.success("Đã lưu số phép năm");
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
      title={`Phép năm ${balance.year}`}
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Được hưởng trong năm" hint="Ngày; theo luật tối thiểu 12">
            <Input inputMode="decimal" value={entitlement} onChange={(ev) => setEntitlement(ev.target.value)} />
          </Field>
          <Field label="Tồn năm trước" hint="Chuyển sang năm nay">
            <Input inputMode="decimal" value={carriedOver} onChange={(ev) => setCarriedOver(ev.target.value)} />
          </Field>
        </div>
        <Field label="Ghi chú">
          <Input value={note} maxLength={300} onChange={(ev) => setNote(ev.target.value)} placeholder="VD: +1 ngày thâm niên 5 năm" />
        </Field>
        <p className="rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
          Còn lại = được hưởng + tồn năm trước − số đã nghỉ phép theo lịch chấm công (hiện {formatDays(balance.used)} ngày):{" "}
          <b className="text-foreground">{valid ? formatDays(Math.round((e + c - balance.used) * 10) / 10) : "–"} ngày</b>.
        </p>
      </div>
    </Modal>
  );
}

/** Annual leave: the numbers a manager sets, and what the calendar says was used. */
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
    { label: "Được hưởng", value: balance.entitlement },
    { label: "Tồn năm trước", value: balance.carriedOver },
    { label: `Đã nghỉ (đến hết ${monthLabel(month).toLowerCase()})`, value: balance.used },
  ];
  return (
    <section className="rounded-2xl border bg-card p-4" aria-labelledby="leave-balance">
      <div className="mb-3 flex items-center gap-2">
        <Palmtree className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 id="leave-balance" className="flex-1 text-sm font-semibold">
          Phép năm {balance.year}
        </h2>
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Sửa số
          </Button>
        )}
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className={cn("text-3xl font-semibold tabular-nums", balance.remaining < 0 ? "text-danger" : "text-foreground")}>{formatDays(balance.remaining)}</span>
        <span className="text-sm text-muted-foreground">ngày còn lại</span>
      </p>
      <dl className="mt-3 space-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-medium tabular-nums">{formatDays(r.value)}</dd>
          </div>
        ))}
      </dl>
      {balance.note && <p className="mt-2 text-xs text-muted-foreground">Ghi chú: {balance.note}</p>}
      <p className="mt-2 text-xs text-muted-foreground">Số đã nghỉ và còn lại tự tính từ lịch chấm công.</p>
      {editing && <EditBalanceModal personId={personId} personName={personName} balance={balance} onClose={() => setEditing(false)} onSaved={onSaved} />}
    </section>
  );
}
