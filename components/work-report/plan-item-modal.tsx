"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client";
import { PRIORITY } from "@/lib/constants";
import { zonedDay, zonedDayEdge, type ProjectBrief, type WorkPeriodJson } from "@/lib/work-report";

/**
 * Adds a plan item for the next period: a real task (POST /api/tasks) assigned to
 * the author, starting and due inside that period, so it shows in "Kỳ tới" and in
 * the project like any other task.
 */
export function PlanItemModal({
  open,
  onClose,
  projects,
  period,
  assigneeId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  projects: ProjectBrief[];
  /** The next period (dates are limited to it). */
  period: WorkPeriodJson;
  assigneeId: string;
  onCreated: () => void;
}) {
  const first = zonedDay(period.start);
  const last = zonedDay(period.end);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [start, setStart] = useState(first);
  const [due, setDue] = useState(last);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setProjectId((id) => (projects.some((p) => p.id === id) ? id : (projects[0]?.id ?? "")));
    setTitle("");
    setPriority("MEDIUM");
    setStart(first);
    setDue(last);
    setErrors({});
  }, [open, projects, first, last]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const inside = (d: string) => d >= first && d <= last;
    if (!inside(start) || !inside(due)) {
      setErrors({ dueDate: `Chọn ngày trong ${period.label}` });
      return;
    }
    if (due < start) {
      setErrors({ dueDate: "Hạn chót phải sau ngày bắt đầu" });
      return;
    }
    setBusy(true);
    try {
      await api("/api/tasks", {
        method: "POST",
        body: {
          projectId,
          title,
          assigneeId,
          priority,
          startDate: zonedDayEdge(start, "start"),
          dueDate: zonedDayEdge(due, "end"),
        },
      });
      toast.success(`Đã thêm vào kế hoạch ${period.short.toLowerCase()}`);
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {});
        toast.error(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Thêm việc vào kế hoạch ${period.short.toLowerCase()}`}
      description={`Tạo công việc giao cho bạn trong ${period.label}. Công việc xuất hiện trong dự án và trong báo cáo.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="plan-item-form" loading={busy} disabled={!title.trim() || !projectId}>
            Thêm vào kế hoạch
          </Button>
        </>
      }
    >
      <form id="plan-item-form" onSubmit={submit} className="space-y-4">
        <Field label="Dự án" error={errors.projectId}>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Công việc" error={errors.title}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Hoàn thiện tài liệu hướng dẫn"
            autoFocus
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Mức ưu tiên">
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {Object.entries(PRIORITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bắt đầu">
            <Input type="date" value={start} min={first} max={last} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field label="Hạn chót" error={errors.dueDate}>
            <Input type="date" value={due} min={start || first} max={last} onChange={(e) => setDue(e.target.value)} required />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
