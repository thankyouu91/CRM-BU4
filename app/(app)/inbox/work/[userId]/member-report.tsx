"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { replacePeriodInUrl, WorkPeriodNav, type PeriodRef } from "@/components/work-report/period-nav";
import { WorkReportScreen } from "@/components/work-report/report-view";
import { periodQuery, type WorkReportData } from "@/lib/work-report";

export function MemberWorkReport({ userId, initial, initialPeriod }: { userId: string; initial: WorkReportData; initialPeriod: PeriodRef }) {
  const [period, setPeriodState] = useState<PeriodRef>(initialPeriod);
  const setPeriod = (p: PeriodRef) => {
    setPeriodState(p);
    replacePeriodInUrl(p);
  };
  return (
    <div>
      <Link
        href={`/inbox?tab=weekly&${periodQuery(period)}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> Báo cáo tuần / tháng của nhân sự
      </Link>
      <WorkReportScreen userId={userId} period={period} initial={initial} toolbar={<WorkPeriodNav value={period} onChange={setPeriod} />} />
    </div>
  );
}
