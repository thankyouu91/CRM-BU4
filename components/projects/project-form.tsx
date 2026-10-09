"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { api, ApiError } from "@/lib/client";
import { PROJECT_STATUS, SWATCHES } from "@/lib/constants";
import { PROJECT_ROLE_INFO, PROJECT_ROLES, type ProjectRoleKey } from "@/lib/permissions";
import { contractMetrics, formatVnd } from "@/lib/finance";
import type { ContractDto } from "@/lib/contracts";
import { MoneyInput, toDateInput } from "@/components/contracts/contract-form";
import { fromInputDate, toInputDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Directory } from "./types";

export interface ProjectFormValues {
  id?: string;
  name: string;
  description: string | null;
  status: string;
  color: string;
  startDate: string | null;
  dueDate: string | null;
  ownerId?: string;
  /** Members and their role in the project (the owner is always a manager). */
  members: { userId: string; role: ProjectRoleKey }[];
}

/** The project's main contract, edited inline. Stored as a contract record (one source of truth). */
interface ContractFields {
  code: string;
  partner: string;
  value: number | null;
  trainingCost: number | null;
  examCost: number | null;
  otherCost: number | null;
  collected: number | null;
}
const EMPTY_CONTRACT: ContractFields = { code: "", partner: "", value: null, trainingCost: null, examCost: null, otherCost: null, collected: null };
const contractFields = (c: ContractDto | undefined): ContractFields =>
  c
    ? {
        code: c.code ?? "",
        partner: c.partner ?? "",
        value: c.value,
        trainingCost: c.trainingCost || null,
        examCost: c.examCost || null,
        otherCost: c.otherCost || null,
        collected: c.collected || null,
      }
    : EMPTY_CONTRACT;

const EMPTY: ProjectFormValues = {
  name: "",
  description: "",
  status: "PLANNING",
  color: SWATCHES[0],
  startDate: null,
  dueDate: null,
  members: [],
};

export function ProjectFormModal({
  open,
  onClose,
  onSaved,
  directory,
  initial,
  finance,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  directory: Directory;
  initial?: ProjectFormValues;
  /** Present for holders of "Hợp đồng & chi phí": the project's contracts (null while loading). */
  finance?: { contracts: ContractDto[] | null };
}) {
  const [v, setV] = useState<ProjectFormValues>(initial ?? EMPTY);
  const [cf, setCf] = useState<ContractFields>(EMPTY_CONTRACT);
  const contracts = finance?.contracts ?? null;
  const single = contracts && contracts.length <= 1;
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editing = !!initial?.id;

  useEffect(() => {
    if (open) {
      setV(initial ?? EMPTY);
      setCf(contractFields(contracts?.[0]));
      setErrors({});
      setQuery("");
    }
    // Prefill once per opening; later reloads of the contract list must not wipe edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    return directory.filter((u) => !q || u.name.toLowerCase().includes(q) || u.jobTitle?.toLowerCase().includes(q));
  }, [directory, query]);

  const roleOf = useMemo(() => new Map(v.members.map((m) => [m.userId, m.role])), [v.members]);

  const toggleMember = (id: string) => {
    if (id === v.ownerId) return; // the owner always stays a member
    setV((s) => ({
      ...s,
      members: s.members.some((m) => m.userId === id)
        ? s.members.filter((m) => m.userId !== id)
        : [...s.members, { userId: id, role: "MEMBER" }],
    }));
  };

  const setRole = (id: string, role: ProjectRoleKey) =>
    setV((s) => ({ ...s, members: s.members.map((m) => (m.userId === id ? { ...m, role } : m)) }));

  const submit = async () => {
    setBusy(true);
    setErrors({});
    const body = {
      name: v.name,
      description: v.description || null,
      status: v.status,
      color: v.color,
      startDate: v.startDate,
      dueDate: v.dueDate,
      members: v.members,
    };
    try {
      let id: string;
      if (initial?.id) {
        await api(`/api/projects/${initial.id}`, { method: "PATCH", body });
        id = initial.id;
      } else {
        id = (await api<{ project: { id: string } }>("/api/projects", { method: "POST", body })).project.id;
      }
      const contractSaved = await saveContract(id);
      toast.success(initial?.id ? "Đã cập nhật dự án" : "Đã tạo dự án", contractSaved ? { description: "Hợp đồng đã được cập nhật vào Hợp đồng & chi phí." } : undefined);
      onSaved(id);
      onClose();
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fields ?? {});
        toast.error(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  /** Create or update the project's main contract. Returns whether anything was written. */
  async function saveContract(projectId: string): Promise<boolean> {
    if (!finance || !single) return false;
    const existing = contracts?.[0];
    if (!existing && cf.value === null) return false;
    const fields = {
      code: cf.code || null,
      partner: cf.partner || null,
      value: cf.value ?? 0,
      trainingCost: cf.trainingCost ?? 0,
      examCost: cf.examCost ?? 0,
      otherCost: cf.otherCost ?? 0,
      collected: cf.collected ?? 0,
    };
    try {
      if (existing) await api(`/api/contracts/${existing.id}`, { method: "PATCH", body: fields });
      else
        await api("/api/contracts", {
          method: "POST",
          body: {
            ...fields,
            projectId,
            name: v.name.trim(),
            performedAt: toDateInput(v.startDate ?? new Date().toISOString()),
            status: v.status === "COMPLETED" ? "COMPLETED" : v.status === "PLANNING" ? "PLANNED" : "IN_PROGRESS",
          },
        });
      return true;
    } catch (e) {
      toast.error(`Đã lưu dự án nhưng chưa lưu được hợp đồng: ${e instanceof ApiError ? e.message : "lỗi không xác định"}`);
      return false;
    }
  }

  const preview = contractMetrics({
    value: cf.value ?? 0,
    trainingCost: cf.trainingCost ?? 0,
    examCost: cf.examCost ?? 0,
    otherCost: cf.otherCost ?? 0,
    expectedMargin: contracts?.[0]?.expectedMargin ?? null,
    collected: cf.collected ?? 0,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? "Chỉnh sửa dự án" : "Tạo dự án mới"}
      description="Thiết lập thông tin, thời gian và thành viên tham gia dự án."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit} loading={busy} disabled={v.name.trim().length < 2}>
            {editing ? "Lưu thay đổi" : "Tạo dự án"}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <Field label="Tên dự án" error={errors.name}>
            <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="VD: Ra mắt sản phẩm mới Q1" autoFocus />
          </Field>
          <Field label="Mô tả">
            <Textarea
              value={v.description ?? ""}
              onChange={(e) => setV({ ...v, description: e.target.value })}
              placeholder="Mục tiêu, phạm vi và kết quả mong đợi…"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ngày bắt đầu">
              <Input type="date" value={toInputDate(v.startDate)} onChange={(e) => setV({ ...v, startDate: fromInputDate(e.target.value, "start") })} />
            </Field>
            <Field label="Hạn hoàn thành" error={errors.dueDate}>
              <Input type="date" value={toInputDate(v.dueDate)} onChange={(e) => setV({ ...v, dueDate: fromInputDate(e.target.value, "end") })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Trạng thái">
              <Select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
                {Object.entries(PROJECT_STATUS).map(([k, s]) => (
                  <option key={k} value={k}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Màu nhận diện">
              <div className="flex h-10 flex-wrap items-center gap-1.5">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setV({ ...v, color: c })}
                    className={cn("flex h-6 w-6 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition", v.color === c && "ring-2 ring-foreground/40")}
                    style={{ background: c }}
                    aria-label={`Chọn màu ${c}`}
                  >
                    {v.color === c && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          {finance && (
            <section className="rounded-xl border border-dashed p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Wallet className="h-4 w-4 text-primary" /> Hợp đồng & chi phí <span className="text-xs font-normal text-muted-foreground">(tuỳ chọn)</span>
              </p>
              {contracts === null ? (
                <p className="mt-2 text-xs text-muted-foreground">Đang tải hợp đồng…</p>
              ) : !single ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Dự án có {contracts.length} hợp đồng — xem và sửa trong tab “Hợp đồng & chi phí” của dự án.
                </p>
              ) : (
                <>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Số hợp đồng">
                      <Input value={cf.code} onChange={(e) => setCf({ ...cf, code: e.target.value })} placeholder="VD: 248/HĐMB/IES-CDIMEX" />
                    </Field>
                    <Field label="Đối tác / khách hàng">
                      <Input value={cf.partner} onChange={(e) => setCf({ ...cf, partner: e.target.value })} placeholder="Tên đơn vị" />
                    </Field>
                    <Field label="Giá trị hợp đồng">
                      <MoneyInput value={cf.value} onChange={(value) => setCf({ ...cf, value })} />
                    </Field>
                    <Field label="Đã thu">
                      <MoneyInput value={cf.collected} onChange={(collected) => setCf({ ...cf, collected })} />
                    </Field>
                    <Field label="Chi phí đào tạo">
                      <MoneyInput value={cf.trainingCost} onChange={(trainingCost) => setCf({ ...cf, trainingCost })} />
                    </Field>
                    <Field label="Chi phí khảo thí">
                      <MoneyInput value={cf.examCost} onChange={(examCost) => setCf({ ...cf, examCost })} />
                    </Field>
                    <Field label="Chi phí khác">
                      <MoneyInput value={cf.otherCost} onChange={(otherCost) => setCf({ ...cf, otherCost })} />
                    </Field>
                  </div>
                  {cf.value !== null && (
                    <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                      Lợi nhuận gộp{" "}
                      <b className={preview.profit !== null && preview.profit < 0 ? "text-danger" : "text-success"}>
                        {preview.profit === null ? "—" : formatVnd(preview.profit)}
                      </b>
                      {preview.margin !== null && ` (${preview.margin}%)`} · Còn phải thu <b>{formatVnd(preview.receivable)}</b>
                    </p>
                  )}
                </>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">Lưu thành hợp đồng của dự án — dùng chung với trang Hợp đồng & chi phí và Trung tâm báo cáo.</p>
            </section>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-foreground/80">
            Thành viên & vai trò <span className="text-muted-foreground">({v.members.filter((m) => m.userId !== v.ownerId).length} đã chọn)</span>
          </p>
          <div className="rounded-xl border">
            <div className="relative border-b">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm nhân sự…"
                className="h-10 w-full rounded-t-xl bg-transparent pl-9 pr-3 text-sm outline-none"
              />
            </div>
            <ul className="scrollbar-thin max-h-[280px] overflow-y-auto p-1">
              {people.map((u) => {
                const owner = u.id === v.ownerId;
                const role = roleOf.get(u.id);
                const checked = owner || role !== undefined;
                return (
                  <li key={u.id} className="flex items-center gap-1 rounded-lg pr-1 hover:bg-muted">
                    <button type="button" onClick={() => toggleMember(u.id)} className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-left">
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          checked && "border-primary bg-primary text-primary-foreground",
                        )}
                      >
                        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <Avatar name={u.name} color={u.avatarColor} size="xs" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{u.name}</span>
                        {u.jobTitle && <span className="block truncate text-[11px] text-muted-foreground">{u.jobTitle}</span>}
                      </span>
                    </button>
                    {owner ? (
                      <span className="shrink-0 px-1 text-[10px] font-medium text-primary">Chủ dự án</span>
                    ) : (
                      role && (
                        <select
                          aria-label={`Vai trò của ${u.name} trong dự án`}
                          value={role}
                          onChange={(e) => setRole(u.id, e.target.value as ProjectRoleKey)}
                          className="h-7 shrink-0 rounded-md border bg-card px-1 text-[11px] outline-none focus:border-primary/60"
                        >
                          {PROJECT_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {PROJECT_ROLE_INFO[r].label}
                            </option>
                          ))}
                        </select>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {!editing && "Bạn sẽ tự động là chủ dự án. "}
            <b className="text-foreground/80">Quản lý dự án</b> sửa dự án & duyệt báo cáo · <b className="text-foreground/80">Thành viên</b> làm & báo cáo việc ·{" "}
            <b className="text-foreground/80">Chỉ xem</b> xem & góp ý.
          </p>
        </div>
      </div>
    </Modal>
  );
}
