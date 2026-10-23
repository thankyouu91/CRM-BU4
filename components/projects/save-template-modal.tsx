"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { api, ApiError, useChanged } from "@/lib/client";
import { MAX_TEMPLATE_CATEGORIES, MAX_TEMPLATE_TASKS } from "@/lib/project-templates";

/** Save the open project's structure (categories, tasks, relative dates) as a template. */
export function SaveTemplateModal({
  open,
  onClose,
  project,
}: {
  open: boolean;
  onClose: () => void;
  project: { id: string; name: string; categories: number; tasks: number };
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (useChanged([open, project.name]) && open) {
    setName(project.name);
    setDescription("");
    setErrors({});
  }

  const tooBig =
    project.categories > MAX_TEMPLATE_CATEGORIES
      ? `Dự án có ${project.categories} hạng mục; một mẫu chứa tối đa ${MAX_TEMPLATE_CATEGORIES}.`
      : project.tasks > MAX_TEMPLATE_TASKS
        ? `Dự án có ${project.tasks} công việc; một mẫu chứa tối đa ${MAX_TEMPLATE_TASKS}.`
        : null;
  const ready = name.trim().length >= 2 && !tooBig;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setErrors({});
    try {
      const { template } = await api<{ template: { name: string } }>("/api/project-templates", {
        method: "POST",
        body: { projectId: project.id, name, description: description.trim() || null },
      });
      toast.success(`Đã lưu mẫu “${template.name}”`, { description: "Dùng ở trang Dự án → Tạo từ mẫu." });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields ?? {});
      toast.error(err instanceof ApiError ? err.message : "Không thể lưu mẫu");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Lưu làm mẫu"
      description="Dùng lại cấu trúc dự án này cho các dự án tương tự."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={() => submit()} loading={busy} disabled={!ready}>
            Lưu mẫu
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Tên mẫu" error={errors.name} htmlFor="template-name">
          <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus />
        </Field>
        <Field label="Mô tả (tuỳ chọn)" error={errors.description} htmlFor="template-description">
          <Textarea
            id="template-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="VD: Khảo thí tiếng Anh cho doanh nghiệp, 3 đợt thi"
          />
        </Field>
        <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          <p>
            Mẫu lưu <span className="font-medium text-foreground">{project.categories} hạng mục, {project.tasks} công việc</span> cùng mức ưu tiên, mô tả và
            ngày (tính theo số ngày từ ngày bắt đầu dự án).
          </p>
          <p className="mt-1">Không lưu người phụ trách, trạng thái, tiến độ, báo cáo, ghi chú hay hợp đồng.</p>
        </div>
        {tooBig && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{tooBig}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
