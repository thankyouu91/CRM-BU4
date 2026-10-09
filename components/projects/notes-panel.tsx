"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, MessageSquareQuote, Send, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge, RoleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { EmptyState, Segmented } from "@/components/ui/misc";
import { api, ApiError, useApi } from "@/lib/client";
import { formatDateTime, timeAgo } from "@/lib/utils";

interface Note {
  id: string;
  type: "NOTE" | "FEEDBACK";
  content: string;
  createdAt: string;
  authorId: string;
  author: { id: string; name: string; avatarColor: string; role: string };
}

type Filter = "ALL" | "NOTE" | "FEEDBACK";

export function NotesPanel({ projectId, meId, canManage }: { projectId: string; meId: string; canManage: boolean }) {
  const { data, reload } = useApi<{ notes: Note[] }>(`/api/projects/${projectId}/notes`);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [type, setType] = useState<"NOTE" | "FEEDBACK">("FEEDBACK");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const notes = (data?.notes ?? []).filter((n) => filter === "ALL" || n.type === filter);
  const count = (t: Filter) => (data?.notes ?? []).filter((n) => t === "ALL" || n.type === t).length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/notes`, { method: "POST", body: { content, type } });
      setContent("");
      toast.success(type === "FEEDBACK" ? "Đã gửi phản hồi" : "Đã lưu ghi chú");
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể lưu");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/api/notes/${id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể xoá");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="order-2 lg:order-1">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Segmented
            layoutId="notes-filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "ALL", label: `Tất cả (${count("ALL")})` },
              { value: "FEEDBACK", label: `Phản hồi (${count("FEEDBACK")})` },
              { value: "NOTE", label: `Ghi chú (${count("NOTE")})` },
            ]}
          />
        </div>
        {notes.length === 0 ? (
          <div className="rounded-2xl border bg-card">
            <EmptyState icon={MessageSquare} title="Chưa có ghi chú hay phản hồi" description="Ghi lại quyết định, góp ý hoặc phản hồi của khách hàng cho dự án." />
          </div>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {notes.map((n) => (
                <motion.li
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="group rounded-2xl border bg-card p-4 shadow-card"
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={n.author.name} color={n.author.avatarColor} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{n.author.name}</span>
                        <RoleBadge role={n.author.role} />
                        {n.type === "FEEDBACK" ? (
                          <Badge className="bg-primary/10 text-primary">
                            <MessageSquareQuote className="h-3 w-3" /> Phản hồi
                          </Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground">
                            <StickyNote className="h-3 w-3" /> Ghi chú
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground" title={formatDateTime(n.createdAt)}>
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{n.content}</p>
                    </div>
                    {(n.authorId === meId || canManage) && (
                      <button
                        onClick={() => remove(n.id)}
                        className="rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                        aria-label="Xoá"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <form onSubmit={submit} className="order-1 h-fit rounded-2xl border bg-card p-5 shadow-card lg:sticky lg:top-24 lg:order-2">
        <h3 className="font-semibold">Viết ghi chú / phản hồi</h3>
        <p className="mt-1 text-xs text-muted-foreground">Mọi thành viên dự án đều xem được.</p>
        <Segmented
          layoutId="note-type"
          className="mt-4 w-full [&>button]:flex-1"
          value={type}
          onChange={setType}
          options={[
            { value: "FEEDBACK", label: <><MessageSquareQuote className="h-3.5 w-3.5" /> Phản hồi</> },
            { value: "NOTE", label: <><StickyNote className="h-3.5 w-3.5" /> Ghi chú</> },
          ]}
        />
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={type === "FEEDBACK" ? "Góp ý, đánh giá chất lượng, phản hồi khách hàng…" : "Quyết định, thông tin quan trọng, biên bản họp…"}
          className="mt-3 min-h-[120px]"
        />
        <Button type="submit" className="mt-3 w-full" loading={busy} disabled={!content.trim()}>
          <Send className="h-4 w-4" /> Đăng
        </Button>
      </form>
    </div>
  );
}
