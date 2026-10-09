"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { api, ApiError } from "@/lib/client";
import {
  CONTRACT_STATUS,
  CONTRACT_STATUSES,
  PAYMENT_STATUS,
  RATINGS,
  contractMetrics,
  formatVnd,
  parseVnd,
  type ContractStatusKey,
} from "@/lib/finance";
import type { ContractDto } from "@/lib/contracts";
import { cn } from "@/lib/utils";

export type ProjectOption = { id: string; name: string; color: string };

export const toDateInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const monthOf = (iso: string) => {
  const d = new Date(iso);
  return `Tháng ${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
};
export const ratingBg = (label: string | null) =>
  RATINGS.find((r) => r.label === label)?.bg ??
  "bg-muted text-muted-foreground";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Whole-đồng amount with Vietnamese digit grouping while typing. */
export function MoneyInput({
  value,
  onChange,
  placeholder = "0",
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Input
        inputMode="numeric"
        value={value === null ? "" : value.toLocaleString("vi-VN")}
        placeholder={placeholder}
        onChange={(e) => {
          const n = parseVnd(e.target.value);
          onChange(n === null ? null : Math.max(0, n));
        }}
        className="pr-8 text-right tabular-nums"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        đ
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------------------

export interface ContractFormState {
  code: string;
  name: string;
  partner: string;
  value: number | null;
  performedAt: string;
  status: ContractStatusKey;
  trainingCost: number | null;
  examCost: number | null;
  otherCost: number | null;
  expectedMargin: string;
  collected: number | null;
  projectId: string;
  note: string;
}

function emptyForm(date: string): ContractFormState {
  return {
    code: "",
    name: "",
    partner: "",
    value: null,
    performedAt: date,
    status: "IN_PROGRESS",
    trainingCost: null,
    examCost: null,
    otherCost: null,
    expectedMargin: "",
    collected: null,
    projectId: "",
    note: "",
  };
}

function fromContract(c: ContractDto): ContractFormState {
  return {
    code: c.code ?? "",
    name: c.name,
    partner: c.partner ?? "",
    value: c.value,
    performedAt: toDateInput(c.performedAt),
    status: c.status as ContractStatusKey,
    trainingCost: c.trainingCost || null,
    examCost: c.examCost || null,
    otherCost: c.otherCost || null,
    expectedMargin: c.expectedMargin === null ? "" : String(c.expectedMargin),
    collected: c.collected || null,
    projectId: c.projectId ?? "",
    note: c.note ?? "",
  };
}

export function ContractModal({
  open,
  contract,
  defaultDate,
  projects,
  lockedProject,
  defaults,
  onClose,
  onSaved,
  onDelete,
}: {
  open: boolean;
  contract: ContractDto | null;
  defaultDate: string;
  projects: ProjectOption[];
  /** Fix the linked project (contracts added from a project's tab). */
  lockedProject?: ProjectOption;
  /** Prefill for a new contract, e.g. the project's name. */
  defaults?: Partial<ContractFormState>;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (c: ContractDto) => void;
}) {
  const [v, setV] = useState<ContractFormState>(() => emptyForm(defaultDate));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setV(
        contract
          ? fromContract(contract)
          : {
              ...emptyForm(defaultDate),
              ...defaults,
              ...(lockedProject ? { projectId: lockedProject.id } : {}),
            },
      );
      setErrors({});
    }
    // defaults is an inline object at call sites; reset only when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contract, defaultDate]);

  const margin =
    v.expectedMargin.trim() === ""
      ? null
      : Number(v.expectedMargin.replace(",", "."));
  const m = contractMetrics({
    value: v.value ?? 0,
    trainingCost: v.trainingCost ?? 0,
    examCost: v.examCost ?? 0,
    otherCost: v.otherCost ?? 0,
    expectedMargin: margin !== null && Number.isFinite(margin) ? margin : null,
    collected: v.collected ?? 0,
  });

  const submit = async () => {
    setBusy(true);
    setErrors({});
    const body = {
      code: v.code || null,
      name: v.name,
      partner: v.partner || null,
      value: v.value ?? 0,
      performedAt: v.performedAt,
      status: v.status,
      trainingCost: v.trainingCost ?? 0,
      examCost: v.examCost ?? 0,
      otherCost: v.otherCost ?? 0,
      expectedMargin:
        margin !== null && Number.isFinite(margin) ? margin : null,
      collected: v.collected ?? 0,
      projectId: v.projectId || null,
      note: v.note || null,
    };
    try {
      if (contract)
        await api(`/api/contracts/${contract.id}`, { method: "PATCH", body });
      else await api("/api/contracts", { method: "POST", body });
      toast.success(contract ? "Đã cập nhật hợp đồng" : "Đã thêm hợp đồng");
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fields ?? {});
      toast.error(e instanceof ApiError ? e.message : "Không thể lưu");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={contract ? "Sửa hợp đồng" : "Thêm hợp đồng"}
      description="Nhập giá trị, chi phí và số đã thu — lợi nhuận, tỷ suất và công nợ được tính tự động."
      footer={
        <>
          {contract && (
            <Button
              variant="ghost"
              className="mr-auto text-danger hover:bg-danger/10 hover:text-danger"
              onClick={() => onDelete(contract)}
            >
              <Trash2 className="h-4 w-4" /> Xoá
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            onClick={submit}
            loading={busy}
            disabled={!v.name.trim() || v.value === null}
          >
            {contract ? "Lưu thay đổi" : "Thêm hợp đồng"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_260px]">
        <div className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên hợp đồng / dự án" error={errors.name}>
              <Input
                value={v.name}
                onChange={(e) => setV({ ...v, name: e.target.value })}
                placeholder="VD: Cung cấp tài khoản luyện thi"
                autoFocus
              />
            </Field>
            <Field label="Mã hợp đồng">
              <Input
                value={v.code}
                onChange={(e) => setV({ ...v, code: e.target.value })}
                placeholder="VD: 248/HĐMB/IES-CDIMEX"
              />
            </Field>
            <Field label="Đối tác / khách hàng">
              <Input
                value={v.partner}
                onChange={(e) => setV({ ...v, partner: e.target.value })}
                placeholder="Tên đơn vị"
              />
            </Field>
            <Field label="Giá trị hợp đồng" error={errors.value}>
              <MoneyInput
                value={v.value}
                onChange={(value) => setV({ ...v, value })}
              />
            </Field>
            <Field
              label="Ngày thực hiện"
              error={errors.performedAt}
              hint="Báo cáo lọc theo tháng/quý/năm của ngày này."
            >
              <Input
                type="date"
                value={v.performedAt}
                onChange={(e) => setV({ ...v, performedAt: e.target.value })}
              />
            </Field>
            <Field label="Tiến độ thực hiện">
              <Select
                value={v.status}
                onChange={(e) =>
                  setV({ ...v, status: e.target.value as ContractStatusKey })
                }
              >
                {CONTRACT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CONTRACT_STATUS[s].label}
                  </option>
                ))}
              </Select>
            </Field>
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
              Chi phí
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Chi phí đào tạo">
                <MoneyInput
                  value={v.trainingCost}
                  onChange={(trainingCost) => setV({ ...v, trainingCost })}
                />
              </Field>
              <Field label="Chi phí khảo thí">
                <MoneyInput
                  value={v.examCost}
                  onChange={(examCost) => setV({ ...v, examCost })}
                />
              </Field>
              <Field label="Chi phí khác">
                <MoneyInput
                  value={v.otherCost}
                  onChange={(otherCost) => setV({ ...v, otherCost })}
                />
              </Field>
              <Field
                label="Tỷ suất LN dự kiến (%)"
                hint="Chỉ dùng để ước tính khi chưa nhập chi phí."
              >
                <Input
                  inputMode="decimal"
                  value={v.expectedMargin}
                  onChange={(e) =>
                    setV({ ...v, expectedMargin: e.target.value })
                  }
                  placeholder="VD: 30"
                />
              </Field>
              <Field label="Đã thanh toán (đã thu)">
                <MoneyInput
                  value={v.collected}
                  onChange={(collected) => setV({ ...v, collected })}
                />
              </Field>
              <Field label="Dự án liên kết" error={errors.projectId}>
                {lockedProject ? (
                  <p className="flex h-10 items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: lockedProject.color }}
                    />
                    <span className="truncate">{lockedProject.name}</span>
                  </p>
                ) : (
                  <Select
                    value={v.projectId}
                    onChange={(e) => setV({ ...v, projectId: e.target.value })}
                  >
                    <option value="">— Không liên kết —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </section>
          <Field label="Ghi chú">
            <Textarea
              value={v.note}
              onChange={(e) => setV({ ...v, note: e.target.value })}
              rows={2}
            />
          </Field>
        </div>

        {/* Live result */}
        <aside className="h-fit space-y-3 rounded-2xl border bg-muted/30 p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Kết quả tính tự động
          </p>
          <Row
            label="Tổng chi phí"
            value={formatVnd(m.totalCost)}
            sub={v.value ? `${m.costRatio}% giá trị HĐ` : undefined}
          />
          <Row
            label={
              m.basis === "estimate"
                ? "Lợi nhuận gộp (ước tính)"
                : "Lợi nhuận gộp"
            }
            value={m.profit === null ? "Chưa có chi phí" : formatVnd(m.profit)}
            tone={m.profit !== null && m.profit < 0 ? "danger" : "success"}
          />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tỷ suất LN</span>
            <span className="flex items-center gap-2 font-semibold tabular-nums">
              {m.margin === null ? "—" : `${m.margin}%`}
              {m.rating && (
                <Badge className={ratingBg(m.rating)}>{m.rating}</Badge>
              )}
            </span>
          </div>
          <div className="border-t pt-3" />
          <Row
            label="Còn phải thu"
            value={formatVnd(m.receivable)}
            tone={m.receivable > 0 ? "danger" : undefined}
          />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Trạng thái TT</span>
            <Badge className={PAYMENT_STATUS[m.paymentStatus].bg}>
              {PAYMENT_STATUS[m.paymentStatus].label}
            </Badge>
          </div>
          {m.basis === null && (v.value ?? 0) > 0 && (
            <p className="rounded-lg bg-warning/10 px-2.5 py-2 text-xs text-warning">
              Nhập chi phí hoặc tỷ suất LN dự kiến để tính lợi nhuận.
            </p>
          )}
        </aside>
      </div>
    </Modal>
  );
}

function Row({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "danger" | "success";
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            tone === "danger" && "text-danger",
            tone === "success" && "text-success",
          )}
        >
          {value}
        </span>
      </div>
      {sub && (
        <p className="text-right text-[11px] text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
