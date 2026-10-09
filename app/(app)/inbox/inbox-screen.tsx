"use client";

import { useState } from "react";
import { CalendarRange, Inbox } from "lucide-react";
import { PageHeader, Segmented } from "@/components/ui/misc";
import { replacePeriodInUrl, type PeriodRef } from "@/components/work-report/period-nav";
import { TeamWorkReportsView } from "@/components/work-report/team-reports";
import type { TeamWorkReports } from "@/lib/work-report";
import { InboxView } from "./inbox-view";

export type InboxTab = "progress" | "weekly";

/** "Hộp báo cáo": progress reports on tasks, and for people with staff below them, their weekly / monthly reports. */
export function InboxScreen({
  isManager,
  seesTeam,
  tab: initialTab,
  initial,
  initialTeam,
  initialPeriod,
}: {
  isManager: boolean;
  /** Someone's level is below mine (shows the weekly / monthly tab). */
  seesTeam: boolean;
  tab: InboxTab;
  initial?: Parameters<typeof InboxView>[0]["initial"];
  initialTeam?: TeamWorkReports;
  initialPeriod: PeriodRef;
}) {
  const [tab, setTabState] = useState<InboxTab>(initialTab);
  const [period, setPeriodState] = useState<PeriodRef>(initialPeriod);
  // Data sent with the page is for the first view only; after a switch the views use their cached copy.
  const [fresh, setFresh] = useState(true);

  if (!seesTeam) return <InboxView isManager={isManager} initial={initial} />;

  const setTab = (t: InboxTab) => {
    setTabState(t);
    setFresh(false);
    const sp = new URLSearchParams(window.location.search);
    if (t === "progress") sp.delete("tab");
    else sp.set("tab", t);
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };
  const setPeriod = (p: PeriodRef) => {
    setPeriodState(p);
    replacePeriodInUrl(p);
  };

  const tabs = (
    <div className="mb-5">
      <Segmented
        layoutId="inbox-tab"
        value={tab}
        onChange={setTab}
        options={[
          {
            value: "progress",
            label: (
              <>
                <Inbox className="h-3.5 w-3.5" /> Báo cáo tiến độ
              </>
            ),
          },
          {
            value: "weekly",
            label: (
              <>
                <CalendarRange className="h-3.5 w-3.5" /> Báo cáo tuần / tháng
              </>
            ),
          },
        ]}
      />
    </div>
  );

  if (tab === "progress") return <InboxView isManager={isManager} initial={fresh ? initial : undefined} tabs={tabs} />;

  return (
    <div>
      <PageHeader
        title="Hộp báo cáo"
        description="Báo cáo công việc tuần / tháng của nhân sự cấp dưới: ai đã gửi, ai còn nháp, ai chưa có. Mở từng người để đọc và đánh dấu đã xem."
      />
      {tabs}
      <TeamWorkReportsView period={period} onPeriodChange={setPeriod} initial={fresh ? initialTeam : undefined} />
    </div>
  );
}
