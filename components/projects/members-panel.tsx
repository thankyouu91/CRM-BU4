"use client";

import { useMemo, useState } from "react";
import { Crown, TriangleAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/client";
import { isOverdue } from "@/lib/dates";
import { PROJECT_ROLE_INFO, PROJECT_ROLES, type ProjectRoleKey } from "@/lib/permissions";
import type { ProjectDetailData } from "./types";

const ROLE_BADGE: Record<ProjectRoleKey, string> = {
  MANAGER: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  MEMBER: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  VIEWER: "bg-muted text-muted-foreground",
};

export function MembersPanel({
  project,
  canManage,
  onEditMembers,
  onChanged,
}: {
  project: ProjectDetailData;
  canManage: boolean;
  onEditMembers: () => void;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const roleOf = useMemo(() => new Map(project.members.map((m) => [m.id, m.projectRole])), [project.members]);

  // Change one member's project role; the rest of the list is sent unchanged.
  const changeRole = async (userId: string, role: ProjectRoleKey) => {
    setSaving(userId);
    try {
      const members = project.members.map((m) => ({ userId: m.id, role: m.id === userId ? role : m.projectRole }));
      await api(`/api/projects/${project.id}`, { method: "PATCH", body: { members } });
      toast.success("Đã cập nhật vai trò trong dự án");
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thể cập nhật vai trò");
    } finally {
      setSaving(null);
    }
  };

  const rows = useMemo(() => {
    const people = new Map([[project.owner.id, project.owner], ...project.members.map((m) => [m.id, m] as const)]);
    return Array.from(people.values())
      .map((u) => {
        const mine = project.tasks.filter((t) => t.assigneeId === u.id);
        const done = mine.filter((t) => t.status === "DONE").length;
        return {
          user: u,
          owner: u.id === project.ownerId,
          role: (u.id === project.ownerId ? "MANAGER" : (roleOf.get(u.id) ?? "MEMBER")) as ProjectRoleKey,
          assigned: mine.length,
          done,
          active: mine.filter((t) => t.status === "IN_PROGRESS" || t.status === "REVIEW").length,
          overdue: mine.filter((t) => isOverdue(t.dueDate, t.status)).length,
          rate: mine.length ? Math.round((done / mine.length) * 100) : 0,
        };
      })
      .sort((a, b) => Number(b.owner) - Number(a.owner) || b.assigned - a.assigned);
  }, [project, roleOf]);

  return (
    <div className="rounded-2xl border bg-card shadow-card">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h3 className="font-semibold">Thành viên dự án ({rows.length})</h3>
          <p className="text-xs text-muted-foreground">
            Vai trò trong dự án, khối lượng công việc và tỷ lệ hoàn thành của từng người
          </p>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={onEditMembers}>
            <UserPlus className="h-4 w-4" /> Quản lý thành viên
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-y bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-2.5 text-left font-medium">Thành viên</th>
              <th className="px-3 py-2.5 text-left font-medium">Vai trò</th>
              <th className="px-3 py-2.5 text-right font-medium">Được giao</th>
              <th className="px-3 py-2.5 text-right font-medium">Đang làm</th>
              <th className="px-3 py-2.5 text-right font-medium">Quá hạn</th>
              <th className="w-48 px-5 py-2.5 text-left font-medium">Hoàn thành</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user.id} className="border-b last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.user.name} color={r.user.avatarColor} />
                    <div>
                      <p className="flex items-center gap-1.5 font-medium">
                        {r.user.name}
                        {r.owner && <Crown className="h-3.5 w-3.5 text-warning" aria-label="Chủ dự án" />}
                      </p>
                      <p className="text-xs text-muted-foreground">{r.owner ? "Chủ dự án" : (r.user.jobTitle ?? "Thành viên")}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  {canManage && !r.owner ? (
                    <select
                      aria-label={`Vai trò của ${r.user.name} trong dự án`}
                      value={r.role}
                      disabled={saving === r.user.id}
                      onChange={(e) => changeRole(r.user.id, e.target.value as ProjectRoleKey)}
                      className="h-8 rounded-lg border bg-card px-2 text-xs outline-none focus:border-primary/60 disabled:opacity-60"
                    >
                      {PROJECT_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {PROJECT_ROLE_INFO[role].label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge className={ROLE_BADGE[r.role]}>{PROJECT_ROLE_INFO[r.role].label}</Badge>
                  )}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{r.assigned}</td>
                <td className="px-3 py-3 text-right tabular-nums">{r.active}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {r.overdue > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium text-danger">
                      <TriangleAlert className="h-3.5 w-3.5" /> {r.overdue}
                    </span>
                  ) : (
                    0
                  )}
                </td>
                <td className="px-5 py-3">
                  <ProgressBar value={r.rate} height={6} showLabel />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {r.done}/{r.assigned} việc
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="grid gap-3 border-t px-5 py-4 text-xs sm:grid-cols-3">
        {PROJECT_ROLES.map((role) => (
          <div key={role}>
            <dt>
              <Badge className={ROLE_BADGE[role]}>{PROJECT_ROLE_INFO[role].label}</Badge>
            </dt>
            <dd className="mt-1 text-muted-foreground">{PROJECT_ROLE_INFO[role].description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
