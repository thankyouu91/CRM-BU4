"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Flag, ListChecks, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client";
import { PRIORITY, TASK_STATUS } from "@/lib/constants";
import { zonedDayEdge } from "@/lib/work-report";

export interface BulkResult {
  updated: number;
  unchanged: number;
  skipped: { id: string; title: string | null; reason: string }[];
}

type Patch = { assigneeId?: string | null; dueDate?: string | null; status?: string; priority?: string };

const field = "h-9 rounded-lg border bg-card px-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-50";

/** Summary of a bulk change, with the reasons for skipped tasks. */
export function bulkMessage(r: BulkResult): { ok: string; skipped: string | null } {
  const parts = [`Đã sửa ${r.updated} công việc`];
  if (r.unchanged) parts.push(`${r.unchanged} việc đã đúng sẵn`);
  const reasons = new Map<string, number>();
  for (const s of r.skipped) reasons.set(s.reason, (reasons.get(s.reason) ?? 0) + 1);
  return {
    ok: parts.join(" · "),
    skipped: r.skipped.length ? `Bỏ qua ${r.skipped.length}: ${[...reasons].map(([reason, n]) => `${reason} (${n})`).join("; ")}` : null,
  };
}

/**
 * Bar shown while tasks are selected: give them to someone, set a deadline, a status or
 * a priority in one step. The server applies each person's rights and says what it skipped.
 */
export function BulkBar({ ids, onDone, onClear }: { ids: string[]; onDone: () => void; onClear: () => void }) {
  const [people, setPeople] = useState<{ id: string; name: string; jobTitle: string | null }[] | null>(null);
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api<{ users: { id: string; name: string; jobTitle: string | null; active: boolean }[] }>("/api/users")
      .then((r) => live && setPeople(r.users.filter((u) => u.active)))
      .catch(() => live && setPeople([]));
    return () => {
      live = false;
    };
  }, []);

  const apply = async (patch: Patch, what: string) => {
    setBusy(true);
    try {
      const r = await api<BulkResult>("/api/tasks/bulk", { method: "POST", body: { ids, patch } });
      const msg = bulkMessage(r);
      if (r.updated || !r.skipped.length) toast.success(`${what}: ${msg.ok}`, { description: msg.skipped ?? undefined, duration: msg.skipped ? 8000 : 4000 });
      else toast.error(`${what}: không sửa được công việc nào`, { description: msg.skipped ?? undefined, duration: 8000 });
      setDue("");
      onDone();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thể sửa hàng loạt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="region" aria-label="Sửa hàng loạt" className="sticky bottom-3 z-20 mt-4 rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-pop backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-1 flex items-center gap-1.5 text-sm font-semibold">
          <ListChecks className="h-4 w-4 text-primary" /> Đã chọn {ids.length}
        </p>
        <label className="flex items-center gap-1.5">
          <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
          <select
            aria-label="Giao cho"
            className={field}
            disabled={busy || !people}
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              const name = v === "none" ? null : people?.find((p) => p.id === v)?.name;
              void apply({ assigneeId: v === "none" ? null : v }, v === "none" ? "Bỏ người phụ trách" : `Giao cho ${name}`);
            }}
          >
            <option value="">{people ? "Giao cho…" : "Đang tải…"}</option>
            {people?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.jobTitle ? ` · ${p.jobTitle}` : ""}
              </option>
            ))}
            <option value="none">Bỏ người phụ trách</option>
          </select>
        </label>
        <span className="flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
          <input type="date" aria-label="Deadline mới" value={due} onChange={(e) => setDue(e.target.value)} disabled={busy} className={field} />
          <Button size="sm" variant="secondary" disabled={busy || !due} onClick={() => apply({ dueDate: zonedDayEdge(due, "end") }, "Đặt deadline")}>
            Đặt deadline
          </Button>
        </span>
        <select
          aria-label="Đổi trạng thái"
          className={field}
          disabled={busy}
          value=""
          onChange={(e) => e.target.value && apply({ status: e.target.value }, `Chuyển sang “${TASK_STATUS[e.target.value as keyof typeof TASK_STATUS].label}”`)}
        >
          <option value="">Trạng thái…</option>
          {Object.entries(TASK_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5">
          <Flag className="h-4 w-4 text-muted-foreground" aria-hidden />
          <select
            aria-label="Đổi ưu tiên"
            className={field}
            disabled={busy}
            value=""
            onChange={(e) => e.target.value && apply({ priority: e.target.value }, `Ưu tiên “${PRIORITY[e.target.value as keyof typeof PRIORITY].label}”`)}
          >
            <option value="">Ưu tiên…</option>
            {Object.entries(PRIORITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear} disabled={busy}>
          <X className="h-4 w-4" /> Bỏ chọn
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Chỉ sửa được việc bạn có quyền; người phụ trách phải là thành viên của dự án. Mọi thay đổi được ghi vào nhật ký.</p>
    </div>
  );
}
