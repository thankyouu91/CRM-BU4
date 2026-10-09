"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { api, ApiError } from "@/lib/client";
import { PROJECT_STATUS, SWATCHES } from "@/lib/constants";
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
  memberIds: string[];
}

const EMPTY: ProjectFormValues = {
  name: "",
  description: "",
  status: "PLANNING",
  color: SWATCHES[0],
  startDate: null,
  dueDate: null,
  memberIds: [],
};

export function ProjectFormModal({
  open,
  onClose,
  onSaved,
  directory,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  directory: Directory;
  initial?: ProjectFormValues;
}) {
  const [v, setV] = useState<ProjectFormValues>(initial ?? EMPTY);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editing = !!initial?.id;

  useEffect(() => {
    if (open) {
      setV(initial ?? EMPTY);
      setErrors({});
      setQuery("");
    }
  }, [open, initial]);

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    return directory.filter((u) => !q || u.name.toLowerCase().includes(q) || u.jobTitle?.toLowerCase().includes(q));
  }, [directory, query]);

  const toggleMember = (id: string) => {
    if (id === v.ownerId) return; // the owner always stays a member
    setV((s) => ({
      ...s,
      memberIds: s.memberIds.includes(id) ? s.memberIds.filter((m) => m !== id) : [...s.memberIds, id],
    }));
  };

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
      memberIds: v.memberIds,
    };
    try {
      if (initial?.id) {
        await api(`/api/projects/${initial.id}`, { method: "PATCH", body });
        toast.success("Đã cập nhật dự án");
        onSaved(initial.id);
      } else {
        const res = await api<{ project: { id: string } }>("/api/projects", { method: "POST", body });
        toast.success("Đã tạo dự án");
        onSaved(res.project.id);
      }
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
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-foreground/80">
            Thành viên <span className="text-muted-foreground">({v.memberIds.length} đã chọn)</span>
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
                const checked = v.memberIds.includes(u.id) || u.id === v.ownerId;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => toggleMember(u.id)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                    >
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
                      {u.id === v.ownerId && <span className="text-[10px] font-medium text-primary">Chủ dự án</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          {!editing && <p className="mt-2 text-xs text-muted-foreground">Bạn sẽ tự động là chủ dự án.</p>}
        </div>
      </div>
    </Modal>
  );
}
