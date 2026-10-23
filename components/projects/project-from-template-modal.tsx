"use client";

import { useState } from "react";
import { LayoutTemplate, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/misc";
import { Field, Input } from "@/components/ui/input";
import { api, ApiError, useApi, useChanged } from "@/lib/client";
import { dayNumber, showDay } from "@/lib/project-templates";
import { zonedDay } from "@/lib/work-report";
import { cn, formatDate } from "@/lib/utils";
import { DateInput } from "@/components/ui/date-input";

/** A row of GET /api/project-templates. */
export interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  categories: number;
  tasks: number;
  createdBy: { id: string; name: string } | null;
  updatedAt: string;
  canDelete: boolean;
}

export const countsText = (t: { categories: number; tasks: number }) => `${t.categories} hạng mục, ${t.tasks} công việc`;

/** Pick a template, name the project and its start day; the template's dates move to that day. */
export function ProjectFromTemplateModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const list = useApi<{ templates: TemplateItem[] }>(open ? "/api/project-templates" : null);
  const templates = list.data?.templates ?? [];
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [named, setNamed] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<TemplateItem | null>(null);

  if (useChanged([open]) && open) {
    setTemplateId("");
    setName("");
    setNamed(false);
    setStartDate(zonedDay(new Date()));
    setErrors({});
  }

  const template = templates.find((t) => t.id === templateId);
  const pick = (t: TemplateItem) => {
    setTemplateId(t.id);
    // Suggest the template's name until the person types their own.
    if (!named) setName(t.name);
  };
  const validDay = dayNumber(startDate) !== null;
  const ready = !!template && name.trim().length >= 2 && validDay;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setErrors({});
    try {
      const { project } = await api<{ project: { id: string; name: string } }>("/api/projects/from-template", {
        method: "POST",
        body: { templateId, name, startDate },
      });
      toast.success(`Đã tạo dự án “${project.name}” từ mẫu`);
      onCreated(project.id);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields ?? {});
      toast.error(err instanceof ApiError ? err.message : "Không thể tạo dự án");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Tạo dự án từ mẫu"
        description="Tạo lại hạng mục và công việc của mẫu, ngày tính lại theo ngày bắt đầu mới. Người phụ trách, trạng thái và tiến độ để trống."
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Huỷ
            </Button>
            <Button onClick={() => submit()} loading={busy} disabled={!ready}>
              Tạo dự án
            </Button>
          </>
        }
      >
        {list.loading && !list.data ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : list.error ? (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{list.error}</p>
        ) : !templates.length ? (
          <EmptyState
            icon={LayoutTemplate}
            className="py-8"
            title="Chưa có mẫu dự án nào"
            description="Mở một dự án → Lưu làm mẫu. Mẫu giữ hạng mục, công việc và lịch của dự án để dùng lại."
          />
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="mb-1.5 text-xs font-medium text-foreground/80">Chọn mẫu</legend>
              <div className="scrollbar-thin max-h-64 space-y-2 overflow-y-auto pr-0.5">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "flex items-start gap-2 rounded-xl border p-3 transition-colors",
                      t.id === templateId ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30" : "hover:bg-muted/60",
                    )}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                      <input type="radio" name="template" value={t.id} checked={t.id === templateId} onChange={() => pick(t)} className="mt-1 accent-[rgb(var(--primary))]" />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-medium">{t.name}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {countsText(t)} · {t.createdBy?.name ?? "Không rõ người tạo"} · {formatDate(t.updatedAt)}
                        </span>
                        {t.description && <span className="mt-1 line-clamp-2 block break-words text-xs text-muted-foreground">{t.description}</span>}
                      </span>
                    </label>
                    {t.canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleting(t)}
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                        aria-label={`Xoá mẫu ${t.name}`}
                        title="Xoá mẫu"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Field label="Tên dự án" error={errors.name} htmlFor="template-project-name">
                <Input
                  id="template-project-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNamed(true);
                  }}
                  placeholder="VD: Khảo thí tiếng Anh ACB đợt 2"
                />
              </Field>
              <Field label="Ngày bắt đầu" error={errors.startDate ?? (startDate && !validDay ? "Ngày không hợp lệ" : undefined)} htmlFor="template-start-date">
                <DateInput id="template-start-date" aria-label="Ngày bắt đầu" value={startDate} onChange={setStartDate} className="sm:w-44" />
              </Field>
            </div>
            <p role="status" className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {template ? (
                <>
                  <span className="font-medium text-foreground">{countsText(template)}</span>
                  {validDay ? `; ngày tính lại từ ${showDay(startDate)}` : "; chọn ngày bắt đầu để tính lại ngày"}
                </>
              ) : (
                "Chọn một mẫu để xem trước."
              )}
            </p>
            <button type="submit" hidden />
          </form>
        )}
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Xoá mẫu dự án?"
        danger
        confirmLabel="Xoá mẫu"
        message={
          <>
            Mẫu <b className="text-foreground">{deleting?.name}</b> sẽ bị xoá. Các dự án đã tạo từ mẫu này không bị ảnh hưởng.
          </>
        }
        onConfirm={async () => {
          const target = deleting!;
          try {
            await api(`/api/project-templates/${target.id}`, { method: "DELETE" });
            toast.success("Đã xoá mẫu");
            if (target.id === templateId) setTemplateId("");
            list.setData((prev) => prev && { templates: prev.templates.filter((t) => t.id !== target.id) });
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : "Không thể xoá");
          }
        }}
      />
    </>
  );
}
