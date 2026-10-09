"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client";
import { SWATCHES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function CategoryModal({
  open,
  onClose,
  projectId,
  category,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  category?: { id: string; name: string; color: string } | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(category?.name ?? "");
      setColor(category?.color ?? SWATCHES[0]);
    }
  }, [open, category]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (category) await api(`/api/categories/${category.id}`, { method: "PATCH", body: { name, color } });
      else await api(`/api/projects/${projectId}/categories`, { method: "POST", body: { name, color } });
      toast.success(category ? "Đã cập nhật hạng mục" : "Đã thêm hạng mục");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể lưu");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={category ? "Sửa hạng mục" : "Thêm hạng mục"}
      description="Hạng mục giúp nhóm các công việc theo giai đoạn hoặc chức năng."
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
        <Field label="Tên hạng mục">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Thiết kế, Phát triển, Kiểm thử…" autoFocus />
        </Field>
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
