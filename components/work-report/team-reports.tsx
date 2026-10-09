"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Eye, FileSpreadsheet, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { WorkPeriodNav, type PeriodRef } from "./period-nav";
import { api, useApi } from "@/lib/client";
import { cn, timeAgo } from "@/lib/utils";
import { periodQuery, sectionTitles, zonedText, type TeamMemberReport, type TeamWorkReports } from "@/lib/work-report";

/** Boss overview: everyone whose weekly / monthly report I may read, with the state of their report. */
export function TeamWorkReportsView({
  period,
  onPeriodChange,
  initial,
}: {
  period: PeriodRef;
  onPeriodChange: (p: PeriodRef) => void;
  initial?: TeamWorkReports;
}) {
  const { data, error, loading } = useApi<TeamWorkReports>(`/api/work-reports/team?${periodQuery(period)}`, { initial });
  const [exporting, setExporting] = useState(false);
  const ready = !!data && data.period.type === period.type && data.period.key === period.key;
  const titles = sectionTitles(period.type);
  const members = ready ? data.members : [];
  const sent = members.filter((m) => m.state === "SUBMITTED");
  const count = {
    sent: sent.length,
    draft: members.filter((m) => m.state === "DRAFT").length,
    none: members.filter((m) => m.state === "NONE").length,
    toReview: sent.filter((m) => !m.report?.reviewedAt || m.report.reviewStale).length,
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const [full, { exportTeamWorkReportsXlsx }] = await Promise.all([
        api<TeamWorkReports>(`/api/work-reports/team?${periodQuery(period)}&detail=1`),
        import("@/lib/export/work-report-xlsx"),
      ]);
      await exportTeamWorkReportsXlsx(full, `tong-hop-bao-cao-${period.key.toLowerCase()}.xlsx`);
    } catch (e) {
      console.error(e);
      toast.error("Không xuất được file Excel");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <WorkPeriodNav value={period} onChange={onPeriodChange} label={ready ? data.period.label : undefined} />
        <Button variant="outline" onClick={exportAll} loading={exporting} disabled={!members.length}>
          <FileSpreadsheet className="h-4 w-4" /> Xuất Excel tổng hợp
        </Button>
      </div>

      {error && !ready ? (
        <p className="rounded-2xl border bg-card py-12 text-center text-sm text-danger">{error}</p>
      ) : !ready ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState icon={Users} title="Chưa có nhân sự cấp dưới" description="Báo cáo tuần / tháng của người ở cấp thấp hơn bạn sẽ xuất hiện tại đây." />
        </div>
      ) : (
        <div className={cn("transition-opacity", loading && "opacity-60")}>
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <Chip className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              Đã gửi {count.sent}/{members.length}
            </Chip>
            {count.toReview > 0 && <Chip className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Chờ xem {count.toReview}</Chip>}
            <Chip className="bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300">Nháp {count.draft}</Chip>
            <Chip className="bg-muted text-muted-foreground">Chưa có {count.none}</Chip>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_repeat(4,minmax(0,0.8fr))_1.5rem] gap-3 border-b bg-muted/40 px-5 py-2.5 text-xs font-medium text-muted-foreground lg:grid">
              <span>Nhân sự</span>
              <span>Trạng thái</span>
              <span className="text-right">{titles.last.replace(" đã làm", "")} xong</span>
              <span className="text-right">Đang làm</span>
              <span className="text-right">Quá hạn</span>
              <span className="text-right">Kế hoạch {titles.unit} tới</span>
              <span />
            </div>
            <ul className="divide-y">
              {members.map((m) => (
                <MemberRow key={m.author.id} m={m} href={`/inbox/work/${m.author.id}?${periodQuery(period)}`} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("rounded-md px-2 py-1 font-semibold", className)}>{children}</span>;
}

function MemberState({ m }: { m: TeamMemberReport }) {
  const r = m.report;
  if (m.state === "NONE" || !r) return <span className="text-sm text-muted-foreground">Chưa có báo cáo</span>;
  if (m.state === "DRAFT") {
    return (
      <span className="text-sm">
        <span className="font-medium text-slate-600 dark:text-slate-300">Nháp</span>
        <span className="text-xs text-muted-foreground"> · cập nhật {timeAgo(r.updatedAt)}</span>
      </span>
    );
  }
  const seen = r.reviewedAt && !r.reviewStale;
  return (
    <span className="block text-sm">
      <span className="font-medium text-success">Đã gửi</span>
      <span className="text-xs text-muted-foreground"> · {zonedText(r.submittedAt, "datetime")}</span>
      <span className={cn("mt-0.5 flex items-center gap-1 text-xs", seen ? "text-success" : "text-warning")}>
        {seen ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {seen ? `${r.reviewedBy?.name ?? "Cấp trên"} đã xem` : r.reviewedAt ? "Gửi lại, chưa xem bản mới" : "Chờ xem"}
      </span>
    </span>
  );
}

function MemberRow({ m, href }: { m: TeamMemberReport; href: string }) {
  const t = m.totals;
  const stat = (label: string, value: number, danger = false) => (
    <span className="flex items-baseline justify-between gap-2 text-sm lg:block lg:text-right">
      <span className="text-xs text-muted-foreground lg:hidden">{label}</span>
      <span className={cn("font-semibold tabular-nums", danger && value > 0 && "text-danger")}>{value}</span>
    </span>
  );
  return (
    <li>
      <Link
        href={href}
        className="grid grid-cols-2 items-center gap-3 px-5 py-3.5 hover:bg-muted/40 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_repeat(4,minmax(0,0.8fr))_1.5rem]"
      >
        <span className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
          <Avatar name={m.author.name} color={m.author.avatarColor} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{m.author.name}</span>
            <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <RoleBadge role={m.author.role} />
              {m.author.jobTitle}
            </span>
          </span>
        </span>
        <span className="col-span-2 lg:col-span-1">
          <MemberState m={m} />
        </span>
        {stat("Kỳ trước xong", t.lastDone)}
        {stat("Đang làm", t.currentOpen)}
        {stat("Quá hạn", t.overdue, true)}
        {stat("Kế hoạch kỳ tới", t.next)}
        <ChevronRight className="hidden h-4 w-4 text-muted-foreground lg:block" />
      </Link>
    </li>
  );
}
