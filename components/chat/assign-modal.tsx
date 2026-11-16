"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { api, ApiError, useApi } from "@/lib/client";
import { fromInputDate } from "@/lib/dates";

interface Person {
  id: string;
  name: string;
}
interface ProjectOption {
  id: string;
  name: string;
  status: string;
  owner: Person;
  members: (Person & { projectRole: string })[];
}

export interface Assigned {
  task: { id: string; title: string };
  assignee: Person | null;
  dueDate: string;
}

/**
 * Turns a chat message into a task: the same POST /api/tasks as anywhere else, so the
 * project's rules decide who may give work to whom. Title and assignee come from the
 * message (the first @mentioned person who works in the chosen project).
 */
export function AssignModal({
  open,
  onClose,
  text,
  mentioned,
  author,
  onAssigned,
}: {
  open: boolean;
  onClose: () => void;
  /** The message as read: "@Bình làm báo giá…". */
  text: string;
  mentioned: Person[];
  author: string;
  onAssigned: (a: Assigned) => void;
}) {
  const projects = useApi<{ projects: ProjectOption[] }>(open ? "/api/projects" : null);
  const open_ = useMemo(() => (projects.data?.projects ?? []).filter((p) => p.status !== "COMPLETED" && p.status !== "CANCELLED"), [projects.data]);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Who can carry work in a project: its owner and members who are not view-only.
  const people = useMemo(() => {
    const p = open_.find((x) => x.id === projectId);
    if (!p) return [];
    const list = [p.owner, ...p.members.filter((m) => m.projectRole !== "VIEWER")];
    return list.filter((u, i) => list.findIndex((v) => v.id === u.id) === i);
  }, [open_, projectId]);

  // People @mentioned in the message who cannot take work in the chosen project.
  const outside = mentioned.filter((m) => !people.some((u) => u.id === m.id)).map((m) => m.name);

  useEffect(() => {
    if (!open) return;
    // The message without the names it mentions, first line: "@Bình làm báo giá" → "làm báo giá".
    let t = text;
    for (const m of mentioned) t = t.split(`@${m.name}`).join(" ");
    setTitle(t.split("\n")[0].replace(/\s+/g, " ").trim().slice(0, 200));
    setProjectId("");
    setAssigneeId("");
    setDueDate("");
    setErrors({});
  }, [open, text, mentioned]);

  useEffect(() => {
    setAssigneeId((cur) => (people.some((u) => u.id === cur) ? cur : (mentioned.find((m) => people.some((u) => u.id === m.id))?.id ?? "")));
  }, [people, mentioned]);

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      const res = await api<{ task: { id: string; title: string } }>("/api/tasks", {
        method: "POST",
        body: {
          projectId,
          title,
          description: `Giao từ Trao đổi chung (${author}):\n${text}`.slice(0, 4000),
          assigneeId: assigneeId || null,
          dueDate: fromInputDate(dueDate, "end"),
        },
      });
      onAssigned({ task: res.task, assignee: people.find((u) => u.id === assigneeId) ?? null, dueDate });
      onClose();
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fields ?? {});
      toast.error(e instanceof ApiError ? e.message : "Không giao được việc");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Giao việc"
      description="Tạo công việc trong dự án và báo vào Trao đổi chung."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit} loading={busy} disabled={!projectId || !title.trim()}>
            Giao việc
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Dự án" error={errors.projectId}>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Dự án" autoFocus>
            <option value="">{projects.data ? "Chọn dự án" : "Đang tải…"}</option>
            {open_.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Công việc" error={errors.title}>
          <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} aria-label="Tên công việc" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Người phụ trách" error={errors.assigneeId} hint={projectId ? (!people.length ? "Dự án chưa có thành viên" : outside.length ? `${outside.join(", ")} không làm trong dự án này: thêm vào dự án trước, hoặc chọn dự án khác` : undefined) : undefined}>
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} disabled={!projectId} aria-label="Người phụ trách">
              <option value="">Chưa giao</option>
              {people.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Hạn chót" error={errors.dueDate}>
            <DateInput aria-label="Hạn chót" value={dueDate} onChange={setDueDate} />
          </Field>
        </div>
        <Field label="Nội dung gốc">
          <Textarea value={text} readOnly rows={3} className="text-muted-foreground" />
        </Field>
      </div>
    </Modal>
  );
}
