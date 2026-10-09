"use client";

import { Pagination } from "@/components/ui/pagination";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCheck, CheckCircle2, Clock, Eye, Inbox, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { TaskStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, Segmented } from "@/components/ui/misc";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { api, ApiError, useApi } from "@/lib/client";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

interface InboxReport {
  id: string;
  content: string;
  progress: number;
  hoursSpent: number;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  author: { id: string; name: string; avatarColor: string; jobTitle: string | null };
  reviewer: { id: string; name: string } | null;
  task: { id: string; title: string; status: string; progress: number; project: { id: string; name: string; color: string } };
}

type Box = "received" | "sent";
type Status = "pending" | "reviewed" | "all";

function ReportCard({
  r,
  canReview,
  onOpenTask,
  onReviewed,
}: {
  r: InboxReport;
  canReview: boolean;
  onOpenTask: (id: string) => void;
  onReviewed: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"seen" | "approve" | null>(null);

  const review = async (approveTask: boolean) => {
    setBusy(approveTask ? "approve" : "seen");
    try {
      await api(`/api/reports/${r.id}`, { method: "PATCH", body: { reviewNote: note || null, approveTask } });
      toast.success(approveTask ? "Đã duyệt hoàn thành công việc" : "Đã đánh dấu đã xem");
      await onReviewed();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thể cập nhật");
    } finally {
      setBusy(null);
    }
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className={cn("rounded-2xl border bg-card p-5 shadow-card", !r.reviewedAt && canReview && "border-l-4 border-l-warning")}
    >
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex min-w-0 flex-1 gap-3">
          <Avatar name={r.author.name} color={r.author.avatarColor} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-semibold">{r.author.name}</span>
              {r.author.jobTitle && <span className="text-xs text-muted-foreground">{r.author.jobTitle}</span>}
              <span className="text-xs text-muted-foreground" title={formatDateTime(r.createdAt)}>
                · {timeAgo(r.createdAt)}
              </span>
            </div>
            <button onClick={() => onOpenTask(r.task.id)} className="mt-1 flex min-w-0 items-center gap-1.5 text-left text-sm hover:text-primary">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.task.project.color }} />
              <span className="truncate text-muted-foreground">{r.task.project.name} ›</span>
              <span className="truncate font-medium">{r.task.title}</span>
            </button>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{r.content}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 font-semibold text-primary">Tiến độ {r.progress}%</span>
              {r.hoursSpent > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {r.hoursSpent} giờ
                </span>
              )}
              <TaskStatusBadge status={r.task.status} />
            </div>
          </div>
        </div>

        <div className="lg:w-80 lg:border-l lg:pl-5">
          {r.reviewedAt ? (
            <div className="rounded-xl bg-success/10 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-success">
                <CheckCircle2 className="h-4 w-4" /> Đã xem xét
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.reviewer?.name ?? "Quản lý"} · {timeAgo(r.reviewedAt)}
              </p>
              {r.reviewNote && <p className="mt-2 text-sm">“{r.reviewNote}”</p>}
            </div>
          ) : canReview ? (
            <div className="space-y-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nhận xét cho người thực hiện…" className="h-9" />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" loading={busy === "seen"} disabled={!!busy} onClick={() => review(false)}>
                  <Eye className="h-3.5 w-3.5" /> Đã xem
                </Button>
                {r.task.status !== "DONE" && r.progress >= 100 && (
                  <Button size="sm" className="flex-1" loading={busy === "approve"} disabled={!!busy} onClick={() => review(true)}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Duyệt xong
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 rounded-xl bg-warning/10 p-3 text-sm font-medium text-warning">
              <Send className="h-4 w-4" /> Đã gửi · chờ quản lý xem xét
            </p>
          )}
        </div>
      </div>
    </motion.li>
  );
}

export function InboxView({
  isManager,
  initial,
  tabs,
}: {
  isManager: boolean;
  initial?: { reports: InboxReport[]; pendingCount: number; total: number; nextCursor: string | null };
  tabs?: React.ReactNode;
}) {
  const router = useRouter();
  const [box, setBox] = useState<Box>(isManager ? "received" : "sent");
  const [status, setStatus] = useState<Status>(isManager ? "pending" : "all");
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1];
  const { data, loading, error, reload } = useApi<{ reports: InboxReport[]; pendingCount: number; total: number; nextCursor: string | null }>(`/api/reports/inbox?box=${box}&status=${status}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { initial });

  const refresh = async () => {
    if (cursors.length > 1) setCursors([null]);
    else await reload();
    router.refresh(); // update the sidebar badge
  };

  const markAllSeen = async () => {
    const pending = (data?.reports ?? []).filter((r) => !r.reviewedAt);
    setBulk(true);
    try {
      for (const r of pending) await api(`/api/reports/${r.id}`, { method: "PATCH", body: {} });
      toast.success(`Đã đánh dấu ${pending.length} báo cáo là đã xem`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thể cập nhật");
    } finally {
      setBulk(false);
    }
  };

  const reports = data?.reports ?? [];
  const canReview = box === "received";

  return (
    <div>
      <PageHeader
        title="Hộp báo cáo"
        description={
          isManager
            ? "Báo cáo tiến độ do người thực hiện gửi về. Xem xét, phản hồi và duyệt hoàn thành công việc."
            : "Các báo cáo tiến độ bạn đã gửi và phản hồi từ quản lý."
        }
        actions={
          canReview &&
          status !== "reviewed" &&
          reports.some((r) => !r.reviewedAt) && (
            <Button variant="outline" onClick={markAllSeen} loading={bulk}>
              <CheckCheck className="h-4 w-4" /> Đánh dấu trang này đã xem
            </Button>
          )
        }
      />
      {tabs}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {isManager ? (
          <Segmented
            layoutId="inbox-box"
            value={box}
            onChange={(b) => {
              setBox(b);
              setCursors([null]);
              setStatus(b === "received" ? "pending" : "all");
            }}
            options={[
              {
                value: "received",
                label: (
                  <>
                    Nhận được
                    {!!data?.pendingCount && box === "received" && (
                      <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{data.pendingCount}</span>
                    )}
                  </>
                ),
              },
              { value: "sent", label: "Đã gửi" },
            ]}
          />
        ) : (
          <span />
        )}
        <Segmented
          layoutId="inbox-status"
          value={status}
          onChange={(value) => { setStatus(value); setCursors([null]); }}
          options={[
            { value: "pending", label: "Chờ xem xét" },
            { value: "reviewed", label: "Đã xem" },
            { value: "all", label: "Tất cả" },
          ]}
        />
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState
            icon={Inbox}
            title={status === "pending" ? "Không còn báo cáo nào chờ xem xét" : "Chưa có báo cáo"}
            description={canReview ? "Báo cáo mới từ người thực hiện sẽ xuất hiện tại đây." : "Gửi báo cáo tiến độ từ màn hình chi tiết công việc."}
          />
        </div>
      ) : (
        <ul className={cn("space-y-4 transition-opacity", loading && "opacity-60")}>
          <AnimatePresence initial={false}>
            {reports.map((r) => (
              <ReportCard key={r.id} r={r} canReview={canReview} onOpenTask={setOpenTask} onReviewed={refresh} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {error && <p role="alert" className="my-3 text-danger">{error}</p>}
      <Pagination total={data?.total ?? 0} page={cursors.length} busy={loading || bulk} hasNext={!!data?.nextCursor} onPrevious={() => setCursors((s) => s.slice(0, -1))} onNext={() => { if (data?.nextCursor) setCursors((s) => [...s, data.nextCursor]); }} />
      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} onChanged={refresh} />
    </div>
  );
}
