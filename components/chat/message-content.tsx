"use client";

import Link from "next/link";
import { chatParts } from "@/lib/chat";
import type { ChatTaskView } from "@/lib/chat-queries";
import { TASK_STATUS, taskLink } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";

/** A message's text with its @mentions highlighted and #task tags as live cards. */
export function MessageContent({ content, tasks, meId }: { content: string; tasks: Record<string, ChatTaskView>; meId: string }) {
  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
      {chatParts(content).map((p, i) => {
        if (p.kind === "text") return <span key={i}>{p.text}</span>;
        if (p.kind === "mention") {
          return (
            <span key={i} className={cn("rounded px-1 font-medium", p.id === meId ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" : "bg-primary/10 text-primary")}>
              @{p.name}
            </span>
          );
        }
        const t = tasks[p.id];
        // Not in a project this person sees: the title the author wrote, nothing more.
        if (!t) return <span key={i} className="rounded bg-muted px-1 text-muted-foreground" title="Bạn không xem được công việc này">#{p.title}</span>;
        const status = TASK_STATUS[t.status as keyof typeof TASK_STATUS];
        return (
          <Link
            key={i}
            href={taskLink(t.projectId, t.id)}
            className="mx-0.5 inline-flex max-w-full items-center gap-1.5 rounded-md border bg-card px-1.5 py-0.5 align-middle text-xs hover:bg-muted"
            title={`${t.projectName}${t.assigneeName ? ` · ${t.assigneeName}` : " · chưa giao"}${t.dueDate ? ` · hạn ${formatDate(t.dueDate)}` : ""}`}
          >
            <span className="truncate font-medium">#{t.title}</span>
            <span className="shrink-0 text-muted-foreground">
              {status?.label ?? t.status} · {Math.round(t.progress)}%
            </span>
          </Link>
        );
      })}
    </div>
  );
}
