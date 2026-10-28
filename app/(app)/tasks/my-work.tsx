"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { FileText, ListChecks } from "lucide-react";
import { PageHeader, Segmented } from "@/components/ui/misc";
import { replacePeriodInUrl, WorkPeriodNav, type PeriodRef } from "@/components/work-report/period-nav";
import type { WorkReportData } from "@/lib/work-report";
import { MyTasksView } from "./tasks-view";

const WorkReportScreen = dynamic(() => import("@/components/work-report/report-view").then((m) => m.WorkReportScreen), {
  loading: () => <p role="status" className="py-12 text-center text-sm text-muted-foreground">Đang tải báo cáo…</p>,
});

export type MyWorkTab = "list" | "report";

/** "Công việc của tôi": the task list and the weekly / monthly report, as two tabs. */
export function MyWork({
  tab: initialTab,
  canSeeAll,
  initialTasks,
  initialCalendar,
  initialFilter,
  projects,
  initialReport,
  initialPeriod,
}: {
  tab: MyWorkTab;
  canSeeAll: boolean;
  initialTasks?: Parameters<typeof MyTasksView>[0]["initial"];
  initialCalendar?: Parameters<typeof MyTasksView>[0]["initialCalendar"];
  initialFilter?: Parameters<typeof MyTasksView>[0]["initialFilter"];
  projects: { id: string; name: string }[];
  initialReport?: WorkReportData;
  initialPeriod: PeriodRef;
}) {
  const [tab, setTabState] = useState<MyWorkTab>(initialTab);
  const [period, setPeriodState] = useState<PeriodRef>(initialPeriod);
  // Data sent with the page is for the first view only; after a switch the views use their cached copy.
  const [fresh, setFresh] = useState(true);

  const setTab = (t: MyWorkTab) => {
    setTabState(t);
    setFresh(false);
    const sp = new URLSearchParams(window.location.search);
    if (t === "list") sp.delete("tab");
    else sp.set("tab", t);
    const qs = sp.toString();
    // Only the address bar changes: router.replace would render the whole page again on the server.
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };
  const setPeriod = (p: PeriodRef) => {
    setPeriodState(p);
    replacePeriodInUrl(p);
  };

  const tabs = (
    <div className="mb-5 print:hidden">
      <Segmented
        layoutId="my-work-tab"
        value={tab}
        onChange={setTab}
        options={[
          {
            value: "list",
            label: (
              <>
                <ListChecks className="h-3.5 w-3.5" /> Danh sách công việc
              </>
            ),
          },
          {
            value: "report",
            label: (
              <>
                <FileText className="h-3.5 w-3.5" /> Báo cáo tuần / tháng
              </>
            ),
          },
        ]}
      />
    </div>
  );

  if (tab === "list") return <MyTasksView canSeeAll={canSeeAll} initial={fresh ? initialTasks : undefined} initialCalendar={fresh ? initialCalendar : undefined} initialFilter={initialFilter} projects={projects} tabs={tabs} />;

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Công việc của tôi"
          description="Báo cáo việc đã làm, đang làm và kế hoạch theo tuần hoặc tháng để gửi cấp trên. Danh sách công việc luôn lấy trực tiếp từ công việc và dự án của bạn."
        />
      </div>
      {tabs}
      <WorkReportScreen
        period={period}
        initial={fresh ? initialReport : undefined}
        toolbar={<WorkPeriodNav value={period} onChange={setPeriod} />}
      />
    </div>
  );
}
