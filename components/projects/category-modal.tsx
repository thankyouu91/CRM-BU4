"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client";
import { SWATCHES } from "@/lib/constants";
import { fromInputDate, toInputDate } from "@/lib/dates";
import { cn, formatDate } from "@/lib/utils";

interface CategoryLike {
  id: string;
  name: string;
  color: string;
  parentId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
}

export function CategoryModal({
  open,
  onClose,
  projectId,
  category,
  categories = [],
  defaultParentId = null,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  category?: CategoryLike | null;
  /** All categories of the project, to pick a main category from. */
  categories?: CategoryLike[];
  /** Pre-select a main category when adding a sub-category. */
  defaultParentId?: string | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [parentId, setParentId] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      const parent = categories.find((c) => c.id === (category?.parentId ?? defaultParentId));
      setName(category?.name ?? "");
      setColor(category?.color ?? parent?.color ?? SWATCHES[0]);
      setParentId(category?.parentId ?? defaultParentId ?? "");
      setStartDate(category?.startDate ?? null);
      setDueDate(category?.dueDate ?? null);
      setErrors({});
    }
  }, [open, category, defaultParentId, categories]);

  // Two levels only: a category that has sub-categories stays a main category.
  const hasChildren = !!category && categories.some((c) => c.parentId === category.id);
  const mains = categories.filter((c) => !c.parentId && c.id !== category?.id);
  const parent = categories.find((c) => c.id === parentId);
  const outsideParent =
    !!parent &&
    ((!!parent.dueDate && !!dueDate && new Date(dueDate) > new Date(parent.dueDate)) ||
      (!!parent.startDate && !!startDate && new Date(startDate) < new Date(parent.startDate)));

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErrors({});
    const body = { name, color, parentId: parentId || null, startDate, dueDate };
    try {
      if (category) await api(`/api/categories/${category.id}`, { method: "PATCH", body });
      else await api(`/api/projects/${projectId}/categories`, { method: "POST", body });
      toast.success(category ? "Đã cập nhật hạng mục" : parentId ? "Đã thêm hạng mục con" : "Đã thêm hạng mục");
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setErrors((err.fields as Record<string, string>) ?? {});
      toast.error(err instanceof ApiError ? err.message : "Không thể lưu");
    } finally {
      setBusy(false);
    }
  };

  const title = category ? "Sửa hạng mục" : parentId ? "Thêm hạng mục con" : "Thêm hạng mục";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      description="Hạng mục lớn nhóm công việc theo giai đoạn; hạng mục con chia nhỏ hơn, mỗi cấp có thời hạn riêng."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={() => submit()} loading={busy} disabled={!name.trim()}>
            Lưu
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Tên hạng mục" error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Thiết kế, Phát triển, Kiểm thử…" autoFocus />
        </Field>
        <Field
          label="Thuộc hạng mục"
          error={errors.parentId}
          hint={hasChildren ? "Hạng mục này đang có hạng mục con nên luôn là hạng mục lớn." : undefined}
        >
          <Select value={parentId} disabled={hasChildren} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Là hạng mục lớn —</option>
            {mains.map((c) => (
              <option key={c.id} value={c.id}>
                Hạng mục con của: {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày bắt đầu">
            <Input type="date" value={toInputDate(startDate)} onChange={(e) => setStartDate(fromInputDate(e.target.value, "start"))} />
          </Field>
          <Field label="Hạn hoàn thành" error={errors.dueDate}>
            <Input type="date" value={toInputDate(dueDate)} onChange={(e) => setDueDate(fromInputDate(e.target.value, "end"))} />
          </Field>
        </div>
        {parent && (parent.startDate || parent.dueDate) && (
          <p className={cn("rounded-lg px-3 py-2 text-xs", outsideParent ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground")}>
            {outsideParent ? "Lưu ý: thời hạn nằm ngoài thời hạn của hạng mục lớn " : "Hạng mục lớn "}“{parent.name}”: {formatDate(parent.startDate) || "…"} →{" "}
            {formatDate(parent.dueDate) || "…"}
          </p>
        )}
        <Field label="Màu">
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn("flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-card", color === c && "ring-2 ring-foreground/40")}
                style={{ background: c }}
                aria-label={`Chọn màu ${c}`}
              >
                {color === c && <Check className="h-4 w-4 text-white" />}
              </button>
            ))}
          </div>
        </Field>
      </form>
    </Modal>
  );
}
