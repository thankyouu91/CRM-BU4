"use client";

import { useMemo } from "react";
import { Crown, TriangleAlert, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { isOverdue } from "@/lib/dates";
import type { ProjectDetailData } from "./types";

export function MembersPanel({
  project,
  canManage,
  onEditMembers,
}: {
  project: ProjectDetailData;
  canManage: boolean;
  onEditMembers: () => void;
}) {
  const rows = useMemo(() => {
    const people = new Map([[project.owner.id, project.owner], ...project.members.map((m) => [m.id, m] as const)]);
    return Array.from(people.values())
      .map((u) => {
        const mine = project.tasks.filter((t) => t.assigneeId === u.id);
        const done = mine.filter((t) => t.status === "DONE").length;
        return {
          user: u,
          owner: u.id === project.ownerId,
          assigned: mine.length,
          done,
          active: mine.filter((t) => t.status === "IN_PROGRESS" || t.status === "REVIEW").length,
          overdue: mine.filter((t) => isOverdue(t.dueDate, t.status)).length,
          rate: mine.length ? Math.round((done / mine.length) * 100) : 0,
        };
      })
      .sort((a, b) => Number(b.owner) - Number(a.owner) || b.assigned - a.assigned);
  }, [project]);

  return (
    <div className="rounded-2xl border bg-card shadow-card">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h3 className="font-semibold">Thành viên dự án ({rows.length})</h3>
          <p className="text-xs text-muted-foreground">Khối lượng công việc và tỷ lệ hoàn thành của từng người phụ trách</p>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={onEditMembers}>
            <UserPlus className="h-4 w-4" /> Quản lý thành viên
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-y bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-2.5 text-left font-medium">Thành viên</th>
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
    </div>
  );
}
