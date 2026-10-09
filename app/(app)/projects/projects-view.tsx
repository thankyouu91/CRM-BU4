"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, FolderKanban, MessageSquare, Plus, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvatarStack } from "@/components/ui/avatar";
import { ProjectStatusBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader, Segmented } from "@/components/ui/misc";
import { ProgressRing } from "@/components/ui/progress";
import { ProjectFormModal } from "@/components/projects/project-form";
import type { Directory, ProjectListItemData } from "@/components/projects/types";
import { formatDate } from "@/lib/utils";

type Filter = "all" | "ACTIVE" | "PLANNING" | "ON_HOLD" | "COMPLETED";

export function ProjectsView({
  initial,
  directory,
  canCreate,
  canFinance,
}: {
  initial: ProjectListItemData[];
  directory: Directory;
  canCreate: boolean;
  /** Show the optional contract section when creating a project. */
  canFinance: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: initial.length };
    for (const p of initial) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [initial]);

  const shown = initial.filter(
    (p) =>
      (filter === "all" || p.status === filter) &&
      (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())),
  );

  const label = (text: string, key: string) => (
    <>
      {text}
      <span className="rounded bg-foreground/5 px-1 text-[10px] tabular-nums">{counts[key] ?? 0}</span>
    </>
  );

  return (
    <div>
      <PageHeader
        title="Dự án"
        description="Theo dõi tiến độ và quản lý toàn bộ dự án của bạn."
        actions={
          canCreate && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Tạo dự án
            </Button>
          )
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          layoutId="project-filter"
          value={filter}
          onChange={setFilter}
          className="max-w-full overflow-x-auto"
          options={[
            { value: "all", label: label("Tất cả", "all") },
            { value: "ACTIVE", label: label("Đang thực hiện", "ACTIVE") },
            { value: "PLANNING", label: label("Lên kế hoạch", "PLANNING") },
            { value: "ON_HOLD", label: label("Tạm dừng", "ON_HOLD") },
            { value: "COMPLETED", label: label("Hoàn thành", "COMPLETED") },
          ]}
        />
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm dự án…"
            className="h-10 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState
            icon={FolderKanban}
            title={initial.length ? "Không có dự án phù hợp" : "Chưa có dự án nào"}
            description={canCreate ? "Bắt đầu bằng việc tạo dự án đầu tiên và mời thành viên tham gia." : "Bạn sẽ thấy dự án ở đây khi được thêm làm thành viên."}
            action={
              canCreate && (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> Tạo dự án
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link
                href={`/projects/${p.id}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop"
              >
                <span className="absolute inset-x-0 top-0 h-1" style={{ background: p.color }} />
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <ProjectStatusBadge status={p.status} />
                    <h3 className="mt-2.5 line-clamp-2 text-base font-semibold leading-snug group-hover:text-primary">{p.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Chủ dự án: {p.owner.name}</p>
                  </div>
                  <ProgressRing value={p.progress} size={64} stroke={6} />
                </div>
                {p.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}

                <div className="mt-auto pt-5">
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-3 text-center">
                    <div>
                      <p className="text-base font-bold">
                        {p.doneTasks}
                        <span className="text-xs font-normal text-muted-foreground">/{p.totalTasks}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">Công việc</p>
                    </div>
                    <div>
                      <p className="flex items-center justify-center gap-1 text-base font-bold">
                        {p.overdueTasks > 0 && <TriangleAlert className="h-3.5 w-3.5 text-danger" />}
                        <span className={p.overdueTasks ? "text-danger" : undefined}>{p.overdueTasks}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">Quá hạn</p>
                    </div>
                    <div>
                      <p className="flex items-center justify-center gap-1 text-base font-bold">
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        {p._count.notes}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Ghi chú</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <AvatarStack users={p.members} max={5} />
                    {p.dueDate && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" /> {formatDate(p.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <ProjectFormModal
        open={creating}
        onClose={() => setCreating(false)}
        directory={directory}
        finance={canFinance ? { contracts: [] } : undefined}
        onSaved={(id) => router.push(`/projects/${id}`)}
      />
    </div>
  );
}
