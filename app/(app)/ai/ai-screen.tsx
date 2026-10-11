"use client";

import { useState } from "react";
import { ClipboardCopy, MessagesSquare } from "lucide-react";
import { PageHeader, Segmented } from "@/components/ui/misc";
import { AiView, type BuiltInAi } from "./ai-view";
import { ChatView } from "./chat-view";
import type { ReportPeriod } from "@/components/reports/period-filter";

export type AiTab = "chat" | "prompt";

/** The AI page: chat with Claude (built-in AI), or package a report prompt for Claude.ai. */
export function AiScreen({
  tab: initialTab,
  userId,
  userName,
  projects,
  builtIn,
  canFinance,
  initial,
}: {
  tab: AiTab;
  userId: string;
  userName: string;
  projects: { id: string; name: string; color: string }[];
  builtIn: BuiltInAi;
  canFinance: boolean;
  initial: { type: ReportPeriod; anchor: string; from: string; to: string; projectId: string };
}) {
  const [tab, setTabState] = useState<AiTab>(initialTab);
  const setTab = (t: AiTab) => {
    setTabState(t);
    // Keep the tab in the URL so a reload or a shared link opens the same view.
    const url = new URL(window.location.href);
    if (t === "chat") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url);
  };

  return (
    <div>
      <PageHeader
        title="Trợ lý AI"
        description={
          tab === "chat"
            ? "Trò chuyện với Claude về dự án, tiến độ và nhân sự, dựa trên số liệu thật theo quyền xem của bạn."
            : "Đóng gói số liệu thật thành prompt chuẩn để dùng với Claude.ai hoặc Claude Code, không cần API key."
        }
      />
      <Segmented
        layoutId="ai-tab"
        value={tab}
        onChange={setTab}
        className="mb-5"
        options={[
          { value: "chat", label: <><MessagesSquare className="h-3.5 w-3.5" /> Trò chuyện</> },
          { value: "prompt", label: <><ClipboardCopy className="h-3.5 w-3.5" /> Sao chép prompt</> },
        ]}
      />
      {tab === "chat" ? (
        <ChatView userId={userId} userName={userName} projects={projects} builtIn={builtIn} canFinance={canFinance} initialProjectId={initial.projectId} />
      ) : (
        <AiView embedded projects={projects} userName={userName} builtIn={builtIn} initial={initial} />
      )}
    </div>
  );
}
