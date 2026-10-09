"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client";
import { PRIORITY } from "@/lib/constants";
import { fromInputDate } from "@/lib/dates";
import type { CategoryBrief, UserBrief } from "./types";

export function TaskCreateModal({
  open,
  onClose,
  projectId,
  categories,
  people,
  defaultCategoryId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  categories: CategoryBrief[];
  people: UserBrief[];
  defaultCategoryId?: string | null;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setCategoryId(defaultCategoryId ?? categories[0]?.id ?? "");
    setAssigneeId("");
    setPriority("MEDIUM");
    setStartDate("");
    setDueDate("");
    setErrors({});
  }, [open, defaultCategoryId, categories]);

  const submit = async () => {
    if (startDate && dueDate && dueDate < startDate) {
      setErrors({ dueDate: "Hạn chót phải sau ngày bắt đầu" });
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ task: { id: string } }>("/api/tasks", {
        method: "POST",
        body: {
          projectId,
          title,
          description: description || null,
          categoryId: categoryId || null,
          assigneeId: assigneeId || null,
          priority,
          startDate: fromInputDate(startDate, "start"),
          dueDate: fromInputDate(dueDate, "end"),
        },
      });
      toast.success("Đã tạo công việc");
      onCreated(res.task.id);
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
      title="Tạo công việc"
      description="Giao việc cho người phụ trách (PIC) và đặt hạn hoàn thành."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit} loading={busy} disabled={!title.trim()}>
            Tạo công việc
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tiêu đề" error={errors.title}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Thiết kế trang thanh toán" autoFocus />
        </Field>
        <Field label="Mô tả">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Yêu cầu, tiêu chí hoàn thành…" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hạng mục">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— Chưa phân loại —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Người phụ trách (PIC)" error={errors.assigneeId}>
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">— Chưa giao —</option>
              {people.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.jobTitle ? ` · ${u.jobTitle}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mức ưu tiên">
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {Object.entries(PRIORITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bắt đầu">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Hạn chót" error={errors.dueDate}>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>
        </div>
      </div>
    </Modal>
  );
}
