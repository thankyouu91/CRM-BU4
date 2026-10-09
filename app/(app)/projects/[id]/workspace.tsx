"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChartColumn,
  Kanban as KanbanIcon,
  Layers,
  List,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  Users,
  Eye,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AvatarStack } from "@/components/ui/avatar";
import { ProjectStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Segmented } from "@/components/ui/misc";
import { ProgressRing } from "@/components/ui/progress";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { TaskCreateModal } from "@/components/tasks/task-create-modal";
import { TaskList, type TaskFilters } from "@/components/projects/task-list";
import { Kanban } from "@/components/projects/kanban";
import type { ProjectContracts } from "@/components/projects/finance-panel";
import { useWorkspace, type WorkspaceData } from "@/components/projects/use-workspace";
import type { Directory, ProjectCategory } from "@/components/projects/types";
import { api, ApiError, useApi } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { isOverdue } from "@/lib/dates";
import { PROJECT_ROLE_INFO } from "@/lib/permissions";

// Tabs and dialogs that aren't on screen at first load separately (the progress
// tab carries the chart library) and are fetched once the browser is idle.
const panelFallback = () => (
  <div className="flex justify-center py-16">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);
const loaders = {
  progress: () => import("@/components/projects/progress-panel"),
  finance: () => import("@/components/projects/finance-panel"),
  notes: () => import("@/components/projects/notes-panel"),
  members: () => import("@/components/projects/members-panel"),
  category: () => import("@/components/projects/category-modal"),
  form: () => import("@/components/projects/project-form"),
};
const ProgressPanel = dynamic(() => loaders.progress().then((m) => m.ProgressPanel), { loading: panelFallback });
const FinancePanel = dynamic(() => loaders.finance().then((m) => m.FinancePanel), { loading: panelFallback });
const NotesPanel = dynamic(() => loaders.notes().then((m) => m.NotesPanel), { loading: panelFallback });
const MembersPanel = dynamic(() => loaders.members().then((m) => m.MembersPanel), { loading: panelFallback });
const CategoryModal = dynamic(() => loaders.category().then((m) => m.CategoryModal));
const ProjectFormModal = dynamic(() => loaders.form().then((m) => m.ProjectFormModal));

type Tab = "tasks" | "progress" | "finance" | "notes" | "members";
const TABS: Tab[] = ["tasks", "progress", "finance", "notes", "members"];

export function ProjectWorkspace({
  projectId,
  meId,
  directory,
  canFinance,
  initial,
  initialFinance,
}: {
  projectId: string;
  meId: string;
  directory: Directory;
  /** Holders of "Hợp đồng & chi phí" see and edit the project's contracts. */
  canFinance: boolean;
  /** Rendered with the page, so the workspace shows without a second request. */
  initial: WorkspaceData;
  initialFinance?: ProjectContracts;
}) {
  const router = useRouter();
  const params = useSearchParams();
  // Task changes go through `send`: the list updates at once and the server's answer carries the refreshed project.
  const { data, error, reload, send } = useWorkspace(projectId, initial);
  // One source for the project's money: the same contract records as /contracts.
  const finance = useApi<ProjectContracts>(canFinance ? `/api/contracts?projectId=${projectId}` : null, { initial: initialFinance });

  const initialTab = params.get("tab") as Tab | null;
  const [tab, setTabState] = useState<Tab>(initialTab && TABS.includes(initialTab) && (initialTab !== "finance" || canFinance) ? initialTab : "tasks");
  const [view, setView] = useState<"list" | "kanban">("list");
  const [filters, setFilters] = useState<TaskFilters>({ mine: false, hideDone: false });
  const [openTask, setOpenTask] = useState<string | null>(params.get("task"));
  const [creating, setCreating] = useState(false);
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category: ProjectCategory | null; parentId?: string | null }>({
    open: false,
    category: null,
  });
  const [deletingCategory, setDeletingCategory] = useState<ProjectCategory | null>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  useEffect(() => {
    const prefetch = () => Object.values(loaders).forEach((load) => void load());
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 1500);
    return () => clearTimeout(id);
  }, []);

  const setTab = (t: Tab) => {
    setTabState(t);
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", t);
    // Only the address bar changes: router.replace would render the whole page again on the server.
    window.history.replaceState(null, "", `?${sp.toString()}`);
  };

  // Everyone in the project (avatars), and the people work can be assigned to.
  const people = useMemo(() => {
    if (!data) return [];
    const map = new Map([[data.project.owner.id, data.project.owner], ...data.project.members.map((m) => [m.id, m] as const)]);
    return Array.from(map.values());
  }, [data]);
  const assignable = useMemo(
    () => people.filter((u) => u.id === data?.project.ownerId || !("projectRole" in u) || u.projectRole !== "VIEWER"),
    [people, data],
  );

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <TriangleAlert className="h-8 w-8 text-danger" />
        <p>{error}</p>
        <Link href="/projects" className="text-sm text-primary hover:underline">
          Quay lại danh sách dự án
        </Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { project: p, canManage, canContribute, canDelete, projectRole } = data;
  const done = p.tasks.filter((t) => t.status === "DONE").length;
  const overdue = p.tasks.filter((t) => isOverdue(t.dueDate, t.status)).length;
  const daysLeft = p.dueDate ? Math.ceil((new Date(p.dueDate).getTime() - Date.now()) / 86_400_000) : null;

  return (
    <div>
      <Link href="/projects" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Dự án
      </Link>

      {/* Header */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border bg-card p-6 shadow-card">
        <span className="absolute inset-x-0 top-0 h-1" style={{ background: p.color }} />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
              <ProjectStatusBadge status={p.status} />
            </div>
            {p.description && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{p.description}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <span className="text-muted-foreground">
                Chủ dự án: <span className="font-medium text-foreground">{p.owner.name}</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                Vai trò của bạn:{" "}
                <span className="font-medium text-foreground">
                  {projectRole === "MANAGER"
                    ? PROJECT_ROLE_INFO.MANAGER.label
                    : canManage
                      ? "Quản lý (toàn hệ thống)"
                      : projectRole
                        ? PROJECT_ROLE_INFO[projectRole].label
                        : "Người xem (toàn hệ thống)"}
                </span>
              </span>
              {(p.startDate || p.dueDate) && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  {formatDate(p.startDate) || "—"} → {formatDate(p.dueDate) || "—"}
                  {daysLeft !== null && p.status !== "COMPLETED" && (
                    <span className={daysLeft < 0 ? "font-medium text-danger" : "font-medium text-foreground"}>
                      ({daysLeft < 0 ? `trễ ${-daysLeft} ngày` : `còn ${daysLeft} ngày`})
                    </span>
                  )}
                </span>
              )}
              <span className="flex items-center gap-2">
                <AvatarStack users={people} max={6} size="sm" />
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="text-right text-sm">
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">{done}</span>/{p.tasks.length} công việc
              </p>
              {overdue > 0 && (
                <p className="mt-1 flex items-center justify-end gap-1 text-xs font-medium text-danger">
                  <TriangleAlert className="h-3.5 w-3.5" /> {overdue} quá hạn
                </p>
              )}
            </div>
            <ProgressRing value={p.progress} size={96} stroke={9} label={<><span className="text-xl font-bold">{p.progress}%</span><span className="text-[10px] text-muted-foreground">hoàn thành</span></>} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t pt-5">
          {canContribute ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Thêm công việc
            </Button>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" /> Bạn đang xem dự án này ở chế độ chỉ xem
            </span>
          )}
          {canManage && (
            <>
              <Button size="sm" variant="outline" onClick={() => setCategoryModal({ open: true, category: null })}>
                <Layers className="h-4 w-4" /> Thêm hạng mục
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingProject(true)}>
                <Pencil className="h-4 w-4" /> Sửa dự án
              </Button>
            </>
          )}
          <Link href={`/reports?projectId=${p.id}`}>
            <Button size="sm" variant="outline">
              <ChartColumn className="h-4 w-4" /> Báo cáo & trình chiếu
            </Button>
          </Link>
          {canDelete && (
            <Button size="sm" variant="ghost" className="ml-auto text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setDeletingProject(true)}>
              <Trash2 className="h-4 w-4" /> Xoá dự án
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          layoutId="project-tab"
          value={tab}
          onChange={setTab}
          className="max-w-full overflow-x-auto"
          options={[
            { value: "tasks", label: <><List className="h-3.5 w-3.5" /> Công việc</> },
            { value: "progress", label: <><ChartColumn className="h-3.5 w-3.5" /> Tiến độ</> },
            ...(canFinance ? [{ value: "finance" as const, label: <><Wallet className="h-3.5 w-3.5" /> Hợp đồng & chi phí</> }] : []),
            { value: "notes", label: <><MessageSquare className="h-3.5 w-3.5" /> Ghi chú & phản hồi</> },
            { value: "members", label: <><Users className="h-3.5 w-3.5" /> Thành viên</> },
          ]}
        />
        {tab === "tasks" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-xs">
              <input type="checkbox" checked={filters.mine} onChange={(e) => setFilters({ ...filters, mine: e.target.checked })} className="accent-[rgb(var(--primary))]" />
              Việc của tôi
            </label>
            {view === "list" && (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-xs">
                <input type="checkbox" checked={filters.hideDone} onChange={(e) => setFilters({ ...filters, hideDone: e.target.checked })} className="accent-[rgb(var(--primary))]" />
                Ẩn việc đã xong
              </label>
            )}
            <Segmented
              layoutId="task-view"
              value={view}
              onChange={setView}
              options={[
                { value: "list", label: <><List className="h-3.5 w-3.5" /> Danh sách</> },
                { value: "kanban", label: <><KanbanIcon className="h-3.5 w-3.5" /> Kanban</> },
              ]}
            />
          </div>
        )}
      </div>

      {tab === "tasks" &&
        (view === "list" ? (
          <TaskList
            projectId={p.id}
            categories={p.categories}
            tasks={p.tasks}
            filters={filters}
            meId={meId}
            canManage={canManage}
            canContribute={canContribute}
            onOpen={setOpenTask}
            send={send}
            onEditCategory={(c) => setCategoryModal({ open: true, category: c })}
            onDeleteCategory={setDeletingCategory}
            onAddSubCategory={(parent) => setCategoryModal({ open: true, category: null, parentId: parent.id })}
          />
        ) : (
          <Kanban tasks={p.tasks} categories={p.categories} filters={filters} meId={meId} canManage={canManage} canContribute={canContribute} onOpen={setOpenTask} send={send} />
        ))}
      {tab === "progress" && <ProgressPanel project={p} />}
      {tab === "finance" && canFinance && <FinancePanel project={p} data={finance.data} onChanged={finance.reload} />}
      {tab === "notes" && <NotesPanel projectId={p.id} meId={meId} canManage={canManage} />}
      {tab === "members" && <MembersPanel project={p} canManage={canManage} onEditMembers={() => setEditingProject(true)} onChanged={reload} />}

      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} send={send} />
      <TaskCreateModal
        open={creating}
        onClose={() => setCreating(false)}
        projectId={p.id}
        categories={p.categories}
        people={assignable}
        send={send}
        onCreated={setOpenTask}
      />
      <CategoryModal
        open={categoryModal.open}
        onClose={() => setCategoryModal({ open: false, category: null })}
        projectId={p.id}
        category={categoryModal.category}
        categories={p.categories}
        defaultParentId={categoryModal.parentId ?? null}
        onSaved={reload}
      />
      <ProjectFormModal
        open={editingProject}
        onClose={() => setEditingProject(false)}
        directory={directory}
        finance={canFinance ? { contracts: finance.data?.contracts ?? null } : undefined}
        onSaved={() => {
          void reload();
          if (canFinance) void finance.reload();
          router.refresh();
        }}
        initial={{
          id: p.id,
          name: p.name,
          description: p.description,
          status: p.status,
          color: p.color,
          startDate: p.startDate,
          dueDate: p.dueDate,
          ownerId: p.ownerId,
          members: p.members.map((m) => ({ userId: m.id, role: m.projectRole })),
        }}
      />
      <ConfirmDialog
        open={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        title="Xoá hạng mục?"
        danger
        confirmLabel="Xoá hạng mục"
        message={
          <>
            Hạng mục <b className="text-foreground">{deletingCategory?.name}</b>
            {deletingCategory && p.categories.some((c) => c.parentId === deletingCategory.id) ? " và các hạng mục con của nó" : ""} sẽ bị xoá. Các công
            việc bên trong được giữ lại và chuyển sang “Chưa phân loại”.
          </>
        }
        onConfirm={async () => {
          try {
            await api(`/api/categories/${deletingCategory!.id}`, { method: "DELETE" });
            toast.success("Đã xoá hạng mục");
            await reload();
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : "Không thể xoá");
          }
        }}
      />
      <ConfirmDialog
        open={deletingProject}
        onClose={() => setDeletingProject(false)}
        title="Xoá dự án?"
        danger
        confirmLabel="Xoá vĩnh viễn"
        message={
          <>
            Toàn bộ <b className="text-foreground">{p.tasks.length} công việc</b>, báo cáo và ghi chú của dự án <b className="text-foreground">{p.name}</b>{" "}
            sẽ bị xoá vĩnh viễn. Không thể hoàn tác.
          </>
        }
        onConfirm={async () => {
          try {
            await api(`/api/projects/${p.id}`, { method: "DELETE" });
            toast.success("Đã xoá dự án");
            router.push("/projects");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : "Không thể xoá");
          }
        }}
      />
    </div>
  );
}
